import { resolve, join } from 'node:path';
import { RegistryError } from '../errors.js';
import { readJson, writeJsonAtomic, withHomeLock } from '../fs-atomic.js';
import { assertPluginName, assertWritePath, type HarnessPaths } from '../paths.js';

export interface PluginSource {
  type: 'path';
  path: string;
}
export interface RegistryEntry {
  name: string;
  version: string;
  source: PluginSource;
  installPath: string;
  linked: boolean;
  enabled: boolean;
  installedAt: string;
  manifestSha256: string;
  permissionsSha256: string;
}
export interface RegistryData {
  schemaVersion: 1;
  plugins: RegistryEntry[];
}

export async function readRegistry(paths: HarnessPaths): Promise<RegistryData> {
  assertWritePath(paths.home, paths.registryFile);
  const raw = await readJson<unknown>(paths.registryFile, { schemaVersion: 1, plugins: [] });
  if (
    !raw ||
    typeof raw !== 'object' ||
    !('schemaVersion' in raw) ||
    raw.schemaVersion !== 1 ||
    !('plugins' in raw) ||
    !Array.isArray(raw.plugins)
  )
    throw new RegistryError();
  const seen = new Set<string>();
  for (const entry of raw.plugins as unknown[]) {
    if (!entry || typeof entry !== 'object') throw new RegistryError();
    const e = entry as Record<string, unknown>;
    if (
      typeof e.name !== 'string' ||
      typeof e.version !== 'string' ||
      typeof e.installPath !== 'string' ||
      typeof e.linked !== 'boolean' ||
      typeof e.enabled !== 'boolean' ||
      typeof e.installedAt !== 'string' ||
      typeof e.manifestSha256 !== 'string' ||
      !/^[a-f0-9]{64}$/.test(e.manifestSha256) ||
      typeof e.permissionsSha256 !== 'string' ||
      !/^[a-f0-9]{64}$/.test(e.permissionsSha256) ||
      !e.source ||
      typeof e.source !== 'object' ||
      !('type' in e.source) ||
      e.source.type !== 'path' ||
      !('path' in e.source) ||
      typeof e.source.path !== 'string'
    )
      throw new RegistryError();
    try {
      assertPluginName(e.name);
    } catch {
      throw new RegistryError();
    }
    if (resolve(e.installPath) !== join(resolve(paths.pluginsDir), e.name) || seen.has(e.name))
      throw new RegistryError();
    assertWritePath(paths.home, e.installPath, true);
    seen.add(e.name);
  }
  return raw as RegistryData;
}
/** Internal store operation. Call only while holding withHomeLock(paths). */
export async function writeRegistryLocked(
  paths: HarnessPaths,
  registry: RegistryData,
): Promise<void> {
  await writeJsonAtomic(paths.registryFile, registry, { home: paths.home, mode: 0o600 });
}
export class Registry {
  constructor(readonly paths: HarnessPaths) {}
  read(): Promise<RegistryData> {
    return readRegistry(this.paths);
  }
  async write(data: RegistryData): Promise<void> {
    await withHomeLock(this.paths, () => writeRegistryLocked(this.paths, data));
  }
}
