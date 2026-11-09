# Harness Plugin Protocol v1 (draft)

This document is the contract between the Harness host and plugins. A plugin that follows it works without importing any harness library. Status: **draft**; the field names and semantics here are what [tasks/plan.md](tasks/plan.md) implements. Items marked **[M2]** are specified now but implemented in milestone M2.

## 1. Model

A plugin is a directory containing `harness-plugin.json` at its root. The manifest declares zero or more **contributions**:

| Contribution | What it adds to the host | Runs code? | Contract |
|---|---|---|---|
| `mcpServers` | Tools the agent and the user can call | Yes, as a long-lived process per session | MCP over stdio (any spec revision the official SDKs negotiate: 2025-06-18, 2025-11-25, 2026-07-28) |
| `hooks` | Interception of host lifecycle events: allow, deny or ask for tool calls; rewrite inputs and outputs; inject context | Yes, as a short-lived process per event | §6.2: a compatible subset of Claude Code's command-hook format (JSON on stdin, JSON on stdout) |
| `commands` [M2] | Slash commands that expand to a prompt for the agent | No | Markdown file with front-matter (§7) |
| `config` | A settings schema the host prompts for, validates, stores and injects | No | JSON Schema 2020-12 (§4) |
| `permissions` | Declared access, shown at consent and enforced when sandboxing is on [M4] | No | §5 |

The host itself contributes nothing. With no plugins enabled, the agent has no tools.

## 2. Directory layout

```
my-plugin/
├─ harness-plugin.json      required
├─ README.md                recommended; shown by `harness plugin inspect --readme`
├─ server.py | server.mjs   any code your mcpServers/hooks commands run
├─ hooks/ or dist/          hook scripts (Node hooks: one bundled file, see below)
└─ commands/                [M2] one Markdown file per command
```

Every path in the manifest is relative to the plugin root and must resolve inside it. Symlinks escaping the root are rejected at validation.

**No install step.** The host never runs `npm install`, `pip install` or any package script inside a plugin. Node code ships either dependency-free or bundled into a single file (for example `esbuild --bundle --platform=node --format=esm`). The reference `guard` bundles `secretlint` and `picomatch` into one 247 KB file this way. Python code declares its dependencies in a PEP 723 header and runs through `uv run --script`, which builds and caches the environment on first use. Plugins installed from npm are extracted with install scripts disabled.

## 3. Manifest reference

| Field | Type | Required | Meaning |
|---|---|---|---|
| `$schema` | string | no | `https://harness.dev/schema/plugin-v1.json` for editor autocomplete; ignored by the host |
| `apiVersion` | integer | **yes** | Must be `1`. Hosts reject versions they do not support with `unsupported apiVersion N (host supports 1)` |
| `name` | string | **yes** | Kebab-case, 2–40 chars, `^[a-z][a-z0-9-]*[a-z0-9]$`. Unique per installation and used as the namespace for tools and commands |
| `version` | string | **yes** | SemVer |
| `description` | string | no | One sentence shown in `plugin list` |
| `author`, `license`, `homepage`, `repository`, `keywords` | various | no | Display only |
| `config` | JSON Schema object | no | §4 |
| `permissions` | object | no | §5. Omitted means "declares nothing", which the consent screen displays as such |
| `mcpServers` | object | no | Map of server id to `{ command, args?, env?, cwd?, startupTimeoutMs? }`. §6.1 |
| `hooks` | array | no | List of `{ event, match?, command, args?, timeout?, onError? }`. §6.2 |
| `commands` | object | no [M2] | Map of command name to `{ file, description? }`. §7 |
| `priority` | integer | no | Hook ordering, lower runs first, default `100` |

Unknown top-level fields produce a **warning**; `harness plugin validate --strict` turns warnings into errors. Unknown fields inside `mcpServers` entries, `hooks` entries, `permissions` and `commands` are **errors**.

## 4. Variables, config and secrets

### 4.1 Substitution variables

Strings in `mcpServers.*.command/args/env/cwd`, `hooks[].command/args` and `permissions.filesystem[].path` may contain:

| Variable | Value |
|---|---|
| `${plugin.root}` | Absolute path of the installed plugin directory |
| `${plugin.data}` | A persistent, writable directory reserved for this plugin (`$HARNESS_HOME/data/<name>`) |
| `${plugin.name}` | The plugin name |
| `${harness.home}` | Absolute `HARNESS_HOME` |
| `${config.<key>}` | The resolved config value (top-level keys only). Arrays and objects are JSON-encoded. `~` at the start of a `format: "path"` value is expanded |
| `${env.<NAME>}` | The user's environment variable `NAME`, **only if** `NAME` is listed in `permissions.env` |

An unknown variable is a validation error. Substitution is textual and happens once, before spawning, with no recursive expansion. Replacement values are inserted literally, so a value containing `$&` or `${...}` is never re-interpreted. Commands are always spawned as argument arrays, never through a shell, so values with spaces are safe.

### 4.2 Config schema

`config` is a JSON Schema 2020-12 object schema with `type: "object"` and `properties`. The host applies `default`s, validates on every `set` and before every start, and refuses to start a plugin whose config is invalid (it shows the missing or invalid keys). Supported annotations that drive prompts and forms: `title`, `description`, `default`, `enum`, `format: "path"`, and the harness keyword **`x-secret: true`**.

Secret values are masked in all output and never written to `registry.json` or the plain config file. In the MVP they are stored in an owner-only (`0600`) file, `config/<plugin>.secrets.json`. From M2 they go to the OS keychain, with that file as the fallback on headless systems. Alternatively, a user can point a secret at an environment variable that the plugin declares in `permissions.env`.

### 4.3 How a plugin receives its config

Every process the host spawns for a plugin receives:

| Environment variable | Content |
|---|---|
| `HARNESS_PLUGIN_NAME` | The plugin name |
| `HARNESS_PLUGIN_ROOT` | Same as `${plugin.root}` |
| `HARNESS_PLUGIN_DATA` | Same as `${plugin.data}` |
| `HARNESS_PLUGIN_CONFIG` | The full resolved config as JSON, secrets included, **only this plugin's** |
| `HARNESS_PROTOCOL` | `1` |
| `CLAUDE_PLUGIN_ROOT`, `CLAUDE_PLUGIN_DATA` | Hook processes only: aliases of `HARNESS_PLUGIN_ROOT` and `HARNESS_PLUGIN_DATA`, so hook scripts written for Claude Code plugins find their files |

plus a minimal inherited base (`PATH`, `HOME`, `USER`, `LOGNAME`, `SHELL`, `TERM`, `LANG`, `LC_*`, `TMPDIR`, and on Windows `SystemRoot`, `APPDATA`, `USERPROFILE`), plus any `env` entries the manifest sets explicitly. Nothing else from the user's shell is inherited. (In the MVP, MCP servers are started with the official SDK transport, which also passes its own small default set of variables. M4 replaces it with a transport that applies exactly this allow-list.)

## 5. Permissions

```json
"permissions": {
  "filesystem": [{ "path": "${config.notesDir}", "access": "read" | "read-write" }],
  "network": false | true | ["api.example.com", "*.example.org"],
  "env": ["GITHUB_TOKEN"],
  "exec": false
}
```

In v1, permissions are **declarations**. They are shown on the consent screen at install, enable and update, and a change in the permission set (compared by hash) requires fresh consent. `env` is enforced in every mode, because undeclared variables are not passed. With `sandbox: true` in host config [M4], the host runs plugin processes under Anthropic's `srt` sandbox. `filesystem` paths become the write allow-list, `network` becomes the domain allow-list, and a missing declaration means deny.

## 6. Runtime contracts

### 6.1 Tools: `mcpServers`

```json
"mcpServers": {
  "notes": {
    "command": "uv",
    "args": ["run", "--quiet", "--script", "${plugin.root}/server.py"],
    "env": { "NOTES_DIR": "${config.notesDir}" },
    "startupTimeoutMs": 10000
  }
}
```

The host starts each server over stdio with the official MCP client at the first session that needs tools (or at `inspect --live`), lists its tools, and stops it when the session ends. Rules for server authors:

- **Write protocol messages only to stdout.** Write logs to **stderr**. The host captures stderr to `$HARNESS_HOME/logs/<plugin>.log`.
- **Tool names** must be unique within a plugin, across all its servers. Users see them as `<plugin>.<tool>` (the *qualified name*, also used by hook `match` globs). Models and hook payloads see `mcp__<plugin>__<tool>`, the convention Claude Code uses for MCP tools, so existing hook matchers carry over. Model-facing names must match `^[a-zA-Z0-9_-]{1,64}$`; keep tool names to `[a-zA-Z0-9_-]` and short enough that no rewriting is needed.
- **Tool annotations** (`readOnlyHint`, `destructiveHint`, `idempotentHint`, `openWorldHint`) are passed to hooks and drive the host's default approval policy. Set `destructiveHint: true` on anything that deletes or overwrites.
- **Errors**: return a tool result with `isError: true` and a human-readable text part. Do not crash. The host turns crashes into error results that name the plugin and its log file.
- **Input validation**: the host validates arguments against your `inputSchema` before calling you. You still must not trust paths and must keep your own containment checks.
- **Do not rely on** sampling, roots or logging, which are deprecated in MCP 2026-07-28, or on server-initiated requests. Configuration arrives through the environment.
- **Startup**: the server must answer tool listing within `startupTimeoutMs` (default 10 000). A plugin that fails to start is marked `failed` without affecting others.

### 6.2 Hooks

Hooks use **Claude Code's command-hook wire format** for the five events below: the same event names, stdin field names, `hookSpecificOutput` envelope, exit-code rules and timeout units ([Claude Code hooks reference](https://code.claude.com/docs/en/hooks)). A hook written for Claude Code that uses only these events and fields runs unchanged, and authors can use Claude's documentation as a second reference. This is a compatible **subset**, not an emulation. Other Claude events, HTTP, prompt and agent hook types, `async` hooks and the `defer` decision are not supported.

```json
"hooks": [
  { "event": "PreToolUse",  "match": "**", "command": "node", "args": ["${plugin.root}/dist/guard.mjs"], "timeout": 5, "onError": "deny" },
  { "event": "PostToolUse", "match": "**", "command": "node", "args": ["${plugin.root}/dist/guard.mjs"], "timeout": 5 }
]
```

`command` is an executable resolved on `PATH` and `args` its argument vector (Claude's "exec form"); there is never a shell.

**Events**

| Event | Fires | Can return |
|---|---|---|
| `PreToolUse` | Before every tool call (agent-initiated or `harness tools call`) whose qualified name matches `match` | `hookSpecificOutput.permissionDecision` (`allow` \| `deny` \| `ask`), `permissionDecisionReason`, `updatedInput` |
| `PostToolUse` | After every matching tool call, including error results | `hookSpecificOutput.updatedToolOutput`, `hookSpecificOutput.additionalContext` |
| `SessionStart` [M2] | When a `chat`/`run`/web session begins | `hookSpecificOutput.additionalContext` (added to the system instructions) |
| `UserPromptSubmit` [M2] | When the user sends a message | Top-level `decision: "block"` with `reason`; `hookSpecificOutput.additionalContext` |
| `SessionEnd` [M2] | When the session ends | Nothing (output ignored) |

`match` is a glob over the **qualified** tool name (`notes.*`, `*.write`, `**`), evaluated with picomatch, and applies only to tool events. The default is `**`. Claude Code's own `matcher` field is a regular expression over `tool_name`; it is not accepted here, and the planned importer for Claude plugins [post-v1] translates it.

**Input**: one JSON document on stdin, then stdin is closed.

```json
{
  "session_id": "s_7f3a",
  "cwd": "/Users/me/work",
  "hook_event_name": "PreToolUse",
  "tool_name": "mcp__notes__write",
  "tool_input": { "path": "todo.md", "content": "rotate key sk-abcdef123456" },
  "tool_use_id": "call_01",
  "_harness": {
    "protocol": 1,
    "tool": "notes.write",
    "plugin": "notes",
    "annotations": { "readOnlyHint": false, "destructiveHint": false },
    "interactive": true
  }
}
```

`PostToolUse` adds `tool_response`, the MCP `CallToolResult` (`{ "content": [...], "structuredContent": {...}, "isError": false }`). `UserPromptSubmit` adds `prompt`. `_harness` is a namespaced extension that Claude Code does not send. Hooks that need provenance or MCP annotations read it, and hooks written for Claude Code ignore it. A hook's own config arrives in `HARNESS_PLUGIN_CONFIG` (§4.3), never the tool owner's.

**Output**: zero or one JSON object on stdout, and nothing else on stdout.

```json
{
  "hookSpecificOutput": {
    "hookEventName": "PreToolUse",
    "permissionDecision": "ask",
    "permissionDecisionReason": "guard: notes.write changes data",
    "updatedInput": { "path": "todo.md", "content": "rotate key [REDACTED]" }
  }
}
```

| Exit code | Meaning |
|---|---|
| `0` with empty stdout | No opinion (equivalent to `allow` / unchanged) |
| `0` with JSON | Validated against the event's output schema. Unknown fields are ignored with a warning. `defer` or any other unsupported decision counts as `deny` |
| `2` | `deny` for `PreToolUse`, `block` for `UserPromptSubmit`, ignored for other events. The first 1,000 characters of stderr become the reason; stdout is ignored |
| any other, timeout, or invalid JSON | Hook error: apply `onError` and log it. The default is `deny` for `PreToolUse` and `UserPromptSubmit` (fail-closed) and `allow` for the other events. This is stricter than Claude Code, which continues after a failing hook |

**Ordering and merging**: matching hooks run **sequentially**, ordered by plugin `priority`, then plugin name, then declaration order. Each `PreToolUse` hook sees the `updatedInput` produced by the previous one, and the host re-validates every rewrite against the tool's `inputSchema`. An invalid rewrite is a `deny`. The first `deny` stops the chain. Otherwise the final decision is the most restrictive seen (`deny` > `ask` > `allow`), and all reasons are kept. `PostToolUse` hooks chain `updatedToolOutput` the same way. A final `ask` is shown to the user in interactive sessions with the **effective input after all rewrites**, and that exact input is what runs. In non-interactive sessions `ask` becomes `deny` with the reason `approval required but session is non-interactive`, unless the user passed `--yes`. Each hook runs at most once per tool call, even if a turn is paused for approval and resumed.

**Limits**: `timeout` is in seconds, as in Claude Code. It defaults to 5 and the maximum is 60. On timeout the hook process tree is killed. Hooks for the same event never run concurrently, and tool calls within one turn run one at a time.

### 6.3 The host's own approval policy

Independently of hooks, host config `approvals` is `destructive` (default: ask before tools annotated `destructiveHint: true`), `always`, or `off`. Hook decisions are combined with it using the same precedence. A plugin cannot lower the user's setting: an `allow` from a hook does not skip a host-level `ask`.

## 7. Commands [M2]

```json
"commands": { "digest": { "file": "commands/digest.md", "description": "Summarise notes changed this week" } }
```

```markdown
---
args: [{ name: since, default: "7 days" }]
---
Use the notes tools to find notes modified in the last {{since}} and write a five-bullet digest.
```

Users run them as `/notes:digest` in `chat` or `harness run /notes:digest since="3 days"`. The host renders the template and submits it as the user turn. Commands contain no code.

## 8. Validation and testing

`harness plugin validate <dir>` checks the manifest against `schema/plugin-v1.json`, path containment, variable references (unknown `${...}`, `${env.X}` not declared in `permissions.env`, and `${config.k}` not in the schema), and duplicate tool-name declarations where statically knowable.

`harness plugin test <dir>` [M2] installs the plugin into a temporary home, applies config from `test/config.json` if present, starts its servers, lists tools and checks their names and schemas. It then replays any hook fixtures in `test/hooks/*.json` (each holds `{ "input": {...}, "expect": {...} }`) and reports pass or fail per check. MCP servers can additionally be explored with the MCP Inspector (`uv run mcp dev server.py` for Python).

## 9. Compatibility

Additive changes, such as new optional fields, new events and new variables, keep `apiVersion: 1`. Hosts ignore unknown hook output fields and warn on unknown top-level manifest fields, so newer plugins degrade gracefully on older v1 hosts. Removing or changing the meaning of anything requires `apiVersion: 2`. Hosts that support 2 should keep loading 1.

## 10. Reference plugins

### `notes`: tools, Python

```json
{
  "$schema": "https://harness.dev/schema/plugin-v1.json",
  "apiVersion": 1,
  "name": "notes",
  "version": "0.1.0",
  "description": "Search, read and append to a folder of Markdown notes.",
  "config": {
    "type": "object",
    "required": ["notesDir"],
    "properties": {
      "notesDir":   { "type": "string", "title": "Notes folder", "format": "path" },
      "readOnly":   { "type": "boolean", "default": false },
      "maxResults": { "type": "integer", "default": 10, "minimum": 1, "maximum": 100 }
    }
  },
  "permissions": { "filesystem": [{ "path": "${config.notesDir}", "access": "read-write" }], "network": false },
  "mcpServers": {
    "notes": { "command": "uv", "args": ["run", "--quiet", "--script", "${plugin.root}/server.py"] }
  },
  "commands": { "digest": { "file": "commands/digest.md", "description": "Digest of recently changed notes" } }
}
```

The server is an ordinary MCP server: `MCPServer("notes")` with `@mcp.tool()` functions `search`, `read` and `write`. `write` only appends, so it is annotated `readOnlyHint: false, destructiveHint: false`, because MCP defines appending as an additive update, not a destructive one. It reads `HARNESS_PLUGIN_CONFIG` for `notesDir`, `readOnly` and `maxResults`, and declares its dependencies in a PEP 723 header so `uv` builds the environment on first run. The spike version is in [spike/notes_server.py](spike/notes_server.py).

### `guard`: hooks, Node, no tools

```json
{
  "apiVersion": 1,
  "name": "guard",
  "version": "0.1.0",
  "description": "Policy for any plugin's tools: deny, ask, redact secrets, keep an audit log.",
  "priority": 10,
  "config": {
    "type": "object",
    "properties": {
      "mode":   { "enum": ["enforce", "monitor"], "default": "enforce" },
      "deny":   { "type": "array", "items": { "type": "string" }, "default": [] },
      "ask":    { "type": "array", "items": { "type": "string" }, "default": ["*.delete"] },
      "askOnDestructive": { "type": "boolean", "default": true },
      "redact": { "type": "boolean", "default": true },
      "denyPaths": { "type": "array", "items": { "type": "string" }, "default": ["**/.env", "**/*.pem"] },
      "secretPatterns": { "type": "array", "items": { "type": "string" }, "default": ["sk-[A-Za-z0-9_-]{8,}", "AKIA[0-9A-Z]{16}"] }
    }
  },
  "permissions": { "filesystem": [{ "path": "${plugin.data}", "access": "read-write" }], "network": false },
  "hooks": [
    { "event": "PreToolUse",  "match": "**", "command": "node", "args": ["${plugin.root}/dist/guard.mjs"], "timeout": 3, "onError": "deny" },
    { "event": "PostToolUse", "match": "**", "command": "node", "args": ["${plugin.root}/dist/guard.mjs"], "timeout": 3, "onError": "allow" }
  ]
}
```

`guard.mjs` reads the event from stdin and dispatches on `hook_event_name`. For `PreToolUse` it does three things in order:

1. It checks `deny` globs against `_harness.tool` and `denyPaths` against any `path` argument, exiting 2 with a reason on a match.
2. It checks `ask` globs and `_harness.annotations.destructiveHint`.
3. It redacts secrets in `tool_input` and returns them as `updatedInput`.

For `PostToolUse` it redacts `tool_response` and returns `updatedToolOutput`. Every call appends `{ts, session, event, tool, decision, reasons, redactions}` to `${plugin.data}/audit.jsonl`. In `monitor` mode it always returns `allow` but still logs.

Detection uses `@secretlint/core` with the recommended preset, minus its comment-directive rule, so scanned content cannot switch scanning off. Exact match ranges are used only for rules whose ranges were validated; otherwise the whole value is redacted. The `secretPatterns` regexes cover formats the preset deliberately skips. Matching uses `picomatch`. The source is bundled with esbuild into a single `dist/guard.mjs`, so the installed plugin has no `node_modules`. It never references a specific plugin's tools. A working version is in [spike-libs/plugins/guard](spike-libs/plugins/guard/).

### `wrap-filesystem`: no code at all [M2]

```json
{
  "apiVersion": 1,
  "name": "wrap-filesystem",
  "version": "0.1.0",
  "description": "The official MCP filesystem server, scoped to one folder.",
  "config": { "type": "object", "required": ["root"], "properties": { "root": { "type": "string", "format": "path" } } },
  "permissions": { "filesystem": [{ "path": "${config.root}", "access": "read-write" }], "network": ["registry.npmjs.org"] },
  "mcpServers": { "fs": { "command": "npx", "args": ["-y", "@modelcontextprotocol/server-filesystem@2.2.0", "${config.root}"] } }
}
```
