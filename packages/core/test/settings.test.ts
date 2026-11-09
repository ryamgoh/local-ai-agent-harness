import { afterEach, beforeEach, expect, test } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { loadSettings, saveSetting } from '../src/config/settings.js';
import { resolvePaths, type HarnessPaths } from '../src/paths.js';
let home: string, paths: HarnessPaths;
beforeEach(async () => {
  home = await mkdtemp(join(tmpdir(), 'harness-settings-'));
  process.env.HARNESS_HOME = home;
  paths = resolvePaths(home);
});
afterEach(async () => {
  await rm(home, { recursive: true, force: true });
});
test('default settings are returned in an empty home', async () => {
  expect(await loadSettings(paths, {})).toEqual({
    model: { provider: 'openai-compatible', id: 'qwen3:8b', baseURL: 'http://localhost:11434/v1' },
    approvals: 'destructive',
    maxSteps: 20,
  });
});

test('HARNESS_MODEL splits only on its first colon', async () => {
  expect(
    (await loadSettings(paths, { HARNESS_MODEL: 'openai-compatible:qwen3:8b' })).model,
  ).toMatchObject({ provider: 'openai-compatible', id: 'qwen3:8b' });
  expect(
    (await loadSettings(paths, { HARNESS_MODEL: 'mock:/some/path:script.json' })).model,
  ).toMatchObject({ provider: 'mock', id: '/some/path:script.json' });
});
test('settings persist typed values independently of environment override', async () => {
  process.env.HARNESS_MODEL = 'mock:temporary';
  try {
    await saveSetting(paths, 'model.id', 'stored-model');
    await saveSetting(paths, 'maxSteps', '5');
    await saveSetting(paths, 'approvals', 'off');
    expect(await loadSettings(paths, {})).toMatchObject({
      model: { id: 'stored-model' },
      maxSteps: 5,
      approvals: 'off',
    });
    expect((await loadSettings(paths)).model).toMatchObject({ provider: 'mock', id: 'temporary' });
  } finally {
    delete process.env.HARNESS_MODEL;
  }
});
test.each(['invalid', 'other:model', 'mock:', ':model'])(
  'invalid model override fails safely: %s',
  async (value) => {
    await expect(loadSettings(paths, { HARNESS_MODEL: value })).rejects.toMatchObject({
      code: 'SETTINGS_INVALID',
    });
  },
);
test('invalid update leaves previous settings unchanged and rejects unknown keys', async () => {
  await saveSetting(paths, 'maxSteps', '5');
  await expect(saveSetting(paths, 'maxSteps', 'abc')).rejects.toMatchObject({
    code: 'SETTINGS_INVALID',
  });
  await expect(saveSetting(paths, 'approvals', 'invalid')).rejects.toMatchObject({
    code: 'SETTINGS_INVALID',
  });
  await expect(saveSetting(paths, 'model.apiKey', 'private-value')).rejects.toMatchObject({
    code: 'SETTINGS_INVALID',
  });
  expect((await loadSettings(paths, {})).maxSteps).toBe(5);
});
