import untildify from 'untildify';
import { UnknownVariableError, UndeclaredEnvError } from '../errors.js';

export interface SubstitutionContext {
  plugin: { name: string; root: string; data: string };
  harness: { home: string };
  config: Record<string, unknown>;
  env: Record<string, string>;
  allowedEnv: string[];
  pathKeys: string[];
}
export function expandHome(p: string): string {
  return untildify(p);
}
export function listVariables(input: string): string[] {
  return Array.from(input.matchAll(/\$\{([^}]*)\}/g), (m) => m[1] ?? '');
}
export function substitute(input: string, ctx: SubstitutionContext): string {
  return input.replace(/\$\{([^}]*)\}/g, (_match, variable: string) => {
    const match = /^([a-z]+)\.([A-Za-z0-9_]+)$/.exec(variable);
    if (!match) throw new UnknownVariableError(variable);
    const namespace = match[1],
      key = match[2]!;
    let value: unknown;
    if (namespace === 'plugin' && ['name', 'root', 'data'].includes(key))
      value = ctx.plugin[key as keyof SubstitutionContext['plugin']];
    else if (namespace === 'harness' && key === 'home') value = ctx.harness.home;
    else if (namespace === 'config' && Object.hasOwn(ctx.config, key)) {
      value = ctx.config[key];
      if (typeof value === 'string' && ctx.pathKeys.includes(key)) value = expandHome(value);
    } else if (namespace === 'env') {
      if (!ctx.allowedEnv.includes(key)) throw new UndeclaredEnvError(key);
      value = Object.hasOwn(ctx.env, key) ? ctx.env[key] : '';
    } else throw new UnknownVariableError(variable);
    if (value === undefined) throw new UnknownVariableError(variable);
    return typeof value === 'string' ? value : JSON.stringify(value);
  });
}
