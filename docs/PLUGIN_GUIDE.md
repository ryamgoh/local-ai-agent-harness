# Plugin authoring guide

A plugin is a directory with `harness-plugin.json`. You do not import a Harness SDK. The host knows only the manifest, the MCP protocol, and the command-hook wire contract. See [PROTOCOL.md](PROTOCOL.md) for exact fields and supported annotations.

## Add a tool server

Write an ordinary MCP stdio server in your preferred language. For TypeScript/Node use the official `@modelcontextprotocol/server`; for Python use `mcp>=2.3,<3`. Declare input schemas and annotations. stdout is exclusively protocol output; diagnostics belong on stderr. The shipped Python `plugins/notes/server.py` is a complete example with a PEP 723 dependency header.

```json
{
  "apiVersion": 1,
  "name": "my-tools",
  "version": "0.1.0",
  "config": {
    "type": "object",
    "properties": { "directory": { "type": "string", "format": "path" } },
    "required": ["directory"]
  },
  "permissions": {
    "filesystem": [{ "path": "${config.directory}", "access": "read-write" }],
    "network": false
  },
  "mcpServers": {
    "main": {
      "command": "uv",
      "args": ["run", "--quiet", "--script", "${plugin.root}/server.py"]
    }
  }
}
```

Read your own config from JSON in `HARNESS_PLUGIN_CONFIG`. `HARNESS_PLUGIN_DATA` is your writable persistent directory. Treat all tool arguments as untrusted even though the host validates their schema: resolve paths, reject traversal and escaping symlinks, and do not use a shell. Prefer `readOnlyHint: true` for reads and set `destructiveHint: true` for deletion or replacement. The host supports servers that the official client can negotiate across legacy and current MCP revisions.

## Add a policy hook

A hook runs once per matching event. Read one JSON document from stdin until EOF. Return zero or one JSON object on stdout. For `PreToolUse`, return `hookSpecificOutput.permissionDecision`, an optional reason, and optional `updatedInput`. For `PostToolUse`, return `updatedToolOutput` and/or `additionalContext`. The manifest uses a qualified-name glob in `match` and a timeout in **seconds**.

```json
{
  "apiVersion": 1,
  "name": "my-policy",
  "version": "0.1.0",
  "priority": 10,
  "hooks": [
    {
      "event": "PreToolUse",
      "match": "*.delete",
      "command": "node",
      "args": ["${plugin.root}/hook.mjs"],
      "timeout": 2,
      "onError": "deny"
    }
  ]
}
```

For example, `hook.mjs` can be dependency-free:

```js
let raw = '';
for await (const chunk of process.stdin) raw += chunk;
const event = JSON.parse(raw);
console.log(
  JSON.stringify({
    hookSpecificOutput: {
      hookEventName: event.hook_event_name,
      permissionDecision: 'ask',
      permissionDecisionReason: 'Please review the deletion.',
    },
  }),
);
```

Tool-event inputs include `session_id`, `cwd`, `hook_event_name`, `tool_name`, `tool_input`, `tool_use_id`, and `_harness`. `tool_name` is model-facing; `_harness.tool` is the qualified user-facing name and `_harness.annotations` holds MCP annotations. A post-tool event additionally has `tool_response`. Owner config arrives only in the hook process environment, not in another plugin's payload.

Empty stdout with exit 0 means no opinion. Exit 2 denies pre-tool execution. Other exit codes, timeout, malformed output, or invalid envelopes apply `onError`; pre-tool errors deny by default. Unsupported decisions, including `defer`, deny. A hook cannot lower the host's own approval policy. If your hook writes an audit, store metadata only and redact sensitive values before any diagnostic output.

The protocol schema recognizes `SessionStart`, `UserPromptSubmit`, `SessionEnd`, and `commands` for forward compatibility, but those lifecycle contributions do **not execute in this MVP**. They are M2 tasks. Only tool-event hooks are live here.

## Package and validate

Node plugins must be dependency-free or ship a bundled executable. The shipped guard builds a standalone `dist/guard.mjs` with esbuild; the installed plugin requires no `node_modules`. Development-only folders are excluded during installation, but every referenced script/path must still remain within the plugin root. Python scripts can use a PEP 723 header and `uv run --script`.

```sh
pnpm harness plugin validate ./my-plugin --strict
pnpm harness plugin install ./my-plugin --link
pnpm harness plugin config my-plugin
pnpm harness plugin inspect my-plugin --live
pnpm harness tools list --json
pnpm harness tools call my-plugin.some-tool --input '{}'
```

The name must match `^[a-z][a-z0-9-]*[a-z0-9]$` and have 2–40 characters. `version` must be SemVer and `apiVersion` must be 1. Unknown top-level fields warn; unknown nested contribution fields fail validation. `${env.NAME}` requires `NAME` in `permissions.env`; `${config.key}` must be declared in config properties. Substitution is literal and single-pass.

A linked plugin can change implementation code without reinstalling. Changing commands or declared permissions requires reviewing a fresh install plan and using `plugin install --link --force` with renewed consent. Uninstalling a linked plugin removes the host's link, not your source. Host data/logs are retained on uninstall.

## Verification checklist

Use native tests for your server functions and hook script. Validate argument types, path containment, schema defaults, safe errors, hook rewrites, timeout behavior, and redaction. Test both `tools call` and scripted `run` to show the host discovers your contribution rather than using a built-in special case. The MVP does not yet include `plugin new` or `plugin test`; native tests and `plugin validate` are the authoring tools available now.
