import { readFile, lstat } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { createHash } from 'node:crypto';
import writeFileAtomic from 'write-file-atomic';
import lockfile from 'proper-lockfile';
import canonicalize from 'canonicalize';
import { assertWritePath, ensureDirectory, resolvePaths, type HarnessPaths } from './paths.js';
import { HarnessError } from './errors.js';

export interface AtomicWriteOptions {
  mode?: number;
  home?: string;
}
export async function writeJsonAtomic(
  file: string,
  value: unknown,
  options: AtomicWriteOptions | number = {},
): Promise<void> {
  const opts = typeof options === 'number' ? { mode: options } : options;
  const home = opts.home ?? resolvePaths().home;
  assertWritePath(home, file);
  await ensureDirectory(home, dirname(file));
  await writeFileAtomic(file, `${JSON.stringify(value, null, 2)}\n`, {
    fsync: true,
    mode: opts.mode ?? 0o600,
  });
}
export async function readJson<T = unknown>(file: string, fallback?: T): Promise<T> {
  try {
    return JSON.parse(await readFile(file, 'utf8')) as T;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT' && fallback !== undefined)
      return structuredClone(fallback);
    throw new HarnessError('STATE_INVALID', 'Cannot read valid JSON state');
  }
}
export async function withHomeLock<T>(
  paths: HarnessPaths | string,
  action: () => Promise<T>,
): Promise<T> {
  const home = typeof paths === 'string' ? paths : paths.home;
  await ensureDirectory(home, home);
  const lockfilePath = join(home, '.state.lock');
  assertWritePath(home, lockfilePath);
  const release = await lockfile.lock(home, {
    lockfilePath,
    stale: 30_000,
    update: 10_000,
    retries: { retries: 40, minTimeout: 10, maxTimeout: 100, randomize: true },
  });
  try {
    return await action();
  } finally {
    await release();
  }
}
export function hashJson(value: unknown): string {
  const text = canonicalize(value);
  if (text === undefined) throw new HarnessError('STATE_INVALID', 'Cannot hash non-JSON state');
  return createHash('sha256').update(text).digest('hex');
}
export async function pathExists(file: string): Promise<boolean> {
  try {
    await lstat(file);
    return true;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return false;
    throw error;
  }
}
