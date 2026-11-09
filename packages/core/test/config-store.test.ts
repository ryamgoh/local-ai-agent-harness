import { afterEach, beforeEach, expect, test } from 'vitest';
import { mkdtemp, readFile, stat, rm, symlink, writeFile, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ConfigStore, coerce, maskSecrets } from '../src/config/config-store.js';
import { createValidator, validateValue } from '../src/config/validation.js';
import { resolvePaths, type HarnessPaths } from '../src/paths.js';

let home: string, paths: HarnessPaths, cfg: ConfigStore;
const schema = {
  type: 'object',
  required: ['folder'],
  additionalProperties: false,
  properties: {
    folder: { type: 'string', format: 'path' },
    readOnly: { type: 'boolean', default: false },
    maxResults: { type: 'integer', default: 10, minimum: 1, maximum: 100 },
  },
};
beforeEach(async () => {
  home = await mkdtemp(join(tmpdir(), 'harness-config-'));
  process.env.HARNESS_HOME = home;
  paths = resolvePaths(home);
  cfg = new ConfigStore(paths);
});
afterEach(async () => {
  await rm(home, { recursive: true, force: true });
});

test('defaults apply and missing required config is reported', async () => {
  const resolved = await cfg.resolve('sample', schema);
  expect(resolved.values).toMatchObject({ readOnly: false, maxResults: 10 });
  expect(resolved.issues).toEqual([{ key: 'folder', message: 'is required' }]);
  expect(resolved.pathKeys).toEqual(['folder']);
});

test('set coerces typed values and rejects an invalid update without changing storage', async () => {
  expect(
    await cfg.set('sample', schema, { folder: '~/My Folder', readOnly: 'true', maxResults: '5' }),
  ).toEqual([]);
  expect((await cfg.resolve('sample', schema)).values).toMatchObject({
    folder: '~/My Folder',
    readOnly: true,
    maxResults: 5,
  });
  const before = await readFile(join(paths.configDir, 'sample.json'), 'utf8');
  expect(await cfg.set('sample', schema, { maxResults: 'abc' })).toEqual([
    { key: 'maxResults', message: expect.stringContaining('integer') },
  ]);
  expect(await readFile(join(paths.configDir, 'sample.json'), 'utf8')).toBe(before);
  expect(await cfg.set('sample', schema, { maxResults: '101' })).toEqual([
    { key: 'maxResults', message: expect.stringContaining('100') },
  ]);
  expect(await cfg.set('sample', schema, { madeUp: 'x' })).toEqual([
    { key: 'madeUp', message: 'unknown config key' },
  ]);
});
test('secrets are separated, owner-only, and masked without mutating values', async () => {
  const secretSchema = {
    type: 'object',
    properties: { token: { type: 'string', 'x-secret': true, minLength: 6 } },
  };
  expect(await cfg.set('service', secretSchema, { token: 'private-token' })).toEqual([]);
  expect(await readFile(join(paths.configDir, 'service.json'), 'utf8')).not.toContain(
    'private-token',
  );
  expect((await stat(join(paths.configDir, 'service.secrets.json'))).mode & 0o777).toBe(0o600);
  const resolved = await cfg.resolve('service', secretSchema);
  expect(resolved.secretKeys).toEqual(['token']);
  expect(resolved.values).toEqual({ token: 'private-token' });
  expect(maskSecrets(resolved.values, resolved.secretKeys)).toEqual({ token: '••••' });
  expect(resolved.values.token).toBe('private-token');
  const errors = await cfg.set('service', secretSchema, { token: 'raw' });
  expect(JSON.stringify(errors)).not.toContain('raw');
  expect((await cfg.resolve('service', secretSchema)).values.token).toBe('private-token');
});
test('nested dotted assignments and nested secrets remain isolated', async () => {
  const nested = {
    type: 'object',
    properties: {
      connection: {
        type: 'object',
        default: {},
        additionalProperties: false,
        properties: {
          token: { type: 'string', 'x-secret': true },
          count: { type: 'integer', default: 2 },
        },
      },
    },
  };
  expect(
    await cfg.set('sample', nested, {
      'connection.token': 'nested-private',
      'connection.count': '3',
    }),
  ).toEqual([]);
  const resolved = await cfg.resolve('sample', nested);
  expect(resolved.values).toEqual({ connection: { token: 'nested-private', count: 3 } });
  expect(maskSecrets(resolved.values, resolved.secretKeys)).toEqual({
    connection: { token: '••••', count: 3 },
  });
  expect(await readFile(join(paths.configDir, 'sample.json'), 'utf8')).not.toContain(
    'nested-private',
  );
  await cfg.unset('sample', 'connection.token');
  expect((await cfg.resolve('sample', nested)).values).toEqual({ connection: { count: 3 } });
});
test('defaults for secrets never enter the plain config file', async () => {
  const defaults = {
    type: 'object',
    properties: { token: { type: 'string', default: 'secret-default', 'x-secret': true } },
  };
  expect(await cfg.set('sample', defaults, {})).toEqual([]);
  expect(await readFile(join(paths.configDir, 'sample.json'), 'utf8')).not.toContain(
    'secret-default',
  );
  expect((await cfg.resolve('sample', defaults)).values.token).toBe('secret-default');
});
test('stored values validate without coercion and defaults do not mutate the schema', async () => {
  await mkdir(paths.configDir);
  await writeFile(
    join(paths.configDir, 'sample.json'),
    JSON.stringify({ folder: '/x', readOnly: 'true', maxResults: 2 }),
  );
  expect((await cfg.resolve('sample', schema)).issues).toEqual([
    { key: 'readOnly', message: 'must be boolean' },
  ]);
  expect(schema.properties.readOnly.default).toBe(false);
});
test('coerce handles JSON arrays and objects as well as scalar types', () => {
  expect(coerce('true', { type: 'boolean' })).toBe(true);
  expect(coerce('5', { type: 'integer' })).toBe(5);
  expect(coerce('["a"]', { type: 'array', items: { type: 'string' } })).toEqual(['a']);
  expect(coerce('{"a":1}', { type: 'object', properties: { a: { type: 'integer' } } })).toEqual({
    a: 1,
  });
});
test('runtime validator is strict, reusable and does not mutate inputs', () => {
  const input = { text: 42 };
  const toolSchema = {
    type: 'object',
    properties: { text: { type: 'string' } },
    required: ['text'],
  };
  expect(validateValue(toolSchema, input)).toEqual({
    success: false,
    value: { text: 42 },
    errors: ['/text must be string'],
  });
  const defaults = { type: 'object', properties: { count: { type: 'integer', default: 4 } } };
  const empty = {};
  expect(validateValue(defaults, empty)).toEqual({
    success: true,
    value: { count: 4 },
    errors: [],
  });
  expect(empty).toEqual({});
  expect(createValidator(true).compile(toolSchema)({ text: 42 })).toBe(true);
  expect(validateValue({ type: 'object', unknownKeyword: 'private-value' }, {})).toMatchObject({
    success: false,
  });
});
test('remove deletes both config files and rejects traversal plugin identifiers', async () => {
  await cfg.set('sample', schema, { folder: '/x' });
  await cfg.remove('sample');
  expect((await cfg.resolve('sample', schema)).issues).toEqual([
    { key: 'folder', message: 'is required' },
  ]);
  await expect(cfg.set('../outside', schema, { folder: '/x' })).rejects.toMatchObject({
    code: 'PATH_ESCAPE',
  });
});

test('symlinked config directory cannot redirect state writes outside home', async () => {
  const outside = await mkdtemp(join(tmpdir(), 'harness-outside-'));
  try {
    await symlink(outside, paths.configDir, 'dir');
    await expect(cfg.set('sample', schema, { folder: '/x' })).rejects.toMatchObject({
      code: 'PATH_ESCAPE',
    });
    await expect(readFile(join(outside, 'sample.json'), 'utf8')).rejects.toMatchObject({
      code: 'ENOENT',
    });
  } finally {
    await rm(outside, { recursive: true, force: true });
  }
});
test('a secrets-file symlink is never followed or overwritten', async () => {
  await mkdir(paths.configDir);
  await writeFile(join(home, 'external.json'), '{"token":"external-private"}');
  await symlink(join(home, 'external.json'), join(paths.configDir, 'sample.secrets.json'));
  await expect(
    cfg.set(
      'sample',
      { type: 'object', properties: { token: { type: 'string', 'x-secret': true } } },
      { token: 'new-private' },
    ),
  ).rejects.toMatchObject({ code: 'PATH_ESCAPE' });
  expect(await readFile(join(home, 'external.json'), 'utf8')).toBe('{"token":"external-private"}');
});
test('concurrent config assignments are merged under the state lock', async () => {
  const two = {
    type: 'object',
    properties: { first: { type: 'integer' }, second: { type: 'integer' } },
  };
  await Promise.all([
    cfg.set('sample', two, { first: '1' }),
    new ConfigStore(paths).set('sample', two, { second: '2' }),
  ]);
  expect((await cfg.resolve('sample', two)).values).toEqual({ first: 1, second: 2 });
});

test('secret annotations behind local refs and schema composition are preserved', async () => {
  const indirect = {
    type: 'object',
    $defs: { credential: { type: 'string', 'x-secret': true } },
    properties: {
      token: { $ref: '#/$defs/credential' },
      nested: {
        type: 'object',
        default: {},
        allOf: [{ properties: { pin: { type: 'string', 'x-secret': true } } }],
      },
    },
  };
  expect(
    await cfg.set('sample', indirect, {
      token: 'ref-private',
      nested: '{"pin":"composed-private"}',
    }),
  ).toEqual([]);
  const resolved = await cfg.resolve('sample', indirect);
  expect(maskSecrets(resolved.values, resolved.secretKeys)).toEqual({
    token: '••••',
    nested: { pin: '••••' },
  });
  const plain = await readFile(join(paths.configDir, 'sample.json'), 'utf8');
  expect(plain).not.toContain('ref-private');
  expect(plain).not.toContain('composed-private');
});

test('setting one value does not silently coerce invalid unrelated stored values', async () => {
  await mkdir(paths.configDir);
  await writeFile(
    join(paths.configDir, 'sample.json'),
    JSON.stringify({ folder: '/x', readOnly: 'true', maxResults: 2 }),
  );
  expect(await cfg.set('sample', schema, { maxResults: '3' })).toEqual([
    { key: 'readOnly', message: 'must be boolean' },
  ]);
  expect((await cfg.resolve('sample', schema)).values.maxResults).toBe(2);
});
