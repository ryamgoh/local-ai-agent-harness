# MVP architecture

The dependency direction is CLI → Host facade → core adapters. The core never imports plugin code and has no proof-plugin-specific behavior. Manifests are declarative, tools use the official MCP v2 client over stdio, and hooks use short-lived child processes with JSON on stdin and stdout. No server or hook is spawned through a shell.

## Lifecycle

`PluginStore.plan` loads and validates the manifest before showing command and permission consent. `install` writes a staging directory and commits it with an atomic rename under a registry lock; failures restore the previous installed generation. Linked installs retain the original source while keeping their installation entry under `HARNESS_HOME`. Execution and permission hashes protect against declaration drift after consent. Configuration applies JSON Schema defaults and validates before any process starts. Secret fields live in a separate owner-only file.

`Host.start` resolves enabled plugins only, applies config/env substitution once, and starts MCP servers with bounded concurrency. Server startup has a total deadline covering discovery and listing. Failure stays local to the affected plugin. Tool names are qualified as `<plugin>.<tool>` for users and translated to provider-safe `mcp__<plugin>__<tool>` names. Long names have a hash suffix; ambiguous collisions are rejected. MCP stderr diagnostics rotate into per-plugin logs.

## Tool flow

A tool call goes through schema validation → ordered pre-tool hooks → host approval policy → effective-input confirmation → execution → ordered post-tool hooks → result to the model/user. Each rewrite is revalidated. The chain orders hooks by priority, plugin name, and declaration index. Deny wins over ask, which wins over allow, and the first deny stops the chain. `--yes` can accept ask but cannot change deny.

The gateway caches preflight and execution by tool-call ID. The Vercel AI SDK's signed `toolApproval` requests suspend and resume interactive calls without replaying hook side effects. Noninteractive ask is denied without opening stdin. A global per-turn step limit includes approval resumptions. Provider tools execute one at a time; text and gateway events share an async queue so callers see streaming progress before completion.

## Models

`agent/model.ts` is the provider boundary. All model IDs resolve through an explicit provider registry, never an unqualified model string. OpenAI-compatible endpoints use the chat-compatible adapter, avoiding an unintended Responses API or Vercel Gateway call. Provider credentials are referenced by environment variable name. The scripted `ai/test` model is deterministic, implements generate and stream, and validates capture paths under `HARNESS_HOME`.

## Tests and release gates

The core suite tests manifest/config/store behavior and runs real MCP/hook processes for timing, crashes, rewriting, and fail-closed semantics. Session tests use the AI SDK mock model with real tool schemas and stubbed provider fetch. Built-CLI proof tests verify the two independent-language plugins compose without host changes. Native Python and Node tests own the plugins' path and policy edge cases. CI declares Linux/macOS Node 22/24 build, lint, tests, coverage, schema/bundle freshness, security audit, and license gates. Configuring CI is not equivalent to having observed those remote jobs run.
