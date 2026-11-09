# Spec: Harness, a local AI agent harness with plugins

Status: **draft for review**. Working name: "Harness", CLI `harness`. Companion documents: [PLANNING.md](PLANNING.md) (rationale), [PROTOCOL-v1-draft.md](PROTOCOL-v1-draft.md) (plugin contract), [tasks/plan.md](tasks/plan.md) (implementation plan).

## Assumptions

1. The host is TypeScript on Node.js 22.22.2 or later and uses ESM only. That floor is set by `pacote` and `npm-package-arg`. Plugins may be written in any language.
2. The product is a CLI first (MVP), then a local web UI served by the same process. There is no desktop app in v1.
3. Models are reached through an OpenAI-compatible endpoint (Ollama, LM Studio, vLLM or OpenAI) or through Anthropic's API. Automated tests use a scripted mock model and never touch the network.
4. Plugins are trusted only after the user consents. OS-level sandboxing is opt-in (M4). Until then, declared permissions drive consent and approvals, not enforcement.
5. Targets are macOS and Linux, with a Windows smoke test in M4.
6. All state lives under `HARNESS_HOME`, which defaults to `~/.harness`.

## Objective

Build a local agent harness whose capabilities come entirely from plugins. There are two kinds of user.

**Users** (people running the agent):

- U1. Install a plugin from a local folder (MVP), or from git or npm (M2), and see exactly what it will run and what it claims to access before agreeing.
- U2. List installed plugins and inspect any one of them: metadata, source, permissions, config status with secrets masked, contributed tools, hooks and commands, health and log location.
- U3. Configure a plugin through prompts generated from its schema (CLI) or a generated form (web), with validation and defaults.
- U4. Enable or disable a plugin without uninstalling it. Disabled plugins never start and contribute nothing.
- U5. Run plugins three ways: let the agent call their tools in `chat` or `run`; call a tool directly; or run a plugin command (M2).
- U6. Approve or deny risky tool calls when a policy asks. In non-interactive runs, an `ask` becomes a denial.

**Plugin developers:**

- D1. Write a plugin in any language by following a versioned protocol, without importing a harness SDK.
- D2. Validate a plugin (`plugin validate`) and run a conformance test (`plugin test`, M2) locally.
- D3. Start from a template (`plugin new`, M2) and iterate without reinstalling (`install --link`).

Success means that the two shipped plugins, `notes` and `guard`, and a third no-code wrapper of an existing MCP server (M2) add capabilities with no change to the host. Automated tests prove it (see Success Criteria).

## Tech Stack

- Runtime: Node.js ≥ 22.22.2, TypeScript 5 (strict), pnpm workspaces. Library choices and the reasons for them are in [LIBRARIES.md](LIBRARIES.md).
- MCP: `@modelcontextprotocol/client` ^2.4 (stdio transport). Plugin templates use `@modelcontextprotocol/server` ^2.4 (TypeScript) or `mcp` ^2.3 (Python ≥ 3.11 via `uv`).
- Agent loop: `ai` ^7 (`ToolLoopAgent`, `dynamicTool`, `jsonSchema`), `@ai-sdk/openai-compatible`, `@ai-sdk/openai` and `@ai-sdk/anthropic`. Tests use `ai/test` (`MockLanguageModelV4`).
- Schemas: `zod` ^4 for the manifest (exported as JSON Schema 2020-12) and `ajv` ^8 (2020 dialect) plus `ajv-formats` for plugin config schemas.
- CLI: `commander` ^15, `@inquirer/prompts` ^8, `picocolors`.
- Utilities: `env-paths` ^4, `picomatch` ^4, `execa`, `proper-lockfile` ^4 (M3), `simple-git` ^4 (M2), `@napi-rs/keyring` ^2 (M2).
- Web (M3): `hono` ^4, React 19, Vite, `@rjsf/core` ^6 with `@rjsf/validator-ajv8`.
- Sandbox (M4, opt-in): `@anthropic-ai/sandbox-runtime` (`srt`).
- Tests: `vitest` ^5 (unit and end-to-end via `execa`), `pytest` for the Python plugin, `node:test` for the guard plugin.

## Commands

Development:

```
pnpm install
pnpm build                      # tsc -b for all packages
pnpm test                       # vitest run (unit + integration + e2e with mock model)
pnpm test:e2e                   # vitest run test/e2e
pnpm lint                       # eslint + prettier --check
pnpm --filter @harness/cli dev  # tsx watch packages/cli/src/index.ts
uv run --with pytest pytest plugins/notes/tests
node --test plugins/guard/test
```

Product CLI surface (v1; **[M2]** and **[M3]** mark later milestones):

```
harness plugin install <path> [--link] [--yes] [--no-enable]      # git/npm sources [M2]
harness plugin uninstall <name>
harness plugin list [--json]
harness plugin inspect <name> [--json] [--live]
harness plugin enable <name> | disable <name>
harness plugin config <name> [get [key] | set key=value ... | unset key]   # no subcommand = interactive
harness plugin validate <dir> [--strict]
harness plugin update <name> | --all                               [M2]
harness plugin new <dir> --template mcp-node|mcp-python|hook-node  [M2]
harness plugin test <dir>                                          [M2]
harness plugin logs <name> [-f]                                    [M2]
harness tools list [--json]
harness tools call <plugin.tool> --input '<json>' [--yes]
harness chat                                  # REPL: /tools, /plugins, /exit, /<plugin>:<command> [M2]
harness run "<prompt>" [--json] [--yes] [--max-steps 20]
harness run /<plugin>:<command> [args]                             [M2]
harness config get <key> | set <key> <value>  # model.provider, model.id, model.baseURL, model.apiKeyEnv, approvals
harness doctor                                                     [M2]
harness ui [--port 4111] [--no-open]                               [M3]
```

## Project Structure

```
harness/
├─ packages/
│  ├─ core/            Host engine. No CLI/UI deps and no knowledge of any specific plugin
│  │  └─ src/{manifest,store,config,runtime,hooks,agent}/ + host.ts + index.ts
│  ├─ cli/             commander entry point and renderers for core's TurnEvent stream
│  ├─ plugin-kit/      [M2] hook payload types, conformance runner, templates
│  └─ web/             [M3] Hono server (server/) + React app (app/)
├─ plugins/
│  ├─ notes/           Python MCP server (tools) + commands/ [M2]
│  └─ guard/           Node command hooks (policy, redaction, audit)
├─ examples/wrap-filesystem/   [M2] manifest-only wrapper of @modelcontextprotocol/server-filesystem
├─ schema/plugin-v1.json       Generated from the zod manifest schema (committed, checked in CI)
├─ test/{e2e,fixtures}/        CLI end-to-end tests, fixture plugins, mock-model scripts
└─ docs/{PROTOCOL.md, PLUGIN_GUIDE.md, ARCHITECTURE.md}
```

## Code Style

Named exports only. Errors are typed classes with a stable `code`. Schemas are suffixed `Schema`. Core functions take explicit dependencies instead of reading globals, so tests can pass a temporary `HarnessPaths`.

```ts
export class ManifestError extends Error {
  readonly code = 'MANIFEST_INVALID';
  constructor(readonly dir: string, readonly issues: ManifestIssue[]) {
    super(`Invalid plugin manifest in ${dir}:\n` + issues.map((i) => `  - ${i.path}: ${i.message}`).join('\n'));
  }
}

export async function loadManifest(dir: string): Promise<LoadedManifest> {
  const raw = JSON.parse(await readFile(join(dir, MANIFEST_FILE), 'utf8'));
  const parsed = PluginManifestSchema.safeParse(raw);
  if (!parsed.success) throw new ManifestError(dir, toIssues(parsed.error));
  return { manifest: parsed.data, warnings: unknownTopLevelKeys(raw) };
}
```

Further conventions:

- Files use kebab-case. Functions read as verbs (`loadManifest`, `resolveConfig`).
- Never spawn through a shell; always pass argument arrays.
- Never log secret values.

## Testing Strategy

- **Unit tests** (vitest, `packages/*/test`): manifest validation, variable substitution, config coercion and defaults, registry operations, model-name mapping, and hook merge rules.
- **Integration tests** use real processes but no model. A fixture MCP server (`test/fixtures/plugins/echo`) and fixture hook scripts (allow, deny-exit-2, rewrite, hang, garbage-stdout) exercise the runtime manager and hook engine, including timeouts and crashes.
- **Agent tests** use `MockLanguageModelV4` scripted per test. Each test asserts the tools offered to the model, the tool results the model receives, and the side effects on disk.
- **End-to-end tests** run the built CLI with `execa`, a temporary `HARNESS_HOME` and `HARNESS_MODEL=mock:<script.json>`. These are the "proof" tests in Success Criteria.
- **Plugin tests** live inside each plugin (pytest for `notes`, `node:test` for `guard`). They run in CI alongside the host tests.
- **Coverage:** 80% line coverage for `packages/core`. CI runs on macOS and Linux with Node 22 (at least 22.22.2) and 24, plus a Windows smoke job from M4.

## Boundaries

- **Always:** run `pnpm test` before committing. Keep `schema/plugin-v1.json` regenerated from the zod source. Give every new hook event or manifest field a protocol doc entry and a validation test. Use a temporary `HARNESS_HOME` in tests.
- **Ask first:** adding a runtime dependency to `packages/core` that is not listed in LIBRARIES.md; changing the manifest or hook protocol in a way that is not additive (that requires `apiVersion: 2`); turning on any network listener other than `127.0.0.1`; and changing default approval or fail-closed behaviour.
- **Never:** put plugin-specific code or names in `packages/core` or `packages/cli`; spawn through a shell; pass one plugin's config or secrets to another plugin's process; write outside `HARNESS_HOME` from the core; or skip consent for a new or changed command or permission set.

## Success Criteria

Each criterion is an automated test unless it is marked *manual*.

**Plugin lifecycle (U1–U4)**

1. `plugin install <dir>` on a valid plugin prints every resolved server and hook command in full, plus the declared permissions. Without `--yes`, it exits non-zero when consent is declined. With `--yes`, it records the plugin as enabled in `registry.json`.
2. `plugin install` rejects an invalid manifest with exit code 2 and a list naming each failing field. The fixtures are a bad name, an unknown hook event, `apiVersion: 2`, and a path that escapes the plugin root. Installing a name that is already installed fails unless `--force` is given.
3. `plugin inspect notes --live` lists `notes.search`, `notes.read` and `notes.write` with their input schemas, shows config as valid or with the specific missing keys, masks secret values as `••••`, and prints the log file path.
4. `plugin config notes set readOnly=true maxResults=5` stores a boolean and an integer. `set maxResults=abc` fails with a schema message and leaves the stored config unchanged.
5. After `plugin disable notes`, `tools list` shows no `notes.*` tools and no `notes` process is spawned during `run`. After `enable`, they return.

**Running plugins (U5–U6)**

6. `tools call notes.search --input '{"query":"offsite"}'` prints the tool's structured result. It passes through the same `PreToolUse`/`PostToolUse` hooks as agent-initiated calls.
7. In `run`, a tool named by the model as `mcp__notes__search` resolves to `notes.search`. Every model-facing tool name matches `^[a-zA-Z0-9_-]{1,64}$`.
8. When a hook returns `ask`, `run` without `--yes` in a non-interactive terminal denies the call. The model then receives a tool result containing the reason, and the process never waits on stdin.

**Proof that plugins extend the host**

9. **Zero baseline:** with an empty `HARNESS_HOME`, the mock model's captured request contains 0 tools.
10. **No hardcoding:** `test/architecture.test.ts` fails if any file under `packages/core/src` or `packages/cli/src` imports from `plugins/` or matches `/\b(notes|guard)\b/i`.
11. **Composition:** the mock model calls `notes.write` with content containing `sk-abcdef123456`. With `guard` enabled, the note on disk contains `[REDACTED]` and the guard audit log gains two lines, one for `PreToolUse` and one for `PostToolUse`. With `guard` disabled, the note contains the raw string.
12. **Deny:** with guard config `deny: ["notes.write"]`, the file is untouched and the model receives `blocked by guard: ...`.
13. **No-code plugin [M2]:** the manifest-only `examples/wrap-filesystem` installs and its tools appear as `wrap-filesystem.*`.
14. **Authoring [M2]:** `plugin new hello --template mcp-node`, then `plugin test hello`, then `plugin install --link hello` succeeds, and `hello.greet` is callable.

**Robustness**

15. A plugin server that exits during a call yields an error tool result naming the plugin and its log path. Other plugins' tools still work in the same session.
16. A server that has not answered tool listing within 10 s is marked `failed` in `inspect` and does not block other plugins from starting.
17. A hook that exceeds its `timeout` (in seconds) is killed. Its `onError` policy is applied within the timeout plus 250 ms. With no `onError` set, a timed-out `PreToolUse` hook denies the call.
18. A hook that prints non-JSON to stdout is treated as an error, with `onError` applied and the first 200 characters logged.
19. A tool call whose arguments fail the tool's input schema is not sent to the plugin. The model receives the validation errors as the tool result.

**Product (manual)**

20. On a clean macOS machine with Ollama and a tool-capable model, the MVP demo script in PLANNING.md §9 completes as written.
21. [M3] Every CLI capability except git/npm install is reachable in `harness ui`. An `ask` decision shows approve/deny buttons, and the chosen action takes effect.

## Out of Scope for v1

A plugin marketplace or registry service, plugin-contributed UI panels, model-provider plugins, multi-agent orchestration, hot reload of running plugins, remote (HTTP) MCP servers as plugins, and a desktop app shell.

## Open Questions

1. Is TypeScript the right host language for your team, or should the host be Python? The protocol is unaffected either way.
2. **Resolved (default can still be overridden):** `PreToolUse` and `UserPromptSubmit` hooks now fail closed by default (`onError: "deny"`). The library audit recommended this for permission hooks. It is stricter than Claude Code, which continues after a failing hook. A plugin can opt into `onError: "allow"` for a non-critical hook.
3. Should the host's own default approval policy be `destructive` (ask before tools annotated `destructiveHint`), as drafted, or `off`, leaving all policy to plugins such as `guard`?
4. What is the deadline and the audience? A take-home or demo and a product imply different stopping points (see PLANNING.md §11).
5. Will plugins come from third parties? If so, sandboxing moves from opt-in in M4 to default in M2.
