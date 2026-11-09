import { afterEach, expect, test } from 'vitest';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { Host } from '../src/host.js';
const homes: string[] = [];
const hosts: Host[] = [];
afterEach(async () => {
  await Promise.all(hosts.splice(0).map((h) => h.close()));
  await Promise.all(homes.splice(0).map((h) => rm(h, { recursive: true, force: true })));
});
async function setup() {
  const home = await mkdtemp(join(tmpdir(), 'harness-host-'));
  homes.push(home);
  const host = await Host.open({ home });
  hosts.push(host);
  return host;
}
test('Host starts enabled plugins only and routes direct tool calls', async () => {
  const host = await setup();
  await host.plugins.install(await host.plugins.plan(resolve('test/fixtures/plugins/echo')), {
    link: true,
  });
  await host.start();
  expect(host.tools().map((t) => t.qualifiedName)).toEqual(['echo.echo', 'echo.fail']);
  const result = await host.callTool(
    'echo.echo',
    { text: 'hello' },
    { interactive: false, autoApprove: false, confirm: async () => false },
  );
  expect(result.structuredContent).toEqual({ text: 'hello' });
  await host.plugins.setEnabled('echo', false);
  expect(await host.start()).toEqual([]);
  expect(host.tools()).toEqual([]);
});
test('missing required config reports failed status without throwing', async () => {
  const host = await setup();
  const dir = join(host.paths.home, 'source');
  await mkdir(dir);
  await writeFile(
    join(dir, 'harness-plugin.json'),
    JSON.stringify({
      apiVersion: 1,
      name: 'needs-config',
      version: '1.0.0',
      config: { type: 'object', properties: { dir: { type: 'string' } }, required: ['dir'] },
    }),
  );
  await host.plugins.install(await host.plugins.plan(dir));
  expect(await host.start()).toContainEqual(
    expect.objectContaining({
      plugin: 'needs-config',
      state: 'failed',
      error: expect.stringContaining('dir is required'),
    }),
  );
});
test('inspect lists live schemas, status, commands, and log location', async () => {
  const host = await setup();
  await host.plugins.install(await host.plugins.plan(resolve('test/fixtures/plugins/echo')), {
    link: true,
  });
  const i = await host.inspect('echo', { live: true });
  expect(i.tools?.map((t) => t.qualifiedName)).toEqual(['echo.echo', 'echo.fail']);
  expect(i.status?.state).toBe('running');
  expect(i.status?.logFile).toBe(join(host.paths.logsDir, 'echo.log'));
  expect(i.tools?.[0]?.inputSchema).toHaveProperty('properties');
});

test('an enabled policy plugin with invalid configuration blocks tool use instead of silently dropping policy', async () => {
  const host = await setup();
  await host.plugins.install(await host.plugins.plan(resolve('test/fixtures/plugins/echo')), {
    link: true,
  });
  const dir = join(host.paths.home, 'policy-source');
  await mkdir(dir);
  await writeFile(join(dir, 'hook.mjs'), 'process.exit(2);\n');
  await writeFile(
    join(dir, 'harness-plugin.json'),
    JSON.stringify({
      apiVersion: 1,
      name: 'policy',
      version: '1.0.0',
      config: { type: 'object', properties: { mode: { type: 'string' } }, required: ['mode'] },
      hooks: [{ event: 'PreToolUse', command: 'node', args: ['${plugin.root}/hook.mjs'] }],
    }),
  );
  await host.plugins.install(await host.plugins.plan(dir));
  expect(await host.start()).toContainEqual(
    expect.objectContaining({ plugin: 'policy', state: 'failed' }),
  );
  await expect(
    host.callTool(
      'echo.echo',
      { text: 'must not execute' },
      { interactive: false, autoApprove: true, confirm: async () => true },
    ),
  ).rejects.toThrow(/enabled policy plugin/i);
});

test('state directories redirected by symlinks are rejected before Host writes', async () => {
  const { symlink } = await import('node:fs/promises');
  const home = await mkdtemp(join(tmpdir(), 'harness-state-'));
  const outside = await mkdtemp(join(tmpdir(), 'harness-outside-'));
  homes.push(home, outside);
  await symlink(outside, join(home, 'logs'));
  await expect(Host.open({ home })).rejects.toMatchObject({ code: 'PATH_ESCAPE' });
});
