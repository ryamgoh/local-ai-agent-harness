import { homedir } from 'node:os';
import { resolve, join, relative, isAbsolute, dirname } from 'node:path';
import { lstatSync, realpathSync } from 'node:fs';
import { mkdir } from 'node:fs/promises';
import envPaths from 'env-paths';
import { PathContainmentError } from './errors.js';

export interface HarnessPaths {
  home: string;
  registryFile: string;
  settingsFile: string;
  pluginsDir: string;
  configDir: string;
  dataDir: string;
  logsDir: string;
  sessionsDir: string;
}
export function resolvePaths(home?: string): HarnessPaths {
  const fallback = homedir()
    ? join(homedir(), '.harness')
    : envPaths('harness', { suffix: '' }).data;
  let root = resolve(home ?? process.env.HARNESS_HOME ?? fallback);
  try {
    root = realpathSync(root);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
  }
  return {
    home: root,
    registryFile: join(root, 'registry.json'),
    settingsFile: join(root, 'settings.json'),
    pluginsDir: join(root, 'plugins'),
    configDir: join(root, 'config'),
    dataDir: join(root, 'data'),
    logsDir: join(root, 'logs'),
    sessionsDir: join(root, 'sessions'),
  };
}
export function isContained(root: string, target: string): boolean {
  const rel = relative(resolve(root), resolve(target));
  return (
    rel !== '..' &&
    !rel.startsWith(`..${process.platform === 'win32' ? '\\' : '/'}`) &&
    !isAbsolute(rel)
  );
}
/** Check existing components as well as the lexical path; final links are never writable. */
export function assertWritePath(home: string, target: string, parentOnly = false): void {
  const root = resolve(home),
    dest = resolve(target);
  if (!isContained(root, dest)) throw new PathContainmentError(dest);
  let rootReal = root;
  try {
    rootReal = realpathSync(root);
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code !== 'ENOENT') throw e;
  }
  let p = parentOnly ? dirname(dest) : dest;
  while (isContained(root, p)) {
    try {
      const stat = lstatSync(p);
      if (stat.isSymbolicLink()) throw new PathContainmentError(p);
      if (!isContained(rootReal, realpathSync(p))) throw new PathContainmentError(p);
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code !== 'ENOENT') throw e;
    }
    if (p === root) break;
    p = dirname(p);
  }
}
export async function ensureDirectory(home: string, dir: string): Promise<void> {
  assertWritePath(home, dir);
  await mkdir(dir, { recursive: true, mode: 0o700 });
  assertWritePath(home, dir);
}
export function assertPluginName(name: string): void {
  if (name.length < 2 || name.length > 40 || !/^[a-z][a-z0-9-]*[a-z0-9]$/.test(name))
    throw new PathContainmentError(name);
}
