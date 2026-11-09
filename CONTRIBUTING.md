# Contributing

This is the private [ryamgoh/local-ai-agent-harness](https://github.com/ryamgoh/local-ai-agent-harness) repository, distributed as **UNLICENSED/private source**. Repository access is by invitation, not an open-source license. Accept the owner's collaborator invitation before cloning; authenticate with GitHub CLI on your own machine.

## Development setup

Use macOS or Linux, Node.js **22.22.2+** (**24 recommended**), Git, and pnpm **11.25.0**. Python **3.11+** and `uv` are needed for the notes plugin and full plugin/package proof tests. Ollama is optional for a local model demo, not required by automated tests.

```sh
gh auth login
gh repo clone ryamgoh/local-ai-agent-harness
cd local-ai-agent-harness
pnpm install --frozen-lockfile
pnpm build
pnpm harness --help
```

Run the built CLI as `pnpm harness ...`. Use a temporary `HARNESS_HOME` for experiments so you do not modify your regular `~/.harness`. Source proof plugins live at `plugins/notes` and `plugins/guard`; review declared commands/permissions and give install consent explicitly. Plugin permissions are declarations, not an OS sandbox.

End users do not need this toolchain: the [release install](docs/INSTALL.md) uses a downloaded tarball, bundled internal code, and npm shrinkwrap-resolved dependencies.

## Make a focused change

Branch from current `main` and keep the branch short-lived. Use names such as `feature/<description>`, `fix/<description>`, or `chore/<description>`. Keep unrelated refactors separate from behavior changes, and write tests for changed behavior.

Open a PR with the user-visible effect, test evidence, security/compatibility considerations, and any remaining manual checks. Wait for review and the required [CI checks](https://github.com/ryamgoh/local-ai-agent-harness/actions/workflows/ci.yml) before merging. Do not force-push shared branches, bypass release gates, or commit credentials, local state, dependency directories, caches, or release artifacts.

Preserve the plugin-independent host: tools and policies must come from external plugins, and a fresh installation must expose zero tools. Direct and model-driven calls must share the validation/hook/approval gateway. Hook denial cannot be overridden with `--yes`; noninteractive approval must not open stdin. Refer to [ARCHITECTURE.md](docs/ARCHITECTURE.md), [PROTOCOL.md](docs/PROTOCOL.md), and [PLUGIN_GUIDE.md](docs/PLUGIN_GUIDE.md) before changing these boundaries.

## Verify locally

```sh
pnpm version:check
pnpm build
pnpm lint
pnpm typecheck
pnpm test
pnpm test:coverage
pnpm test:plugins
pnpm schema
git diff --exit-code schema/plugin-v1.json
pnpm audit --prod --audit-level high
node scripts/check-licenses.mjs
pnpm build:release
pnpm test:release
```

Review generated guard/fixture bundles for freshness as required by CI. `pnpm test:release` exercises an installation of the actual tarball in an isolated npm prefix, including bundled proof-plugin assets, rather than relying on monorepo workspace links.

Automated model tests use fixtures or stubbed HTTP and do not need hosted credentials. The optional `node scripts/smoke-openrouter.mjs` check requires your own `OPENROUTER_API_KEY`, sends content to the provider, and may incur charges; it is not a routine CI step. Do not store the key in settings, source, logs, or artifacts.

Only claim tests you actually ran. [VERIFICATION.md](VERIFICATION.md) records prior Linux/OpenRouter evidence; use [Actions](https://github.com/ryamgoh/local-ai-agent-harness/actions) for current remote results. The clean macOS/Ollama manual demo remains pending and is not established by a passing macOS CI runner. Windows is not claimed as verified.

## Versions and releases

Update [CHANGELOG.md](CHANGELOG.md) for user-visible changes. Maintainers select a semantic version and run:

```sh
node scripts/version.mjs <semver>
# Equivalent: pnpm version:set <semver>
pnpm version:check
```

Replace `<semver>` with the selected version. This synchronizes root/core/CLI versions; proof-plugin manifests retain independent versions. Do not manually bump all manifests or use npm's version command as a substitute.

Release changes go through a PR, successful CI, and an annotated immutable `v<version>` tag. The initial canonical release is `v0.1.0`; keep the historical local `v0.1.0-mvp` tag untouched. Only authorized maintainers publish via the gated GitHub Release workflow. There is no npm registry publication or npm token. Follow [docs/RELEASING.md](docs/RELEASING.md) for the exact process, artifact verification, and rollback.

## Private-repository protection limits

GitHub currently reports that enforced branch protection for this private repository requires GitHub Pro. The repository stays private; no plan upgrade or visibility change is automatic. Until protection is available, maintainers must follow the CI-before-merge procedure themselves. The tag-driven release workflow still has enforced CI and installable-package prerequisites, so a failing run cannot publish a release through that workflow.
