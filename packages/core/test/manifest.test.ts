import { afterEach, beforeEach, expect, test } from 'vitest';
import { mkdtemp, mkdir, writeFile, rm, symlink } from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { loadManifest } from '../src/manifest/load.js';
import { manifestJsonSchema } from '../src/manifest/schema.js';
import { resolvePaths } from '../src/paths.js';

let home: string;
beforeEach(async () => {
  home = await mkdtemp(join(tmpdir(), 'harness-foundation-'));
  process.env.HARNESS_HOME = home;
});
afterEach(async () => {
  await rm(home, { recursive: true, force: true });
});
async function fixture(raw: object) {
  const dir = join(home, 'source');
  await mkdir(dir, { recursive: true });
  await writeFile(join(dir, 'harness-plugin.json'), JSON.stringify(raw));
  return dir;
}
const minimal = {
  apiVersion: 1,
  name: 'sample',
  version: '1.0.0',
  mcpServers: { s: { command: 'node', args: ['${plugin.root}/server.mjs'] } },
};

test('minimal manifest loads with defaults', async () => {
  const { manifest, warnings } = await loadManifest(await fixture(minimal));
  expect(manifest).toMatchObject({
    apiVersion: 1,
    name: 'sample',
    priority: 100,
    hooks: [],
    permissions: {},
  });
  expect(manifest.mcpServers.s?.startupTimeoutMs).toBe(10_000);
  expect(warnings).toEqual([]);
  expect(resolvePaths().home).toBe(home);
});

test.each([
  [{ ...minimal, name: 'X' }, 'name'],
  [{ ...minimal, version: '01.0.0' }, 'version'],
  [{ ...minimal, hooks: [{ event: 'MadeUp', command: 'node' }] }, 'hooks.0.event'],
  [{ ...minimal, hooks: [{ event: 'PreToolUse', command: 'node', matcher: '.*' }] }, 'hooks.0'],
  [{ ...minimal, permissions: { extra: true } }, 'permissions'],
  [
    { ...minimal, mcpServers: { s: { command: 'node', args: ['${plugin.root}/../x'] } } },
    'mcpServers.s.args.0',
  ],
  [
    { ...minimal, mcpServers: { s: { command: 'node', args: ['${foo.bar}'] } } },
    'mcpServers.s.args.0',
  ],
  [
    { ...minimal, mcpServers: { s: { command: 'node', env: { TOKEN: '${env.TOKEN}' } } } },
    'mcpServers.s.env.TOKEN',
  ],
  [
    { ...minimal, mcpServers: { s: { command: 'node', args: ['${config.missing}'] } } },
    'mcpServers.s.args.0',
  ],
  [{ ...minimal, commands: { go: { file: '../outside.md' } } }, 'commands.go.file'],
])('invalid manifest names failing field %#', async (raw, path) => {
  await expect(loadManifest(await fixture(raw))).rejects.toMatchObject({
    code: 'MANIFEST_INVALID',
    issues: expect.arrayContaining([expect.objectContaining({ path })]),
  });
});
test('unsupported API version is explicit', async () => {
  await expect(loadManifest(await fixture({ ...minimal, apiVersion: 2 }))).rejects.toThrow(
    'unsupported apiVersion 2 (host supports 1)',
  );
});
test('unknown top-level fields warn and hook defaults fail closed only for permission events', async () => {
  const loaded = await loadManifest(
    await fixture({
      ...minimal,
      flavour: 'test',
      hooks: [
        { event: 'PreToolUse', command: 'node' },
        { event: 'PostToolUse', command: 'node' },
        { event: 'UserPromptSubmit', command: 'node' },
      ],
    }),
  );
  expect(loaded.warnings).toEqual(['unknown top-level field "flavour"']);
  expect(loaded.manifest.hooks.map((h) => h.onError)).toEqual(['deny', 'allow', 'deny']);
  expect(loaded.manifest.hooks[0]).toMatchObject({ match: '**', timeout: 5 });
});
test('symlink escape in a referenced file is rejected', async () => {
  const dir = await fixture(minimal);
  await symlink(join(home, 'outside.mjs'), join(dir, 'server.mjs'));
  await writeFile(join(home, 'outside.mjs'), '');
  await expect(loadManifest(dir)).rejects.toMatchObject({ code: 'MANIFEST_INVALID' });
});
test('allowed config and environment variables validate', async () => {
  const dir = await fixture({
    ...minimal,
    config: { type: 'object', properties: { token: { type: 'string', 'x-secret': true } } },
    permissions: { env: ['TOKEN'], filesystem: [{ path: '${plugin.data}', access: 'read-write' }] },
    mcpServers: {
      s: {
        command: 'node',
        args: ['${plugin.root}/server.mjs', '${config.token}'],
        env: { TOKEN: '${env.TOKEN}' },
      },
    },
  });
  await expect(loadManifest(dir)).resolves.toBeDefined();
});
test('committed JSON schema matches source', () => {
  expect(manifestJsonSchema()).toEqual(JSON.parse(readFileSync('schema/plugin-v1.json', 'utf8')));
});

test('a dangling symlink to an external location is still an escape', async () => {
  const dir = await fixture(minimal);
  await symlink(join(home, 'not-created.mjs'), join(dir, 'server.mjs'));
  await expect(loadManifest(dir)).rejects.toMatchObject({
    code: 'MANIFEST_INVALID',
    issues: expect.arrayContaining([expect.objectContaining({ path: 'mcpServers.s.args.0' })]),
  });
});
test('a manifest file symlink cannot escape the plugin directory', async () => {
  const dir = join(home, 'source');
  await mkdir(dir);
  await writeFile(join(home, 'external.json'), JSON.stringify(minimal));
  await symlink(join(home, 'external.json'), join(dir, 'harness-plugin.json'));
  await expect(loadManifest(dir)).rejects.toMatchObject({ code: 'MANIFEST_INVALID' });
});
test.each([
  [{ ...minimal, mcpServers: { s: { command: 'node', transport: 'stdio' } } }, 'mcpServers.s'],
  [
    {
      ...minimal,
      permissions: { filesystem: [{ path: '${plugin.data}', access: 'read', extra: 1 }] },
    },
    'permissions.filesystem.0',
  ],
  [{ ...minimal, commands: { go: { file: 'go.md', extra: 1 } } }, 'commands.go'],
  [
    { ...minimal, hooks: [{ event: 'PreToolUse', command: 'node', timeout: 61 }] },
    'hooks.0.timeout',
  ],
  [{ ...minimal, config: { type: 'object', properties: { v: { type: 'made-up' } } } }, 'config'],
  [
    {
      ...minimal,
      config: { type: 'object', properties: { v: { type: 'string', format: 'unknown-format' } } },
    },
    'config',
  ],
])('nested fields and config schemas are validated %#', async (raw, path) => {
  await expect(loadManifest(await fixture(raw))).rejects.toMatchObject({
    code: 'MANIFEST_INVALID',
    issues: expect.arrayContaining([expect.objectContaining({ path })]),
  });
});

test.each(['--file=${plugin.root}/../outside', '${plugin.root}/../outside/${config.folder}'])(
  'plugin-root containment also covers option values and static prefixes: %s',
  (arg) => {
    return fixture({
      ...minimal,
      config: { type: 'object', properties: { folder: { type: 'string' } } },
      mcpServers: { s: { command: 'node', args: [arg] } },
    }).then((dir) =>
      expect(loadManifest(dir)).rejects.toMatchObject({
        code: 'MANIFEST_INVALID',
        issues: expect.arrayContaining([expect.objectContaining({ path: 'mcpServers.s.args.0' })]),
      }),
    );
  },
);
