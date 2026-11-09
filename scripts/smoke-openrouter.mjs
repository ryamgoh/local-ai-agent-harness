import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import assert from 'node:assert/strict';
const credential = process.env.OPENROUTER_API_KEY;
assert(credential, 'Set OPENROUTER_API_KEY before running this optional paid smoke test.');
const home = mkdtempSync(join(tmpdir(), 'harness-openrouter-'));
const env = { ...process.env, HARNESS_HOME: home };
delete env.HARNESS_MODEL;
const cli = resolve('packages/cli/dist/index.js');
const safe = (text) => String(text ?? '').replaceAll(credential, '[REDACTED]');
function run(args) {
  const result = spawnSync(process.execPath, [cli, ...args], {
    env,
    encoding: 'utf8',
    timeout: 120000,
    maxBuffer: 4 << 20,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  assert.equal(result.status, 0, safe(result.stderr || result.error?.message || result.stdout));
  return result.stdout;
}
try {
  run(['plugin', 'install', resolve('plugins/notes'), '--yes']);
  run(['plugin', 'config', 'notes', 'set', `notesDir=${join(home, 'data', 'notes')}`]);
  run(['plugin', 'install', resolve('plugins/guard'), '--yes']);
  for (const [key, value] of Object.entries({
    'model.provider': 'openai-compatible',
    'model.baseURL': 'https://openrouter.ai/api/v1',
    'model.id': 'openai/gpt-4.1-mini',
    'model.apiKeyEnv': 'OPENROUTER_API_KEY',
  }))
    run(['config', 'set', key, value]);
  const raw = run([
    'run',
    'Use notes.write to append exactly "rotate key sk-abcdef123456" to live.md. Then use notes.search to search for "rotate key" and briefly report the stored content. Use both tools; do not merely describe the actions.',
    '--yes',
    '--json',
    '--max-steps',
    '8',
  ]);
  const events = raw
    .trim()
    .split('\n')
    .map((line) => JSON.parse(line));
  assert(!events.some((event) => event.type === 'error'), safe(raw));
  const content = readFileSync(join(home, 'data', 'notes', 'live.md'), 'utf8');
  assert(content.includes('[REDACTED]'));
  assert(!content.includes('sk-abcdef123456'));
  const calls = events.filter((event) => event.type === 'tool-call').map((event) => event.tool);
  assert(calls.includes('notes.write'));
  assert(calls.includes('notes.search'));
  const done = events.findLast((event) => event.type === 'done');
  assert(done?.text.length > 0);
  const report = {
    provider: 'OpenRouter',
    model: 'openai/gpt-4.1-mini',
    tools: calls,
    noteRedacted: true,
    finalAnswer: done.text,
    steps: done.steps,
    testedAt: new Date().toISOString(),
    credentialStored: false,
  };
  mkdirSync('verification', { recursive: true });
  writeFileSync('verification/openrouter.json', JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify(report, null, 2));
} finally {
  rmSync(home, { recursive: true, force: true });
}
