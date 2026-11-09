# Notes plugin

An ordinary Python MCP server exposing `notes.search`, `notes.read` and `notes.write` over stdio. It imports no Harness code. Python 3.11+ and `uv` are required. Its PEP 723 header declares `mcp>=2.3,<3`; `uv` resolves and caches that dependency on first startup. No package installation or install script is run inside the installed plugin.

## Install and configure

From a built Harness checkout:

```sh
pnpm harness plugin install ./plugins/notes --yes
pnpm harness plugin config notes set 'notesDir=~/My Notes' readOnly=false maxResults=10
pnpm harness tools call notes.search --input '{"query":"offsite","limit":2}'
pnpm harness tools call notes.read --input '{"path":"todo.md"}'
pnpm harness tools call notes.write --input '{"path":"todo.md","content":"Plan the offsite"}'
```

Create the notes directory beforehand. The host expands `~` in the path setting and injects resolved settings only through `HARNESS_PLUGIN_CONFIG`. Spaces remain intact. The server also supports `~` for direct invocation. `notesDir` is required; `readOnly` defaults to `false`; `maxResults` defaults to `10` and must be an integer from 1 through 100. The server independently validates those settings without including configuration values in errors.

## Tool behavior

| Tool | Input | Result |
| --- | --- | --- |
| `search` | `query: str`, optional `limit: int \| None` | List of `{path, line, text}` objects. Paths are relative; line numbers are 1-based. |
| `read` | `path: str` | Complete UTF-8 text. |
| `write` | `path: str`, `content: str` | A short append confirmation; no absolute configuration path. |

Search is a case-insensitive substring search of `*.md` files, in stable path order. Each matching line is a result. Its effective limit is the smaller of a positive requested limit and `maxResults`; an omitted limit uses `maxResults`. Unreadable, non-UTF-8, non-regular, or escaping files are skipped. Read and write accept relative file paths within the configured root, not just `.md` filenames.

Write creates missing relative parent directories and files, uses append mode only, and adds a newline unless the supplied content already ends with one. Existing content is never overwritten. `readOnly=true` rejects writes before creating anything. `search` and `read` advertise `readOnlyHint=true`; additive `write` advertises `readOnlyHint=false`, `destructiveHint=false`, and `idempotentHint=false`. All tools advertise `openWorldHint=false`.

Absolute paths, `..` components, backslashes, null bytes, and the directory itself are rejected. Resolved symlinks must remain inside the root. Opens are anchored to directory descriptors with `O_NOFOLLOW`, protecting against a symlink replacement after validation. Contained symlinks are allowed; escaping symlinks are rejected. FIFOs and other non-regular files are rejected rather than blocking the server. These checks target macOS and Linux; they are not a replacement for OS sandboxing or protection from a hostile process moving already-open directories or creating hardlinks.

Tool failures raise safe exceptions; MCP converts them to error tool results without crashing the server. Stdout is reserved for MCP messages. No network calls are made by tools. Dependency resolution on first `uv` startup can access the package index; after warming the cache, `UV_OFFLINE=1` prevents that too.

## Test and inspect

Run from the workspace root:

```sh
uv run --with pytest --with 'mcp>=2.3,<3' pytest plugins/notes/tests -q
pnpm harness plugin validate plugins/notes
```

The pytest suite calls registered functions directly and checks configuration, limit handling, append semantics, annotations, traversal, symlink escapes and swaps, and FIFO rejection. Outbound socket connections are blocked in tests. Every test uses a temporary home and notes folder. The protocol owns the interface, so the host has no notes-specific code. The optional `digest` command is deferred to M2 and is not declared in this MVP manifest.
