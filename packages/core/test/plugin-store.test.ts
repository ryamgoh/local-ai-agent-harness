import { afterEach, beforeEach, expect, test } from 'vitest';
import { mkdtemp, mkdir, writeFile, readFile, rm, lstat, symlink, readdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { resolvePaths, type HarnessPaths } from '../src/paths.js';
import { PluginStore } from '../src/store/plugin-store.js';

let home: string, paths: HarnessPaths, store: PluginStore, source: string;
const manifest = {
  apiVersion: 1,
  name: 'sample',
  version: '1.0.0',
  mcpServers: { s: { command: 'node', args: ['${plugin.root}/server.mjs'] } },
};
beforeEach(async () => {
  home = await mkdtemp(join(tmpdir(), 'harness-store-'));
  process.env.HARNESS_HOME = home;
  paths = resolvePaths(home);
  store = new PluginStore(paths);
  source = join(home, 'source');
  await mkdir(source);
  await writeFile(join(source, 'harness-plugin.json'), JSON.stringify(manifest));
  await writeFile(join(source, 'server.mjs'), 'original');
});
afterEach(async () => {
  await rm(home, { recursive: true, force: true });
});

test('install copies and registers an enabled plugin with integrity hashes', async () => {
  const plan = await store.plan(source);
  expect(plan.commands[0]).toEqual(['node', join(source, 'server.mjs')]);
  const entry = await store.install(plan);
  expect(entry).toMatchObject({
    name: 'sample',
    enabled: true,
    linked: false,
    installPath: join(paths.pluginsDir, 'sample'),
  });
  expect(entry.manifestSha256).toMatch(/^[a-f0-9]{64}$/);
  expect(entry.permissionsSha256).toMatch(/^[a-f0-9]{64}$/);
  expect(await readFile(join(entry.installPath, 'server.mjs'), 'utf8')).toBe('original');
  expect((await new PluginStore(paths).list()).map((p) => p.name)).toEqual(['sample']);
});

test('same-name install fails unless force, and force leaves one entry', async () => {
  const plan = await store.plan(source);
  await store.install(plan);
  await expect(store.install(plan)).rejects.toMatchObject({ code: 'ALREADY_INSTALLED' });
  const forced = await store.install(plan, { force: true, enable: false });
  expect(forced.enabled).toBe(false);
  expect(await store.list()).toHaveLength(1);
  expect(
    (await readdir(paths.pluginsDir)).filter(
      (n) => n.startsWith('.staging-') || n.startsWith('.backup-'),
    ),
  ).toEqual([]);
});
test('link install creates a symlink, and uninstall never alters the source', async () => {
  const entry = await store.install(await store.plan(source), { link: true });
  expect((await lstat(entry.installPath)).isSymbolicLink()).toBe(true);
  expect((await store.load('sample')).dir).toBe(source);
  await store.uninstall('sample');
  expect(await store.get('sample')).toBeUndefined();
  expect(await readFile(join(source, 'server.mjs'), 'utf8')).toBe('original');
  expect(existsSync(entry.installPath)).toBe(false);
});
test('failed copy removes partial staging and never registers a plugin', async () => {
  await expect(
    store.install(await store.plan(source), {
      copy: async (_src, dest) => {
        await mkdir(dest);
        await writeFile(join(dest, 'partial'), 'x');
        throw new Error('simulated copy failure');
      },
    }),
  ).rejects.toThrow('simulated copy failure');
  expect(await store.list()).toEqual([]);
  expect(existsSync(join(paths.pluginsDir, 'sample'))).toBe(false);
  expect((await readdir(paths.pluginsDir)).filter((n) => n.startsWith('.staging-'))).toEqual([]);
});
test('failed force copy preserves the original installation and registry', async () => {
  const original = await store.install(await store.plan(source));
  await writeFile(join(source, 'server.mjs'), 'new');
  await expect(
    store.install(await store.plan(source), {
      force: true,
      copy: async () => {
        throw new Error('copy failure');
      },
    }),
  ).rejects.toThrow('copy failure');
  expect(await store.get('sample')).toEqual(original);
  expect(await readFile(join(original.installPath, 'server.mjs'), 'utf8')).toBe('original');
});
test('registry write failure after replacement rolls back the old install', async () => {
  const original = await store.install(await store.plan(source));
  const before = await readFile(paths.registryFile, 'utf8');
  await rm(paths.registryFile);
  await symlink(join(home, 'outside.json'), paths.registryFile);
  await writeFile(join(home, 'outside.json'), before);
  await expect(store.install(await store.plan(source), { force: true })).rejects.toMatchObject({
    code: 'PATH_ESCAPE',
  });
  expect(await readFile(join(original.installPath, 'server.mjs'), 'utf8')).toBe('original');
  expect(await readFile(join(home, 'outside.json'), 'utf8')).toBe(before);
});
test('simultaneous installs serialize and produce no duplicate entries', async () => {
  const plan = await store.plan(source);
  const results = await Promise.allSettled([
    store.install(plan),
    new PluginStore(paths).install(plan),
  ]);
  expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
  expect(await store.list()).toHaveLength(1);
});
test('setEnabled persists and unknown operations have typed errors', async () => {
  await store.install(await store.plan(source));
  expect((await store.setEnabled('sample', false)).enabled).toBe(false);
  expect((await new PluginStore(paths).get('sample'))?.enabled).toBe(false);
  expect((await store.setEnabled('sample', true)).enabled).toBe(true);
  await expect(store.uninstall('absent')).rejects.toMatchObject({ code: 'NOT_INSTALLED' });
  await expect(store.setEnabled('absent', true)).rejects.toMatchObject({ code: 'NOT_INSTALLED' });
});
test('changed linked commands and permissions require fresh forced installation', async () => {
  await store.install(await store.plan(source), { link: true });
  await writeFile(
    join(source, 'harness-plugin.json'),
    JSON.stringify({ ...manifest, permissions: { network: true } }),
  );
  await expect(store.load('sample')).rejects.toMatchObject({ code: 'CONSENT_REQUIRED' });
  await expect(store.setEnabled('sample', true)).rejects.toMatchObject({
    code: 'CONSENT_REQUIRED',
  });
  await store.install(await store.plan(source), { force: true, link: true });
  await expect(store.load('sample')).resolves.toBeDefined();
  await writeFile(
    join(source, 'harness-plugin.json'),
    JSON.stringify({ ...manifest, mcpServers: { s: { command: 'python', args: [] } } }),
  );
  await expect(store.load('sample')).rejects.toMatchObject({ code: 'CONSENT_REQUIRED' });
});
test('linked display-only metadata edits do not need new consent', async () => {
  await store.install(await store.plan(source), { link: true });
  await writeFile(
    join(source, 'harness-plugin.json'),
    JSON.stringify({ ...manifest, description: 'Updated description', version: '1.0.1' }),
  );
  expect((await store.load('sample')).manifest.description).toBe('Updated description');
});
test('a changed manifest between planning and installation is rejected', async () => {
  const plan = await store.plan(source);
  await writeFile(
    join(source, 'harness-plugin.json'),
    JSON.stringify({ ...manifest, permissions: { exec: true } }),
  );
  await expect(store.install(plan)).rejects.toMatchObject({ code: 'CONSENT_REQUIRED' });
  expect(await store.list()).toEqual([]);
});
test('escaping symlinks anywhere in the source tree are rejected', async () => {
  await writeFile(join(home, 'outside'), 'external');
  await symlink(join(home, 'outside'), join(source, 'unreferenced'));
  await expect(store.plan(source)).rejects.toMatchObject({ code: 'PATH_ESCAPE' });
});
test('plan leaves config values verbatim for pre-install consent', async () => {
  await writeFile(
    join(source, 'harness-plugin.json'),
    JSON.stringify({
      ...manifest,
      config: { type: 'object', properties: { folder: { type: 'string', format: 'path' } } },
      mcpServers: {
        s: { command: 'node', args: ['${plugin.root}/server.mjs', '${config.folder}'] },
      },
    }),
  );
  expect((await store.plan(source)).commands[0]).toEqual([
    'node',
    join(source, 'server.mjs'),
    '${config.folder}',
  ]);
});

test('built local plugin excludes development trees and their external dependency symlinks', async () => {
  const deps = join(source, 'node_modules');
  await mkdir(deps);
  await symlink(join(home, 'external-package'), join(deps, 'dev-package'), 'dir');
  await mkdir(join(source, '.git'));
  await writeFile(join(source, '.git', 'config'), 'private-development-config');
  await mkdir(join(source, '.venv'));
  await mkdir(join(source, '__pycache__'));
  await mkdir(join(source, '.pytest_cache'));
  const installed = await store.install(await store.plan(source));
  for (const name of ['node_modules', '.git', '.venv', '__pycache__', '.pytest_cache'])
    expect(existsSync(join(installed.installPath, name))).toBe(false);
  expect(await readFile(join(installed.installPath, 'server.mjs'), 'utf8')).toBe('original');
});
test('manifest references to escaping development dependencies still fail validation', async () => {
  await mkdir(join(source, 'node_modules'));
  await mkdir(join(home, 'external-package'));
  await writeFile(join(home, 'external-package', 'server.mjs'), 'external');
  await symlink(join(home, 'external-package'), join(source, 'node_modules', 'package'), 'dir');
  await writeFile(
    join(source, 'harness-plugin.json'),
    JSON.stringify({
      ...manifest,
      mcpServers: {
        s: { command: 'node', args: ['${plugin.root}/node_modules/package/server.mjs'] },
      },
    }),
  );
  await expect(store.plan(source)).rejects.toMatchObject({ code: 'MANIFEST_INVALID' });
});

test('failed force registration after staging restores old directory and consent receipt', async () => {
  const original = await store.install(await store.plan(source));
  const originalReceipt = await readFile(join(home, '.consent', 'sample.json'), 'utf8');
  const registryBackup = join(home, 'registry-backup.json');
  await writeFile(join(source, 'server.mjs'), 'replacement');
  const { cp, rename } = await import('node:fs/promises');
  const plan = await store.plan(source);
  try {
    await expect(
      store.install(plan, {
        force: true,
        copy: async (src, dest) => {
          await cp(src, dest, { recursive: true });
          await rename(paths.registryFile, registryBackup);
          await mkdir(paths.registryFile);
        },
      }),
    ).rejects.toThrow();
    expect(await readFile(join(original.installPath, 'server.mjs'), 'utf8')).toBe('original');
    expect(await readFile(join(home, '.consent', 'sample.json'), 'utf8')).toBe(originalReceipt);
    expect(
      (await readdir(paths.pluginsDir)).filter(
        (n) => n.startsWith('.staging-') || n.startsWith('.backup-'),
      ),
    ).toEqual([]);
  } finally {
    await rm(paths.registryFile, { recursive: true, force: true });
    await rename(registryBackup, paths.registryFile);
  }
  expect(await store.get('sample')).toEqual(original);
});
test('failed new registration leaves no installation, consent receipt, data, or registry entry', async () => {
  const { cp } = await import('node:fs/promises');
  const plan = await store.plan(source);
  await expect(
    store.install(plan, {
      copy: async (src, dest) => {
        await cp(src, dest, { recursive: true });
        await mkdir(paths.registryFile);
      },
    }),
  ).rejects.toThrow();
  expect(existsSync(join(paths.pluginsDir, 'sample'))).toBe(false);
  expect(existsSync(join(paths.dataDir, 'sample'))).toBe(false);
  expect(existsSync(join(home, '.consent', 'sample.json'))).toBe(false);
  await rm(paths.registryFile, { recursive: true });
  expect(await store.list()).toEqual([]);
});

test('a linked source root replaced with a symlink requires renewed consent', async () => {
  const { rename, cp } = await import('node:fs/promises');
  await store.install(await store.plan(source), { link: true });
  const moved = join(home, 'moved-source');
  await rename(source, moved);
  const alternate = join(home, 'alternate-source');
  await cp(moved, alternate, { recursive: true });
  await symlink(alternate, source, 'dir');
  await expect(store.load('sample')).rejects.toMatchObject({ code: 'CONSENT_REQUIRED' });
});
