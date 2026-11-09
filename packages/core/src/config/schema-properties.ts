import type { JsonSchemaObject } from '../manifest/schema.js';
import { isRecord } from './properties.js';

function variants(
  root: JsonSchemaObject,
  node: JsonSchemaObject,
  seen = new Set<object>(),
): JsonSchemaObject[] {
  if (seen.has(node)) return [];
  seen.add(node);
  const result = [node];
  if (typeof node.$ref === 'string' && node.$ref.startsWith('#/')) {
    let target: unknown = root;
    for (const part of node.$ref.slice(2).split('/')) {
      const key = part.replace(/~1/g, '/').replace(/~0/g, '~');
      target = isRecord(target) && Object.hasOwn(target, key) ? target[key] : undefined;
    }
    if (isRecord(target)) result.push(...variants(root, target, seen));
  }
  for (const keyword of ['allOf', 'anyOf', 'oneOf']) {
    const branches = node[keyword];
    if (Array.isArray(branches))
      for (const branch of branches)
        if (isRecord(branch)) result.push(...variants(root, branch, seen));
  }
  for (const keyword of ['if', 'then', 'else'])
    if (isRecord(node[keyword])) result.push(...variants(root, node[keyword], seen));
  return result;
}
export function configAnnotations(schema?: JsonSchemaObject): {
  secretKeys: string[];
  pathKeys: string[];
} {
  const secretKeys = new Set<string>(),
    pathKeys = new Set<string>();
  if (!schema) return { secretKeys: [], pathKeys: [] };
  function walk(node: JsonSchemaObject, prefix = '', ancestors = new Set<object>()) {
    const all = variants(schema!, node);
    if (all.some((s) => s['x-secret'] === true)) {
      if (prefix) secretKeys.add(prefix);
      else
        for (const s of all)
          if (isRecord(s.properties))
            for (const key of Object.keys(s.properties)) secretKeys.add(key);
      return;
    }
    if (prefix && all.some((s) => s.format === 'path')) pathKeys.add(prefix);
    if (ancestors.has(node)) {
      if (prefix) secretKeys.add(prefix);
      return;
    }
    const next = new Set(ancestors).add(node);
    for (const s of all) {
      if (isRecord(s.properties))
        for (const [key, prop] of Object.entries(s.properties)) {
          if (isRecord(prop)) walk(prop, prefix ? `${prefix}.${key}` : key, next);
        }
      // Protect arrays as a whole if their element schemas contain secret annotations.
      if (prefix && (isRecord(s.items) || Array.isArray(s.prefixItems))) {
        const before = new Set(secretKeys);
        if (isRecord(s.items)) walk(s.items, prefix, next);
        if (Array.isArray(s.prefixItems))
          for (const item of s.prefixItems) if (isRecord(item)) walk(item, prefix, next);
        if ([...secretKeys].some((key) => !before.has(key))) {
          for (const key of [...secretKeys])
            if (key.startsWith(`${prefix}.`)) secretKeys.delete(key);
          secretKeys.add(prefix);
        }
      }
    }
  }
  walk(schema);
  const normalized = [...secretKeys].filter(
    (key) => ![...secretKeys].some((parent) => parent !== key && key.startsWith(`${parent}.`)),
  );
  return { secretKeys: normalized, pathKeys: [...pathKeys] };
}
export function configProperty(
  schema: JsonSchemaObject,
  key: string,
): JsonSchemaObject | undefined {
  let candidates: JsonSchemaObject[] = [schema];
  for (const part of key.split('.')) {
    candidates = candidates.flatMap((node) =>
      variants(schema, node).flatMap((s) => {
        return isRecord(s.properties) && isRecord(s.properties[part])
          ? [s.properties[part] as JsonSchemaObject]
          : [];
      }),
    );
    if (!candidates.length) return undefined;
  }
  const result = Object.assign(
    {},
    ...candidates.flatMap((node) => variants(schema, node)),
  ) as JsonSchemaObject;
  // Local references were resolved above; final validation still uses the complete original schema.
  delete result.$ref;
  return result;
}
