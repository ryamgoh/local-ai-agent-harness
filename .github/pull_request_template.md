## Summary

<!-- What changed and why? Link an issue if relevant. -->

## Verification

<!-- List commands run and results; explain anything not run. CI runs Linux/macOS on Node 22/24. -->

- [ ] Build, lint, types, coverage, and plugin tests pass without provider-billed calls.
- [ ] Generated schema/bundles are current; dependency audit and license checks pass.
- [ ] `pnpm version:check` and `pnpm test:version` pass.
- [ ] If release-related: `pnpm build:release` and `pnpm test:release` pass against the actual package.

## Risks and compatibility

<!-- Note behavior/config changes, security implications, and migration needs, or write "None". -->

- [ ] No credentials, private state, or `node_modules` are included in source archives.
- [ ] Any version/changelog changes are consistent; published tags and assets are not rewritten.
