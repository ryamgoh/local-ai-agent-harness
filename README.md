# Local AI Agent Harness MVP

A local-first TypeScript CLI whose tools and policies come from external plugins. The host runs MCP tool servers in separate processes and wraps every direct or agent-driven tool call in JSON-in/JSON-out command hooks. An empty installation gives the model zero tools.

This implements M0–M1 (Tasks 0–14) of the supplied plan. Git/npm plugin sources, slash-command contributions, session hooks, keychain integration, the web UI, and OS sandboxing are later milestones, not hidden partial features.

## Requirements and build

Use macOS or Linux with Node.js **22.22.2 or newer**, pnpm **11.25.0**, and Python **3.11 or newer**. The Python proof plugin runs through [uv](https://docs.astral.sh/uv/). The host never runs a package installer inside an installed plugin; `uv` manages the Python script environment as declared by its PEP 723 header. Its first launch may need network access to populate the cache.

```sh
pnpm install --frozen-lockfile
pnpm build
pnpm test
pnpm test:plugins
pnpm lint
pnpm test:coverage
```

For this source checkout, run the CLI as `pnpm harness ...` or `node packages/cli/dist/index.js ...`. To use the shorter `harness` spelling in the examples below:

```sh
harness() { node "$PWD/packages/cli/dist/index.js" "$@"; }
export HARNESS_HOME="$(mktemp -d)"
```

Run that function from the repository root. State defaults to `~/.harness` when `HARNESS_HOME` is unset. Registry, config, plugin data, logs, and any mock capture files stay under that directory. The default model endpoint is Ollama at `http://localhost:11434/v1`, with model ID `qwen3:8b`.

## End-to-end plugin demo

```sh
harness tools list
harness plugin validate plugins/notes
harness plugin validate plugins/guard
harness plugin install plugins/notes --yes
harness plugin config notes set "notesDir=$HARNESS_HOME/data/notes" maxResults=5
harness plugin install plugins/guard --yes
harness plugin inspect notes --live
harness tools call notes.write --input '{"path":"offsite.md","content":"Q3 offsite: Lisbon. Rotate key sk-abcdef123456"}' --yes
harness tools call notes.read --input '{"path":"offsite.md"}'
harness tools call notes.search --input '{"query":"offsite"}'
```

The stored note contains `[REDACTED]` instead of the synthetic key. The policy plugin's metadata-only audit is at `$HARNESS_HOME/data/guard/audit.jsonl`. Direct tool calls use the exact same validation, hook, and approval gateway as model calls.

```sh
harness plugin config guard set 'deny=["notes.write"]'
harness tools call notes.write --input '{"path":"blocked.md","content":"not written"}' --yes
# The denied direct call exits 1 and does not create blocked.md.
harness plugin config guard set 'deny=[]' 'ask=["notes.write"]'
harness run "Save an offsite summary" --json
# In a pipe/non-TTY, any ask is denied immediately; no stdin prompt is read.
harness plugin config guard set 'ask=[]'
harness plugin disable guard
harness tools call notes.write --input '{"path":"raw.md","content":"sk-abcdef123456"}' --yes
harness plugin disable notes
harness tools list
harness plugin enable notes
harness plugin uninstall notes
```

`--yes` explicitly accepts install consent or tool approval requests. It **never overrides a hook denial**. Avoid using it for plugins or actions you have not reviewed.

## Agent loop with Ollama

Start Ollama and load a model that supports tools. For example, on the machine running the CLI:

```sh
ollama pull qwen3:8b
harness config set model.provider openai-compatible
harness config set model.id qwen3:8b
harness config set model.baseURL http://localhost:11434/v1
harness run "Where is the Q3 offsite? Use the search tool." --max-steps 10
harness chat
```

The REPL supports `/tools`, `/plugins`, and `/exit` and retains conversation history during that session. The Vercel AI SDK `ToolLoopAgent` streams text, executes tools sequentially, and enforces a per-turn step limit. Arguments are validated before hooks or execution, and every hook rewrite is validated again. Errors and denials are returned to the model so it can recover.

Local endpoints do not need a credential by default. To authenticate to an endpoint, set `model.apiKeyEnv` to the **name** of a credential environment variable, never the credential itself. Ollama, LM Studio, vLLM, and OpenRouter use the OpenAI-compatible provider; direct OpenAI and Anthropic providers are also available.

## OpenRouter

The OpenRouter connector credential is used through `OPENROUTER_API_KEY` in the execution environment. No credential is embedded in this source checkout, in settings, or in the downloadable archive. On your own computer, provide that environment variable through your preferred secret manager.

```sh
harness config set model.provider openai-compatible
harness config set model.baseURL https://openrouter.ai/api/v1
harness config set model.id openai/gpt-4.1-mini
harness config set model.apiKeyEnv OPENROUTER_API_KEY
harness run "Where is the Q3 offsite? Search the notes." --max-steps 10
```

Hosted inference can incur provider charges and sends the prompt and tool results to that provider. Model-provider **plugins** are out of scope: this MVP configures a provider adapter instead. A colon in a local model ID is preserved, and explicit provider resolution prevents accidental routing through the Vercel AI Gateway.

## Offline scripted model

Automated host tests never call a hosted model. For a deterministic demo, create a model script under `HARNESS_HOME` and select it via `HARNESS_MODEL`:

```sh
cat > "$HARNESS_HOME/model.json" <<'JSON'
{
  "steps": [
    {"tool":"mcp__notes__search","input":{"query":"offsite"}},
    {"text":"The offsite is in Lisbon."}
  ]
}
JSON
HARNESS_MODEL="mock:$HARNESS_HOME/model.json" harness run "Where is the offsite?" --json
```

Scripted answers are fixtures, not actual inference. Optional `capture` and `captureMessages` script properties record tool names and model-message snapshots; their paths must remain within `HARNESS_HOME`. `run --json` writes one `TurnEvent` JSON object per line, while diagnostics go to stderr.

## CLI reference

```text
plugin install <dir> [--link] [--yes] [--no-enable] [--force]
plugin list [--json]
plugin inspect <name> [--json] [--live]
plugin config <name> [get [key] | set key=value ... | unset key]
plugin enable <name>
plugin disable <name>
plugin uninstall <name>
plugin validate <dir> [--strict]
tools list [--json]
tools call <plugin.tool> --input '<json>' [--yes]
run <prompt> [--json] [--yes] [--max-steps N]
chat
config get <key>
config set <key> <value>
```

Without a config subcommand, interactive prompts are generated from the plugin's schema. Booleans, integers, numbers, enums, strings, paths, JSON collections, and password fields are validated before persistence. Failed configuration updates leave the stored configuration unchanged. `x-secret` values are stored separately with owner-only file permissions and displayed as `••••`.

Exit codes: `0` success, `1` runtime/direct-tool error, `2` usage or validation error, `3` consent declined. A successfully completed agent turn can exit `0` even if the model attempted a denied tool call; inspect the emitted `tool-result` and `approval` events.

## Trust and known boundaries

Plugins execute arbitrary code with your user's privileges. Filesystem and network permissions are **declarations for consent, not an OS sandbox**. Install only code you trust. Commands and declared permissions are shown before install; changed execution or permission declarations in linked plugins require fresh consent via a forced reinstall. Development directories such as `node_modules` are not copied into the installed bundle.

Disabled plugins never start or contribute tools/hooks. Process environments contain only the minimal base allowlist, explicitly declared environment mappings, and that plugin's own configuration. Hooks fail closed by default for `PreToolUse`; post-tool hook errors default to allowing the unchanged result. Server startup failures are isolated, and crash results include the plugin log location. No side-effecting call is automatically replayed.

Uninstall removes installed code and configuration but retains plugin data and logs to avoid destroying user content. The official MCP stdio transport performs process shutdown; stronger cross-platform process-tree isolation and opt-in sandbox enforcement are later hardening work. macOS and Windows status should be read from the verification report, not assumed from this Linux run.

## Project layout and documents

`packages/core` is the plugin-independent engine; `packages/cli` is its thin terminal adapter. `plugins/notes` is a Python MCP server; `plugins/guard` is a bundled Node command-hook plugin. `test/e2e/proof.test.ts` verifies zero baseline, composition, deny, noninteractive approval, disabling, and direct-call parity. `test/architecture.test.ts` rejects any proof-plugin-specific names or imports in the host source.

Read [the protocol](docs/PROTOCOL.md), [the plugin authoring guide](docs/PLUGIN_GUIDE.md), [the architecture](docs/ARCHITECTURE.md), [the supplied specification](SPEC.md), and [the implementation status](tasks/status.md). The JSON Schema published for editors is `schema/plugin-v1.json` and is regenerated with `pnpm schema`.
