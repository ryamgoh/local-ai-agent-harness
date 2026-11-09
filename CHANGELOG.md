# Changelog

User-visible changes are listed here; tags and release assets are immutable. This project is **UNLICENSED/private source**, distributed to invited collaborators through [GitHub Releases](https://github.com/ryamgoh/local-ai-agent-harness/releases), not the npm registry.

## Unreleased

No additional changes recorded.

## 0.1.0 — 2026-11-09 (release preparation)

The initial canonical release target is `v0.1.0`. Publication and new remote CI results must be confirmed on [Releases](https://github.com/ryamgoh/local-ai-agent-harness/releases/tag/v0.1.0) and [Actions](https://github.com/ryamgoh/local-ai-agent-harness/actions); this entry does not assert they have completed. The historical local `v0.1.0-mvp` tag remains unchanged.

### Added

Local-folder plugin installation with development links, consent, inspect/config/validate, enable/disable, and uninstall. MCP stdio tools and JSON command hooks compose through one gateway. The CLI provides direct calls, streaming agent runs, a chat REPL, and schema-generated configuration prompts. Ollama/OpenAI-compatible, OpenAI, Anthropic, and deterministic mock provider adapters are available.

The independent Python notes plugin and bundled Node guard plugin demonstrate discovered tools, redaction, denial, monitoring, and metadata-only auditing. Automated host, plugin, architecture, and CLI proof suites accompany the protocol, authoring guide, and generated manifest schema.

Versioned private distribution as `local-ai-agent-harness-0.1.0.tgz`, exposing `harness` and requiring Node.js 22.22.2+ (24 recommended). Internal host/CLI code is bundled and npm runtime dependencies are resolved through the included shrinkwrap, so release users do not need pnpm, TypeScript, or a source checkout. Proof-plugin assets are included but remain opt-in, with reviewed install consent.

Synchronized root/core/CLI version commands, installed-tarball smoke tests, and a GitHub Release workflow gated by quality and package checks. Collaborator installation, source contribution, release maintenance, updates, rollback, and uninstall instructions describe private GitHub access without npm publication.

### Security

Staged atomic installation and consent receipts protect declaration changes. Plugin environments and secret files are isolated; nested/structured/environment credential values are masked from diagnostics and inspection. Hook rewrites are revalidated and approval shows effective input. Deny cannot be overridden with `--yes`, and noninteractive ask never opens stdin. Failed enabled policies block tool launch. Step limits and sequential tool calls bound the agent loop; cross-turn tool-call IDs cannot reuse an earlier execution cache.

Release publication requires tag/version agreement and successful prerequisites. No npm token or production model credential is needed by the release workflow. The private source distribution does not grant an open-source license.

### Boundaries

Declared filesystem/network permissions are not an OS sandbox. Python 3.11+ and `uv` are required only for notes; Ollama is required only for inference through Ollama. Hosted inference may incur charges and sends prompts/tool results to the provider.

M2–M4 runtime features and clean macOS/Ollama manual acceptance remain pending. [The prior verification report](VERIFICATION.md) covers Linux and live OpenRouter tests, not new remote CI/release results. Automated macOS runner tests do not substitute for the Ollama manual demo; Windows is not claimed as verified.
