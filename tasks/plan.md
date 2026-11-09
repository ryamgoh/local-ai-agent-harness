# Harness Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a local AI agent harness whose capabilities come entirely from plugins. Users install, inspect, configure, enable and run plugins from a CLI (MVP) and a local web UI (M3). Two reference plugins, `notes` and `guard`, prove the mechanism through automated tests.

**Architecture:** A `@harness/core` package with no plugin-specific code loads `harness-plugin.json` manifests, stores registry, config and secrets under `HARNESS_HOME`, starts plugin MCP servers over stdio, runs command hooks around every tool call, and drives an AI SDK `ToolLoopAgent`. `@harness/cli` (and later `@harness/web`) are thin renderers of core's `TurnEvent` stream.

**Tech Stack:** Node ≥ 22.22.2, TypeScript strict, ESM, pnpm workspaces. Core: `@modelcontextprotocol/client` ^2.4, `ai` ^7 (+ `@ai-sdk/openai-compatible` ^3, `@ai-sdk/openai` ^4, `@ai-sdk/anthropic` ^4), `zod` ^4, `ajv` ^8.20 + `ajv-formats` ^3, `dot-prop` ^10, `env-paths` ^4, `untildify` ^6, `write-file-atomic` ^8, `proper-lockfile` ^4, `canonicalize` ^5, `semver` ^7, `picomatch` ^4, `execa` ^10, `p-map` ^7, `rotating-file-stream` ^3, `pino` ^10. CLI: `commander` ^15, `@inquirer/prompts` ^8.7, `cli-table3`. Tests: `vitest` ^5, `@inquirer/testing`. Plugins: Python `mcp` ^2.3 via `uv`; `guard` bundles `@secretlint/core` ^13 + preset and `picomatch` with `esbuild`. Why each was chosen, and the custom parts each task still owns, are in [LIBRARIES.md](../LIBRARIES.md).

**Spec:** [SPEC.md](../SPEC.md) and [PROTOCOL-v1-draft.md](../PROTOCOL-v1-draft.md). Rationale is in [PLANNING.md](../PLANNING.md). The working spikes are [spike/](../spike/) (hand-rolled) and [spike-libs/](../spike-libs/) (the libraries below, wired together). When a task says "as in spike-libs", copy the call shape from `spike-libs/host.mjs`.

## Global Constraints

- Node.js `>=22.22.2` (required by `pacote`/`npm-package-arg`); `"type": "module"`; TypeScript `strict: true`, `noUncheckedIndexedAccess: true`.
- `@modelcontextprotocol/client` `^2.4.0`; `ai` `^7.0.0`; `zod` `^4.2.0` (required by MCP SDK v2).
- Manifest file name is exactly `harness-plugin.json`. `apiVersion` must be `1`.
- Plugin names match `^[a-z][a-z0-9-]*[a-z0-9]$`, 2–40 chars.
- Qualified tool name is `<plugin>.<tool>`. The model-facing name, also sent to hooks as `tool_name`, is `mcp__<plugin>__<tool>`, sanitised to `^[a-zA-Z0-9_-]{1,64}$`.
- Default timeouts: server `startupTimeoutMs` 10 000; hook `timeout` 5 **seconds** (maximum 60). Hook `onError` default is `deny` for `PreToolUse` and `UserPromptSubmit`, `allow` for other events.
- Hook wire format is Claude Code's (PROTOCOL-v1-draft.md §6.2): stdin `{session_id, cwd, hook_event_name, tool_name, tool_input, tool_use_id, tool_response?, _harness}`, stdout `{hookSpecificOutput: {...}}`. `defer` and unknown decisions are `deny`.
- Hook precedence is `deny` > `ask` > `allow`. Non-interactive `ask` becomes `deny` unless `--yes`.
- Host `approvals` setting: `destructive` (default) | `always` | `off`.
- State lives only under `HARNESS_HOME` (default `~/.harness`). Every test sets a temporary `HARNESS_HOME`.
- Never spawn through a shell. Never pass one plugin's config or secrets to another plugin's process. Never run a package install or package script inside a plugin directory.
- Each third-party library is imported in exactly one adapter module (for example `runtime/mcp-client.ts`, `agent/model.ts`, `hooks/runner.ts`, `fs-atomic.ts`). Other modules use the adapter.
- AI SDK settings that are unsafe by default are fixed everywhere: `jsonSchema()` always gets a `validate` function, `ToolLoopAgent` always uses `toolCallConcurrency: 1` and `toolApproval` (never `needsApproval`), and models are always resolved through `createProviderRegistry` with an explicit prefix, never a bare model string.
- `packages/core/src` and `packages/cli/src` never import from `plugins/` and never contain the words `notes` or `guard`.
- Plugin process environment = base allow-list (`PATH HOME USER LOGNAME SHELL TERM LANG LC_* TMPDIR`, plus `SystemRoot APPDATA USERPROFILE` on Windows) + manifest `env` + `HARNESS_PLUGIN_{NAME,ROOT,DATA,CONFIG}` + `HARNESS_PROTOCOL=1`.

## Review Focus

1. **A plugin server that never answers, or prints junk to stdout at startup.** The host must mark it `failed` after `startupTimeoutMs` and still start every other plugin. → test added to Task 5.
2. **Config path values with `~` or spaces (`~/My Notes`).** They must be expanded and reach the plugin as one intact argv/env value. → tests added to Tasks 2 and 5.
3. **`harness run` in a pipe or CI hitting an `ask`.** It must deny with a clear reason and never read stdin. → tests added to Tasks 7 and 14.
4. **A local model emitting tool arguments that fail the schema, or invalid JSON.** The call must not reach the plugin, the model must get the validation errors, and the session must continue. → test added to Task 7.
5. **Installing the same name twice, or an install interrupted mid-copy.** There must be no duplicate entries and no half-installed registry entry. → tests added to Task 3.

---

## File Structure

```
package.json  pnpm-workspace.yaml  tsconfig.base.json  vitest.workspace.ts  .github/workflows/ci.yml
packages/core/src/
  paths.ts                 HarnessPaths resolution
  errors.ts                HarnessError base + typed errors with stable codes
  fs-atomic.ts             writeJsonAtomic / readJson helpers
  manifest/schema.ts       zod PluginManifestSchema + manifestJsonSchema()
  manifest/load.ts         loadManifest, validateManifestRefs
  manifest/substitute.ts   substitute, listVariables, expandHome
  store/registry.ts        Registry read/write (registry.json)
  store/plugin-store.ts    PluginStore: plan/install/uninstall/list/get/setEnabled/load
  config/config-store.ts   ConfigStore: resolve/set/unset/remove, coerce, maskSecrets
  config/settings.ts       Host settings (settings.json + HARNESS_MODEL override)
  runtime/resolve.ts       resolvePlugin -> ResolvedPlugin (substituted spawn specs + hooks)
  runtime/env.ts           buildEnv
  runtime/mcp-client.ts    the ONLY file importing @modelcontextprotocol/client
  runtime/runtime-manager.ts RuntimeManager + toModelName
  hooks/runner.ts          runCommandHook
  hooks/engine.ts          HookEngine (match, order, merge)
  agent/model.ts           the ONLY file importing @ai-sdk/* providers; createModel
  agent/mock-model.ts      scripted MockLanguageModelV4 for tests/offline demo
  agent/gateway.ts         ToolGateway: validate -> hooks -> approvals -> call -> after-hooks
  agent/session.ts         Session.runTurn -> AsyncIterable<TurnEvent>
  host.ts                  Host facade
  index.ts                 public exports
packages/core/test/        one *.test.ts per module + fixtures/
packages/cli/src/
  index.ts                 commander program
  commands/plugin.ts       install/uninstall/list/inspect/enable/disable/config/validate
  commands/tools.ts        tools list/call
  commands/agent.ts        run/chat
  commands/settings.ts     config get/set
  render.ts                TurnEvent -> terminal; consent and inspect formatting
  io.ts                    TurnIO for TTY / non-TTY
plugins/notes/             harness-plugin.json, server.py, tests/test_server.py
plugins/guard/             harness-plugin.json, hooks/guard.mjs, test/guard.test.mjs
test/fixtures/plugins/     echo (Node MCP server), hooks-* (allow, deny2, rewrite, hang, garbage), bad-* manifests
test/fixtures/scripts/     mock-model scripts (*.json)
test/e2e/                  proof.test.ts, lifecycle.test.ts
test/architecture.test.ts
schema/plugin-v1.json      generated
docs/PROTOCOL.md  docs/PLUGIN_GUIDE.md  README.md
```

---

## M0: Skeleton

### Task 0: Workspace, CI and the spike as an integration test

**Files:**
- Create: `package.json`, `pnpm-workspace.yaml`, `tsconfig.base.json`, `vitest.workspace.ts`, `.github/workflows/ci.yml`, `packages/core/package.json`, `packages/cli/package.json`
- Create: `test/fixtures/plugins/echo/harness-plugin.json`, `test/fixtures/plugins/echo/server.mjs` (an MCP server using `@modelcontextprotocol/server` with tools `echo(text)` and `fail()`)
- Test: `packages/core/test/smoke.test.ts`

**Interfaces:**
- Produces: the `echo` fixture plugin (tools `echo`, `fail`) used by Tasks 5–14.

- [ ] **Step 1: Write the failing test**

```ts
test('echo fixture server lists its tools over stdio', async () => {
  const tools = await listToolsViaStdio('node', [fixture('plugins/echo/server.mjs')]);
  expect(tools.map((t) => t.name).sort()).toEqual(['echo', 'fail']);
});
```

- [ ] **Step 2: Run** `pnpm vitest run packages/core/test/smoke.test.ts`. Expected: FAIL (`listToolsViaStdio` not defined).
- [ ] **Step 3: Implement** a test helper `listToolsViaStdio(command: string, args: string[]): Promise<Tool[]>` in `packages/core/test/helpers.ts`, using `Client` and `StdioClientTransport` as in `spike/probe.mjs`.
- [ ] **Step 4: Run** the same command. Expected: PASS. CI runs `pnpm install && pnpm build && pnpm test` on `ubuntu-latest` and `macos-latest` with Node 22.22.2+ and 24, plus `pnpm audit --prod` and a licence allow-list check, installing `uv` via `astral-sh/setup-uv`.
- [ ] **Step 5: Commit** `chore: workspace skeleton, CI, echo fixture`.

---

## M1: MVP CLI

### Task 1: Paths, errors and the manifest schema

**Files:**
- Create: `packages/core/src/{paths.ts,errors.ts,fs-atomic.ts,manifest/schema.ts,manifest/load.ts}`, `scripts/gen-schema.ts`, `schema/plugin-v1.json`
- Create fixtures: `test/fixtures/plugins/bad-name`, `bad-event`, `bad-api2`, `bad-escape`, `unknown-key`
- Test: `packages/core/test/manifest.test.ts`

**Interfaces:**
- Produces:
  - `resolvePaths(home?: string): HarnessPaths`, where `HarnessPaths = { home, registryFile, settingsFile, pluginsDir, configDir, dataDir, logsDir, sessionsDir }`
  - `MANIFEST_FILE = 'harness-plugin.json'`
  - `PluginManifestSchema`, `type PluginManifest`, `McpServerSpec`, `HookSpec`, `HookEventName`, `Permissions`, `CommandSpec`
  - `loadManifest(dir: string): Promise<LoadedManifest>`, where `LoadedManifest = { dir, manifest, warnings: string[] }`; throws `ManifestError { code: 'MANIFEST_INVALID', issues: { path: string; message: string }[] }`
  - `validateManifestRefs(m: PluginManifest, dir: string): ManifestIssue[]`
  - `manifestJsonSchema(): object`

- [ ] **Step 1: Write the failing tests**

```ts
test('minimal manifest loads with defaults', async () => {
  const { manifest } = await loadManifest(fixture('plugins/echo'));
  expect(manifest).toMatchObject({ apiVersion: 1, name: 'echo', priority: 100, hooks: [], permissions: {} });
});
test.each([
  ['bad-name', 'name'], ['bad-event', 'hooks.0.event'], ['bad-escape', 'mcpServers.s.args.0'],
])('%s is rejected at %s', async (dir, path) => {
  await expect(loadManifest(fixture(`plugins/${dir}`))).rejects.toMatchObject({ code: 'MANIFEST_INVALID', issues: expect.arrayContaining([expect.objectContaining({ path })]) });
});
test('apiVersion 2 names the supported version', async () => {
  await expect(loadManifest(fixture('plugins/bad-api2'))).rejects.toThrow('unsupported apiVersion 2 (host supports 1)');
});
test('unknown top-level key is a warning, unknown hook key is an error', async () => {
  expect((await loadManifest(fixture('plugins/unknown-key'))).warnings).toEqual(['unknown top-level field "flavour"']);
});
test('committed JSON schema matches the zod source', () => {
  expect(manifestJsonSchema()).toEqual(JSON.parse(readFileSync('schema/plugin-v1.json', 'utf8')));
});
```

- [ ] **Step 2: Run** `pnpm vitest run packages/core/test/manifest.test.ts`. Expected: FAIL (module not found).
- [ ] **Step 3: Implement.** Use zod `.strict()` on nested objects and a passthrough top-level schema whose unknown keys become warnings. Export JSON Schema with `z.toJSONSchema(PluginManifestSchema, { target: 'draft-2020-12' })`. Hook entries are `{ event, match?, command, args?, timeout?, onError? }` with `event` one of the five Claude event names. `fs-atomic.ts` is the adapter for `write-file-atomic` (`{ fsync: true, mode }`) and `proper-lockfile` (`lock(home, { lockfilePath, stale: 30000, update: 10000, retries })`); `paths.ts` uses `env-paths`. `bad-escape` uses `"${plugin.root}/../x"`; containment is checked in `validateManifestRefs` by resolving `${plugin.root}` to `dir` and requiring `path.relative(dir, p)` not to start with `..`.
- [ ] **Step 4: Run** the test command, then `pnpm tsx scripts/gen-schema.ts && git diff --exit-code schema/`. Expected: PASS, no diff.
- [ ] **Step 5: Commit** `feat(core): manifest schema, loader, published JSON schema`.

### Task 2: Variable substitution

**Files:**
- Create: `packages/core/src/manifest/substitute.ts`
- Test: `packages/core/test/substitute.test.ts`

**Interfaces:**
- Produces:
  - `SubstitutionContext = { plugin: { name, root, data }, harness: { home }, config: Record<string, unknown>, env: Record<string, string>, allowedEnv: string[], pathKeys: string[] }`
  - `substitute(input: string, ctx: SubstitutionContext): string`, which throws `UnknownVariableError { code: 'UNKNOWN_VARIABLE', variable }` or `UndeclaredEnvError { code: 'UNDECLARED_ENV', name }`
  - `listVariables(input: string): string[]`
  - `expandHome(p: string): string`

- [ ] **Step 1: Write the failing tests**

```ts
test('plugin and config variables', () => {
  expect(substitute('${plugin.root}/server.py', ctx)).toBe('/h/plugins/notes/server.py');
  expect(substitute('${config.limit}', { ...ctx, config: { limit: 5 } })).toBe('5');
  expect(substitute('${config.tags}', { ...ctx, config: { tags: ['a'] } })).toBe('["a"]');
});
test('path config values expand ~ and keep spaces', () => {
  expect(substitute('${config.notesDir}', { ...ctx, config: { notesDir: '~/My Notes' }, pathKeys: ['notesDir'] })).toBe(`${homedir()}/My Notes`);
});
test('env requires declaration', () => {
  expect(() => substitute('${env.TOKEN}', { ...ctx, env: { TOKEN: 'x' }, allowedEnv: [] })).toThrow(UndeclaredEnvError);
});
test('unknown variable throws', () => expect(() => substitute('${foo.bar}', ctx)).toThrow(UnknownVariableError));
test('listVariables finds all references', () => expect(listVariables('${a.b}-${config.c}')).toEqual(['a.b', 'config.c']));
test('replacement values are literal', () => expect(substitute('${config.p}', { ...ctx, config: { p: 'a$&b${plugin.root}' } })).toBe('a$&b${plugin.root}'));
```

- [ ] **Step 2: Run** `pnpm vitest run packages/core/test/substitute.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement** a single-pass regex `/\$\{([a-z]+)\.([A-Za-z0-9_]+)\}/g` with a **replacer function** (so `$&` in values is literal) and no recursive expansion; `expandHome` uses `untildify`. This stays custom on purpose: MCPB's `replaceVariables` mishandles `$&`, unescaped keys, unknown variables and defaults (LIBRARIES.md).
- [ ] **Step 4: Run** the test command. Expected: PASS.
- [ ] **Step 5: Commit** `feat(core): manifest variable substitution`.

### Task 3: Plugin store and registry

**Files:**
- Create: `packages/core/src/store/{registry.ts,plugin-store.ts}`
- Test: `packages/core/test/plugin-store.test.ts`

**Interfaces:**
- Consumes: `resolvePaths`, `loadManifest`, `validateManifestRefs`, `writeJsonAtomic` (Task 1).
- Produces:
  - `PluginSource = { type: 'path'; path: string }` (widened in Task 15)
  - `RegistryEntry = { name, version, source, installPath, linked, enabled, installedAt, manifestSha256, permissionsSha256 }`
  - `InstallPlan = { loaded: LoadedManifest; source: PluginSource; commands: string[][]; permissions: Permissions }`, where `commands` has `${plugin.root}` resolved and `${config.*}` left verbatim
  - `class PluginStore { constructor(paths); plan(src: string): Promise<InstallPlan>; install(plan, opts?: { link?: boolean; enable?: boolean; force?: boolean }): Promise<RegistryEntry>; uninstall(name): Promise<void>; list(): Promise<RegistryEntry[]>; get(name): Promise<RegistryEntry | undefined>; setEnabled(name, enabled): Promise<RegistryEntry>; load(name): Promise<LoadedManifest> }`
  - Errors `AlreadyInstalledError` (`ALREADY_INSTALLED`) and `NotInstalledError` (`NOT_INSTALLED`).

- [ ] **Step 1: Write the failing tests**

```ts
test('install copies into pluginsDir and registers enabled', async () => {
  const e = await store.install(await store.plan(fixture('plugins/echo')));
  expect(e).toMatchObject({ name: 'echo', enabled: true, linked: false });
  expect(existsSync(join(paths.pluginsDir, 'echo', 'harness-plugin.json'))).toBe(true);
});
test('plan resolves plugin.root in commands but leaves config vars', async () => {
  expect((await store.plan(fixture('plugins/echo'))).commands[0]).toEqual(['node', expect.stringMatching(/plugins\/echo\/server\.mjs$/)]);
});
test('second install of same name fails unless force', async () => {
  await store.install(await store.plan(fixture('plugins/echo')));
  await expect(store.install(await store.plan(fixture('plugins/echo')))).rejects.toMatchObject({ code: 'ALREADY_INSTALLED' });
  await expect(store.install(await store.plan(fixture('plugins/echo')), { force: true })).resolves.toBeDefined();
  expect((await store.list()).filter((p) => p.name === 'echo')).toHaveLength(1);
});
test('link creates a symlink and uninstall leaves the source intact', async () => { /* lstat isSymbolicLink; source dir still exists after uninstall */ });
test('failed copy leaves no registry entry and no partial dir', async () => {
  await expect(store.install(plan, { copy: failingCopy })).rejects.toThrow();
  expect(await store.get('echo')).toBeUndefined();
  expect(existsSync(join(paths.pluginsDir, 'echo'))).toBe(false);
});
test('setEnabled persists', async () => { /* disable -> list shows enabled false after re-open */ });
```

- [ ] **Step 2: Run** `pnpm vitest run packages/core/test/plugin-store.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement.** Copy into `pluginsDir/.staging-<random>`, then `rename` into `pluginsDir/<name>`, then write the registry atomically. On any error, remove staging. `copy` is an injectable option, used only by tests. Hashes are SHA-256 (`node:crypto`) of `canonicalize(...)` (RFC 8785) of the manifest and of `permissions`. Every registry write goes through `fs-atomic.ts` under the lock, with a `schemaVersion` field for future migrations.
- [ ] **Step 4: Run** the test command. Expected: PASS.
- [ ] **Step 5: Commit** `feat(core): plugin store with atomic install, link, enable`.

### Task 4: Config store and host settings

**Files:**
- Create: `packages/core/src/config/{config-store.ts,settings.ts}`
- Test: `packages/core/test/config-store.test.ts`, `packages/core/test/settings.test.ts`

**Interfaces:**
- Produces:
  - `ResolvedConfig = { values: Record<string, unknown>; issues: { key: string; message: string }[]; secretKeys: string[]; pathKeys: string[] }`
  - `class ConfigStore { constructor(paths); resolve(plugin, schema?): Promise<ResolvedConfig>; set(plugin, schema, assignments: Record<string, string>): Promise<ConfigIssue[]>; unset(plugin, key): Promise<void>; remove(plugin): Promise<void> }`
  - `coerce(raw: string, prop: JsonSchemaObject): unknown`
  - `maskSecrets(values, secretKeys): Record<string, unknown>`, which replaces values with `'••••'`
  - `HostSettings = { model: ModelSettings; approvals: 'destructive' | 'always' | 'off'; maxSteps: number }`
  - `ModelSettings = { provider: 'openai-compatible' | 'openai' | 'anthropic' | 'mock'; id: string; baseURL?: string; apiKeyEnv?: string }`
  - `loadSettings(paths, env = process.env): Promise<HostSettings>`, where `HARNESS_MODEL=<provider>:<id>` overrides and splits on the first colon only; `saveSetting(paths, key: string, value: string): Promise<void>`

- [ ] **Step 1: Write the failing tests**

```ts
test('defaults applied, required reported', async () => {
  const r = await cfg.resolve('notes', notesSchema);
  expect(r.values).toMatchObject({ readOnly: false, maxResults: 10 });
  expect(r.issues).toEqual([{ key: 'notesDir', message: 'is required' }]);
});
test('set coerces CLI strings by schema type', async () => {
  expect(await cfg.set('notes', notesSchema, { readOnly: 'true', maxResults: '5', notesDir: '~/n' })).toEqual([]);
  expect((await cfg.resolve('notes', notesSchema)).values).toMatchObject({ readOnly: true, maxResults: 5 });
});
test('invalid set leaves stored config unchanged', async () => {
  expect(await cfg.set('notes', notesSchema, { maxResults: 'abc' })).toEqual([{ key: 'maxResults', message: expect.stringContaining('integer') }]);
  expect((await cfg.resolve('notes', notesSchema)).values.maxResults).toBe(5);
});
test('x-secret values go to a 0600 secrets file and are masked', async () => {
  await cfg.set('svc', secretSchema, { token: 'abc' });
  expect(readFileSync(join(paths.configDir, 'svc.json'), 'utf8')).not.toContain('abc');
  expect(statSync(join(paths.configDir, 'svc.secrets.json')).mode & 0o777).toBe(0o600);
  expect(maskSecrets({ token: 'abc' }, ['token'])).toEqual({ token: '••••' });
});
test('HARNESS_MODEL splits on first colon', async () => {
  expect((await loadSettings(paths, { HARNESS_MODEL: 'openai-compatible:qwen3:8b' })).model).toMatchObject({ provider: 'openai-compatible', id: 'qwen3:8b' });
});
```

- [ ] **Step 2: Run** `pnpm vitest run packages/core/test/config-store.test.ts packages/core/test/settings.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement.** Use two Ajv 2020 instances (`ajv/dist/2020`): one for CLI input with `useDefaults`, `coerceTypes`, `allErrors`, `strict` and `ownProperties` (this replaces a hand-written `coerce`, so `coerce()` becomes a thin wrapper), and one without coercion for stored values. Add `addKeyword({ keyword: 'x-secret', schemaType: 'boolean' })` and `x-path-kind`, plus `ajv-formats` with a custom `path` format. Dotted keys use `dot-prop` `setProperty`/`deleteProperty`. Files are written through `fs-atomic.ts`, secrets with mode `0600`. The model setting `<provider>:<id>` is a provider-registry id (for example `openai-compatible:qwen3:8b`), resolved in Task 8. Validate on a deep copy, and write only when there are no errors. The settings defaults are `{ model: { provider: 'openai-compatible', id: 'qwen3:8b', baseURL: 'http://localhost:11434/v1' }, approvals: 'destructive', maxSteps: 20 }`.
- [ ] **Step 4: Run** the test command. Expected: PASS.
- [ ] **Step 5: Commit** `feat(core): schema-driven plugin config, secrets file, host settings`.

### Task 5: Plugin resolution and the runtime manager

**Files:**
- Create: `packages/core/src/runtime/{resolve.ts,env.ts,mcp-client.ts,runtime-manager.ts}`
- Create fixtures: `test/fixtures/plugins/hang` (server that never responds), `junk` (prints non-JSON then exits), `crash` (tool `boom` calls `process.exit(1)`), `two` (second plugin also exposing `echo`)
- Test: `packages/core/test/runtime.test.ts`

**Interfaces:**
- Consumes: `RegistryEntry`, `LoadedManifest`, `ResolvedConfig`, `substitute`, `HarnessPaths`.
- Produces:
  - `ResolvedPlugin = { name; priority; root; data; config: Record<string, unknown>; servers: Record<string, SpawnSpec>; hooks: ResolvedHook[]; permissions: Permissions }`
  - `SpawnSpec = { command; args: string[]; env: Record<string, string>; cwd; startupTimeoutMs }`
  - `resolvePlugin(entry, loaded, config: ResolvedConfig, paths, env = process.env): ResolvedPlugin`, which throws `ConfigInvalidError` (`CONFIG_INVALID`, `issues`) when `config.issues.length > 0`
  - `buildEnv(p: ResolvedPlugin, extra: Record<string, string>, base = process.env): Record<string, string>`
  - `toModelName(plugin: string, tool: string): string`
  - `HostTool = { plugin; server; name; qualifiedName; modelName; description; inputSchema: object; annotations?: Record<string, boolean> }`
  - `ToolResult = { isError: boolean; content: unknown[]; structuredContent?: unknown }`
  - `PluginStatus = { plugin; state: 'stopped' | 'starting' | 'running' | 'failed' | 'crashed'; error?: string; logFile: string; tools: number }`
  - `class RuntimeManager { constructor(opts: { paths: HarnessPaths }); start(plugins: ResolvedPlugin[]): Promise<PluginStatus[]>; tools(): HostTool[]; byModelName(n: string): HostTool | undefined; byQualifiedName(n: string): HostTool | undefined; call(qualifiedName: string, input: unknown, signal?: AbortSignal): Promise<ToolResult>; status(): PluginStatus[]; stop(): Promise<void> }`
  - `ResolvedHook` type is declared here (consumed by Task 6): `{ plugin; priority; index; event: HookEventName; match; command: string; args: string[]; env: Record<string, string>; timeout: number /* seconds */; onError: 'allow' | 'deny'; owner: { name; root; data; config } }`

- [ ] **Step 1: Write the failing tests**

```ts
test('tools are namespaced per plugin', async () => {
  await rt.start([resolved('echo'), resolved('two')]);
  expect(rt.tools().map((t) => t.qualifiedName).sort()).toEqual(['echo.echo', 'echo.fail', 'two.echo']);
  expect(rt.byModelName('mcp__two__echo')?.qualifiedName).toBe('two.echo');
});
test('toModelName sanitises and bounds length', () => {
  expect(toModelName('my-plugin', 'do.thing')).toBe('mcp__my-plugin__do_thing');
  expect(toModelName('p', 'x'.repeat(80))).toMatch(/^[a-zA-Z0-9_-]{1,64}$/);
});
test('hung and junk servers fail without blocking others', async () => {
  const s = await rt.start([resolved('hang', { startupTimeoutMs: 500 }), resolved('junk'), resolved('echo')]);
  expect(Object.fromEntries(s.map((x) => [x.plugin, x.state]))).toEqual({ hang: 'failed', junk: 'failed', echo: 'running' });
}, 5000);
test('crash during call becomes an error result naming the log', async () => {
  await rt.start([resolved('crash'), resolved('echo')]);
  const r = await rt.call('crash.boom', {});
  expect(r.isError).toBe(true);
  expect(JSON.stringify(r.content)).toContain(join(paths.logsDir, 'crash.log'));
  expect((await rt.call('echo.echo', { text: 'hi' })).isError).toBe(false);
});
test('plugin env is allow-listed and carries its own config only', () => {
  const env = buildEnv(resolved('echo', { config: { notesDir: '/My Notes' } }), {}, { PATH: '/bin', AWS_SECRET: 'x' });
  expect(env.AWS_SECRET).toBeUndefined();
  expect(JSON.parse(env.HARNESS_PLUGIN_CONFIG!)).toEqual({ notesDir: '/My Notes' });
});
test('stderr is captured to the plugin log', async () => { /* echo fixture writes "ready" to stderr; logs/echo.log contains it */ });
```

- [ ] **Step 2: Run** `pnpm vitest run packages/core/test/runtime.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement.** `mcp-client.ts` wraps `Client` and `StdioClientTransport` with `stderr: 'pipe'`. It exports `connect(spec: SpawnSpec, logFile: string): Promise<McpConnection>`, where `McpConnection = { listTools(): Promise<Tool[]>; callTool(name, args, signal): Promise<ToolResult>; onExit(cb): void; close(): Promise<void> }`. `stderr` is piped into a `rotating-file-stream` (`size: '10M', maxFiles: 5, mode: 0o600`). `start` runs plugins with `p-map` (`concurrency: 4`, errors collected per plugin, never thrown), passing `{ timeout: startupTimeoutMs }` to `client.connect` and `listTools`. It rejects duplicate tool names inside one plugin with state `failed` and error `duplicate tool "x"`. `toModelName` builds `mcp__<plugin>__<tool>` and replaces `[^a-zA-Z0-9_-]` with `_`. If the result is longer than 64 characters, it keeps the first 55 and appends `_` plus 8 hex characters of SHA-1.
- [ ] **Step 4: Run** the test command. Expected: PASS.
- [ ] **Step 5: Commit** `feat(core): plugin resolution and MCP runtime manager`.

### Task 6: Hook runner and engine

**Files:**
- Create: `packages/core/src/hooks/{runner.ts,engine.ts}`
- Create fixtures in `test/fixtures/hooks/` (all in Claude wire format): `allow.mjs` (empty stdout), `deny2.mjs` (stderr "nope", exit 2), `ask.mjs`, `rewrite.mjs` (uppercases `tool_input.text` via `updatedInput`), `hang.mjs`, `garbage.mjs` (prints `not json`), `defer.mjs` (returns `permissionDecision: 'defer'`), `echo-payload.mjs` (writes stdin and env to files named by `OUT`)
- Test: `packages/core/test/hooks.test.ts`

**Interfaces:**
- Consumes: `ResolvedHook`, `HostTool`, `ToolResult` (Task 5).
- Produces:
  - `HookRunResult = { kind: 'output'; output: Record<string, unknown> } | { kind: 'deny'; reason: string } | { kind: 'error'; error: string }`
  - `runCommandHook(hook: ResolvedHook, payload: object): Promise<HookRunResult>`
  - `SessionCtx = { id: string; cwd: string; interactive: boolean }`
  - `HookTrace = { plugin; event; decision?: string; reason?: string; error?: string; ms: number }`
  - `ToolBeforeOutcome = { decision: 'allow' | 'deny' | 'ask'; reasons: string[]; input: unknown; trace: HookTrace[] }`
  - `ToolAfterOutcome = { result: ToolResult; additionalContext: string[]; trace: HookTrace[] }`
  - `class HookEngine { constructor(hooks: ResolvedHook[], opts?: { run?: typeof runCommandHook }); toolBefore(ctx, tool: HostTool, input): Promise<ToolBeforeOutcome>; toolAfter(ctx, tool, input, result): Promise<ToolAfterOutcome> }`

- [ ] **Step 1: Write the failing tests**

```ts
test('payload follows protocol v1 and carries only the owner config', async () => {
  await engine([hook('echo-payload.mjs', { owner: { config: { mode: 'x' } } })]).toolBefore(ctx, tool('notes.write'), { a: 1 });
  expect(readPayload()).toMatchObject({ hook_event_name: 'PreToolUse', tool_name: 'mcp__notes__write', tool_input: { a: 1 }, _harness: { protocol: 1, tool: 'notes.write' } });
  expect(JSON.parse(readEnv().HARNESS_PLUGIN_CONFIG)).toEqual({ mode: 'x' }); expect(readEnv().CLAUDE_PLUGIN_ROOT).toBe(readEnv().HARNESS_PLUGIN_ROOT);
});
test('exit 2 denies with stderr reason', async () => {
  expect(await engine([hook('deny2.mjs')]).toolBefore(ctx, t, {})).toMatchObject({ decision: 'deny', reasons: ['nope'] });
});
test('precedence deny > ask > allow and first deny stops the chain', async () => {
  const o = await engine([hook('allow.mjs'), hook('ask.mjs'), hook('deny2.mjs'), hook('rewrite.mjs')]).toolBefore(ctx, t, { text: 'a' });
  expect(o.decision).toBe('deny'); expect(o.trace).toHaveLength(3);
});
test('updatedInput chains in priority order', async () => {
  expect((await engine([hook('rewrite.mjs', { priority: 1 }), hook('echo-payload.mjs', { priority: 2 })]).toolBefore(ctx, t, { text: 'a' })).input).toEqual({ text: 'A' });
});
test('timeout kills hook and applies onError within budget', async () => {
  const t0 = Date.now();
  const o = await engine([hook('hang.mjs', { timeout: 0.2 })]).toolBefore(ctx, t, {}); // default onError for PreToolUse is deny
  expect(o.decision).toBe('deny'); expect(Date.now() - t0).toBeLessThan(450);
});
test('garbage stdout is an error: PreToolUse fails closed, onError allow opts out', async () => {
  expect(await engine([hook('garbage.mjs')]).toolBefore(ctx, t, {})).toMatchObject({ decision: 'deny', trace: [expect.objectContaining({ error: expect.stringContaining('not json') })] });
  expect((await engine([hook('garbage.mjs', { onError: 'allow' })]).toolBefore(ctx, t, {})).decision).toBe('allow');
});
test('defer and unknown decisions deny', async () => { expect((await engine([hook('defer.mjs')]).toolBefore(ctx, t, {})).decision).toBe('deny'); });
test('match globs filter hooks', async () => {
  expect((await engine([hook('deny2.mjs', { match: 'web.*' })]).toolBefore(ctx, tool('notes.read'), {})).decision).toBe('allow');
});
test('toolAfter chains updatedToolOutput', async () => { /* hook returns {hookSpecificOutput:{hookEventName:'PostToolUse',updatedToolOutput:{isError:false,content:[{type:'text',text:'[REDACTED]'}]}}} */ });
```

- [ ] **Step 2: Run** `pnpm vitest run packages/core/test/hooks.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement.** `runner.ts` is the `execa` adapter: `execa(command, args, { input: JSON.stringify(payload) + '\n', timeout: timeout * 1000, killSignal: 'SIGTERM', forceKillAfterDelay: 250, cleanup: true, reject: false, extendEnv: false, env, shell: false, maxBuffer: 1 << 20 })`, checking `timedOut` and `signal` before `exitCode` (as in spike-libs `runHook`). `engine.ts` is the custom reducer (about 40 lines, see `runChain` in spike-libs): order by `(priority, plugin, index)`, chain `updatedInput`, `deny` > `ask` > `allow`, first `deny` stops. A small zod schema per event validates `hookSpecificOutput`. Matching uses `picomatch(match, { dot: true, nonegate: true, noextglob: true })` against the qualified name.
- [ ] **Step 4: Run** the test command. Expected: PASS.
- [ ] **Step 5: Commit** `feat(core): command hook runner and decision engine`.

### Task 7: Tool gateway (validation, hooks, approvals)

**Files:**
- Create: `packages/core/src/agent/gateway.ts`
- Test: `packages/core/test/gateway.test.ts`

**Interfaces:**
- Consumes: `RuntimeManager.call/byQualifiedName`, `HookEngine`, `HostSettings.approvals`.
- Produces:
  - `ApprovalRequest = { tool: string; input: unknown; reasons: string[] }`
  - `TurnIO = { interactive: boolean; autoApprove: boolean; confirm(req: ApprovalRequest): Promise<boolean> }`
  - `TurnEvent = { type: 'text'; delta: string } | { type: 'tool-call'; tool: string; input: unknown } | { type: 'hook'; trace: HookTrace } | { type: 'approval'; tool: string; approved: boolean; reasons: string[] } | { type: 'tool-result'; tool: string; result: ToolResult } | { type: 'done'; text: string; steps: number } | { type: 'error'; message: string }`
  - `class ToolGateway { constructor(deps: { runtime: RuntimeManager; hooks: HookEngine; approvals: HostSettings['approvals'] }); preflight(ctx: SessionCtx, toolCallId: string, qualifiedName: string, input: unknown): Promise<ToolBeforeOutcome>; execute(ctx: SessionCtx, toolCallId: string, qualifiedName: string, emit: (e: TurnEvent) => void): Promise<ToolResult>; invoke(ctx: SessionCtx, qualifiedName: string, input: unknown, io: TurnIO, emit: (e: TurnEvent) => void): Promise<ToolResult> }`. `invoke` is `preflight` + confirm + `execute`, used by `tools call`

- [ ] **Step 1: Write the failing tests**

```ts
test('schema-invalid input never reaches the plugin', async () => {
  const r = await gw.invoke(ctx, 'echo.echo', { text: 42 }, io, emit);
  expect(r).toMatchObject({ isError: true }); expect(JSON.stringify(r.content)).toContain('/text must be string');
  expect(runtimeCalls).toHaveLength(0);
});
test('deny returns a blocked result containing the reason', async () => {
  expect(JSON.stringify((await gwWith(['deny2.mjs']).invoke(ctx, 'echo.echo', { text: 'a' }, io, emit)).content)).toContain('blocked by deny2: nope');
});
test('ask in non-interactive session denies without calling confirm', async () => {
  const confirm = vi.fn();
  const r = await gwWith(['ask.mjs']).invoke(ctx, 'echo.echo', { text: 'a' }, { interactive: false, autoApprove: false, confirm }, emit);
  expect(confirm).not.toHaveBeenCalled(); expect(JSON.stringify(r.content)).toContain('approval required but session is non-interactive');
});
test('ask + interactive confirm true executes; autoApprove skips prompt', async () => { /* ... */ });
test('host approvals=destructive asks for destructiveHint tools even if hooks allow', async () => { /* ... */ });
test('rewritten input is what the plugin receives and after-hooks see the result', async () => { /* rewrite.mjs -> echo returns "A" */ });
test('a rewrite that violates the tool schema denies', async () => { /* hook returns updatedInput {text: 42} -> blocked, plugin not called */ });
test('preflight is cached per toolCallId so hooks run once across approval and execute', async () => { /* call preflight twice + invoke -> echo-payload fixture wrote once */ });
```

- [ ] **Step 2: Run** `pnpm vitest run packages/core/test/gateway.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement.** Split `invoke` into `preflight(ctx, toolCallId, qualifiedName, input)` (validate, run `PreToolUse`, combine with host policy; cached by `toolCallId`) and `execute(...)` (call the plugin with the preflight's effective input, then run `PostToolUse`). Task 8 calls `preflight` from the AI SDK `toolApproval` callback and `execute` from the tool's `execute`, as in spike-libs. `tools call` uses both directly. Validate with an Ajv instance that caches compiled schemas per tool. The final decision combines the hook outcome with the host policy (`approvals`, `annotations.destructiveHint`) using the same precedence. Emit `hook`, `approval`, `tool-call` and `tool-result` events in order.
- [ ] **Step 4: Run** the test command. Expected: PASS.
- [ ] **Step 5: Commit** `feat(core): tool gateway with validation, hooks and approvals`.

### Task 8: Model factory, mock model and session loop

**Files:**
- Create: `packages/core/src/agent/{model.ts,mock-model.ts,session.ts}`
- Create: `test/fixtures/scripts/{answer.json,write-secret.json,search-then-answer.json,bad-args.json}`
- Test: `packages/core/test/session.test.ts`

**Interfaces:**
- Consumes: `ToolGateway`, `HostTool[]`, `ModelSettings`.
- Produces:
  - `createModel(s: ModelSettings): LanguageModel`. `mock` reads a script at path `s.id`: `{ steps: ({ tool: string; input: unknown } | { text: string })[], capture?: string }`. When `capture` is set, it writes the tool names offered at each step to that JSON file.
  - `class Session { constructor(deps: { model: LanguageModel; gateway: ToolGateway; tools: HostTool[]; maxSteps: number; cwd: string }); readonly id: string; runTurn(prompt: string, io: TurnIO): AsyncIterable<TurnEvent> }`

- [ ] **Step 1: Write the failing tests**

```ts
test('no tools are offered when no plugins are running', async () => {
  await drain(session({ tools: [], script: 'answer.json' }).runTurn('hi', io));
  expect(captured()).toEqual([[]]);
});
test('model-facing names map back to qualified names', async () => {
  const ev = await drain(session({ tools: echoTools, script: 'search-then-answer.json' }).runTurn('x', io));
  expect(ev.filter((e) => e.type === 'tool-call').map((e) => e.tool)).toEqual(['echo.echo']);
  expect(ev.at(-1)).toMatchObject({ type: 'done', steps: 2 });
});
test('bad args from the model produce an error result and the loop continues', async () => {
  const ev = await drain(session({ tools: echoTools, script: 'bad-args.json' }).runTurn('x', io));
  expect(ev.find((e) => e.type === 'tool-result')).toMatchObject({ result: { isError: true } });
  expect(ev.at(-1)?.type).toBe('done');
});
test('maxSteps stops runaway loops', async () => { /* script with 30 tool steps, maxSteps 3 -> done.steps === 3 */ });
```

- [ ] **Step 2: Run** `pnpm vitest run packages/core/test/session.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement.** Use `new ToolLoopAgent({ model, tools, stopWhen: isStepCount(maxSteps), toolCallConcurrency: 1, toolApproval, experimental_toolApprovalSecret })`, where `toolApproval` calls `gateway.preflight` and maps `deny` → `{ type: 'denied', reason }`, `ask` → `{ type: 'user-approval', reason }` (or `denied` when non-interactive without `--yes`), `allow` → `'not-applicable'`. For `user-approval`, `TurnIO.confirm` is asked with the preflight's effective input, then the turn resumes by appending `responseMessages` and a `tool-approval-response` message. Each `HostTool` becomes `dynamicTool({ description, inputSchema: jsonSchema(t.inputSchema, { validate }), execute: (input, { toolCallId }) => gateway.execute(...) })` keyed by `modelName`, with `validate` backed by the gateway's Ajv. Without `validate`, the SDK does not validate. Use `agent.stream()` and map `result.stream` parts to `TurnEvent`s. The mock model follows the `MockLanguageModelV4` shape in `spike-libs/host.mjs`. `model.ts` builds one `createProviderRegistry({ 'openai-compatible': createOpenAICompatible({ name: 'local', baseURL }), openai: createOpenAI(), anthropic: createAnthropic(), mock: customProvider(...) })` and resolves `registry.languageModel(settings.model)`. Never pass a bare model string, because that routes to the Vercel AI Gateway. Use `@ai-sdk/openai-compatible`, not `@ai-sdk/openai`, for local servers. Add one test per unsafe default (no validation, concurrency, bare string).
- [ ] **Step 4: Run** the test command. Expected: PASS.
- [ ] **Step 5: Commit** `feat(core): model factory, scripted mock model, session loop`.

### Task 9: Host facade

**Files:**
- Create: `packages/core/src/host.ts`, `packages/core/src/index.ts`
- Test: `packages/core/test/host.test.ts`

**Interfaces:**
- Consumes: Tasks 1–8.
- Produces: `class Host { static open(opts?: { home?: string; env?: NodeJS.ProcessEnv }): Promise<Host>; readonly paths: HarnessPaths; readonly plugins: PluginStore; readonly config: ConfigStore; settings(): Promise<HostSettings>; start(opts?: { only?: string[] }): Promise<PluginStatus[]>; tools(): HostTool[]; callTool(qualifiedName: string, input: unknown, io: TurnIO, emit?: (e: TurnEvent) => void): Promise<ToolResult>; newSession(opts?: { cwd?: string }): Promise<Session>; inspect(name: string, opts?: { live?: boolean }): Promise<PluginInspection>; close(): Promise<void> }`, where `PluginInspection = { entry: RegistryEntry; manifest: PluginManifest; config: { values: Record<string, unknown>; issues: ConfigIssue[] }; commands: string[][]; hooks: { event; match; command: string[] }[]; status?: PluginStatus; tools?: HostTool[] }` and secrets are masked.

- [ ] **Step 1: Write the failing tests**

```ts
test('start launches only enabled plugins with valid config', async () => {
  await installEcho(host); await installEcho(host, 'two'); await host.plugins.setEnabled('two', false);
  expect((await host.start()).map((s) => s.plugin)).toEqual(['echo']);
});
test('invalid config is reported as failed with the missing keys, not thrown', async () => {
  await installFixture(host, 'needs-config');
  expect(await host.start()).toContainEqual(expect.objectContaining({ plugin: 'needs-config', state: 'failed', error: expect.stringContaining('dir is required') }));
});
test('inspect masks secrets and lists live tools', async () => { /* ... */ });
test('callTool goes through hooks like agent calls', async () => { /* deny hook fixture plugin blocks echo.echo via host.callTool */ });
```

- [ ] **Step 2: Run** `pnpm vitest run packages/core/test/host.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement** the composition only, with no new logic beyond wiring.
- [ ] **Step 4: Run** `pnpm vitest run packages/core`. Expected: PASS (all core tests).
- [ ] **Step 5: Commit** `feat(core): host facade`.

### Task 10: CLI plugin commands

**Files:**
- Create: `packages/cli/src/{index.ts,commands/plugin.ts,render.ts,io.ts}`
- Test: `test/e2e/lifecycle.test.ts`

**Interfaces:**
- Consumes: `Host` (Task 9).
- Produces: the binary `harness` with `plugin install|uninstall|list|inspect|enable|disable|config|validate`, exit codes `0` ok, `1` runtime error, `2` validation or usage error, `3` consent declined. Also the test helper `cli(args: string[], opts?: { input?: string; env?: Record<string, string> }): Promise<{ code: number; stdout: string; stderr: string }>`, which runs the built binary with a temporary `HARNESS_HOME`.

- [ ] **Step 1: Write the failing tests**

```ts
test('install shows exact commands and permissions; declining exits 3', async () => {
  const r = await cli(['plugin', 'install', fixture('plugins/echo')], { input: 'n\n' });
  expect(r.stdout).toMatch(/Will run:\s+node .*plugins\/echo\/server\.mjs/); expect(r.stdout).toContain('Permissions: none declared');
  expect(r.code).toBe(3);
});
test('install --yes, list, disable, enable round-trip', async () => { /* list --json shows enabled flags */ });
test('invalid manifest exits 2 listing fields', async () => {
  const r = await cli(['plugin', 'validate', fixture('plugins/bad-event')]);
  expect(r.code).toBe(2); expect(r.stderr).toContain('hooks.0.event');
});
test('config set/get with coercion and masking', async () => { /* set limit=5 -> get shows 5; secret shows •••• */ });
test('inspect --live prints tools and log path', async () => { /* ... */ });
```

- [ ] **Step 2: Run** `pnpm build && pnpm vitest run test/e2e/lifecycle.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement** with commander (`parseAsync`, `exitOverride`, `configureOutput`); tables with `cli-table3`, colour with `node:util` `styleText`. Prompts use `@inquirer/prompts` with `output: process.stderr` so `--json` stdout stays clean, and `ExitPromptError` (Ctrl-C) maps to exit 3. When the consent prompt (`confirm`) runs on a non-TTY stdin, it reads a single line. The consent screen prints `Will run:` followed by each command as a space-joined argv, then `Permissions:` with one line per declared item, or `none declared`. If required config is missing after install, it offers interactive prompts generated from the schema (string → `input`, boolean → `confirm`, enum → `select`, `x-secret` → `password`, integer/number → `number`). This mapping, about 150 lines, is custom because no maintained schema-to-prompt library exists; tests drive it with `@inquirer/testing`.
- [ ] **Step 4: Run** the test command. Expected: PASS.
- [ ] **Step 5: Commit** `feat(cli): plugin lifecycle commands`.

### Task 11: CLI tools, run, chat and settings

**Files:**
- Create: `packages/cli/src/commands/{tools.ts,agent.ts,settings.ts}`
- Test: extend `test/e2e/lifecycle.test.ts`

**Interfaces:**
- Consumes: `Host.callTool`, `Host.newSession`, `Session.runTurn`, `saveSetting`.
- Produces: `harness tools list [--json]`, `harness tools call <q> --input <json> [--yes]`, `harness run <prompt> [--json] [--yes] [--max-steps N]`, `harness chat`, and `harness config get|set`. With `--json`, `run` prints one `TurnEvent` per line (JSON Lines).

- [ ] **Step 1: Write the failing tests**

```ts
test('tools list with zero plugins', async () => expect((await cli(['tools', 'list'])).stdout).toContain('No tools (0 plugins enabled)'));
test('tools call prints structured result', async () => { /* echo.echo {"text":"hi"} -> stdout contains "hi" */ });
test('run with mock model streams text and emits JSONL events', async () => {
  const r = await cli(['run', 'hi', '--json'], { env: { HARNESS_MODEL: `mock:${fixture('scripts/search-then-answer.json')}` } });
  expect(r.stdout.trim().split('\n').map((l) => JSON.parse(l).type)).toEqual(expect.arrayContaining(['tool-call', 'tool-result', 'done']));
});
test('run never reads stdin when non-interactive and a hook asks', async () => { /* stdin closed; exits 0; tool-result contains non-interactive reason */ });
```

- [ ] **Step 2: Run** `pnpm build && pnpm vitest run test/e2e/lifecycle.test.ts`. Expected: FAIL on the new tests.
- [ ] **Step 3: Implement.** `chat` uses `node:readline/promises`, with built-in slash commands `/tools`, `/plugins` and `/exit`. `io.ts` creates `TurnIO` with `interactive = process.stdin.isTTY && process.stdout.isTTY`.
- [ ] **Step 4: Run** the test command. Expected: PASS.
- [ ] **Step 5: Commit** `feat(cli): tools, run, chat, settings`.

### Task 12: `notes` plugin (Python)

**Files:**
- Create: `plugins/notes/{harness-plugin.json,server.py,README.md}`, `plugins/notes/tests/test_server.py`

**Interfaces:**
- Produces: tools `search(query: str, limit: int | None) -> list[{path, line, text}]`, `read(path: str) -> str` and `write(path: str, content: str) -> str` (append-only, annotated `readOnlyHint: false, destructiveHint: false`), using the manifest in PROTOCOL-v1-draft.md §10. `search` and `read` are annotated `readOnlyHint: true`.

- [ ] **Step 1: Write the failing tests** (pytest, calling the tool functions directly with `HARNESS_PLUGIN_CONFIG` set via `monkeypatch`)

```python
def test_search_respects_limit(notes): assert len(server.search("line", limit=2)) == 2
def test_read_rejects_traversal(notes): pytest.raises(ValueError, server.read, "../secret.txt")
def test_write_appends_and_creates(notes): server.write("todo.md", "a"); server.write("todo.md", "b"); assert (notes / "todo.md").read_text() == "a\nb\n"
def test_read_only_blocks_write(notes_ro): pytest.raises(ValueError, server.write, "x.md", "y")
```

- [ ] **Step 2: Run** `uv run --with pytest --with "mcp>=2.3,<3" pytest plugins/notes/tests -q`. Expected: FAIL.
- [ ] **Step 3: Implement** by extending `spike/notes_server.py` with `read`, `maxResults` and annotations.
- [ ] **Step 4: Run** the pytest command, then `harness plugin validate plugins/notes`. Expected: PASS, `Validation passed`.
- [ ] **Step 5: Commit** `feat(plugins): notes MCP plugin in Python`.

### Task 13: `guard` plugin (Node, hooks only)

**Files:**
- Create: `plugins/guard/{harness-plugin.json,package.json,src/guard.mjs,README.md}`, build output `plugins/guard/dist/guard.mjs` (committed), `plugins/guard/test/guard.test.mjs`

**Interfaces:**
- Produces: the hook behaviour in PROTOCOL-v1-draft.md §10, in Claude wire format. Detection is `@secretlint/core` with `@secretlint/secretlint-rule-preset-recommend` (comment-directive rule removed), plus the configurable `secretPatterns` (defaults `sk-[A-Za-z0-9_-]{8,}`, `AKIA[0-9A-Z]{16}`) for formats the preset skips. The audit line format is `{"ts","session","event","tool","decision","reasons","redactions"}`, written with `appendFileSync` (or `pino` with `sync: true`).

- [ ] **Step 1: Write the failing tests** (`node:test`, spawning `guard.mjs` with crafted payloads)

```js
const out = (r) => r.hookSpecificOutput;
test('redacts secrets in PreToolUse input', () => assert.equal(out(run(before({ content: 'k sk-abcdef123456' }))).updatedInput.content, 'k [REDACTED]'));
test('redacts a GitHub token found by secretlint', () => assert.equal(out(run(before({ content: 'k ghp_' + 'a'.repeat(36) }))).updatedInput.content, 'k [REDACTED]'));
test('a secretlint-disable comment in content does not switch scanning off', () => assert.match(out(run(before({ content: '// secretlint-disable\nghp_' + 'a'.repeat(36) }))).updatedInput.content, /\[REDACTED\]/));
test('deny pattern exits 2 with a reason', () => assert.equal(runRaw(before({}, { deny: ['notes.write'] }, 'notes.write')).exitCode, 2));
test('destructiveHint asks when askOnDestructive', () => assert.equal(out(run(before({}, {}, 'x.rm', { destructiveHint: true }))).permissionDecision, 'ask'));
test('monitor mode allows but still audits', () => { const o = run(before({}, { mode: 'monitor', deny: ['**'] })); assert.equal(out(o).permissionDecision, 'allow'); assert.equal(auditLines().length, 1); });
test('redacts secrets in PostToolUse output', () => assert.match(JSON.stringify(out(run(after('token sk-abcdef123456'))).updatedToolOutput), /\[REDACTED\]/));
```

- [ ] **Step 2: Run** `pnpm --filter guard build && node --test plugins/guard/test`. Expected: FAIL.
- [ ] **Step 3: Implement** `src/guard.mjs`, starting from `spike-libs/plugins/guard/src/guard.mjs`. It reads stdin, dispatches on `hook_event_name`, matches with `picomatch` against `_harness.tool`, and writes the audit log to `HARNESS_PLUGIN_DATA/audit.jsonl`. Redaction walks every string leaf. secretlint's match ranges are used only for rules whose ranges were validated (GitHub tokens to start with); any other hit redacts the whole leaf. The `build` script bundles it into `dist/guard.mjs` with `esbuild --bundle --platform=node --format=esm --target=node22` and a `createRequire` banner, so the installed plugin has no `node_modules`. CI fails if `dist/` is stale.
- [ ] **Step 4: Run** the node test command, then `harness plugin validate plugins/guard`. Expected: PASS.
- [ ] **Step 5: Commit** `feat(plugins): guard policy hooks in Node`.

### Task 14: Proof tests, architecture test and protocol docs

**Files:**
- Create: `test/e2e/proof.test.ts`, `test/architecture.test.ts`, `docs/PROTOCOL.md` (promoted from `PROTOCOL-v1-draft.md`), `docs/PLUGIN_GUIDE.md`, `README.md`

**Interfaces:**
- Consumes: the CLI (Tasks 10–11), `notes` (Task 12) and `guard` (Task 13).

- [ ] **Step 1: Write the failing tests** (each maps to a SPEC success criterion)

```ts
test('#9 zero baseline: model is offered no tools', async () => { await cli(['run', 'hi'], mock('answer.json')); expect(captured()).toEqual([[]]); });
test('#2 install adds exactly the notes tools; uninstall removes them', async () => { /* tools list --json names === ['notes.read','notes.search','notes.write'] then [] */ });
test('#11 composition: guard redacts what notes writes; disabling guard restores raw', async () => {
  await installNotes(); await installGuard();
  await cli(['run', 'save', '--yes'], mock('write-secret.json'));
  expect(read('todo.md')).toContain('[REDACTED]'); expect(auditLines()).toHaveLength(2);
  await cli(['plugin', 'disable', 'guard']); await cli(['run', 'save', '--yes'], mock('write-secret.json'));
  expect(read('todo.md')).toContain('sk-abcdef123456');
});
test('#12 deny leaves the file untouched and tells the model', async () => { /* guard config deny=["notes.write"] */ });
test('#8 non-interactive ask denies without blocking', async () => { /* guard ask=["notes.write"], no --yes, stdin closed, completes < 10s */ });
```

```ts
test('#10 core and cli contain no plugin-specific code', () => {
  const files = globSync('packages/{core,cli}/src/**/*.ts');
  for (const f of files) { const s = readFileSync(f, 'utf8'); expect(s, f).not.toMatch(/from ['"].*plugins\//); expect(s, f).not.toMatch(/\b(notes|guard)\b/i); }
});
```

- [ ] **Step 2: Run** `pnpm build && pnpm vitest run test/e2e/proof.test.ts test/architecture.test.ts`. Expected: FAIL until the fixtures and scripts exist, then PASS. Any failure here is a real bug in Tasks 1–13; fix it in the owning task's module.
- [ ] **Step 3: Write the docs.** `docs/PROTOCOL.md` is the reviewed draft. `docs/PLUGIN_GUIDE.md` walks through building a tool plugin and a hook plugin from scratch in 15 minutes. `README.md` covers quick start, the trust model and the MVP demo script from PLANNING.md §9.
- [ ] **Step 4: Run** `pnpm test`, then manually run the PLANNING.md §9 demo against Ollama with a tool-capable model. Expected: all tests PASS, and the demo completes as written (SPEC criterion 20).
- [ ] **Step 5: Commit** `test: proof suite; docs: protocol v1, plugin guide, README`. Tag `v0.1.0-mvp`.

---

## M2: Complete CLI product (task outlines)

Each task follows the same five-step cycle. Acceptance criteria and verification are listed; the interfaces extend the ones above.

- [ ] **Task 15: git and npm sources, `update` with permission-diff consent.** Widen `PluginSource` with `{ type: 'git'; url; ref? }` and `{ type: 'npm'; spec }`. Git uses `simple-git`: clone with `--no-checkout` and hooks and filters disabled, then check out the resolved full commit SHA. npm uses `npm-package-arg` to parse the spec and `pacote.extract(spec, stage, { ignoreScripts: true, integrity })`, so no install scripts run, and records the resolved version and integrity. `update` re-plans the plugin, using `pacote.packument` + `semver` for npm. If `permissionsSha256` changed, it shows a `microdiff` of the normalised permissions and re-asks. *Verify:* e2e installs from a local bare git repo fixture at a tag, and an update with added `network` permission prompts. *Files:* `store/sources/{git,npm}.ts`, `commands/plugin.ts`.
- [ ] **Task 16: `plugin new` templates.** Templates are `mcp-node`, `mcp-python` and `hook-node`, each with a README, a test config and hook fixtures. *Verify:* SPEC #14 (new → test → install --link → tool callable). *Files:* `packages/plugin-kit/templates/*`, `commands/plugin.ts`.
- [ ] **Task 17: `plugin test` conformance kit.** Runs validate, a temporary install, config from `test/config.json`, start and listTools with schema checks, then replays `test/hooks/*.json` fixtures. It uses the official MCP client and Ajv (the official conformance package does not yet support stdio or spec 2026-07-28), prints a pass/fail table and exits non-zero on failure. The docs point authors to `npx @modelcontextprotocol/inspector --cli` for interactive debugging. *Verify:* passes for `notes`, `guard` and all templates, and fails with a named check for a broken fixture. *Files:* `packages/plugin-kit/src/conformance.ts`.
- [ ] **Task 18: `commands` contribution.** Markdown with front-matter `args`, parsed with `yaml` (`parseDocument(fm, { uniqueKeys: true }).toJS({ maxAliasCount: 0 })`; not `gray-matter`), rendered with a minimal `{{name}}` replacer of about 30 lines, and run as `/plugin:cmd` in `chat` and `run`. Command names are namespaced and collisions are impossible. *Verify:* `/notes:digest` is unknown with zero plugins; after install, the mock model receives the rendered prompt. *Files:* `core/src/commands.ts`, `plugins/notes/commands/digest.md`.
- [ ] **Task 19: session hooks.** `SessionStart` contributes `hookSpecificOutput.additionalContext` to the system instructions, `UserPromptSubmit` can block (top-level `decision: "block"`, `reason`, or exit 2) or add context, and `SessionEnd` is fire-and-forget. Context strings are capped at 10,000 characters, as in Claude Code. *Verify:* fixture hooks in the engine tests; guard gains an optional `session.start` policy notice. *Files:* `hooks/engine.ts`, `agent/session.ts`.
- [ ] **Task 20: keychain secrets and strict env.** Secrets move to `@napi-rs/keyring` (`AsyncEntry(service, account)` with `setPassword`/`getPassword`/`deletePassword`) under service `harness`, account `<plugin>/<key>`. When the keychain is unavailable, the host never falls back silently: it says so, and uses the `0600` file only when the user opts in (optionally encrypted with `age-encryption`). An existing secrets file is migrated on first run. *Verify:* unit test with a fake keyring; manual check on macOS Keychain. *Files:* `config/secret-store.ts`.
- [ ] **Task 21: `plugin logs`, `doctor`, wrapped third-party plugin.** `doctor` checks Node (≥ 22.22.2), `uv` and `git` (located with `which`), keychain availability, model reachability and each enabled plugin's startup. Add `examples/wrap-filesystem`. *Verify:* SPEC #13. *Files:* `commands/{plugin,doctor}.ts`, `examples/wrap-filesystem/harness-plugin.json`.

## M3: Local web app (task outlines)

- [ ] **Task 22: HTTP API.** Hono with `@hono/node-server` on `127.0.0.1` at a random or `--port` port, launched with `open`. A per-launch token travels in the URL fragment and is sent as `Authorization: Bearer` (`bearerAuth`), never in a query string. `secureHeaders` is on, and an exact `Host` and `Origin` check of about 15 lines replaces `csrf()`, which skips JSON requests. Registry and config writes go through `fs-atomic.ts` (`proper-lockfile`). Endpoints mirror the CLI (`GET /api/plugins`, `GET /api/plugins/:name`, `POST /api/plugins/:name/enable`, `PUT /api/plugins/:name/config`, `GET /api/tools`, `POST /api/tools/:q/call`, `POST /api/sessions`, `POST /api/sessions/:id/turns` streaming an AI SDK UI message stream (`createUIMessageStream` with `data-hook` parts for hook traces, `createUIMessageStreamResponse`), `POST /api/approvals/:id`). *Verify:* API tests with `app.request()`; requests without the token get 401; a non-local `Host` gets 403.
- [ ] **Task 23: Plugins and inspect pages.** A list with enable toggles, and an inspect page showing manifest, consent summary, live tools with schemas, hooks, status and log tail. Built with Vite, `@tanstack/react-query` and shadcn/ui components copied into the repo. The log tail uses Hono `streamSSE` read with `fetch` + `eventsource-parser`, because `EventSource` cannot send the bearer header. *Verify:* Playwright smoke test against the built UI with a temporary home.
- [ ] **Task 24: Config forms.** `@rjsf/core` with the `@rjsf/shadcn` theme and `@rjsf/validator-ajv8` (`customizeValidator` adds `x-secret` and `x-path-kind`) renders each plugin's `config` schema. `x-secret` fields render as write-only password inputs that show "set" or "not set". Server-side validation errors map to fields. *Verify:* Playwright submits an invalid then a valid `notes` config.
- [ ] **Task 25: Chat with timeline and approvals.** Built on `@ai-sdk/react` `useChat` with `DefaultChatTransport` and `addToolApprovalResponse` (`sendAutomaticallyWhen: lastAssistantMessageIsCompleteWithApprovalResponses`). Chat, tool and confirmation components are copied from the shadcn/ui AI patterns, not the `ai-elements` package, which announces deprecation in November 2026. The page shows streaming text, inline cards for tool calls, hook traces and results, and approve/deny buttons for `ask`; the server keeps the authoritative approval state. *Verify:* SPEC #21 with the mock model and the guard `ask` fixture.

## M4: Hardening and release (task outlines)

- [ ] **Task 26: Opt-in sandbox.** Host setting `sandbox: true` wraps every plugin spawn with `srt`. Settings are generated from `permissions`: `allowWrite` from filesystem `read-write` paths plus `${plugin.data}`, and `allowedDomains` from `network`. `doctor` reports missing `bubblewrap`/`socat`/`ripgrep` on Linux. *Verify:* a fixture plugin that tries to write outside its declared path fails under the sandbox and succeeds without it (Linux CI with bubblewrap, plus manual macOS).
- [ ] **Task 27: Robustness.** Crash restart with `p-retry` backoff (maximum 3 per session; side-effecting calls are never replayed), and a strict MCP stdio transport of about 70 lines on `execa` (`extendEnv: false`, `killDescendants: true`) built from the SDK's `ReadBuffer`/`serializeMessage`, replacing the official transport's default environment and direct-child-only kill. Orphan processes are killed on SIGINT/SIGTERM via `exit-hook`, and a Windows smoke job (install `echo`, `tools call`, `run` with the mock model). *Verify:* CI on `windows-latest`; SIGINT test leaves no child processes (`ps` check on POSIX).
- [ ] **Task 28: Release.** Publish to npm with a `harness` binary, a docs site from `docs/`, a recorded demo, and a security pass against the OWASP MCP Top 10 with findings filed as issues. Before release, confirm the licence of `@rjsf/shadcn` (npm says MIT, repository says Apache-2.0) and of any staged pre-1.0 package such as `@bomb.sh/tab`. *Verify:* on a fresh VM, `npm i -g` and the demo complete in under 10 minutes (PLANNING.md §10 M4 exit).

---

## Self-review notes

- **Spec coverage.** SPEC criteria map to tasks as follows:
  - Lifecycle, #1–#5: Tasks 3, 4, 10.
  - Running plugins, #6–#8: Tasks 7, 11, 14.
  - Proofs, #9–#12: Task 14; #13: Task 21; #14: Task 16.
  - Robustness, #15–#19: Tasks 5, 6, 7.
  - Manual, #20: Task 14; #21: Task 25.
- **Type consistency.** `HostTool`, `ToolResult`, `ResolvedHook` and `PluginStatus` are defined once in Task 5. `TurnIO` and `TurnEvent` are defined once in Task 7. All later tasks reference these names unchanged.
- **Execution.** Tasks 1–9 are strictly sequential, since each consumes the previous interfaces. Tasks 12 and 13 (the plugins) can run in parallel with Tasks 5–11, because they depend only on the protocol, not on host code.
