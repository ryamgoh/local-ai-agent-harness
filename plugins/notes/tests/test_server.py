"""Direct-function contract tests; no host or network is needed."""
import importlib.util
import json
import socket
from pathlib import Path

import pytest

spec = importlib.util.spec_from_file_location("notes_server", Path(__file__).parents[1] / "server.py")
server = importlib.util.module_from_spec(spec)
spec.loader.exec_module(server)


@pytest.fixture(autouse=True)
def no_network(monkeypatch):
    original = socket.socket.connect

    def connect(sock, address):
        if sock.family != socket.AF_UNIX:
            raise AssertionError("Plugin tests must not use the network")
        return original(sock, address)

    monkeypatch.setattr(socket.socket, "connect", connect)


@pytest.fixture
def notes(tmp_path, monkeypatch):
    root = tmp_path / "My Notes"
    root.mkdir()
    monkeypatch.setenv("HARNESS_HOME", str(tmp_path / "home"))
    monkeypatch.setenv("HARNESS_PLUGIN_CONFIG", json.dumps({"notesDir": str(root)}))
    (root / "test.md").write_text("line one\nline two\nline three\n", encoding="utf-8")
    return root


def test_search_respects_limit(notes):
    assert server.search("line", limit=2) == [
        {"path": "test.md", "line": 1, "text": "line one"},
        {"path": "test.md", "line": 2, "text": "line two"},
    ]


def test_read_rejects_traversal(notes):
    with pytest.raises(ValueError):
        server.read("../secret.txt")


def test_write_appends_and_creates(notes):
    server.write("todo.md", "a")
    server.write("todo.md", "b")
    assert (notes / "todo.md").read_text() == "a\nb\n"


def test_read_only_blocks_write(notes, monkeypatch):
    monkeypatch.setenv("HARNESS_PLUGIN_CONFIG", json.dumps({"notesDir": str(notes), "readOnly": True}))
    with pytest.raises(ValueError, match="read.only"):
        server.write("x.md", "y")
    assert not (notes / "x.md").exists()


def test_search_caps_requested_limit_at_configured_maximum(notes, monkeypatch):
    monkeypatch.setenv("HARNESS_PLUGIN_CONFIG", json.dumps({"notesDir": str(notes), "maxResults": 1}))
    assert len(server.search("line", limit=99)) == 1
    assert len(server.search("LINE")) == 1


@pytest.mark.parametrize("path", ["../test.md", "/etc/passwd", "a/../../escape.md", "a\\..\\escape.md", "", ".", "bad\x00.md"])
def test_paths_reject_invalid_input(notes, path):
    for function, args in [(server.read, (path,)), (server.write, (path, "text"))]:
        with pytest.raises(ValueError):
            function(*args)


def test_symlink_escape_is_rejected_and_not_searched(notes, tmp_path):
    outside = tmp_path / "outside"
    outside.mkdir()
    (outside / "private.md").write_text("line confidential\n")
    (notes / "linked.md").symlink_to(outside / "private.md")
    (notes / "linked-dir").symlink_to(outside, target_is_directory=True)
    for path in ["linked.md", "linked-dir/private.md", "linked-dir/new.md"]:
        with pytest.raises(ValueError):
            server.write(path, "bad")
    for path in ["linked.md", "linked-dir/private.md"]:
        with pytest.raises(ValueError):
            server.read(path)
    assert [row["path"] for row in server.search("confidential")] == []
    assert (outside / "private.md").read_text() == "line confidential\n"
    assert not (outside / "new.md").exists()


def test_write_creates_nested_note_and_preserves_existing_newline(notes):
    server.write("folder/new.md", "one\n")
    server.write("folder/new.md", "two")
    assert server.read("folder/new.md") == "one\ntwo\n"


def test_search_skips_non_markdown_and_non_regular_files(notes):
    (notes / "hidden.txt").write_text("line hidden")
    (notes / "directory.md").mkdir()
    assert len(server.search("line")) == 3


def test_notes_never_reads_a_fifo(notes):
    import os
    os.mkfifo(notes / "pipe.md")
    with pytest.raises(ValueError, match="regular"):
        server.read("pipe.md")


@pytest.mark.parametrize("extra", [{"maxResults": 0}, {"maxResults": 101}, {"maxResults": True}, {"readOnly": "false"}])
def test_invalid_config_fails_without_exposing_values(notes, monkeypatch, extra):
    monkeypatch.setenv("HARNESS_PLUGIN_CONFIG", json.dumps({"notesDir": str(notes), "private": "config-sentinel", **extra}))
    with pytest.raises(ValueError, match="Invalid notes configuration") as error:
        server.search("line")
    assert "config-sentinel" not in str(error.value)


@pytest.mark.parametrize("limit", [0, -1, True, "2"])
def test_invalid_search_limits_are_rejected(notes, limit):
    with pytest.raises(ValueError):
        server.search("line", limit=limit)


def test_tools_have_correct_annotations_and_do_not_expose_config(notes):
    import asyncio
    tools = {tool.name: tool for tool in asyncio.run(server.mcp.list_tools())}
    assert set(tools) == {"search", "read", "write"}
    for name in ["search", "read"]:
        assert tools[name].annotations.model_dump(by_alias=True)["readOnlyHint"] is True
    write_annotations = tools["write"].annotations.model_dump(by_alias=True)
    assert write_annotations["readOnlyHint"] is False
    assert write_annotations["destructiveHint"] is False
    assert write_annotations["idempotentHint"] is False
    assert all(tool.annotations.model_dump(by_alias=True)["openWorldHint"] is False for tool in tools.values())
    assert str(notes) not in server.write("todo.md", "safe")


def test_contained_symlink_is_allowed(notes):
    (notes / "alias.md").symlink_to(notes / "test.md")
    assert server.read("alias.md").startswith("line one")
    server.write("alias.md", "added")
    assert server.read("test.md").endswith("added\n")


def test_symlink_swap_after_validation_cannot_escape(notes, tmp_path, monkeypatch):
    import os
    outside = tmp_path / "outside.md"
    outside.write_text("do not touch\n")
    target = notes / "todo.md"
    target.write_text("safe\n")
    original = os.open
    swapped = False

    def open_with_swap(path, flags, mode=0o777, *, dir_fd=None):
        nonlocal swapped
        if path == "todo.md" and dir_fd is not None and not swapped:
            target.unlink()
            target.symlink_to(outside)
            swapped = True
        return original(path, flags, mode, dir_fd=dir_fd)

    monkeypatch.setattr(os, "open", open_with_swap)
    with pytest.raises(ValueError):
        server.write("todo.md", "unsafe")
    assert swapped
    assert outside.read_text() == "do not touch\n"


def test_symlink_loop_is_a_safe_tool_error(notes):
    (notes / "loop.md").symlink_to(notes / "loop.md")
    with pytest.raises(ValueError):
        server.read("loop.md")


@pytest.mark.parametrize("raw", ['{invalid', '[]', '{}'])
def test_missing_or_malformed_config_never_discloses_environment(monkeypatch, raw):
    monkeypatch.setenv("HARNESS_PLUGIN_CONFIG", raw)
    with pytest.raises(ValueError, match="Invalid notes configuration"):
        server.search("line")


def test_pep723_uv_server_lists_calls_and_recovers_from_path_errors(notes):
    import asyncio
    import os
    from mcp import Client, StdioServerParameters

    async def exercise():
        params = StdioServerParameters(
            command="uv",
            args=["run", "--quiet", "--offline", "--script", str(Path(__file__).parents[1] / "server.py")],
            env={"PATH": os.environ["PATH"], "HOME": os.environ["HOME"],
                 "HARNESS_HOME": os.environ["HARNESS_HOME"],
                 "HARNESS_PLUGIN_CONFIG": os.environ["HARNESS_PLUGIN_CONFIG"]},
        )
        async with Client(params, read_timeout_seconds=5) as client:
            listing = await client.list_tools()
            assert {tool.name for tool in listing.tools} == {"search", "read", "write"}
            result = await client.call_tool("search", {"query": "line", "limit": 1})
            assert not result.is_error
            assert result.structured_content == {"result": [{"path": "test.md", "line": 1, "text": "line one"}]}
            error = await client.call_tool("read", {"path": "../escape.md"})
            assert error.is_error
            written = await client.call_tool("write", {"path": "stdio.md", "content": "via MCP"})
            assert not written.is_error
            read_result = await client.call_tool("read", {"path": "stdio.md"})
            assert not read_result.is_error
            assert read_result.content[0].text == "via MCP\n"
            assert str(notes) not in json.dumps(listing.model_dump(by_alias=True))

    asyncio.run(exercise())
    assert (notes / "stdio.md").read_text() == "via MCP\n"
