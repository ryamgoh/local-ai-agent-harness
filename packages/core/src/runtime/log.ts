import { createStream } from 'rotating-file-stream';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import type { Writable } from 'node:stream';
import { getValue } from '../config/properties.js';
export function secretValues(config: Record<string, unknown>): string[] {
  const values = new Set<string>();
  function visit(value: unknown) {
    if (typeof value === 'string' && value.length) {
      values.add(value);
      values.add(JSON.stringify(value).slice(1, -1));
    } else if (Array.isArray(value)) {
      values.add(JSON.stringify(value));
      value.forEach(visit);
    } else if (value && typeof value === 'object') {
      values.add(JSON.stringify(value));
      Object.values(value).forEach(visit);
    } else if (typeof value === 'number' || typeof value === 'boolean') values.add(String(value));
  }
  Object.values(config).forEach(visit);
  return [...values].filter(Boolean).sort((a, b) => b.length - a.length);
}
export function confidentialValues(
  config: Record<string, unknown>,
  keys: string[],
  envNames: string[] = [],
  env: NodeJS.ProcessEnv = {},
): string[] {
  return secretValues(
    Object.fromEntries([
      ...keys.map((key, index) => [`field${index}`, getValue(config, key)]),
      ...envNames.map((name, index) => [`env${index}`, env[name]]),
    ]),
  );
}
export function maskDiagnostic(text: string, secrets: string[]): string {
  for (const secret of secrets) if (secret) text = text.split(secret).join('••••');
  return text;
}
export function maskStructured<T>(value: T, secrets: string[]): T {
  if (typeof value === 'string') return maskDiagnostic(value, secrets) as T;
  if (Array.isArray(value)) return value.map((v) => maskStructured(v, secrets)) as T;
  if (value && typeof value === 'object')
    return Object.fromEntries(
      Object.entries(value).map(([key, v]) => [key, maskStructured(v, secrets)]),
    ) as T;
  return value;
}
export function openLog(file: string): Writable {
  mkdirSync(dirname(file), { recursive: true, mode: 0o700 });
  return createStream(file, { size: '10M', maxFiles: 5, mode: 0o600 });
}
