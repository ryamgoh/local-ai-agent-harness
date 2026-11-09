# MVP implementation notes

The supplied plan is executed for M0–M1 (Tasks 0–14). Later milestone items remain out of scope. Tests exercise the CLI, protocol, host facade, and plugin function seams established in SPEC.md.

Official APIs checked on 2026-11-09: [AI SDK ToolLoopAgent](https://ai-sdk.dev/docs/reference/ai-sdk-core/tool-loop-agent), [OpenAI-compatible provider](https://ai-sdk.dev/providers/openai-compatible-providers), and [MCP TypeScript SDK](https://github.com/modelcontextprotocol/typescript-sdk). No hosted inference is used by automated tests.

## Integration corrections

The published manifest JSON Schema describes raw input, so generation uses Zod's `io: 'input'` option in addition to the plan's dialect. This prevents defaulted fields from becoming incorrectly required in editor validation. The loader still normalizes defaults after loading.

Enabled policy plugins that cannot resolve fail closed at session/tool launch instead of being silently excluded. Previously approved unchanged plugins can be re-enabled without repeat consent; declaration drift still requires a forced reinstall with renewed consent. Local OpenAI-compatible endpoints receive no implicit cloud credential unless `model.apiKeyEnv` is explicitly configured.

The implementation review identified recursive/environment secret masking and cross-turn tool-call cache isolation. Targeted regressions exercise each issue before its owning runtime/session boundary is fixed and before the final release verification. Startup directory and log paths are checked against the state root, including existing symlink components.
