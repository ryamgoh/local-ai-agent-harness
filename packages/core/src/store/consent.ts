import { join } from 'node:path';
import { rm } from 'node:fs/promises';
import { hashJson, readJson, writeJsonAtomic } from '../fs-atomic.js';
import { assertPluginName, assertWritePath, type HarnessPaths } from '../paths.js';
import type { PluginManifest } from '../manifest/schema.js';

export interface ConsentReceipt {
  schemaVersion: 1;
  manifestSha256: string;
  consentSha256: string;
}
export function consentHash(m: PluginManifest): string {
  return hashJson({
    name: m.name,
    priority: m.priority,
    config: m.config ?? {},
    permissions: m.permissions,
    mcpServers: m.mcpServers,
    hooks: m.hooks,
    commands: m.commands,
  });
}
export function receiptPath(paths: HarnessPaths, name: string): string {
  assertPluginName(name);
  const file = join(paths.home, '.consent', `${name}.json`);
  assertWritePath(paths.home, file);
  return file;
}
export async function readConsent(
  paths: HarnessPaths,
  name: string,
): Promise<ConsentReceipt | null> {
  return readJson<ConsentReceipt | null>(receiptPath(paths, name), null);
}
export async function writeConsent(
  paths: HarnessPaths,
  name: string,
  receipt: ConsentReceipt | null,
): Promise<void> {
  const file = receiptPath(paths, name);
  if (receipt) await writeJsonAtomic(file, receipt, { home: paths.home, mode: 0o600 });
  else await rm(file, { force: true });
}
