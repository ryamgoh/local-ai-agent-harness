import { CliError, type CommandContext } from '../context.js';
import { createTurnIO } from '../io.js';
import { renderTools } from '../render.js';
import type { Host } from '@harness/core';

export async function startHost(host: Host): Promise<void> {
  const statuses = await host.start();
  for (const status of statuses) {
    if (status.state === 'failed' || status.state === 'crashed')
      process.stderr.write(
        `Plugin ${status.plugin}: ${status.error ?? status.state} (log: ${status.logFile})\n`,
      );
  }
}
export async function listTools(context: CommandContext, json = false): Promise<void> {
  const host = await context.host();
  await startHost(host);
  const tools = host.tools();
  if (json) process.stdout.write(`${JSON.stringify(tools)}\n`);
  else if (tools.length) process.stdout.write(renderTools(tools));
  else {
    const count = (await host.plugins.list()).filter((plugin) => plugin.enabled).length;
    process.stdout.write(`No tools (${count} plugins enabled)\n`);
  }
}
export async function callTool(
  context: CommandContext,
  name: string,
  input: string,
  yes = false,
): Promise<void> {
  let value: unknown;
  try {
    value = JSON.parse(input) as unknown;
  } catch {
    throw new CliError('Tool input must be valid JSON', 2);
  }
  const host = await context.host();
  await startHost(host);
  const result = await host.callTool(name, value, createTurnIO(yes));
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  if (result.isError) process.exitCode = 1;
}
