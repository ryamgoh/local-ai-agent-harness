# Releasing

Releases are versioned assets in the **private** [ryamgoh/local-ai-agent-harness](https://github.com/ryamgoh/local-ai-agent-harness) repository. The distribution is **UNLICENSED/private source**, not an npm registry publication. Collaborators must be invited and accept repository access before downloading.

The initial canonical release is **v0.1.0**, with asset **local-ai-agent-harness-0.1.0.tgz**, package name `local-ai-agent-harness`, binary `harness`, and Node requirement `>=22.22.2` (Node 24 recommended). The historical local tag `v0.1.0-mvp` stays unchanged; it is not a substitute for the canonical release tag. The commands below describe the release process, not evidence that it has already passed remotely.

## Version contract

Use `MAJOR.MINOR.PATCH`. Document breaking changes explicitly; during `0.x` development, use a minor bump for breaking changes and reserve patches for compatible fixes. Keep the tag, root/core/CLI package versions, built CLI version, tarball filename, and changelog entry consistent.

Update versions through the repository script, not scattered manual edits:

```sh
node scripts/version.mjs <semver>
# Equivalent: pnpm version:set <semver>
pnpm version:check
```

Replace `<semver>` with the selected version (for the initial release, `0.1.0`). The script synchronizes the root, `packages/core`, and `packages/cli`; proof-plugin manifests have independent versions and are deliberately not synchronized. The CLI reads package metadata instead of a hard-coded version.

## Prepare a pull request

1. Start a short-lived branch from current `main`, such as `chore/release-0.1.0`.
2. Run the version command and update [CHANGELOG.md](../CHANGELOG.md), including any migration or compatibility notes.
3. Verify locally, inspect the packaged contents, and commit only the intended changes. Open a PR; do not release from an unreviewed working tree.
4. Wait for all required CI checks, review, and merge. Confirm the **merged commit's** CI run is green before tagging.

Local preparation:

```sh
pnpm install --frozen-lockfile
pnpm version:check
pnpm build
pnpm lint
pnpm typecheck
pnpm test:coverage
pnpm test:plugins
pnpm schema
git diff --exit-code schema/plugin-v1.json
pnpm audit --prod --audit-level high
node scripts/check-licenses.mjs
pnpm build:release
pnpm test:release
```

The full suite needs Python 3.11+ and `uv` for notes. Package smoke tests install the **actual tarball** in an isolated npm prefix, check version/help and the empty-tool baseline, and exercise the packaged proof plugins without source-checkout runtime dependencies. Also review generated schema and committed guard/fixture bundle freshness; [CI](https://github.com/ryamgoh/local-ai-agent-harness/actions/workflows/ci.yml) is the authoritative complete gate list.

The package bundles internal host/CLI code and includes proof-plugin assets plus `npm-shrinkwrap.json` for npm runtime dependencies. It must not require unpublished workspace packages, pnpm, or TypeScript at install time. Inspect the artifact for accidental credentials, local state, caches, and unrelated files before release.

## Tag the verified commit

After merge and successful CI, update your clean local `main` and select the verified commit. For the first release:

```sh
git switch main
git pull --ff-only origin main
git status --short
pnpm version:check
git tag -a v0.1.0 -m "Release 0.1.0"
git push origin v0.1.0
```

Stop if the working tree is not clean, `main` advanced beyond the verified commit, version validation fails, or that tag already exists. For later releases, substitute the new version consistently. Tags are **annotated and immutable**: never force-push, move, delete/recreate, or reuse a released tag. Leave `v0.1.0-mvp` untouched.

## Observe gated publication

The [release workflow](https://github.com/ryamgoh/local-ai-agent-harness/actions/workflows/release.yml) runs from a `v<version>` tag. It checks tag/version agreement and requires the reusable quality workflow, release packaging, and installed-package smoke to succeed before publishing GitHub Release assets. Quality includes the Linux/macOS Node 22/24 matrix, host/plugin tests, lint/type checks, coverage, freshness, dependency audit, license checks, and package smoke.

Only the release-publish job needs repository `contents: write`; validation jobs are read-only. There is **no npm publish step, no npm token, and no production model credential in CI**. Runtime dependencies can still be fetched from npm during install. Provider-billed OpenRouter smoke and the manual macOS/Ollama demo are separate activities, not CI requirements or automatic release claims.

Watch the tag's actual workflow run. If any prerequisite fails, do not create a manual release to bypass it. Correct the failure through a reviewed change, then use a new version/tag if the existing tag must remain immutable. Do not replace an already distributed asset with a different tarball under the same version.

## Verify the published release

After the workflow succeeds, inspect [Releases](https://github.com/ryamgoh/local-ai-agent-harness/releases) for the exact tag, asset, release notes, and checksums. On a clean machine or isolated user-owned prefix, use an account with private-repository access to download and install the real asset:

```sh
gh release download v0.1.0 --repo ryamgoh/local-ai-agent-harness --pattern 'local-ai-agent-harness-0.1.0.tgz'
npm install -g ./local-ai-agent-harness-0.1.0.tgz
harness --version
harness --help
HARNESS_HOME="$(mktemp -d)" harness tools list
HARNESS_PACKAGE_DIR="$(npm root -g)/local-ai-agent-harness"
harness plugin validate "$HARNESS_PACKAGE_DIR/plugins/notes"
harness plugin validate "$HARNESS_PACKAGE_DIR/plugins/guard"
```

If authentication is needed, run `gh auth login` on **your own machine** as an invited collaborator. Use [INSTALL.md](INSTALL.md) for interactive plugin installation with reviewed consent, a no-`sudo` prefix, and full first-use checks. Validate published checksums with your platform's checksum tool before installing when checksums are provided.

Record the workflow URL, released commit/tag, asset filename, and observed install result when reporting completion. A configured workflow, local passing tests, or a badge alone does not prove publication succeeded. [VERIFICATION.md](../VERIFICATION.md) is historical Linux/OpenRouter evidence; automated macOS CI is not the pending manual macOS/Ollama acceptance demo.

## Rollback and fixes

To roll back a user's CLI, download and install a known-good **older published asset** using the same procedure in [INSTALL.md](INSTALL.md#update-or-roll-back). Back up state first and check backward compatibility; rolling back the binary does not roll back state or copied plugins.

If the release has a defect, note it in the release notes, prepare a fix through a short-lived branch/PR, bump the version, and publish a new immutable tag. Do not rewrite history or replace existing assets. Release ownership stays with authorized maintainers; collaborator access and branch-protection availability must be confirmed rather than assumed.
