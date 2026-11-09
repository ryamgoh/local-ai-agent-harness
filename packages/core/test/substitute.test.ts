import { expect, test } from 'vitest';
import { homedir } from 'node:os';
import {
  substitute,
  listVariables,
  expandHome,
  type SubstitutionContext,
} from '../src/manifest/substitute.js';
import { UnknownVariableError, UndeclaredEnvError } from '../src/errors.js';

const ctx: SubstitutionContext = {
  plugin: { name: 'sample', root: '/h/plugins/sample', data: '/h/data/sample' },
  harness: { home: '/h' },
  config: {},
  env: {},
  allowedEnv: [],
  pathKeys: [],
};
test('plugin and config variables are replaced literally once', () => {
  expect(substitute('${plugin.root}/server.py', ctx)).toBe('/h/plugins/sample/server.py');
  expect(substitute('${config.limit}', { ...ctx, config: { limit: 5 } })).toBe('5');
  expect(substitute('${config.tags}', { ...ctx, config: { tags: ['a'] } })).toBe('["a"]');
  expect(substitute('${config.p}', { ...ctx, config: { p: 'a$&b${plugin.root}' } })).toBe(
    'a$&b${plugin.root}',
  );
});

test('path values expand home and retain spaces as one value', () => {
  expect(
    substitute('${config.folder}', {
      ...ctx,
      config: { folder: '~/My Folder' },
      pathKeys: ['folder'],
    }),
  ).toBe(`${homedir()}/My Folder`);
  expect(expandHome('relative folder')).toBe('relative folder');
});
test('env requires declaration and never uses inherited object properties', () => {
  expect(() => substitute('${env.TOKEN}', { ...ctx, env: { TOKEN: 'x' } })).toThrow(
    UndeclaredEnvError,
  );
  expect(substitute('${env.TOKEN}', { ...ctx, env: { TOKEN: 'x' }, allowedEnv: ['TOKEN'] })).toBe(
    'x',
  );
  expect(substitute('${env.TOKEN}', { ...ctx, allowedEnv: ['TOKEN'] })).toBe('');
});
test.each([
  '${foo.bar}',
  '${config.absent}',
  '${plugin.other}',
  '${config.a.b}',
  '${config.}',
  '${bad syntax}',
])('unknown reference is rejected: %s', (input) => {
  expect(() => substitute(input, ctx)).toThrow(UnknownVariableError);
});
test('listVariables preserves reference order, duplicates and invalid forms', () => {
  expect(listVariables('${a.b}-${config.c}-${a.b}-${bad syntax}')).toEqual([
    'a.b',
    'config.c',
    'a.b',
    'bad syntax',
  ]);
});
