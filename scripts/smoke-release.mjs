import assert from 'node:assert/strict';
import { access, mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { assertVersions, projectRoot } from './version.mjs';

const exec = promisify(execFile);
const version = await assertVersions();
const tarball = resolve(
  process.argv[2] ?? join(projectRoot, 'release', `local-ai-agent-harness-${version}.tgz`),
);
const root = await mkdtemp(join(tmpdir(), 'harness-global-smoke-'));
const prefix = join(root, 'prefix');
const home = join(root, 'home');
const packageRoot = join(prefix, 'lib/node_modules/local-ai-agent-harness');
const binary = join(prefix, 'bin/harness');
const env = {
  ...process.env,
  HARNESS_HOME: home,
  PATH: `${join(prefix, 'bin')}:${process.env.PATH ?? ''}`,
};
let installed = false;
async function cli(args, extraEnv = {}) {
  const result = await exec(binary, args, {
    env: { ...env, ...extraEnv },
    maxBuffer: 4 * 1024 * 1024,
  });
  return result.stdout.trim();
}
console.log(`Testing global installation of ${tarball} into an isolated prefix`);
try {
  await exec(
    'npm',
    [
      'install',
      '--global',
      '--prefix',
      prefix,
      '--ignore-scripts',
      '--no-audit',
      '--no-fund',
      tarball,
    ],
    { maxBuffer: 4 * 1024 * 1024 },
  );
  installed = true;
  assert.equal(await cli(['--version']), version);
  assert.match(await cli(['--help']), /plugin/);
  assert.deepEqual(JSON.parse(await cli(['tools', 'list', '--json'])), []);
  const metadata = JSON.parse(await readFile(join(packageRoot, 'package.json'), 'utf8'));
  assert.equal(metadata.private, true);
  assert.equal(metadata.dependencies['@harness/core'], undefined);
  await access(join(packageRoot, 'npm-shrinkwrap.json'));
  for (const plugin of ['notes', 'guard']) {
    assert.match(
      await cli(['plugin', 'validate', join(packageRoot, 'plugins', plugin)]),
      /Validation passed/,
    );
    await cli(['plugin', 'install', join(packageRoot, 'plugins', plugin), '--yes']);
  }
  await cli([
    'plugin',
    'config',
    'notes',
    'set',
    `notesDir=${join(home, 'data/notes')}`,
    'maxResults=5',
  ]);
  const tools = JSON.parse(await cli(['tools', 'list', '--json']));
  assert.equal(tools.length, 3);
  assert.ok(tools.some((tool) => tool.qualifiedName === 'notes.write'));
  const input = {
    path: 'release-smoke.md',
    content: 'Release package works; rotate sk-abcdef123456',
  };
  await cli(['tools', 'call', 'notes.write', '--input', JSON.stringify(input), '--yes']);
  const disk = await readFile(join(home, 'data/notes/release-smoke.md'), 'utf8');
  assert.ok(disk.includes('[REDACTED]'));
  assert.ok(!disk.includes('sk-abcdef123456'));
  const script = join(home, 'smoke-model.json');
  await writeFile(
    script,
    JSON.stringify({
      steps: [
        { tool: 'mcp__notes__search', input: { query: 'release package' } },
        { text: 'The packaged agent used a discovered tool.' },
      ],
    }),
  );
  const events = (
    await cli(['run', 'Check the saved release note', '--json'], {
      HARNESS_MODEL: `mock:${script}`,
    })
  )
    .split('\n')
    .map((line) => JSON.parse(line));
  assert.ok(events.some((event) => event.type === 'tool-result' && event.tool === 'notes.search'));
  assert.ok(events.some((event) => event.type === 'done'));
  await cli(['plugin', 'config', 'guard', 'set', 'deny=["notes.write"]']);
  await assert.rejects(
    cli([
      'tools',
      'call',
      'notes.write',
      '--input',
      JSON.stringify({ path: 'blocked.md', content: 'Must not be written' }),
      '--yes',
    ]),
    (error) => error.code === 1,
  );
  await assert.rejects(access(join(home, 'data/notes/blocked.md')), { code: 'ENOENT' });
  await cli(['plugin', 'uninstall', 'notes']);
  assert.deepEqual(JSON.parse(await cli(['tools', 'list', '--json'])), []);
  await exec('npm', [
    'uninstall',
    '--global',
    '--prefix',
    prefix,
    '--ignore-scripts',
    '--no-audit',
    '--no-fund',
    'local-ai-agent-harness',
  ]);
  installed = false;
  await assert.rejects(access(packageRoot), { code: 'ENOENT' });
  console.log(
    `RELEASE SMOKE PASSED: version ${version}; global binary; locked dependencies; opt-in assets; real MCP discovery; guard redaction/deny; scripted agent; uninstall.`,
  );
} finally {
  if (installed)
    await exec('npm', [
      'uninstall',
      '--global',
      '--prefix',
      prefix,
      '--ignore-scripts',
      '--no-audit',
      '--no-fund',
      'local-ai-agent-harness',
    ]).catch(() => {});
  await rm(root, { recursive: true, force: true });
}
