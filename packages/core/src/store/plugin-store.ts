import { cp, lstat, readdir, realpath, rename, rm, symlink } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { join, resolve, relative, sep } from 'node:path';
import {
  AlreadyInstalledError,
  ManifestChangedError,
  NotInstalledError,
  PathContainmentError,
} from '../errors.js';
import { hashJson, pathExists, withHomeLock } from '../fs-atomic.js';
import {
  assertPluginName,
  assertWritePath,
  ensureDirectory,
  isContained,
  type HarnessPaths,
} from '../paths.js';
import { loadManifest, type LoadedManifest } from '../manifest/load.js';
import type { Permissions } from '../manifest/schema.js';
import {
  readRegistry,
  writeRegistryLocked,
  type PluginSource,
  type RegistryEntry,
} from './registry.js';
import { consentHash, readConsent, writeConsent } from './consent.js';

export type { PluginSource, RegistryEntry } from './registry.js';
export interface InstallPlan {
  loaded: LoadedManifest;
  source: PluginSource;
  commands: string[][];
  permissions: Permissions;
}
export interface InstallOptions {
  link?: boolean;
  enable?: boolean;
  force?: boolean;
  /** Test seam: copy source into a fresh staging path. No package scripts are run. */
  copy?: (source: string, destination: string) => Promise<void>;
}
const developmentDirs = new Set(['node_modules', '.git', '.venv', '__pycache__', '.pytest_cache']);
async function checkTree(root: string, directory = root): Promise<void> {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (developmentDirs.has(entry.name)) continue;
    const file = join(directory, entry.name);
    if (entry.isSymbolicLink()) {
      let target: string;
      try {
        target = await realpath(file);
      } catch {
        throw new PathContainmentError(file);
      }
      if (!isContained(root, target)) throw new PathContainmentError(file);
    } else if (entry.isDirectory()) await checkTree(root, file);
    else if (!entry.isFile()) throw new PathContainmentError(file);
  }
}
function commandsFor(loaded: LoadedManifest): string[][] {
  const root = (s: string) => s.split('${plugin.root}').join(loaded.dir);
  return [
    ...Object.values(loaded.manifest.mcpServers).map((s) => [s.command, ...s.args]),
    ...loaded.manifest.hooks.map((h) => [h.command, ...h.args]),
  ].map((argv) => argv.map(root));
}
export class PluginStore {
  constructor(readonly paths: HarnessPaths) {}
  async plan(src: string): Promise<InstallPlan> {
    const dir = await realpath(resolve(src));
    const loaded = await loadManifest(dir);
    await checkTree(dir);
    return {
      loaded,
      source: { type: 'path', path: dir },
      commands: commandsFor(loaded),
      permissions: loaded.manifest.permissions,
    };
  }
  async install(plan: InstallPlan, opts: InstallOptions = {}): Promise<RegistryEntry> {
    return withHomeLock(this.paths, async () => {
      const source = await realpath(plan.source.path);
      const fresh = await loadManifest(source);
      const name = fresh.manifest.name;
      assertPluginName(name);
      if (
        hashJson(fresh.manifest) !== hashJson(plan.loaded.manifest) ||
        hashJson(commandsFor(fresh)) !== hashJson(plan.commands) ||
        hashJson(fresh.manifest.permissions) !== hashJson(plan.permissions)
      ) {
        throw new ManifestChangedError(name);
      }
      await checkTree(source);
      const registry = await readRegistry(this.paths);
      const existing = registry.plugins.find((e) => e.name === name);
      const destination = join(this.paths.pluginsDir, name);
      assertWritePath(this.paths.home, destination, true);
      if ((existing || (await pathExists(destination))) && !opts.force)
        throw new AlreadyInstalledError(name);
      await ensureDirectory(this.paths.home, this.paths.pluginsDir);
      const stage = join(this.paths.pluginsDir, `.staging-${randomUUID()}`);
      const backup = join(this.paths.pluginsDir, `.backup-${randomUUID()}`);
      const data = join(this.paths.dataDir, name);
      const previousConsent = await readConsent(this.paths, name);
      let backedUp = false,
        installed = false,
        createdData = false,
        wroteConsent = false;
      try {
        if (opts.link) await symlink(source, stage, 'dir');
        else {
          if (opts.copy) await opts.copy(source, stage);
          else
            await cp(source, stage, {
              recursive: true,
              dereference: true,
              errorOnExist: true,
              force: false,
              filter: (file) =>
                !relative(source, file)
                  .split(sep)
                  .some((part) => developmentDirs.has(part)),
            });
          // A copy seam cannot introduce a linked root or escaping links.
          if ((await lstat(stage)).isSymbolicLink()) throw new PathContainmentError(stage);
          await checkTree(stage);
          if (hashJson((await loadManifest(stage)).manifest) !== hashJson(fresh.manifest))
            throw new ManifestChangedError(name);
        }
        if (hashJson((await loadManifest(source)).manifest) !== hashJson(fresh.manifest))
          throw new ManifestChangedError(name);
        if (await pathExists(destination)) {
          await rename(destination, backup);
          backedUp = true;
        }
        await rename(stage, destination);
        installed = true;
        const hadData = await pathExists(data);
        await ensureDirectory(this.paths.home, data);
        createdData = !hadData;
        const entry: RegistryEntry = {
          name,
          version: fresh.manifest.version,
          source: { type: 'path', path: source },
          installPath: destination,
          linked: opts.link ?? false,
          enabled: opts.enable ?? true,
          installedAt: new Date().toISOString(),
          manifestSha256: hashJson(fresh.manifest),
          permissionsSha256: hashJson(fresh.manifest.permissions),
        };
        await writeConsent(this.paths, name, {
          schemaVersion: 1,
          manifestSha256: entry.manifestSha256,
          consentSha256: consentHash(fresh.manifest),
        });
        wroteConsent = true;
        await writeRegistryLocked(this.paths, {
          schemaVersion: 1,
          plugins: [...registry.plugins.filter((e) => e.name !== name), entry],
        });
        if (backedUp) await rm(backup, { recursive: true, force: true }).catch(() => {});
        return entry;
      } catch (error) {
        if (wroteConsent) await writeConsent(this.paths, name, previousConsent);
        if (installed) await rm(destination, { recursive: true, force: true });
        if (backedUp) await rename(backup, destination);
        if (createdData) await rm(data, { recursive: true, force: true });
        throw error;
      } finally {
        await rm(stage, { recursive: true, force: true });
      }
    });
  }
  async uninstall(name: string): Promise<void> {
    assertPluginName(name);
    await withHomeLock(this.paths, async () => {
      const registry = await readRegistry(this.paths);
      const entry = registry.plugins.find((e) => e.name === name);
      if (!entry) throw new NotInstalledError(name);
      assertWritePath(this.paths.home, entry.installPath, true);
      const backup = join(this.paths.pluginsDir, `.removed-${randomUUID()}`);
      const exists = await pathExists(entry.installPath);
      if (exists) await rename(entry.installPath, backup);
      try {
        await writeRegistryLocked(this.paths, {
          schemaVersion: 1,
          plugins: registry.plugins.filter((e) => e.name !== name),
        });
      } catch (error) {
        if (exists) await rename(backup, entry.installPath);
        throw error;
      }
      if (exists) await rm(backup, { recursive: true, force: true });
      await writeConsent(this.paths, name, null);
    });
  }
  async list(): Promise<RegistryEntry[]> {
    return (await readRegistry(this.paths)).plugins;
  }
  async get(name: string): Promise<RegistryEntry | undefined> {
    assertPluginName(name);
    return (await this.list()).find((e) => e.name === name);
  }
  async setEnabled(name: string, enabled: boolean): Promise<RegistryEntry> {
    assertPluginName(name);
    return withHomeLock(this.paths, async () => {
      const registry = await readRegistry(this.paths);
      const entry = registry.plugins.find((e) => e.name === name);
      if (!entry) throw new NotInstalledError(name);
      if (enabled) await this.loadEntry(entry);
      const updated = { ...entry, enabled };
      await writeRegistryLocked(this.paths, {
        schemaVersion: 1,
        plugins: registry.plugins.map((e) => (e.name === name ? updated : e)),
      });
      return updated;
    });
  }
  async load(name: string): Promise<LoadedManifest> {
    const entry = await this.get(name);
    if (!entry) throw new NotInstalledError(name);
    return this.loadEntry(entry);
  }
  private async loadEntry(entry: RegistryEntry): Promise<LoadedManifest> {
    assertWritePath(this.paths.home, entry.installPath, true);
    const stat = await lstat(entry.installPath);
    if (entry.linked !== stat.isSymbolicLink()) throw new ManifestChangedError(entry.name);
    const dir = await realpath(entry.installPath);
    if (entry.linked && dir !== resolve(entry.source.path))
      throw new ManifestChangedError(entry.name);
    if (!entry.linked && !isContained(this.paths.home, dir)) throw new PathContainmentError(dir);
    const loaded = await loadManifest(dir);
    if (
      loaded.manifest.name !== entry.name ||
      hashJson(loaded.manifest.permissions) !== entry.permissionsSha256
    )
      throw new ManifestChangedError(entry.name);
    if (hashJson(loaded.manifest) !== entry.manifestSha256) {
      const receipt = await readConsent(this.paths, entry.name);
      if (
        !receipt ||
        receipt.schemaVersion !== 1 ||
        receipt.manifestSha256 !== entry.manifestSha256 ||
        receipt.consentSha256 !== consentHash(loaded.manifest)
      )
        throw new ManifestChangedError(entry.name);
    }
    await checkTree(dir);
    return loaded;
  }
}
