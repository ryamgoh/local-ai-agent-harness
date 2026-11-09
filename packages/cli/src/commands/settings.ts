import { saveSetting } from '@harness/core';
import { getValue, printValue, type CommandContext } from '../context.js';

export async function getSetting(context: CommandContext, key?: string): Promise<void> {
  const settings = await (await context.host()).settings();
  printValue(key ? getValue(settings, key) : settings);
}
export async function setSetting(
  context: CommandContext,
  key: string,
  value: string,
): Promise<void> {
  const host = await context.host();
  await saveSetting(host.paths, key, value);
  process.stdout.write(`Set ${key}\n`);
}
