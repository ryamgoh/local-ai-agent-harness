# MVP implementation status

The authoritative task descriptions remain in [plan.md](plan.md). This checklist records the delivered M0–M1 slice, without marking M2–M4 as implemented.

**Updated 2026-11-09.** The [feature timeline](../ROADMAP.md) separates implementation from acceptance and links every numbered task to its GitHub issue. All 15 M0–M1 implementation packages are delivered; Task 14 remains open for the clean macOS/Ollama manual acceptance gate. GitHub milestones provide live completion, while this document is a maintained snapshot.

| Task | Delivered implementation                                                                                                        | Evidence                                                |
| ---- | ------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------- |
| 0    | Strict ESM pnpm workspace, echo MCP fixture, Linux/macOS Node 22/24 CI matrix                                                   | Build, runtime tests, workflow configuration            |
| 1    | Contained state paths, typed errors, manifest loader, input-oriented published schema                                           | Manifest and Host path tests; schema equality/freshness |
| 2    | Single-pass literal variable substitution; path expansion and intact spaces                                                     | Substitution tests                                      |
| 3    | Atomic staged copy/link install, registry locks, force rollback, consent hash receipts, enable/disable/uninstall                | Plugin-store and built-CLI lifecycle tests              |
| 4    | Schema config, defaults/coercion, nested secrets, owner-only storage, host settings/env overrides                               | Config-store/settings tests                             |
| 5    | Isolated process environments, parallel bounded MCP startup, discovery/name mapping, crash errors/logs                          | Real-process runtime and secret-isolation tests         |
| 6    | JSON command hooks, timeout/error policy, ordered matching/reduction, validated rewrites                                        | Hook tests and native policy tests                      |
| 7    | One validation/hook/approval/execution/post-hook gateway                                                                        | Gateway tests; direct-call parity proof                 |
| 8    | Explicit provider registry, Vercel AI SDK streaming loop, signed approval resume, sequential calls, step limits, scripted model | Session/provider tests; optional live OpenRouter smoke  |
| 9    | Host composition, live inspection, policy-unavailability fail-closed handling                                                   | Host tests; no plugin-specific host code                |
| 10   | CLI lifecycle/config/validate commands, schema prompts and consent                                                              | Built-CLI lifecycle/public prompt tests                 |
| 11   | CLI tools/run/chat/settings, JSONL events and retained REPL history                                                             | Built-CLI lifecycle/session tests                       |
| 12   | Ordinary Python MCP notes server with append-only writes and path protections                                                   | Native pytest suite and real MCP proof tests            |
| 13   | Bundled Node guard plugin with enforcement/monitor mode, Secretlint, redaction and metadata-only audit                          | Native Node tests; standalone bundle freshness          |
| 14   | Architecture/composition/deny/disable/noninteractive/direct-call proofs and documentation                                       | Full host suite; protocol and plugin guide              |

The six core architectural proofs are automated: zero tools with an empty home; no plugin names/imports in host source; installation/disabling/uninstalling changes discovery; composition redacts what reaches disk; deny prevents side effects and reaches the model; and unattended ask never reads stdin. Additional tests cover direct calls and malformed model arguments.

## Explicit pending items

**SPEC #20 / Task 14 manual demo:** a clean **macOS** machine running **Ollama** was not available in this Linux sandbox. Ollama-compatible requests are tested with stubbed HTTP; the same compatible adapter was additionally exercised against live OpenRouter with both plugins. This does not substitute for claiming the macOS/Ollama acceptance demo has run.

The private repository and **v0.1.0 GitHub Release are published**. The [remote Linux/macOS Node 22/24 release quality and installed-package gates passed](https://github.com/ryamgoh/local-ai-agent-harness/actions/runs/42553691504), and the [real recording/replay guide](../demos/v0.1.0/README.md) is available. This records release/CI/demo work delivered after the initial local MVP verification snapshot.

Windows smoke, OS sandboxing, git/npm plugin sources, updates, scaffolding/conformance CLI, plugin slash commands, session hooks, OS keychain and the local web UI remain planned. Private installable packaging and recording are partial early delivery of Task 28, not completion of all M4 work. Public npm registry publication is deferred under the private GitHub-only distribution decision; it is not an automatically authorized future release step.

See [the verification report](../VERIFICATION.md) and `verification/` for the exact local commands and observed results. Implementation adjustments that preserve the contract are described in [implementation notes](../docs/IMPLEMENTATION-NOTES.md).
