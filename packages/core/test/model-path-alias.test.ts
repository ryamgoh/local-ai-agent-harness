import {
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  realpath,
  rm,
  symlink,
  writeFile,
} from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { afterEach, beforeEach, expect, test } from 'vitest';
import { generateText } from 'ai';
import { createModel } from '../src/agent/model.js';
import { Host } from '../src/host.js';
import { resolvePaths } from '../src/paths.js';

let parent: string, home: string, aliasedHome: string, outside: string;
beforeEach(async () => {
  parent = await mkdtemp(join(tmpdir(), 'harness-model-path-alias-'));
  const realParent = join(parent, 'private');
  await mkdir(join(realParent, 'home'), { recursive: true });
  await symlink(realParent, join(parent, 'alias'), 'dir');
  home = await realpath(join(realParent, 'home'));
  aliasedHome = join(parent, 'alias', 'home');
  outside = join(dirname(home), 'home-outside');
  await mkdir(outside);
});
afterEach(async () => {
  await rm(parent, { recursive: true, force: true });
});

const captureKeys = ['capture', 'captureMessages'] as const;
async function scripted(
  captures: { capture?: string; captureMessages?: string },
  modelHome = home,
) {
  const script = join(aliasedHome, 'script.json');
  await writeFile(script, JSON.stringify({ steps: [{ text: 'Captured' }], ...captures }));
  return createModel({ provider: 'mock', id: script }, { home: modelHome, env: {} });
}
async function generate(model: Awaited<ReturnType<typeof scripted>>) {
  return generateText({ model, prompt: 'hello', maxRetries: 0 });
}
async function expectCaptures(systemPrompt = false) {
  expect(JSON.parse(await readFile(join(home, 'new', 'nested', 'tools.json'), 'utf8'))).toEqual([
    [],
  ]);
  expect(JSON.parse(await readFile(join(home, 'new', 'nested', 'messages.json'), 'utf8'))).toEqual([
    [
      ...(systemPrompt
        ? [expect.objectContaining({ role: 'system', content: expect.any(String) })]
        : []),
      { role: 'user', content: [{ type: 'text', text: 'hello' }] },
    ],
  ]);
}

// Model construction receives canonical home from Host, while script paths retain
// the caller's spelling, like /var and /private/var on macOS.
test.each(['alias', 'canonical'] as const)(
  'captures an absolute %s descendant when home has been canonicalized',
  async (spelling) => {
    const root = spelling === 'alias' ? aliasedHome : home;
    const model = await scripted(
      {
        capture: join(root, 'new', 'nested', 'tools.json'),
        captureMessages: join(root, 'new', 'nested', 'messages.json'),
      },
      resolvePaths(aliasedHome).home,
    );
    expect((await generate(model)).text).toBe('Captured');
    await expectCaptures();
  },
);
test.each(['alias', 'canonical'] as const)(
  'captures an absolute %s descendant when home retains its alias',
  async (spelling) => {
    const root = spelling === 'alias' ? aliasedHome : home;
    const model = await scripted(
      {
        capture: join(root, 'new', 'nested', 'tools.json'),
        captureMessages: join(root, 'new', 'nested', 'messages.json'),
      },
      aliasedHome,
    );
    expect((await generate(model)).text).toBe('Captured');
    await expectCaptures();
  },
);
test.each(['alias', 'canonical'] as const)(
  'relative captures work with %s home',
  async (spelling) => {
    const model = await scripted(
      {
        capture: 'new/nested/tools.json',
        captureMessages: 'new/nested/messages.json',
      },
      spelling === 'alias' ? aliasedHome : home,
    );
    expect((await generate(model)).text).toBe('Captured');
    await expectCaptures();
  },
);
test.each(['alias', 'canonical'] as const)(
  'Host streams a session with absolute %s captures under an aliased home',
  async (spelling) => {
    const root = spelling === 'alias' ? aliasedHome : home;
    const script = join(aliasedHome, 'script.json');
    await writeFile(
      script,
      JSON.stringify({
        steps: [{ text: 'Captured' }],
        capture: join(root, 'new', 'nested', 'tools.json'),
        captureMessages: join(root, 'new', 'nested', 'messages.json'),
      }),
    );
    const host = await Host.open({
      home: aliasedHome,
      env: { HARNESS_MODEL: `mock:${script}` },
    });
    try {
      expect(host.paths.home).toBe(home);
      const session = await host.newSession();
      const events = [];
      for await (const event of session.runTurn('hello', {
        interactive: false,
        autoApprove: false,
        confirm: async () => false,
      }))
        events.push(event);
      expect(events.at(-1)).toMatchObject({ type: 'done', text: 'Captured', steps: 1 });
      await expectCaptures(true);
    } finally {
      await host.close();
    }
  },
);

for (const key of captureKeys) {
  test.each(['alias', 'canonical', 'relative'] as const)(
    `${key} rejects %s outside targets without creating their descendants`,
    async (spelling) => {
      const capture =
        spelling === 'relative'
          ? '../home-outside/new/nested/capture.json'
          : join(
              spelling === 'alias' ? join(dirname(aliasedHome), 'home-outside') : outside,
              'new',
              'nested',
              'capture.json',
            );
      await expect(scripted({ [key]: capture })).rejects.toThrow(/HARNESS_HOME/);
      expect(await readdir(outside)).toEqual([]);
    },
  );
  test.each(['alias', 'canonical', 'relative'] as const)(
    `${key} rejects %s internal directory symlink escapes before creating children`,
    async (spelling) => {
      await symlink(outside, join(home, 'linked'), 'dir');
      const capture =
        spelling === 'relative'
          ? 'linked/new/nested/capture.json'
          : join(
              spelling === 'alias' ? aliasedHome : home,
              'linked',
              'new',
              'nested',
              'capture.json',
            );
      await expect(scripted({ [key]: capture })).rejects.toThrow(/HARNESS_HOME/);
      expect(await readdir(outside)).toEqual([]);
    },
  );
  test(`${key} cannot bypass an escaping directory that links back to home`, async () => {
    await symlink(outside, join(home, 'linked'), 'dir');
    await symlink(home, join(outside, 'return'), 'dir');
    await expect(
      scripted({ [key]: join(aliasedHome, 'linked', 'return', 'new', 'capture.json') }),
    ).rejects.toThrow(/HARNESS_HOME/);
    expect(await readdir(outside)).toEqual(['return']);
    expect(existsSync(join(home, 'new'))).toBe(false);
  });
  test.each(['outside', 'inside', 'dangling'] as const)(
    `${key} rejects a final file symlink with an %s destination`,
    async (destination) => {
      const file = join(destination === 'inside' ? home : outside, 'protected.json');
      if (destination !== 'dangling') await writeFile(file, 'unchanged');
      await symlink(file, join(home, 'capture.json'));
      await expect(scripted({ [key]: join(aliasedHome, 'capture.json') })).rejects.toThrow(
        /no file symlinks/,
      );
      if (destination === 'dangling') expect(await readdir(outside)).toEqual([]);
      else expect(await readFile(file, 'utf8')).toBe('unchanged');
    },
  );
  test(`${key} rechecks a final file symlink introduced after model construction`, async () => {
    const capture = join(aliasedHome, 'new', 'capture.json');
    const model = await scripted({ [key]: capture });
    const file = join(outside, 'protected.json');
    await writeFile(file, 'unchanged');
    await symlink(file, capture);
    await expect(generate(model)).rejects.toThrow(/no file symlinks/);
    expect(await readFile(file, 'utf8')).toBe('unchanged');
  });
  test(`${key} rechecks directory symlinks introduced after model construction`, async () => {
    const model = await scripted({ [key]: join(aliasedHome, 'new', 'nested', 'capture.json') });
    await rm(join(home, 'new'), { recursive: true });
    await symlink(outside, join(home, 'new'), 'dir');
    await expect(generate(model)).rejects.toThrow(/HARNESS_HOME/);
    expect(await readdir(outside)).toEqual([]);
  });
  test.each(['alias', 'canonical', 'relative'] as const)(
    `${key} rejects %s home itself as a capture file`,
    async (spelling) => {
      const capture = spelling === 'relative' ? '.' : spelling === 'alias' ? aliasedHome : home;
      await expect(scripted({ [key]: capture })).rejects.toThrow(/HARNESS_HOME/);
    },
  );
}
