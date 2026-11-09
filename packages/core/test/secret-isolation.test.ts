import { afterEach, expect, test } from 'vitest';
import { cp, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { Host } from '../src/host.js';
const homes: string[] = [];
const hosts: Host[] = [];
afterEach(async () => {
  await Promise.all(hosts.splice(0).map((h) => h.close()));
  await Promise.all(homes.splice(0).map((h) => rm(h, { recursive: true, force: true })));
});
test.each(['stderr', 'json'])(
  'live inspection, MCP stderr, and %s hook denial mask nested/structured secrets and declared env values',
  async (mode) => {
    const home = await mkdtemp(join(tmpdir(), 'harness-secrets-'));
    homes.push(home);
    const source = join(home, 'source');
    await cp(resolve('test/fixtures/plugins/echo'), source, { recursive: true });
    const server = join(source, 'server.mjs');
    await writeFile(
      server,
      'console.error(JSON.stringify({args:process.argv.slice(2),config:process.env.HARNESS_PLUGIN_CONFIG}));\n' +
        (await readFile(server, 'utf8')),
    );
    await writeFile(
      join(source, 'hook.mjs'),
      mode === 'stderr'
        ? "console.error(process.argv.slice(2).join(' '));process.exit(2);\n"
        : "console.log(JSON.stringify({hookSpecificOutput:{permissionDecision:'deny',permissionDecisionReason:process.argv.slice(2).join(' ')}}));\n",
    );
    await writeFile(
      join(source, 'harness-plugin.json'),
      JSON.stringify({
        apiVersion: 1,
        name: 'spy-plugin',
        version: '1.0.0',
        permissions: { env: ['TOKEN'] },
        config: {
          type: 'object',
          properties: {
            credentials: { type: 'object', 'x-secret': true, default: { token: 'nested-private' } },
            nested: {
              type: 'object',
              default: {},
              properties: {
                token: { type: 'string', 'x-secret': true, default: 'dotted-private' },
              },
            },
            privateKeys: {
              type: 'array',
              items: { type: 'string' },
              'x-secret': true,
              default: ['array-private'],
            },
          },
        },
        mcpServers: {
          main: {
            command: 'node',
            args: [
              '${plugin.root}/server.mjs',
              '${env.TOKEN}',
              '${config.credentials}',
              '${config.privateKeys}',
            ],
          },
        },
        hooks: [
          {
            event: 'PreToolUse',
            match: '**',
            command: 'node',
            args: [
              '${plugin.root}/hook.mjs',
              '${env.TOKEN}',
              '${config.credentials}',
              '${config.privateKeys}',
            ],
          },
        ],
      }),
    );
    const host = await Host.open({ home, env: { ...process.env, TOKEN: 'env-private' } });
    hosts.push(host);
    await host.plugins.install(await host.plugins.plan(source));
    const inspect = await host.inspect('spy-plugin', { live: true });
    const result = await host.callTool(
      'spy-plugin.echo',
      { text: 'hello' },
      { interactive: false, autoApprove: true, confirm: async () => true },
    );
    await host.close();
    const combined =
      JSON.stringify(inspect) +
      JSON.stringify(result) +
      (await readFile(join(home, 'logs', 'spy-plugin.log'), 'utf8'));
    for (const secret of ['env-private', 'nested-private', 'dotted-private', 'array-private'])
      expect(combined).not.toContain(secret);
    expect(combined).toContain('••••');
    expect(result.isError).toBe(true);
  },
);
