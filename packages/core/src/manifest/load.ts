import { readFile } from 'node:fs/promises';
import { realpathSync, lstatSync, readlinkSync } from 'node:fs';
import { join, resolve, dirname, basename, isAbsolute } from 'node:path';
import { ManifestError, type ManifestIssue } from '../errors.js';
import { isContained } from '../paths.js';
import { MANIFEST_FILE, PluginManifestSchema, type PluginManifest } from './schema.js';
import { validateSchema } from '../config/validation.js';

export type { ManifestIssue } from '../errors.js';
export { MANIFEST_FILE } from './schema.js';
export interface LoadedManifest {
  dir: string;
  manifest: PluginManifest;
  warnings: string[];
}

function nearestReal(path: string, depth = 0): string {
  if (depth > 40) throw new Error('Cannot resolve path');
  try {
    if (lstatSync(path).isSymbolicLink())
      return nearestReal(resolve(dirname(path), readlinkSync(path)), depth + 1);
    return realpathSync(path);
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code !== 'ENOENT') throw e;
    const parent = dirname(path);
    return parent === path ? path : join(nearestReal(parent, depth + 1), basename(path));
  }
}
export function validateManifestRefs(m: PluginManifest, dir: string): ManifestIssue[] {
  const issues: ManifestIssue[] = [];
  const root = resolve(dir),
    realRoot = nearestReal(root);
  const properties = m.config?.properties ?? {};
  const allowed = m.permissions.env ?? [];
  function check(
    value: string,
    path: string,
    kind: 'command' | 'argument' | 'file' | 'permission' | 'env' | 'cwd',
  ) {
    for (const match of value.matchAll(/\$\{([^}]*)\}/g)) {
      const variable = match[1] ?? '';
      const valid =
        /^(plugin\.(root|data|name)|harness\.home)$/.test(variable) ||
        (/^config\.[A-Za-z0-9_]+$/.test(variable) &&
          Object.hasOwn(properties, variable.slice(7))) ||
        (/^env\.[A-Za-z0-9_]+$/.test(variable) && allowed.includes(variable.slice(4)));
      if (!valid)
        issues.push({
          path,
          message: variable.startsWith('env.')
            ? 'environment variable must be declared in permissions.env'
            : `unknown variable "${variable}"`,
        });
    }
    const rooted = value.includes('${plugin.root}');
    const localPath =
      kind === 'file' ||
      kind === 'cwd' ||
      (kind === 'command' && /[/\\]/.test(value)) ||
      (kind === 'argument' &&
        (/^(\.\.?[/\\])/.test(value) ||
          (value.includes('/') && !value.startsWith('-') && !value.includes('://'))));
    if (!rooted && (!localPath || value.includes('${'))) return;
    const reference = rooted ? value.slice(value.indexOf('${plugin.root}')) : value;
    let expanded = reference.split('${plugin.root}').join(root);
    // A static prefix can already escape, even when a later config value is unresolved.
    if (expanded.includes('${')) expanded = expanded.slice(0, expanded.indexOf('${'));
    const candidate = isAbsolute(expanded) ? expanded : resolve(root, expanded);
    try {
      if (isContained(root, candidate) && isContained(realRoot, nearestReal(candidate))) return;
    } catch {
      /* An unresolvable link is not a valid contained reference. */
    }
    {
      issues.push({ path, message: 'path escapes plugin root (including symlink targets)' });
    }
  }
  for (const [id, server] of Object.entries(m.mcpServers)) {
    const path = `mcpServers.${id}`;
    check(server.command, `${path}.command`, 'command');
    server.args.forEach((arg, i) => check(arg, `${path}.args.${i}`, 'argument'));
    for (const [key, value] of Object.entries(server.env))
      check(value, `${path}.env.${key}`, 'env');
    if (server.cwd) check(server.cwd, `${path}.cwd`, 'cwd');
  }
  m.hooks.forEach((hook, i) => {
    check(hook.command, `hooks.${i}.command`, 'command');
    hook.args.forEach((arg, j) => check(arg, `hooks.${i}.args.${j}`, 'argument'));
  });
  m.permissions.filesystem?.forEach((entry, i) =>
    check(entry.path, `permissions.filesystem.${i}.path`, 'permission'),
  );
  for (const [key, command] of Object.entries(m.commands))
    check(command.file, `commands.${key}.file`, 'file');
  return issues;
}
export async function loadManifest(dir: string): Promise<LoadedManifest> {
  const root = resolve(dir);
  let raw: unknown;
  try {
    if (!isContained(nearestReal(root), nearestReal(join(root, MANIFEST_FILE)))) {
      throw new Error('Manifest path escapes its root');
    }
  } catch {
    throw new ManifestError(root, [
      { path: MANIFEST_FILE, message: 'manifest path escapes plugin root or cannot be resolved' },
    ]);
  }
  try {
    raw = JSON.parse(await readFile(join(root, MANIFEST_FILE), 'utf8'));
  } catch {
    throw new ManifestError(root, [{ path: '', message: 'cannot read valid JSON manifest' }]);
  }
  if (raw && typeof raw === 'object' && 'apiVersion' in raw && raw.apiVersion !== 1) {
    const version = typeof raw.apiVersion === 'number' ? String(raw.apiVersion) : 'invalid';
    throw new ManifestError(root, [
      { path: 'apiVersion', message: `unsupported apiVersion ${version} (host supports 1)` },
    ]);
  }
  const parsed = PluginManifestSchema.safeParse(raw);
  if (!parsed.success)
    throw new ManifestError(
      root,
      parsed.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
    );
  const manifest = parsed.data;
  manifest.hooks = manifest.hooks.map((h) => ({
    ...h,
    onError:
      h.onError ?? (h.event === 'PreToolUse' || h.event === 'UserPromptSubmit' ? 'deny' : 'allow'),
  }));
  const issues = validateManifestRefs(manifest, root);
  if (manifest.config && !validateSchema(manifest.config))
    issues.push({ path: 'config', message: 'invalid or unsupported JSON schema' });
  if (issues.length) throw new ManifestError(root, issues);
  const known = new Set(Object.keys(PluginManifestSchema.shape));
  const warnings = Object.keys(raw as object)
    .filter((k) => !known.has(k))
    .map((k) => `unknown top-level field "${k}"`);
  return { dir: root, manifest, warnings };
}
