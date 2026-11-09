# GitHub Releases Implementation Plan

> Execute the three tasks in this session; packaging, CI configuration and collaborator documentation have separate file ownership.

**Goal:** Create the approved private `ryamgoh/local-ai-agent-harness` repository with working CI, installable GitHub Releases and reproducible version instructions, without npm publication.

**Architecture:** esbuild packages internal host/CLI code while leaving npm dependencies external. A private npm tarball contains proof-plugin assets and an npm shrinkwrap. A reusable GitHub Actions quality workflow runs on PR/main and is required before a tag workflow publishes the artifact. One version command keeps the root/core/CLI manifests aligned; the CLI reads package metadata instead of a literal.

**Tech stack:** Existing TypeScript, esbuild, pnpm, Node test runner, npm pack/shrinkwrap, GitHub CLI and GitHub Actions.

## Constraints

- Keep the repository private, do not invite unspecified users, and do not publish to npm.
- Node >=22.22.2; CI on Ubuntu/macOS and Node 22.23.4/24; proof Python >=3.11 via uv.
- Do not change agent/plugin semantics or the protocol; provider-billed smoke tests are excluded from CI.
- Only the release-publish job receives contents:write. Never use pull_request_target or production secrets.
- Version/tag/package/CLI must match. Tags and released artifacts are not moved or replaced.

## Review focus

1. A downloaded tarball must install without the monorepo or unpublished workspace packages.
2. An authenticated private-repository collaborator must have working download/clone instructions.
3. A mismatched tag/version or failing quality job must not publish a release.
4. Proof plugins must remain opt-in, and their assets must work from the installed package.
5. Release files must exclude credentials, cache/state, build tooling and source checkout assumptions.

## Task 1 — Installable artifact and versioning

- [ ] Add metadata-derived host/CLI version and tests for manifest/tag agreement.
- [ ] Add a version command that updates root/core/CLI together; preserve independent proof-plugin protocol versions.
- [ ] Add release builder: internal esbuild bundle, exact direct runtime dependency versions, private package metadata, proof-plugin/docs/schema assets, shrinkwrap and npm tarball.
- [ ] Add isolated-prefix smoke: install the actual tarball, check version/help/empty tool list, validate and compose both plugins, confirm redacted disk content, and uninstall.
- [ ] Verify mismatch tests red/green, lint/type/build/host tests, and clean global installation.

## Task 2 — Repository-native CI/CD

- [ ] Make CI reusable and run every gate on PR/main and as a release prerequisite; least permissions, concurrency, timeouts and diagnostic artifacts.
- [ ] Add tag release workflow: verify version, build and smoke the tarball, checksums/source archive, publish only after quality and packaging pass.
- [ ] Add Dependabot, PR template, and version/release maintainer instructions.
- [ ] Push branch and observe real GitHub CI; address concrete runner failures.
- [ ] Configure supported main protections and report any account-plan restrictions honestly.

## Task 3 — Collaborator installation and first release

- [ ] Add CI/release badges, private clone and authenticated `gh release download` instructions, global installation, optional proof-plugin locations, models, updates/uninstall and no-sudo-prefix troubleshooting.
- [ ] Create immutable first canonical tag `v0.1.0` after CI passes; keep the original local MVP tag unchanged.
- [ ] Observe release workflow and verify real assets, remote metadata and collaborator commands.
- [ ] Deliver repository, CI and release URLs plus exact installation commands; no npm registry publication.
