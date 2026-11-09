import { getProperty, setProperty, deleteProperty, hasProperty } from 'dot-prop';

export function isSafeKey(key: string): boolean {
  return (
    key.length > 0 &&
    !key.split(/[.\[\]]/).some((p) => ['__proto__', 'prototype', 'constructor'].includes(p))
  );
}
export function getValue(object: Record<string, unknown>, key: string): unknown {
  return getProperty(object, key);
}
export function hasValue(object: Record<string, unknown>, key: string): boolean {
  return hasProperty(object, key);
}
export function setValue(object: Record<string, unknown>, key: string, value: unknown): void {
  if (!isSafeKey(key)) throw new Error('Invalid property key');
  setProperty(object, key, value);
}
export function deleteValue(object: Record<string, unknown>, key: string): void {
  if (!isSafeKey(key)) throw new Error('Invalid property key');
  deleteProperty(object, key);
}
export function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}
export function mergeValues(
  a: Record<string, unknown>,
  b: Record<string, unknown>,
): Record<string, unknown> {
  const result = structuredClone(a);
  for (const [key, value] of Object.entries(b)) {
    if (!isSafeKey(key)) throw new Error('Invalid property key');
    result[key] =
      isRecord(value) && isRecord(result[key])
        ? mergeValues(result[key], value)
        : structuredClone(value);
  }
  return result;
}
