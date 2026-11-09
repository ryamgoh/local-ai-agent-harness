import { afterEach, beforeEach, describe, expect, test } from 'vitest';
import { cp, lstat, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { PassThrough } from 'node:stream';
import { cli, fixture, temporaryHome } from './helpers.js';

describe('plugin lifecycle through the built CLI', () => {
  let home: string;
  beforeEach(async () => {
    home = await temporaryHome();
  });
  afterEach(async () => {
    await rm(home, { recursive: true, force: true });
  });
  const run = (args: string[], input?: string) => cli(args, { input, env: { HARNESS_HOME: home } });

  test('install displays commands and permissions before declining consent', async () => {
    const result = await run(['plugin', 'install', fixture('plugins/echo')], 'n\n');
    expect(result.stdout).toMatch(/Will run:\s+node .*plugins\/echo\/server\.mjs/);
    expect(result.stdout).toContain('Permissions: none declared');
    expect(result.stdout).toMatch(/trust/i);
    expect(result.stdout).toMatch(/not.*sandbox/i);
    expect(result.code).toBe(3);
    expect(JSON.parse((await run(['plugin', 'list', '--json'])).stdout)).toEqual([]);
  });

  test('install, disable, enable, and uninstall persist their state', async () => {
    expect((await run(['plugin', 'install', fixture('plugins/echo'), '--yes'])).code).toBe(0);
    expect(JSON.parse((await run(['plugin', 'list', '--json'])).stdout)).toContainEqual(
      expect.objectContaining({ name: 'echo', enabled: true }),
    );
    expect((await run(['plugin', 'disable', 'echo'])).code).toBe(0);
    expect(JSON.parse((await run(['plugin', 'list', '--json'])).stdout)[0].enabled).toBe(false);
    expect((await run(['plugin', 'enable', 'echo'])).code).toBe(0);
    expect(JSON.parse((await run(['plugin', 'list', '--json'])).stdout)[0].enabled).toBe(true);
    expect((await run(['plugin', 'uninstall', 'echo'])).code).toBe(0);
    expect(JSON.parse((await run(['plugin', 'list', '--json'])).stdout)).toEqual([]);
  });

  test('unknown commands, missing arguments, and malformed tool JSON exit 2', async () => {
    for (const args of [
      ['plugin', 'unknown'],
      ['plugin', 'install'],
      ['tools', 'call', 'echo.echo', '--input', '{'],
    ]) {
      expect((await run(args)).code).toBe(2);
    }
  });
});

describe('tools and agent commands', () => {
  let home: string;
  beforeEach(async () => {
    home = await temporaryHome();
  });
  afterEach(async () => {
    await rm(home, { recursive: true, force: true });
  });
  const run = (args: string[]) => cli(args, { env: { HARNESS_HOME: home } });
  test('zero-plugin tools baseline is explicit', async () => {
    const result = await run(['tools', 'list']);
    expect(result.code).toBe(0);
    expect(result.stdout).toContain('No tools (0 plugins enabled)');
    expect(JSON.parse((await run(['tools', 'list', '--json'])).stdout)).toEqual([]);
  });
  test('direct tools return structured data and errors have exit code 1', async () => {
    expect((await run(['plugin', 'install', fixture('plugins/echo'), '--yes'])).code).toBe(0);
    const success = await run(['tools', 'call', 'echo.echo', '--input', '{"text":"hello"}']);
    expect(success.code).toBe(0);
    expect(success.stdout).toContain('hello');
    expect((await run(['tools', 'call', 'echo.fail', '--input', '{}'])).code).toBe(1);
    expect((await run(['tools', 'call', 'echo.echo', '--input', '{"text":42}'])).code).toBe(1);
  });
  test('live inspection has tool schemas and a log location', async () => {
    await run(['plugin', 'install', fixture('plugins/echo'), '--yes']);
    const result = await run(['plugin', 'inspect', 'echo', '--live', '--json']);
    expect(result.code).toBe(0);
    const inspection = JSON.parse(result.stdout);
    expect(inspection.tools).toContainEqual(
      expect.objectContaining({ qualifiedName: 'echo.echo', inputSchema: expect.any(Object) }),
    );
    expect(inspection.status.logFile).toContain('echo.log');
    expect((await run(['plugin', 'inspect', 'echo', '--live'])).stdout).toContain('Log:');
  });
  test('settings survive separate CLI processes and invalid step limits exit 2', async () => {
    expect((await run(['config', 'set', 'approvals', 'always'])).code).toBe(0);
    expect((await run(['config', 'get', 'approvals'])).stdout.trim()).toBe('always');
    for (const limit of ['0', '-1', 'abc', '1.5'])
      expect((await run(['run', 'hi', '--max-steps', limit])).code).toBe(2);
  });
});

async function variant(
  home: string,
  name: string,
  extra: Record<string, unknown> = {},
): Promise<string> {
  const source = join(home, `source-${name}`);
  await cp(fixture('plugins/echo'), source, { recursive: true });
  const manifest = JSON.parse(
    await readFile(join(source, 'harness-plugin.json'), 'utf8'),
  ) as Record<string, unknown>;
  await writeFile(
    join(source, 'harness-plugin.json'),
    JSON.stringify({ ...manifest, name, ...extra }),
  );
  return source;
}
async function script(home: string, steps: unknown[]): Promise<string> {
  const path = join(home, 'model.json');
  await writeFile(path, JSON.stringify({ steps }));
  return path;
}

describe('validation, configuration, and execution consent', () => {
  let home: string;
  beforeEach(async () => {
    home = await temporaryHome();
  });
  afterEach(async () => {
    await rm(home, { recursive: true, force: true });
  });
  const run = (args: string[], input?: string) => cli(args, { input, env: { HARNESS_HOME: home } });
  test('manifest validation names failing fields and strict validation rejects warnings', async () => {
    const invalid = await variant(home, 'bad-event', {
      hooks: [{ event: 'NotAnEvent', command: 'node' }],
    });
    const bad = await run(['plugin', 'validate', invalid]);
    expect(bad.code).toBe(2);
    expect(bad.stderr).toContain('hooks.0.event');
    expect((await run(['plugin', 'install', invalid, '--yes'])).code).toBe(2);
    const warning = await variant(home, 'warning-plugin', { flavour: 'custom' });
    expect((await run(['plugin', 'validate', warning])).code).toBe(0);
    expect((await run(['plugin', 'validate', warning, '--strict'])).code).toBe(2);
  });
  test('config set validates without replacing valid values and masks secrets', async () => {
    const source = await variant(home, 'configured', {
      config: {
        type: 'object',
        properties: {
          limit: { type: 'integer', default: 10 },
          readOnly: { type: 'boolean', default: false },
          token: { type: 'string', 'x-secret': true },
        },
      },
    });
    expect((await run(['plugin', 'install', source, '--yes'])).code).toBe(0);
    expect(
      (
        await run([
          'plugin',
          'config',
          'configured',
          'set',
          'limit=5',
          'readOnly=true',
          'token=private-value',
        ])
      ).code,
    ).toBe(0);
    const values = JSON.parse((await run(['plugin', 'config', 'configured', 'get'])).stdout);
    expect(values).toEqual({ limit: 5, readOnly: true, token: '••••' });
    const invalid = await run(['plugin', 'config', 'configured', 'set', 'limit=abc']);
    expect(invalid.code).toBe(2);
    expect(invalid.stderr).toContain('integer');
    expect((await run(['plugin', 'config', 'configured', 'get', 'limit'])).stdout.trim()).toBe('5');
    expect((await run(['plugin', 'config', 'configured', 'unset', 'limit'])).code).toBe(0);
    expect((await run(['plugin', 'config', 'configured', 'get', 'limit'])).stdout.trim()).toBe(
      '10',
    );
    expect(await readFile(join(home, 'config/configured.json'), 'utf8')).not.toContain(
      'private-value',
    );
  });
  test('consent resolves defaults, retains missing variables, and never shows secret defaults', async () => {
    const source = await variant(home, 'consent-plugin', {
      config: {
        type: 'object',
        required: ['missing'],
        properties: {
          limit: { type: 'integer', default: 7 },
          missing: { type: 'string' },
          token: { type: 'string', default: 'very-private-token', 'x-secret': true },
        },
      },
      mcpServers: {
        server: {
          command: 'node',
          args: [
            '${plugin.root}/server.mjs',
            '${config.limit}',
            '${config.missing}',
            '${config.token}',
          ],
        },
      },
    });
    const result = await run(['plugin', 'install', source], 'n\n');
    expect(result.code).toBe(3);
    expect(result.stdout).toContain(`${source}/server.mjs 7 ${'${config.missing}'} ••••`);
    expect(result.stdout + result.stderr).not.toContain('very-private-token');
  });
  test('linked disabled installs never contribute tools, and uninstall retains the source', async () => {
    const source = await variant(home, 'linked-plugin');
    expect((await run(['plugin', 'install', source, '--link', '--yes', '--no-enable'])).code).toBe(
      0,
    );
    expect((await lstat(join(home, 'plugins/linked-plugin'))).isSymbolicLink()).toBe(true);
    expect(JSON.parse((await run(['tools', 'list', '--json'])).stdout)).toEqual([]);
    expect((await run(['plugin', 'uninstall', 'linked-plugin'])).code).toBe(0);
    expect((await lstat(source)).isDirectory()).toBe(true);
  });
  test('enable refuses an altered linked manifest even with --yes', async () => {
    const source = await variant(home, 'integrity-plugin');
    await run(['plugin', 'install', source, '--link', '--yes', '--no-enable']);
    const path = join(source, 'harness-plugin.json');
    const manifest = JSON.parse(await readFile(path, 'utf8'));
    await writeFile(
      path,
      JSON.stringify({
        ...manifest,
        hooks: [{ event: 'PreToolUse', command: 'node', args: ['${plugin.root}/server.mjs'] }],
      }),
    );
    const result = await run(['plugin', 'enable', 'integrity-plugin', '--yes']);
    expect(result.code).toBe(1);
    expect(result.stderr).toMatch(/changed.*consent/i);
    expect(JSON.parse((await run(['plugin', 'list', '--json'])).stdout)[0].enabled).toBe(false);
  });
  test('duplicate installation fails and force replacement requires fresh consent', async () => {
    const source = fixture('plugins/echo');
    await run(['plugin', 'install', source, '--yes']);
    expect((await run(['plugin', 'install', source, '--yes'])).code).toBe(1);
    expect((await run(['plugin', 'install', source, '--force'], 'n\n')).code).toBe(3);
    expect((await run(['plugin', 'install', source, '--force', '--yes'])).code).toBe(0);
    expect(JSON.parse((await run(['plugin', 'list', '--json'])).stdout)).toHaveLength(1);
  });
});

describe('streaming and non-interactive policy', () => {
  let home: string;
  beforeEach(async () => {
    home = await temporaryHome();
  });
  afterEach(async () => {
    await rm(home, { recursive: true, force: true });
  });
  const run = (args: string[]) => cli(args, { env: { HARNESS_HOME: home } });
  test('run produces only JSONL TurnEvents and respects max-steps', async () => {
    await run(['plugin', 'install', fixture('plugins/echo'), '--yes']);
    const model = await script(home, [
      { tool: 'mcp__echo__echo', input: { text: 'hello' } },
      { text: 'finished' },
    ]);
    const env = { HARNESS_HOME: home, HARNESS_MODEL: `mock:${model}` };
    const result = await cli(['run', 'hi', '--json'], { env });
    expect(result.code).toBe(0);
    const events = result.stdout
      .trim()
      .split('\n')
      .map((line) => JSON.parse(line));
    expect(events.map((event) => event.type)).toEqual(
      expect.arrayContaining(['tool-call', 'tool-result', 'text', 'done']),
    );
    expect(events.find((event) => event.type === 'tool-call').tool).toBe('echo.echo');
    const limited = await cli(['run', 'hi', '--json', '--max-steps', '1'], { env });
    expect(limited.code).toBe(0);
    expect(JSON.parse(limited.stdout.trim().split('\n').at(-1)!)).toMatchObject({
      type: 'done',
      steps: 1,
    });
  });
  test('non-TTY run denies ask without reading an open stdin; --yes approves', async () => {
    await run(['plugin', 'install', fixture('plugins/echo'), '--yes']);
    const source = join(home, 'policy-source');
    await mkdir(source);
    await writeFile(
      join(source, 'ask.mjs'),
      'process.stdin.resume(); process.stdin.on("end", () => process.stdout.write(JSON.stringify({ hookSpecificOutput: { hookEventName: "PreToolUse", permissionDecision: "ask", permissionDecisionReason: "test approval" } })));\n',
    );
    await writeFile(
      join(source, 'harness-plugin.json'),
      JSON.stringify({
        apiVersion: 1,
        name: 'ask-policy',
        version: '1.0.0',
        hooks: [{ event: 'PreToolUse', command: 'node', args: ['${plugin.root}/ask.mjs'] }],
      }),
    );
    expect((await run(['plugin', 'install', source, '--yes'])).code).toBe(0);
    const model = await script(home, [
      { tool: 'mcp__echo__echo', input: { text: 'hello' } },
      { text: 'finished' },
    ]);
    const env = { HARNESS_HOME: home, HARNESS_MODEL: `mock:${model}` };
    const denied = await cli(['run', 'hi', '--json'], {
      env,
      keepStdinOpen: true,
      timeoutMs: 8000,
    });
    expect(denied.code).toBe(0);
    expect(denied.stdout).toContain('approval required but session is non-interactive');
    const approved = await cli(['run', 'hi', '--json', '--yes'], {
      env,
      keepStdinOpen: true,
      timeoutMs: 8000,
    });
    expect(approved.code).toBe(0);
    expect(
      approved.stdout
        .trim()
        .split('\n')
        .map((line) => JSON.parse(line))
        .find((event) => event.type === 'tool-result').result.isError,
    ).toBe(false);
    const direct = await run(['tools', 'call', 'echo.echo', '--input', '{"text":"hello"}']);
    expect(direct.code).toBe(1);
    expect(direct.stdout).toContain('approval required but session is non-interactive');
  });
  test('chat slash commands retain one model session across turns', async () => {
    const model = await script(home, [{ text: 'first-response' }, { text: 'second-response' }]);
    const result = await cli(['chat'], {
      input: '/tools\nfirst\n/plugins\nsecond\n/exit\n',
      env: { HARNESS_HOME: home, HARNESS_MODEL: `mock:${model}` },
    });
    expect(result.code).toBe(0);
    expect(result.stdout).toContain('No tools');
    expect(result.stdout).toContain('No plugins installed');
    expect(result.stdout).toContain('first-response');
    expect(result.stdout).toContain('second-response');
  });
});

describe('CLI schema and approval public helpers', () => {
  test('generated schema prompts collect real terminal responses without displaying secrets', async () => {
    const { schemaFields, promptField } = await import('../../packages/cli/src/prompts.js');
    const fields = schemaFields(
      {
        required: ['title'],
        properties: {
          title: { type: 'string' },
          enabled: { type: 'boolean' },
          mode: { enum: ['one', 'two'] },
          token: { type: 'string', 'x-secret': true },
          limit: { type: 'integer' },
        },
      },
      {},
    );
    const responses = ['display-name\n', 'y\n', '\u001b[B\n', 'hidden-password\n', '12\n'];
    const values: (string | undefined)[] = [];
    for (const [index, field] of fields.entries()) {
      const input = new PassThrough();
      const output = new PassThrough();
      let display = '';
      output.on('data', (chunk) => {
        display += String(chunk);
      });
      output.once('data', () => {
        setImmediate(() => input.write(responses[index]));
      });
      try {
        values.push(await promptField(field, { input, output }));
        if (field.kind === 'password') expect(display).not.toContain('hidden-password');
      } finally {
        input.end();
        output.end();
      }
    }
    expect(values).toEqual(['display-name', 'true', 'two', 'hidden-password', '12']);
  });
  test('schema annotations select the documented prompt kinds', async () => {
    const { schemaFields } = await import('../../packages/cli/src/prompts.js');
    const fields = schemaFields(
      {
        required: ['title'],
        properties: {
          title: { type: 'string', title: 'Display name' },
          enabled: { type: 'boolean' },
          mode: { enum: ['one', 'two'] },
          token: { type: 'string', 'x-secret': true },
          limit: { type: 'integer' },
          ratio: { type: 'number' },
        },
      },
      { enabled: true },
    );
    expect(fields.map((field) => [field.key, field.kind])).toEqual([
      ['title', 'input'],
      ['enabled', 'confirm'],
      ['mode', 'select'],
      ['token', 'password'],
      ['limit', 'number'],
      ['ratio', 'number'],
    ]);
    expect(fields[0]).toMatchObject({ message: 'Display name', required: true });
    expect(fields[1]?.value).toBe(true);
  });
  test('assignment parsing preserves equals in values and rejects malformed keys', async () => {
    const { parseAssignments } = await import('../../packages/cli/src/context.js');
    expect(parseAssignments(['nested.key=a=b'])).toEqual({ 'nested.key': 'a=b' });
    expect(() => parseAssignments(['bad'])).toThrow('key=value');
    expect(() => parseAssignments(['__proto__.key=x'])).toThrow('Invalid configuration key');
  });
  test('non-interactive TurnIO.confirm does not consume stdin', async () => {
    const { createTurnIO } = await import('../../packages/cli/src/io.js');
    const io = createTurnIO();
    expect(io.interactive).toBe(false);
    expect(await io.confirm({ tool: 'echo.echo', input: {}, reasons: ['test'] })).toBe(false);
  });
});
