import { afterEach, expect, test } from 'vitest';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve, join } from 'node:path';
import { resolvePaths } from '../src/paths.js';
import { buildEnv } from '../src/runtime/env.js';
import {
  RuntimeManager,
  toModelName,
  type ResolvedPlugin,
} from '../src/runtime/runtime-manager.js';
const roots: string[] = [];
const runtimes: RuntimeManager[] = [];
afterEach(async () => {
  await Promise.all(runtimes.splice(0).map((r) => r.stop()));
  await Promise.all(roots.splice(0).map((p) => rm(p, { recursive: true, force: true })));
});
async function setup() {
  const home = await mkdtemp(join(tmpdir(), 'harness-runtime-'));
  roots.push(home);
  const paths = resolvePaths(home);
  const rt = new RuntimeManager({ paths });
  runtimes.push(rt);
  return { rt, paths };
}
function plugin(
  home: string,
  name = 'echo',
  script = resolve('test/fixtures/plugins/echo/server.mjs'),
  timeout = 2000,
): ResolvedPlugin {
  const p: ResolvedPlugin = {
    name,
    priority: 100,
    root: resolve('test/fixtures/plugins/echo'),
    data: join(home, 'data', name),
    config: {},
    permissions: {},
    hooks: [],
    servers: {},
  };
  p.servers.main = {
    command: process.execPath,
    args: [script],
    cwd: p.root,
    env: buildEnv(p, {}),
    startupTimeoutMs: timeout,
  };
  return p;
}
test('real MCP tools are discovered and namespaced; logs capture stderr', async () => {
  const { rt, paths } = await setup();
  expect(await rt.start([plugin(paths.home), plugin(paths.home, 'second')])).toEqual(
    expect.arrayContaining([expect.objectContaining({ state: 'running' })]),
  );
  expect(
    rt
      .tools()
      .map((t) => t.qualifiedName)
      .sort(),
  ).toEqual(['echo.echo', 'echo.fail', 'second.echo', 'second.fail']);
  expect(rt.byModelName('mcp__second__echo')?.qualifiedName).toBe('second.echo');
  expect((await rt.call('echo.echo', { text: 'hello' })).structuredContent).toEqual({
    text: 'hello',
  });
  expect(await readFile(join(paths.logsDir, 'echo.log'), 'utf8')).toContain('fixture ready');
});
test('model names are sanitized, bounded, and collision resistant', () => {
  expect(toModelName('my-plugin', 'do.thing')).toBe('mcp__my-plugin__do_thing');
  const n = toModelName('ab', 'x'.repeat(80));
  expect(n).toMatch(/^[a-zA-Z0-9_-]{1,64}$/);
  expect(n).not.toBe(toModelName('ab', 'x'.repeat(79) + 'y'));
});
test('plugin environment contains only allowlisted base and owner config', () => {
  const p = plugin('/tmp/harness');
  p.config = { dir: '/My Files' };
  const env = buildEnv(p, { DECLARED: 'ok' }, { PATH: '/bin', AWS_SECRET: 'secret' });
  expect(env.AWS_SECRET).toBeUndefined();
  expect(env.DECLARED).toBe('ok');
  expect(JSON.parse(env.HARNESS_PLUGIN_CONFIG!)).toEqual({ dir: '/My Files' });
});
test('hung and garbage servers fail independently within their startup budget', async () => {
  const { rt, paths } = await setup();
  await mkdir(paths.pluginsDir, { recursive: true });
  const hang = join(paths.pluginsDir, 'hang.mjs');
  const junk = join(paths.pluginsDir, 'junk.mjs');
  await writeFile(hang, 'setInterval(() => {}, 1000);\n');
  await writeFile(junk, 'console.log("not json"); process.exit(1);\n');
  const statuses = await rt.start([
    plugin(paths.home, 'hung', hang, 200),
    plugin(paths.home, 'junk', junk, 200),
    plugin(paths.home),
  ]);
  expect(Object.fromEntries(statuses.map((s) => [s.plugin, s.state]))).toEqual({
    hung: 'failed',
    junk: 'failed',
    echo: 'running',
  });
});
test('a crash becomes an error result with log path and other servers still work', async () => {
  const { rt, paths } = await setup();
  const script = join(resolve('test/fixtures/plugins/echo'), 'crash.mjs');
  await rt.start([plugin(paths.home, 'crash', script), plugin(paths.home)]);
  const r = await rt.call('crash.boom', {});
  expect(r.isError).toBe(true);
  expect(JSON.stringify(r.content)).toContain(join(paths.logsDir, 'crash.log'));
  expect((await rt.call('echo.echo', { text: 'ok' })).isError).toBe(false);
});

test('runtime refuses plugin data or log paths outside its state root', async () => {
  const { rt, paths } = await setup();
  const outside = await mkdtemp(join(tmpdir(), 'harness-outside-'));
  roots.push(outside);
  const p = plugin(paths.home);
  p.data = join(outside, 'must-not-create');
  expect(await rt.start([p])).toContainEqual(
    expect.objectContaining({ state: 'failed', error: expect.stringContaining('contained') }),
  );
  const { access } = await import('node:fs/promises');
  await expect(access(p.data)).rejects.toThrow();
});
