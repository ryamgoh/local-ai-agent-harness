import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { assertVersions, setVersion } from '../scripts/version.mjs';

async function fixture(t) {
  const root = await mkdtemp(join(tmpdir(), 'harness-version-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  for (const dir of ['', 'packages/core', 'packages/cli']) {
    await mkdir(join(root, dir), { recursive: true });
    await writeFile(
      join(root, dir, 'package.json'),
      JSON.stringify({ name: dir || 'root', version: '0.1.0', private: true }) + '\n',
    );
  }
  return root;
}

test('agreed package versions match the exact release tag', async (t) => {
  const root = await fixture(t);
  assert.equal(await assertVersions(root, 'v0.1.0'), '0.1.0');
});
test('mismatched release tags fail before publication', async (t) => {
  const root = await fixture(t);
  await assert.rejects(assertVersions(root, 'v0.2.0'), /tag.*version/i);
  await assert.rejects(assertVersions(root, 'v0.1.0-mvp'), /tag.*version/i);
});
test('manifest drift fails version validation', async (t) => {
  const root = await fixture(t);
  await writeFile(join(root, 'packages/cli/package.json'), JSON.stringify({ version: '0.2.0' }));
  await assert.rejects(assertVersions(root), /versions.*match|version.*mismatch/i);
});
test('setting a version updates host packages and preserves metadata', async (t) => {
  const root = await fixture(t);
  await setVersion(root, '0.2.0-beta.1');
  assert.equal(await assertVersions(root, 'v0.2.0-beta.1'), '0.2.0-beta.1');
  for (const dir of ['', 'packages/core', 'packages/cli']) {
    const text = await readFile(join(root, dir, 'package.json'), 'utf8');
    assert.equal(JSON.parse(text).private, true);
    assert.ok(text.endsWith('\n'));
  }
});
test('invalid or noncanonical versions never modify files', async (t) => {
  const root = await fixture(t);
  const before = await readFile(join(root, 'package.json'), 'utf8');
  for (const value of ['v1.2.3', '1.2', '01.2.3', '../escape', '1.2.3-01']) {
    await assert.rejects(setVersion(root, value), /semantic version/i);
    assert.equal(await readFile(join(root, 'package.json'), 'utf8'), before);
  }
});
