# MVP verification report

**Verified on 2026-11-09 in the Linux Manus sandbox.** The implementation is in `/home/ubuntu/harness`; the supplied planning documents remain in `/home/ubuntu/harness-plan` and their specification/companion documents are also included in this checkout.

**Historical implementation snapshot:** the results below precede the private GitHub repository, gated v0.1.0 release and recorded demo. The original observations are preserved; statements about no repository push or unexecuted remote CI describe that earlier verification stage, not current repository status. See [ROADMAP.md](ROADMAP.md), [tasks/status.md](tasks/status.md) and [GitHub Actions](https://github.com/ryamgoh/local-ai-agent-harness/actions) for subsequent delivery and live evidence.

## Results

| Gate                                                 | Observed result                                                         | Saved evidence                                                  |
| ---------------------------------------------------- | ----------------------------------------------------------------------- | --------------------------------------------------------------- |
| Frozen dependency installation                       | Pass                                                                    | `verification/install.log`                                      |
| `pnpm build`                                         | Pass; TypeScript packages, guard bundle and portable MCP fixtures built | `verification/build.log`                                        |
| `pnpm lint`                                          | Pass; ESLint and Prettier                                               | `verification/lint.log`                                         |
| `pnpm typecheck`                                     | Pass; strict TypeScript project build                                   | `verification/typecheck.log`                                    |
| `pnpm test:coverage`                                 | **159 tests passed across 15 files**                                    | `verification/coverage.log`                                     |
| Core line coverage                                   | **91.57%**; 1,109 of 1,211 executable lines, above the 80% requirement  | Host coverage report                                            |
| Python plugin tests                                  | **32 passed**                                                           | `verification/plugins.log`                                      |
| Node plugin tests                                    | **30 passed, 0 failed**                                                 | `verification/plugins.log`                                      |
| Generated schema equality and formatted regeneration | Pass                                                                    | `verification/schema.log` and manifest tests                    |
| Guard bundle freshness                               | Pass                                                                    | `verification/bundle.log`                                       |
| Production dependency audit                          | No known vulnerabilities reported at verification time                  | `verification/audit.log`                                        |
| Production license allowlist                         | 120 dependencies approved                                               | `verification/licenses.log`                                     |
| Connected-credential source scan                     | Zero matches for the connected OpenRouter/OpenAI credentials            | Release scan; secrets were read only from environment variables |

Runtime versions: Node.js 22.23.4, pnpm 11.25.0, Python 3.12.3, uv 0.13.7. Tests use real MCP and hook processes, while automated model tests use scripted Vercel AI SDK mocks or stubbed provider HTTP. Native plugin tests block network connections; dependency installation and the optional live smoke test are separate activities.

## Live OpenRouter smoke test

The actual built CLI was configured with the OpenAI-compatible adapter at `https://openrouter.ai/api/v1`, model `openai/gpt-4.1-mini`, and `model.apiKeyEnv=OPENROUTER_API_KEY`. With both proof plugins enabled, the model called `notes.write` and `notes.search`; the resulting note contained `[REDACTED]` instead of the synthetic key. The final answer reported redacted search content. The latest recorded turn completed in two model steps.

The credential was not printed, embedded in settings, passed to unrelated plugin environments, or saved into the source/archive. Temporary installed plugins and note data were removed afterward. The safe result is recorded in `verification/openrouter.json`. Rerun this **optional, provider-billed** check with:

```sh
node scripts/smoke-openrouter.mjs
```

It requires `OPENROUTER_API_KEY` in the environment. This is a provider integration smoke test, not a guarantee that all models will summarize every result accurately.

## Requirement coverage

SPEC criteria **1–12 and 15–19** are covered by the manifest/config/store/Host/runtime/hook/gateway/session suites and the built-CLI proof/lifecycle tests. The architectural test scans all production core/CLI source for plugin-specific names or imports. The proof suite observes both model-visible tools/results and actual filesystem side effects.

Additional red/green regressions verify atomic install rollback, linked consent drift and retargeting, nested/structured/environment secret masks in live inspection and stderr/JSON hook reasons, local-provider credential isolation, policy-unavailability fail-closed handling, contained state/log/data paths, cross-turn tool-call ID cache isolation, signed approval resumption, rewrite revalidation, and the global step bound.

The supplied plan's M0–M1 tasks are implemented, with small documented adjustments: raw-input JSON Schema generation uses `io: 'input'`; development dependency folders are excluded from packaged plugins; unchanged re-enabling uses prior consent; and one additional AI SDK adapter keeps library imports centralized. See `tasks/status.md` and `docs/IMPLEMENTATION-NOTES.md`.

## Explicit limitations

**SPEC #20 is still a manual acceptance check:** a clean macOS machine with a running Ollama model was not available. Ollama-compatible request shapes and colon-containing model IDs are tested offline, and the same provider adapter has live OpenRouter evidence. That is not a claim that the macOS/Ollama demo ran.

The Linux/macOS Node 22/24 GitHub Actions matrix is configured but was not remotely executed in this task. Windows smoke and stronger process-tree isolation remain M4. Git/npm plugin sources, provider plugins, updates, scaffolding/conformance CLI, session hooks, slash commands, keychain, UI, OS sandboxing, and publication remain later milestones. Filesystem/network declarations are consent information, not enforced sandbox policy.

No repository was pushed, no npm package was published, and no user desktop or attached persistent device was modified.
