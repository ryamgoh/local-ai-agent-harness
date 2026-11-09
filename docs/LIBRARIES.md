# Build vs. Borrow: Which Libraries Do the Work

**Short answer:** yes. After a component-by-component audit, every generic concern in the harness maps to a maintained library. What is left to write is product policy: the plugin contract, the hook decision rules, consent and approvals, and the screens. That is roughly **4,500 lines of product code**, against about **14,600** if the same features were written from scratch and about 7,000 in the first version of this plan. A second prototype ([spike-libs/](spike-libs/)) wires the recommended libraries together end to end and passes.

The audit also changed the design in two places, and it found about a dozen traps where the obvious use of a library would have shipped a bug. Both are covered below. All versions and licences were checked against the npm registry on 9 November 2026.

## How this was checked

Eight research agents each took one area of the product, listed the logic we would otherwise hand-write, and evaluated candidates against live registry and GitHub data: version, licence, weekly downloads, last release, open issues, Node and ESM support. Where it mattered, they installed the package and ran a probe, for example feeding secrets to a scanner or checking whether a library actually validates input. Their full reports, with code snippets and rejected alternatives, are in [research/libs/](research/libs/). I then built [spike-libs/](spike-libs/), a 263-line host that uses the recommended set together. Its output is in [spike-libs/run-output.txt](spike-libs/run-output.txt).

## The two design changes

**Hooks now speak Claude Code's wire format.** The first draft invented a hook protocol (`tool.before`, `{ "decision": ... }`) that was nearly identical to the command-hook format Claude Code already documents. The protocol now uses Claude's event names (`PreToolUse`, `PostToolUse`, `SessionStart`, `UserPromptSubmit`, `SessionEnd`), its stdin fields (`hook_event_name`, `tool_name`, `tool_input`, `tool_response`), its `hookSpecificOutput` envelope, its exit-code rules, and its timeouts in seconds. Model-facing tool names follow its `mcp__<plugin>__<tool>` convention. This is a compatible subset, not an emulation. Harness-only data such as the qualified tool name and MCP annotations travels in a namespaced `_harness` field that Claude-written hooks simply ignore. Plugin authors get an existing, well-documented reference, and simple Claude guard hooks run unchanged. The adapter is about 70 lines; no Claude runtime is imported. Details are in [PROTOCOL-v1-draft.md §6.2](PROTOCOL-v1-draft.md).

**Approvals ride on the AI SDK's `toolApproval` mechanism.** AI SDK 7 can pause a tool loop for user approval, sign the pending approval so a client cannot forge it, and resume. The harness runs the `PreToolUse` hook chain inside that callback, so the user approves the input _as rewritten by hooks_, and the same input is what executes. Because the SDK calls the callback again when a turn resumes, results are cached per tool call. In the spike, the callback ran 4 times but the hook chain only 3. Without the cache, hooks would run twice and audit logs would double count.

## Area by area

Each table lists what the library replaces and what custom code remains. The line counts are the auditors' estimates for product code, excluding tests.

### Plugin format and protocol (about 1,130 lines from scratch, 395 with libraries)

| Concern                | Use                                                                                 | What stays custom                                                                                                                                                                                                                             |
| ---------------------- | ----------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Manifest validation    | `ajv` 8.20 (MIT), `Ajv2020` with `allErrors` against a pinned JSON Schema           | The manifest and permissions schema itself, version dispatch, and checks that paths stay inside the plugin                                                                                                                                    |
| Config declaration     | JSON Schema 2020-12 through Ajv, with `addKeyword` for `x-secret` and `x-path-kind` | Which annotations drive prompts and forms. JSON Schema's `writeOnly` does not protect secrets, so `x-secret` stays                                                                                                                            |
| Hook wire format       | Claude Code's documented command-hook format, validated with `zod` 4                | About 70 lines that translate to and from the host's internal events and reject what we do not support, such as `defer`                                                                                                                       |
| Command templates [M2] | `yaml` 2.9 (ISC), parsed with `uniqueKeys` and `maxAliasCount: 0`                   | About 30 lines of `{{arg}}` substitution                                                                                                                                                                                                      |
| Variable substitution  | **Custom on purpose**                                                               | About 25 lines. The obvious candidate, MCPB's `replaceVariables`, reproducibly corrupts values containing `$&`, does not escape keys inside its regex, leaves unknown variables in place, and checks required fields before applying defaults |

### Install and plugin store (about 1,520 lines from scratch, 630 with libraries)

| Concern                         | Use                                                                                                           | What stays custom                                                                                                                                                        |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| npm sources [M2]                | `npm-package-arg` 14 and `pacote` 22 (ISC): `pacote.extract(spec, stage, { ignoreScripts: true, integrity })` | Pinning the resolved version and integrity in the registry                                                                                                               |
| git sources [M2]                | `simple-git` 4 (MIT): clone with `--no-checkout`, then check out the full commit SHA                          | Hardening: git hooks and filters can execute code, so they are disabled for the clone                                                                                    |
| Local folders                   | `node:fs` `cp`                                                                                                | `pacote` can pack folders, but only through npm's Arborist and a `package.json`, which plugins do not need                                                               |
| Atomic writes                   | `write-file-atomic` 8 (ISC) with `fsync` and mode `0600`                                                      | Registry schema version and migrations, as small integer steps                                                                                                           |
| Locking                         | `proper-lockfile` 4.1 (MIT)                                                                                   | Nothing. Its last release was 2021, but it has about 47 million weekly downloads and a stable API, so it is a deliberate exception to the freshness rule                 |
| Manifest and permission hashing | `canonicalize` 5 (Apache-2.0, RFC 8785) plus `node:crypto`                                                    | Nothing                                                                                                                                                                  |
| Permission diffs on update [M2] | `microdiff` 1.6 (MIT)                                                                                         | Normalising permission lists into keyed sets first, so reordering is not reported as a change                                                                            |
| Version checks                  | `semver` 7 (ISC) and `pacote.packument`                                                                       | Nothing                                                                                                                                                                  |
| Staging, generations, `--link`  | `node:fs` primitives                                                                                          | About 275 lines. Generic plugin managers do not fit: `live-plugin-manager` loads code into the host's process, and oclif's plugin manager only handles oclif npm plugins |

### Config and secrets (about 1,515 lines from scratch, 520 with libraries)

| Concern                           | Use                                                                                                                   | What stays custom                                                                                                                                                               |
| --------------------------------- | --------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Validation, defaults and coercion | `Ajv2020` with `useDefaults` and `coerceTypes` for CLI input, and without coercion for stored values. `ajv-formats` 3 | Nothing beyond the two Ajv instances                                                                                                                                            |
| Dotted keys (`config set a.b=1`)  | `dot-prop` 10                                                                                                         | Nothing                                                                                                                                                                         |
| Prompts generated from the schema | `@inquirer/prompts` 8.7, with `@inquirer/testing` in tests                                                            | About 150 lines of mapping from schema type to prompt, because no maintained library does this well. The supported subset will be documented                                    |
| Persistence                       | `write-file-atomic` and `proper-lockfile`, as above                                                                   | File layout                                                                                                                                                                     |
| Keychain [M2]                     | `@napi-rs/keyring` 2.1 (MIT)                                                                                          | Explicit fallback policy. A missing keychain must never silently downgrade to plaintext. An encrypted file via `age-encryption` 0.3 (BSD-3, pre-1.0) is an opt-in fallback only |
| Paths                             | `env-paths` 4 and `untildify` 6                                                                                       | Nothing                                                                                                                                                                         |
| Masking secrets in logs           | `pino` 10 with `@pinojs/redact`                                                                                       | Collecting the list of secret paths from each plugin's schema                                                                                                                   |

### MCP runtime (about 1,260 lines from scratch, 395 with libraries)

| Concern                            | Use                                                                                                                                                   | What stays custom                                                                                                                                                                                                                                                                                                         |
| ---------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Starting servers and listing tools | `@modelcontextprotocol/client` 2.4 (MIT): `StdioClientTransport` with `stderr: 'pipe'`, `client.connect`, `listTools` with timeouts and `listChanged` | Namespacing, duplicate detection, state machine                                                                                                                                                                                                                                                                           |
| Parallel startup                   | `p-map` 7, concurrency 4                                                                                                                              | Nothing                                                                                                                                                                                                                                                                                                                   |
| Crash handling                     | `client.onclose`/`onerror` with `p-retry` 9 for restarts [M4]                                                                                         | The rule that a side-effecting call is never replayed after a crash                                                                                                                                                                                                                                                       |
| Per-plugin stderr logs             | `rotating-file-stream` 3.2 (MIT), 10 MB, 5 files                                                                                                      | Nothing                                                                                                                                                                                                                                                                                                                   |
| Process trees [M4]                 | `execa` 10 (`killDescendants`, `forceKillAfterDelay`) and `exit-hook` 5                                                                               | The official stdio transport merges a default environment and kills only its direct child. In the spike that was enough: no `uv` or Python processes were left behind. A strict environment allow-list and whole-tree kill need about 70 lines of custom transport built on the SDK's `ReadBuffer` and `serializeMessage` |
| Conformance kit [M2]               | The official client plus Ajv. `@modelcontextprotocol/inspector` 2.14 `--cli` for authors                                                              | The official conformance package is not usable yet: version 0.1.16 uses SDK v1, tests URLs only, and rejects spec 2026-07-28                                                                                                                                                                                              |

### Hooks and policy (about 427 lines with libraries)

| Concern                           | Use                                                                                                         | What stays custom                                                                                                                                                                                                                                                                                                                                                                               |
| --------------------------------- | ----------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Running hook processes            | `execa` 10 with `input`, `timeout`, `forceKillAfterDelay`, `extendEnv: false`, `reject: false`, `maxBuffer` | Mapping results to decisions. Check `timedOut` and `signal` before `exitCode`                                                                                                                                                                                                                                                                                                                   |
| Matching tool names               | `picomatch` 4 with `dot`, `nonegate` and `noextglob`                                                        | Nothing                                                                                                                                                                                                                                                                                                                                                                                         |
| Ordering, chaining and precedence | **Custom on purpose**                                                                                       | About 40 lines: sequential order, chained `updatedInput` re-validated against the tool schema, `deny` > `ask` > `allow`, first `deny` stops, fail-closed on errors. `tapable`, `hookable` and `before-after-hook` all have the wrong semantics. For example, tapable's waterfall hook cannot stop early, and its bail hook stops on any returned value                                          |
| Guard rules                       | **Custom on purpose**                                                                                       | About 60 lines of glob and annotation rules. Cedar (WebAssembly build 4.14) is the upgrade path if policy ever needs attributes and roles. OPA, Casbin and JSON Logic are heavier than the problem                                                                                                                                                                                              |
| Secret detection                  | `@secretlint/core` 13 with the recommended preset (MIT)                                                     | About 180 lines, because on our test data the preset found only the GitHub token. It missed short `sk-` keys and AWS's example key. Guard therefore removes the preset's comment-directive rule (otherwise tool content could switch scanning off), uses secretlint's match ranges only for rules whose ranges were validated, redacts the whole value otherwise, and adds configurable regexes |
| Audit log                         | `pino` 10 to a `0600` file with synchronous writes                                                          | Record format                                                                                                                                                                                                                                                                                                                                                                                   |

### Agent loop and providers (about 530 lines with libraries)

| Concern                     | Use                                                                                                                                                                         | What stays custom                                                                                      |
| --------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| Tool loop                   | `ai` 7.0 (Apache-2.0): `ToolLoopAgent` with `stopWhen: isStepCount(n)` and **`toolCallConcurrency: 1`**                                                                     | Nothing                                                                                                |
| Plugin tools as model tools | `dynamicTool` with `jsonSchema(schema, { validate })` backed by Ajv                                                                                                         | The validate function. Without it the SDK does not validate at all (see traps)                         |
| Approvals                   | `toolApproval` callback, `tool-approval-response` messages to resume, `experimental_toolApprovalSecret` to sign                                                             | About 130 lines: running hooks inside the callback, the per-call cache, the approval ledger and expiry |
| Providers                   | `createProviderRegistry` with `@ai-sdk/openai-compatible` 3 (Ollama, LM Studio, vLLM), `@ai-sdk/openai` 4, `@ai-sdk/anthropic` 4. Models are addressed as `ollama:qwen3:8b` | Settings mapping                                                                                       |
| Streaming and UI messages   | `result.stream`, `toUIMessageStream`, `createUIMessageStreamResponse`                                                                                                       | Mapping to the host's `TurnEvent` stream                                                               |
| Test model                  | `MockLanguageModelV4` and `simulateReadableStream` from `ai/test`                                                                                                           | Scripts for each test                                                                                  |
| Session persistence [M3]    | `validateUIMessages` and `convertToModelMessages`                                                                                                                           | Storage, about 90 lines                                                                                |

### Local web app [M3] (about 3,630 lines from scratch, 840 with libraries)

| Concern                     | Use                                                                                                                 | What stays custom                                                                                 |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| Server and auth             | `hono` 4.13 and `@hono/node-server` 2.1 (MIT): `bearerAuth`, `secureHeaders`, `serveStatic`, bound to `127.0.0.1`   | An exact `Host` and `Origin` check of about 15 lines, because Hono's `csrf()` skips JSON requests |
| Chat, tool cards, approvals | `@ai-sdk/react` 4 `useChat` with `addToolApprovalResponse`, plus source-copied shadcn/ui components (`shadcn` 4.23) | Hook-trace cards and server-owned approval state                                                  |
| Config forms                | `@rjsf/core`, `@rjsf/validator-ajv8` and `@rjsf/shadcn` 6.11, with `x-secret` added through `customizeValidator`    | Secret fields as write-only password inputs                                                       |
| Plugin and inspect pages    | `@tanstack/react-query` 5 plus shadcn                                                                               | Screen composition                                                                                |
| Live log tail               | Hono `streamSSE` with `eventsource-parser` 4 on `fetch`                                                             | The browser's `EventSource` cannot send an auth header, hence fetch                               |
| Build and launch            | `vite` 8 with `@vitejs/plugin-react`, and `open` 11                                                                 | Nothing                                                                                           |

### CLI and developer experience (about 3,790 lines from scratch, 810 with libraries)

| Concern               | Use                                                                                                        | What stays custom                                                                      |
| --------------------- | ---------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| Commands and parsing  | `commander` 15 with `parseAsync` and `exitOverride`                                                        | Command declarations, exit codes, `--json` output                                      |
| Prompts and consent   | `@inquirer/prompts` 8.7, writing to stderr                                                                 | The rule that a non-interactive `ask` never becomes `allow`                            |
| Output                | `cli-table3`, `yocto-spinner`, optionally `marked` with `marked-terminal`, and Node's built-in `styleText` | The event renderer                                                                     |
| `chat` REPL           | `node:readline/promises` with history and completion                                                       | Slash commands, about 100 lines                                                        |
| Scaffolding [M2]      | `node:fs` `cp` of bundled templates                                                                        | The templates themselves                                                               |
| `doctor` [M2]         | `which` 7                                                                                                  | The checks                                                                             |
| Shell completion [M4] | `@bomb.sh/tab` 0.0.22, staged                                                                              | It is pre-1.0 and its package lacks a licence file, so it waits until that is resolved |

## Traps the audit caught

These are the findings that would have been bugs, mostly security bugs, if we had used the libraries the obvious way.

| Trap                                                                                                                                          | What would have gone wrong                                                                   | What the plan does                                                                                                        |
| --------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| AI SDK `jsonSchema()` without a `validate` function does not validate                                                                         | A model's malformed arguments reach the plugin. A probe confirmed invalid input was executed | Every tool's schema gets an Ajv validator. The spike shows the invalid call becoming a tool error and the loop continuing |
| `ToolLoopAgent` runs tool calls concurrently by default                                                                                       | Hooks and approvals for parallel calls interleave; audit order is nondeterministic           | `toolCallConcurrency: 1`                                                                                                  |
| `needsApproval` is deprecated for `ToolLoopAgent`                                                                                             | Building on an API that is being removed                                                     | `toolApproval`                                                                                                            |
| Tool lifecycle callbacks such as `onToolExecutionStart` are observers that swallow exceptions                                                 | A hook "deny" implemented there would be silently ignored                                    | Hooks run inside `toolApproval` and the tool's `execute` wrapper                                                          |
| `toolApproval` is called again when a turn resumes                                                                                            | Hooks run twice, side effects and audit entries double                                       | Per-call cache, verified in the spike                                                                                     |
| A bare model string such as `"gpt-4o"` routes to the Vercel AI Gateway                                                                        | A local-first tool silently sends prompts to a cloud service                                 | Models are always resolved through the provider registry with an explicit prefix                                          |
| `@ai-sdk/openai` defaults to OpenAI's Responses API                                                                                           | Local OpenAI-compatible servers do not implement it                                          | Local servers use `@ai-sdk/openai-compatible`                                                                             |
| Hono's `csrf()` middleware skips `application/json` requests                                                                                  | The JSON API would be open to cross-site requests from any web page                          | Bearer token from the URL fragment plus an exact Host and Origin check                                                    |
| MCPB's variable substitution has four defects (listed above)                                                                                  | Config values corrupted or left unexpanded in commands                                       | 25-line custom expander that rejects unknown variables                                                                    |
| MCPB's signature verification reported a validly signed test bundle as unsigned                                                               | A false sense of integrity checking                                                          | SHA-256 integrity only. Signing is out of v1 scope                                                                        |
| secretlint misses some common formats, honours `secretlint-disable` comments in scanned content, and one AWS rule reports a wrong match range | Secrets leak through redaction, or a tool output turns scanning off                          | Comment rule removed, range redaction only for validated rules, configurable extra patterns. Verified in the spike        |
| `pacote` and `npm-package-arg` require Node 22.22.2 or later                                                                                  | Install fails on older Node 22 releases                                                      | Node floor raised to 22.22.2                                                                                              |
| Vercel's `ai-elements` package announces deprecation at the end of November 2026                                                              | UI built on a dead dependency                                                                | Copy the shadcn/ui component patterns into the repo instead                                                               |
| `conf` 16 has documented migration bugs and limits on concurrent writers                                                                      | Corrupted settings when the CLI and web UI write at once                                     | `write-file-atomic`, `proper-lockfile` and our own small migrations                                                       |

## Frameworks considered and rejected

| Candidate                                                 | What it would have given        | Why not                                                                                                                                        |
| --------------------------------------------------------- | ------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| Mastra (`@mastra/core` 1.82, `@mastra/mcp` 2.8)           | Agent loop, MCP client, UI      | Parts of the core fall under an enterprise licence, and it brings its own runtime and conventions                                              |
| OpenAI Agents SDK 0.21                                    | Agent loop, guardrails, tracing | The strongest alternative, but its AI SDK model adapter is beta. Worth revisiting if the AI SDK becomes a problem                              |
| Claude Agent SDK 0.3                                      | A complete agent with hooks     | Commercial terms, it drives a Claude Code subprocess, and it depends on MCP SDK v1                                                             |
| VoltAgent 2.11                                            | Agent framework                 | Still on AI SDK 6 and MCP SDK v1                                                                                                               |
| LangGraph 1.7                                             | Durable multi-step graphs       | A single tool loop does not need graphs or checkpointers                                                                                       |
| `mcp-use` client 2.4, 1MCP, MCP Hub, MetaMCP              | Multi-server MCP management     | `mcp-use` connects servers one at a time; the others are standalone aggregator servers, not libraries                                          |
| oclif with `@oclif/plugin-plugins`, `live-plugin-manager` | Plugin install and loading      | Both load plugin code into the host process, which breaks the process isolation the protocol is built on                                       |
| `tapable`, `hookable`, `before-after-hook`                | Hook pipelines                  | Their short-circuit and chaining semantics do not match the decision rules                                                                     |
| OPA, Casbin, JSON Logic                                   | Policy engines                  | Far heavier than glob and annotation rules. Cedar is the planned upgrade if needed                                                             |
| `conf`, `lowdb`                                           | Config storage                  | Migration bugs and no recent maintenance, respectively                                                                                         |
| `gray-matter`                                             | Front-matter parsing            | Bundles an old `js-yaml` and supports executable front-matter engines                                                                          |
| `ink`                                                     | React terminal UI               | Unnecessary for a line-oriented CLI                                                                                                            |
| `keytar`                                                  | Keychain access                 | Archived                                                                                                                                       |
| `@anthropic-ai/mcpb` for the core manifest                | An existing manifest format     | Its schemas are Zod 3, and it has the substitution and signature defects above. It may be used later only to import single-server MCPB bundles |

## Proof: the integration spike

[spike-libs/host.mjs](spike-libs/host.mjs) uses the recommended libraries together. It is a prototype, not product code, but it exercises every risky integration point. It installs a package with `pacote` with scripts disabled, hashes manifests, diffs permissions, coerces and validates config, and writes it under a lock. It starts the Python `notes` plugin through the MCP v2 client, and runs `guard` as a Claude-format command hook. `guard` is bundled with esbuild into one 247 KB file that uses `secretlint` and `picomatch`. Finally, it drives four scripted model calls through `ToolLoopAgent` with `toolApproval`.

```text
-- generate() #1
  tool-call   c1 mcp__notes__write {"path":"todo.md","content":"rotate keys sk-abcdef123456 and ghp_aBcD…"}
  approval    c1 automatic=false reason=guard: notes.write changes data
  [user sees] mcp__notes__write with effective input {"content":"rotate keys [REDACTED] and [REDACTED]"} -> approves
-- generate() #2
  tool-call   c2 mcp__notes__search {"query":42}  [invalid]
  tool-error  c2 AI_InvalidToolInputError: Invalid input for tool mcp__notes__search …
  tool-call   c3 mcp__notes__search {"query":"venue"}
  tool-result c3 … "Venue: Lisbon (wifi badge token [REDACTED])" …
  tool-call   c4 mcp__notes__write {"path":"secrets/keys.md","content":"copy"}
  approval    c4 automatic=true      (guard exited 2: path "secrets/keys.md" is protected)
counters: {"toolApprovalCalls":4,"preHookChains":3,"executions":2,"modelCalls":5}
todo.md = "rotate keys [REDACTED] and [REDACTED]\n"      secrets/keys.md exists: false
after close(): leftover server processes: none
```

Read top to bottom, the run shows six things:

- **Redaction before approval.** Both secret formats were redacted before the approval prompt, and the redacted input is what was written.
- **Invalid input.** It never reached the plugin, and the loop continued.
- **Output redaction.** A secret already in a note was redacted from the search result before the model saw it.
- **Hook denial.** Exit code 2 turned into a denial, and the file was not created.
- **Hooks ran once per call.** The cache kept them from running twice on resume.
- **Clean shutdown.** The official transport left no orphan processes.

The whole run takes about 5.6 seconds, most of it `uv` starting Python.

The spike does not cover a few things:

- inference with a real model;
- the OS keychain, since the sandbox has no Secret Service;
- the web UI;
- Windows.

Each is covered by a task in [tasks/plan.md](tasks/plan.md).

## Dependency risks and policy

A few dependencies need watching:

- **Pre-1.0 packages:** `@anthropic-ai/sandbox-runtime` 0.0.81 (beta, opt-in sandbox in M4), `age-encryption` 0.3 (opt-in fallback only) and `@bomb.sh/tab` 0.0.22 (staged until its licence is clear).
- **`proper-lockfile`:** old but stable.
- **`@rjsf/shadcn`:** its npm metadata says MIT while the repository says Apache-2.0. Both are permissive, but this should be confirmed before release.
- **The two fast-moving dependencies:** the AI SDK, which ships a major version roughly every year, and MCP SDK v2, which is new.

The policy that keeps this manageable:

- Each third-party library is imported in exactly one adapter module, such as `runtime/mcp-client.ts` or `agent/model.ts`, so replacing it touches one file.
- Major versions are pinned and the lockfile is committed.
- CI runs `pnpm audit` and a licence allow-list check.
- Contract tests run against fixture MCP servers on both the old and new protocol versions.
- The host never runs `npm install` inside a plugin. Node plugins ship as a single bundled file or without dependencies, Python plugins use PEP 723 with `uv`, and npm-hosted plugins are extracted with install scripts disabled.

## What changed in the other documents

| Document                                     | Change                                                                                                                                                                                                                                            |
| -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [PROTOCOL-v1-draft.md](PROTOCOL-v1-draft.md) | Hooks use Claude's event names, payload and output envelope. `command` + `args` hook entries, `timeout` in seconds, fail-closed default for `PreToolUse`. Model-facing names `mcp__<plugin>__<tool>`. Packaging rules for Node and Python plugins |
| [PLANNING.md](PLANNING.md)                   | Architecture rules, protocol examples and technology table updated. Effort trimmed: MVP 7–10 days (was 8–12), end to end about 20–29 (was 25–35)                                                                                                  |
| [SPEC.md](SPEC.md)                           | Hook and tool names, Node floor 22.22.2, default for failing hooks resolved                                                                                                                                                                       |
| [tasks/plan.md](tasks/plan.md)               | Every task names the library calls it uses and the custom part it owns                                                                                                                                                                            |
