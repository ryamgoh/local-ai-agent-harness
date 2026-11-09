import { afterEach, expect, test } from 'vitest';
import { execa } from 'execa';
import { mkdtemp, readFile, writeFile, rm, access } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
const homes: string[] = [];
afterEach(async () => {
  await Promise.all(homes.splice(0).map((p) => rm(p, { recursive: true, force: true })));
});
async function setup() {
  const home = await mkdtemp(join(tmpdir(), 'harness-proof-'));
  homes.push(home);
  const call = async (args: string[], model?: string) =>
    execa(process.execPath, [resolve('packages/cli/dist/index.js'), ...args], {
      env: { HARNESS_HOME: home, ...(model ? { HARNESS_MODEL: `mock:${model}` } : {}) },
      reject: false,
      timeout: 20000,
      stdin: 'ignore',
    });
  const install = async (name: string) => {
    const r = await call(['plugin', 'install', resolve('plugins', name), '--yes']);
    expect(r.exitCode, r.stderr).toBe(0);
  };
  const prepare = async () => {
    await install('notes');
    const r = await call([
      'plugin',
      'config',
      'notes',
      'set',
      `notesDir=${join(home, 'data', 'notes')}`,
    ]);
    expect(r.exitCode, r.stderr).toBe(0);
  };
  const script = async (steps: object[]) => {
    const path = join(home, 'model.json');
    await writeFile(
      path,
      JSON.stringify({
        steps,
        capture: join(home, 'capture.json'),
        captureMessages: join(home, 'messages.json'),
      }),
    );
    return path;
  };
  return { home, call, install, prepare, script };
}
test('SPEC #9 zero baseline: empty home offers zero tools', async () => {
  const s = await setup();
  const script = await s.script([{ text: 'No tools available.' }]);
  const r = await s.call(['run', 'hello', '--json'], script);
  expect(r.exitCode, r.stderr).toBe(0);
  expect(JSON.parse(await readFile(join(s.home, 'capture.json'), 'utf8'))).toEqual([[]]);
  expect(r.stdout).toContain('No tools available.');
});
test('install adds only discovered tools, disable removes them, enable restores them, uninstall removes them', async () => {
  const s = await setup();
  await s.prepare();
  const tools = async () => {
    const r = await s.call(['tools', 'list', '--json']);
    expect(r.exitCode, r.stderr).toBe(0);
    return JSON.parse(r.stdout)
      .map((t: { qualifiedName: string }) => t.qualifiedName)
      .sort();
  };
  expect(await tools()).toEqual(['notes.read', 'notes.search', 'notes.write']);
  expect((await s.call(['plugin', 'disable', 'notes'])).exitCode).toBe(0);
  expect(await tools()).toEqual([]);
  const m = await s.script([{ text: 'disabled' }]);
  expect((await s.call(['run', 'hello', '--json'], m)).exitCode).toBe(0);
  expect(JSON.parse(await readFile(join(s.home, 'capture.json'), 'utf8'))).toEqual([[]]);
  expect((await s.call(['plugin', 'enable', 'notes'])).exitCode).toBe(0);
  expect(await tools()).toEqual(['notes.read', 'notes.search', 'notes.write']);
  expect((await s.call(['plugin', 'uninstall', 'notes'])).exitCode).toBe(0);
  expect(await tools()).toEqual([]);
  // The complete lifecycle starts many CLI processes; each still has a 20s timeout.
}, 60_000);
test('SPEC #11 composition: guard redacts what notes writes; disabled guard restores raw content', async () => {
  const s = await setup();
  await s.prepare();
  await s.install('guard');
  const model = await s.script([
    {
      tool: 'mcp__notes__write',
      input: { path: 'todo.md', content: 'rotate key sk-abcdef123456' },
    },
    { text: 'Saved.' },
  ]);
  const r = await s.call(['run', 'save this', '--yes', '--json'], model);
  expect(r.exitCode, r.stderr).toBe(0);
  expect(await readFile(join(s.home, 'data', 'notes', 'todo.md'), 'utf8')).toBe(
    'rotate key [REDACTED]\n',
  );
  const audit = (await readFile(join(s.home, 'data', 'guard', 'audit.jsonl'), 'utf8'))
    .trim()
    .split('\n')
    .map((l) => JSON.parse(l));
  expect(audit.map((a) => a.event)).toEqual(['PreToolUse', 'PostToolUse']);
  expect((await s.call(['plugin', 'disable', 'guard'])).exitCode).toBe(0);
  expect((await s.call(['run', 'save this', '--yes', '--json'], model)).exitCode).toBe(0);
  expect(await readFile(join(s.home, 'data', 'notes', 'todo.md'), 'utf8')).toContain(
    'sk-abcdef123456',
  );
});
test('SPEC #12 deny prevents side effects and returns the reason to the model even with --yes', async () => {
  const s = await setup();
  await s.prepare();
  await s.install('guard');
  expect(
    (await s.call(['plugin', 'config', 'guard', 'set', 'deny=["notes.write"]'])).exitCode,
  ).toBe(0);
  const model = await s.script([
    { tool: 'mcp__notes__write', input: { path: 'blocked.md', content: 'do not save' } },
    { text: 'The operation was blocked.' },
  ]);
  const r = await s.call(['run', 'save', '--yes', '--json'], model);
  expect(r.exitCode, r.stderr).toBe(0);
  await expect(access(join(s.home, 'data', 'notes', 'blocked.md'))).rejects.toThrow();
  expect(r.stdout).toContain('blocked by guard:');
  expect(await readFile(join(s.home, 'messages.json'), 'utf8')).toContain('blocked by guard:');
});
test('SPEC #8 noninteractive ask denies promptly without reading stdin; --yes permits the rewritten input', async () => {
  const s = await setup();
  await s.prepare();
  await s.install('guard');
  expect((await s.call(['plugin', 'config', 'guard', 'set', 'ask=["notes.write"]'])).exitCode).toBe(
    0,
  );
  const model = await s.script([
    { tool: 'mcp__notes__write', input: { path: 'approval.md', content: 'sk-abcdef123456' } },
    { text: 'Finished.' },
  ]);
  const r = await s.call(['run', 'save', '--json'], model);
  expect(r.exitCode, r.stderr).toBe(0);
  expect(r.stdout).toContain('approval required but session is non-interactive');
  await expect(access(join(s.home, 'data', 'notes', 'approval.md'))).rejects.toThrow();
  const yes = await s.call(['run', 'save', '--yes', '--json'], model);
  expect(yes.exitCode, yes.stderr).toBe(0);
  expect(await readFile(join(s.home, 'data', 'notes', 'approval.md'), 'utf8')).toBe('[REDACTED]\n');
});
test('SPEC #6 direct calls pass through the same hooks as agent calls', async () => {
  const s = await setup();
  await s.prepare();
  await s.install('guard');
  const r = await s.call([
    'tools',
    'call',
    'notes.write',
    '--input',
    '{"path":"direct.md","content":"sk-abcdef123456"}',
    '--yes',
  ]);
  expect(r.exitCode, r.stderr).toBe(0);
  expect(await readFile(join(s.home, 'data', 'notes', 'direct.md'), 'utf8')).toBe('[REDACTED]\n');
  const search = await s.call(['tools', 'call', 'notes.search', '--input', '{"query":"REDACTED"}']);
  expect(search.exitCode, search.stderr).toBe(0);
  expect(search.stdout).toContain('direct.md');
});
test('SPEC #19 invalid model arguments are not sent to the plugin and the agent continues', async () => {
  const s = await setup();
  await s.prepare();
  const model = await s.script([
    { tool: 'mcp__notes__write', input: { path: 'invalid.md', content: 42 } },
    { text: 'Recovered from invalid arguments.' },
  ]);
  const r = await s.call(['run', 'save', '--json'], model);
  expect(r.exitCode, r.stderr).toBe(0);
  expect(r.stdout).toContain('Recovered');
  expect(r.stdout).toContain('tool-result');
  await expect(access(join(s.home, 'data', 'notes', 'invalid.md'))).rejects.toThrow();
});
