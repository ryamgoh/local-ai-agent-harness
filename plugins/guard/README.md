# Guard plugin

A tool-agnostic Node 22.22.2+ command-hook plugin with no MCP tools. It speaks protocol v1's Claude-compatible `PreToolUse` / `PostToolUse` JSON envelopes. The installed runtime is the single bundled `dist/guard.mjs`: it needs neither `node_modules` nor an installation step.

## Install and configure

From a built Harness checkout:

```sh
pnpm harness plugin install ./plugins/guard --yes
pnpm harness plugin config guard set 'deny=["*.delete"]' 'ask=["*.write"]'
pnpm harness plugin config guard set mode=monitor
```

The host passes only this plugin's settings through `HARNESS_PLUGIN_CONFIG`, never the tool owner's configuration. Audit storage is exclusively `HARNESS_PLUGIN_DATA/audit.jsonl`.

| Setting | Default | Behavior |
| --- | --- | --- |
| `mode` | `enforce` | `monitor` allows every supported call and never rewrites it, while auditing the original policy and detections. |
| `deny` | `[]` | Deny globs over the qualified `_harness.tool` name. |
| `ask` | `["*.delete"]` | Approval globs over that same qualified name. |
| `askOnDestructive` | `true` | Ask when `_harness.annotations.destructiveHint` is true. |
| `redact` | `true` | Detect and redact secrets recursively in inputs and outputs. |
| `denyPaths` | `["**/.env", "**/*.pem"]` | Deny any recursive `path` argument matching a glob. |
| `secretPatterns` | `["sk-[A-Za-z0-9_-]{8,}", "AKIA[0-9A-Z]{16}"]` | Additional JavaScript regular expressions, compiled globally. |

Globs use picomatch with dot-file matching, literal leading negation, and extglobs disabled. Tool matching is against names such as `files.write`, not `mcp__files__write`. Path matching includes normalized slash separators and resolved symlink targets relative to the payload's `cwd`, including existing ancestors of new files. It is a generic policy aid, not a filesystem sandbox: a tool-specific relative path base may differ from `cwd`, and only arguments named `path` are recognized.

Pre-tool policy gives deny precedence over ask. Enforced denial writes a fixed, content-free reason to stderr and exits 2 with no stdout. Approval and allowed calls return `hookSpecificOutput.permissionDecision`; detected secrets produce `updatedInput` before the tool executes. Post-tool scanning returns `updatedToolOutput`, including for error responses and `structuredContent`. Monitor mode returns allow/no rewrite, but audit `decision` remains the original `deny`, `ask`, or `allow` and `redactions` counts detected replacements.

## Detection and failures

Detection uses `@secretlint/core` and the recommended preset, with its comment-directive implementation removed. In Secretlint 13 that rule is named `@secretlint/secretlint-rule-filter-comments`; both that name and `comment-directive` are excluded. Scanned `secretlint-disable` comments cannot turn detection off.

Only independently verified GitHub token ranges are used for surgical replacements. Other rule hits redact the whole string rather than trust a possibly incomplete range. Extra regex matches are merged with verified ranges, including overlapping matches. Every string value is scanned recursively; secret-bearing object keys are also redacted, and own `__proto__` keys do not mutate prototypes. Zero-width regex matches are ignored. Numbers, booleans, nulls and container structure are preserved, except that redacted object-key collisions may collapse entries and a host can reject a rewrite that violates a tool schema.

Invalid regexes or processing failures fail closed in enforce mode even if `redact=false`: pre-tool calls exit 2, while post-tool results become a safe redacted error result. They are audited as deny with fixed reasons and hashed metadata. Monitor mode still allows and leaves inputs/results untouched, recording the processing failure as an original denial whenever audit storage is writable. Caught parser, scanner and regex errors are never printed because their messages can contain secrets.

Regex settings are trusted administrator input, not arbitrary tool data. Pathological regexes can run slowly; the host's three-second hook timeout remains the outer resource bound. Secret scanning is heuristic, not a guarantee against every credential format.

## Audit privacy

Each JSONL line contains only `ts`, `session`, `event`, `tool`, `decision`, `reasons`, and `redactions`. Reasons are fixed policy descriptions, never interpolated paths, globs, scanner messages, arguments or results. Session and tool metadata are scanned independently even if redaction is disabled; when scanner configuration is invalid, they are replaced by SHA-256 hashes. The file is opened append-only with `O_NOFOLLOW`, checked as a regular file, and kept at `0600`. Raw content and configuration are not persisted. Unknown credential formats in metadata cannot be detected reliably, so avoid embedding content in session IDs or qualified tool names.

An unwritable audit directory makes enforce-mode calls fail closed. In monitor mode allow takes precedence, so an audit-storage failure may prevent a log line; no raw error details are emitted. Permissions are declarations until the host's opt-in sandbox is implemented.

## Develop and verify

Install dependencies at the workspace root, never inside an installed plugin:

```sh
pnpm install
pnpm --filter guard build
node plugins/guard/build.mjs --check
node --test plugins/guard/test/*.test.mjs
pnpm harness plugin validate plugins/guard
```

`build.mjs` uses esbuild's API with `bundle`, `platform=node`, `format=esm`, `target=node22`, and a `createRequire` banner for bundled CommonJS dependencies. Keep `dist/guard.mjs` under version control; `--check` fails if it is stale. No git commit is performed by the build. Runtime imports outside the bundle are only Node built-ins.

Native `node:test` tests spawn the actual bundle with crafted protocol payloads and temporary homes. They cover the protocol examples, deny/ask precedence, destructive and additive annotations, nested/overlapping/custom redaction, comment directives, secret-free audits, invalid regexes, monitor mode, symlink paths, and execution of a copied bundle outside the workspace. Child processes preload network blockers, so tests cannot call external services. Dependency installation itself may access the package registry.
