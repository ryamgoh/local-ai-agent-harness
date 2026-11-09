# /// script
# requires-python = ">=3.11"
# dependencies = ["mcp>=2.3,<3"]
# ///
"""Ordinary stdio MCP server for an explicitly configured local notes folder."""
import json
import os
import stat
from pathlib import Path

from mcp.server import MCPServer
from mcp.types import ToolAnnotations

mcp = MCPServer("notes", version="0.1.0")


def _config() -> dict:
    try:
        config = json.loads(os.environ.get("HARNESS_PLUGIN_CONFIG", "{}"))
        root = config["notesDir"]
        if not isinstance(root, str) or not root:
            raise ValueError
        if not isinstance(config.get("readOnly", False), bool):
            raise ValueError
        maximum = config.get("maxResults", 10)
        if type(maximum) is not int or not 1 <= maximum <= 100:
            raise ValueError
        return {"root": Path(root).expanduser().resolve(), "readOnly": config.get("readOnly", False), "maxResults": maximum}
    except (KeyError, TypeError, ValueError, OSError, RuntimeError):
        raise ValueError("Invalid notes configuration") from None


def _path(root: Path, path: str) -> Path:
    if not isinstance(path, str) or not path or "\x00" in path or "\\" in path:
        raise ValueError("Invalid note path")
    relative = Path(path)
    if relative.is_absolute() or ".." in relative.parts:
        raise ValueError("Note path must stay inside the notes folder")
    try:
        result = (root / relative).resolve()
    except (OSError, RuntimeError):
        raise ValueError("Invalid note path") from None
    if not result.is_relative_to(root) or result == root:
        raise ValueError("Note path must stay inside the notes folder")
    return result


def _open_note(root: Path, path: str, append: bool = False):
    """Resolve containment, then open beneath root without following swapped symlinks."""
    relative = _path(root, path).relative_to(root)
    directory = None
    descriptor = None
    try:
        directory = os.open(root, os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW)
        for part in relative.parts[:-1]:
            if append:
                try:
                    os.mkdir(part, mode=0o700, dir_fd=directory)
                except FileExistsError:
                    pass
            child = os.open(part, os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW, dir_fd=directory)
            os.close(directory)
            directory = child
        flags = os.O_NOFOLLOW | os.O_NONBLOCK
        flags |= (os.O_WRONLY | os.O_APPEND | os.O_CREAT) if append else os.O_RDONLY
        descriptor = os.open(relative.name, flags, mode=0o600, dir_fd=directory)
        if not stat.S_ISREG(os.fstat(descriptor).st_mode):
            raise ValueError("Note must be a regular file")
        stream = os.fdopen(descriptor, "a" if append else "r", encoding="utf-8")
        descriptor = None
        return stream
    except OSError:
        raise ValueError("Unable to access note safely") from None
    finally:
        if descriptor is not None:
            os.close(descriptor)
        if directory is not None:
            os.close(directory)


@mcp.tool(annotations=ToolAnnotations(readOnlyHint=True, destructiveHint=False, idempotentHint=True, openWorldHint=False))
def search(query: str, limit: int | None = None) -> list[dict]:
    """Find case-insensitive matching Markdown lines, with relative paths and 1-based line numbers."""
    config = _config()
    if not isinstance(query, str):
        raise ValueError("Query must be a string")
    if limit is not None and (type(limit) is not int or limit < 1):
        raise ValueError("Limit must be a positive integer")
    maximum = min(config["maxResults"], limit) if limit is not None else config["maxResults"]
    matches = []
    root = config["root"]
    for file in sorted(root.rglob("*.md")):
        relative = file.relative_to(root).as_posix()
        try:
            with _open_note(root, relative) as stream:
                text = stream.read()
        except (ValueError, OSError, UnicodeError):
            continue
        for number, line in enumerate(text.splitlines(), 1):
            if query.casefold() in line.casefold():
                matches.append({"path": relative, "line": number, "text": line})
                if len(matches) == maximum:
                    return matches
    return matches


@mcp.tool(annotations=ToolAnnotations(readOnlyHint=True, destructiveHint=False, idempotentHint=True, openWorldHint=False))
def read(path: str) -> str:
    """Read a UTF-8 note inside the configured folder."""
    with _open_note(_config()["root"], path) as stream:
        return stream.read()


@mcp.tool(annotations=ToolAnnotations(readOnlyHint=False, destructiveHint=False, idempotentHint=False, openWorldHint=False))
def write(path: str, content: str) -> str:
    """Append content and a trailing newline, creating a note if absent; never overwrite."""
    config = _config()
    if config["readOnly"]:
        raise ValueError("Notes are read-only")
    if not isinstance(content, str):
        raise ValueError("Content must be a string")
    with _open_note(config["root"], path, append=True) as stream:
        stream.write(content if content.endswith("\n") else content + "\n")
    return f"Appended to {path}"


if __name__ == "__main__":
    _config()
    mcp.run(transport="stdio")
