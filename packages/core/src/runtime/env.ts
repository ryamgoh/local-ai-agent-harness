import type { ResolvedPlugin } from './types.js';
const BASE_KEYS = new Set([
  'PATH',
  'HOME',
  'USER',
  'LOGNAME',
  'SHELL',
  'TERM',
  'LANG',
  'TMPDIR',
  'SystemRoot',
  'APPDATA',
  'USERPROFILE',
]);
export function buildEnv(
  p: Pick<ResolvedPlugin, 'name' | 'root' | 'data' | 'config'>,
  extra: Record<string, string>,
  base: NodeJS.ProcessEnv = process.env,
): Record<string, string> {
  const env: Record<string, string> = {};
  for (const [key, value] of Object.entries(base))
    if (value !== undefined && (BASE_KEYS.has(key) || key.startsWith('LC_'))) env[key] = value;
  return {
    ...env,
    ...extra,
    HARNESS_PLUGIN_NAME: p.name,
    HARNESS_PLUGIN_ROOT: p.root,
    HARNESS_PLUGIN_DATA: p.data,
    HARNESS_PLUGIN_CONFIG: JSON.stringify(p.config),
    HARNESS_PROTOCOL: '1',
  };
}
