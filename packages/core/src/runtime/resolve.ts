import { join, resolve } from 'node:path';
import type { LoadedManifest } from '../manifest/load.js';
import { substitute, expandHome, type SubstitutionContext } from '../manifest/substitute.js';
import type { RegistryEntry } from '../store/registry.js';
import type { ResolvedConfig } from '../config/config-store.js';
import type { HarnessPaths } from '../paths.js';
import { buildEnv } from './env.js';
import type { ResolvedPlugin } from './types.js';
import { confidentialValues } from './log.js';
export class ConfigInvalidError extends Error {
  readonly code = 'CONFIG_INVALID';
  constructor(readonly issues: { key: string; message: string }[]) {
    super(issues.map((i) => `${i.key} ${i.message}`).join('; '));
  }
}
export function resolvePlugin(
  entry: RegistryEntry,
  loaded: LoadedManifest,
  config: ResolvedConfig,
  paths: HarnessPaths,
  env: NodeJS.ProcessEnv = process.env,
): ResolvedPlugin {
  if (config.issues.length) throw new ConfigInvalidError(config.issues);
  const m = loaded.manifest;
  const root = entry.installPath;
  const data = join(paths.dataDir, m.name);
  const values = { ...config.values };
  for (const key of config.pathKeys)
    if (typeof values[key] === 'string') values[key] = expandHome(values[key]);
  const ctx: SubstitutionContext = {
    plugin: { name: m.name, root, data },
    harness: { home: paths.home },
    config: values,
    env: Object.fromEntries(
      Object.entries(env).filter((e): e is [string, string] => e[1] !== undefined),
    ),
    allowedEnv: m.permissions.env ?? [],
    pathKeys: config.pathKeys,
  };
  const sub = (s: string) => substitute(s, ctx);
  const p: ResolvedPlugin = {
    name: m.name,
    priority: m.priority,
    root,
    data,
    config: values,
    permissions: {
      ...m.permissions,
      ...(m.permissions.filesystem
        ? { filesystem: m.permissions.filesystem.map((f) => ({ ...f, path: sub(f.path) })) }
        : {}),
    },
    servers: {},
    hooks: [],
    secrets: confidentialValues(values, config.secretKeys, m.permissions.env ?? [], env),
  };
  for (const [id, s] of Object.entries(m.mcpServers)) {
    const extra = Object.fromEntries(Object.entries(s.env).map(([k, v]) => [k, sub(v)]));
    p.servers[id] = {
      command: sub(s.command),
      args: s.args.map(sub),
      cwd: s.cwd ? resolve(root, sub(s.cwd)) : root,
      env: buildEnv(p, extra, env),
      startupTimeoutMs: s.startupTimeoutMs,
    };
  }
  p.hooks = m.hooks.map((h, index) => ({
    plugin: p.name,
    priority: p.priority,
    index,
    event: h.event,
    match: h.match,
    command: sub(h.command),
    args: h.args.map(sub),
    timeout: h.timeout,
    onError:
      h.onError ?? (h.event === 'PreToolUse' || h.event === 'UserPromptSubmit' ? 'deny' : 'allow'),
    owner: p,
    secrets: p.secrets,
    harnessHome: paths.home,
    env: { ...buildEnv(p, {}, env), CLAUDE_PLUGIN_ROOT: root, CLAUDE_PLUGIN_DATA: data },
    logFile: join(paths.logsDir, `${p.name}.log`),
  }));
  return p;
}
