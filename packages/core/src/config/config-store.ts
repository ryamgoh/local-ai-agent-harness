import { rm } from 'node:fs/promises';
import { join } from 'node:path';
import { ConfigInvalidError, type ConfigIssue } from '../errors.js';
import { assertPluginName, assertWritePath, type HarnessPaths } from '../paths.js';
import { readJson, writeJsonAtomic, withHomeLock, pathExists } from '../fs-atomic.js';
import type { JsonSchemaObject } from '../manifest/schema.js';
import { validateDetailed } from './validation.js';
import {
  deleteValue,
  getValue,
  hasValue,
  isRecord,
  isSafeKey,
  mergeValues,
  setValue,
} from './properties.js';
import {
  configAnnotations as annotations,
  configProperty as propertyAt,
} from './schema-properties.js';

export type { ConfigIssue } from '../errors.js';
export type { JsonSchemaObject } from '../manifest/schema.js';
export interface ResolvedConfig {
  values: Record<string, unknown>;
  issues: ConfigIssue[];
  secretKeys: string[];
  pathKeys: string[];
}
interface ConfigFiles {
  plain: string;
  secrets: string;
}
function storedKeys(values: Record<string, unknown>, prefix = ''): string[] {
  return Object.entries(values).flatMap(([key, value]) => {
    const path = prefix ? `${prefix}.${key}` : key;
    return isRecord(value) && Object.keys(value).length > 0 ? storedKeys(value, path) : [path];
  });
}
export function coerce(raw: string, prop: JsonSchemaObject): unknown {
  let value: unknown = raw;
  const types = Array.isArray(prop.type) ? prop.type : [prop.type];
  if (types.includes('array') || types.includes('object')) {
    try {
      value = JSON.parse(raw);
    } catch {
      /* Keep raw; Ajv reports the schema type, not the input. */
    }
  }
  const result = validateDetailed(
    {
      type: 'object',
      properties: { value: prop },
      required: ['value'],
      additionalProperties: false,
    },
    { value },
    true,
  );
  return isRecord(result.value) ? result.value.value : value;
}
export function maskSecrets(
  values: Record<string, unknown>,
  secretKeys: string[],
): Record<string, unknown> {
  const masked = structuredClone(values);
  for (const key of secretKeys)
    if (isSafeKey(key) && hasValue(masked, key)) setValue(masked, key, '••••');
  return masked;
}
export class ConfigStore {
  constructor(readonly paths: HarnessPaths) {}
  private files(plugin: string): ConfigFiles {
    assertPluginName(plugin);
    const files = {
      plain: join(this.paths.configDir, `${plugin}.json`),
      secrets: join(this.paths.configDir, `${plugin}.secrets.json`),
    };
    assertWritePath(this.paths.home, files.plain);
    assertWritePath(this.paths.home, files.secrets);
    return files;
  }
  private async read(
    plugin: string,
  ): Promise<{ plain: Record<string, unknown>; secrets: Record<string, unknown> }> {
    const files = this.files(plugin);
    const plain = await readJson<unknown>(files.plain, {}),
      secrets = await readJson<unknown>(files.secrets, {});
    if (!isRecord(plain) || !isRecord(secrets))
      throw new ConfigInvalidError(plugin, [
        { key: '', message: 'stored config must be an object' },
      ]);
    return { plain, secrets };
  }
  async resolve(plugin: string, schema?: JsonSchemaObject): Promise<ResolvedConfig> {
    const { plain, secrets } = await this.read(plugin);
    let values: Record<string, unknown>;
    try {
      values = mergeValues(plain, secrets);
    } catch {
      throw new ConfigInvalidError(plugin, [
        { key: '', message: 'stored config contains an invalid property key' },
      ]);
    }
    const tagged = annotations(schema);
    const secretKeys = [...new Set([...tagged.secretKeys, ...storedKeys(secrets)])];
    if (!schema) return { values, issues: [], secretKeys, pathKeys: tagged.pathKeys };
    const result = validateDetailed(schema, values);
    return {
      values: result.value as Record<string, unknown>,
      issues: result.issues,
      secretKeys,
      pathKeys: tagged.pathKeys,
    };
  }
  async set(
    plugin: string,
    schema: JsonSchemaObject,
    assignments: Record<string, string>,
  ): Promise<ConfigIssue[]> {
    return withHomeLock(this.paths, async () => {
      const stored = await this.read(plugin);
      const values = mergeValues(stored.plain, stored.secrets);
      const issues: ConfigIssue[] = [];
      for (const [key, raw] of Object.entries(assignments)) {
        const prop = isSafeKey(key) ? propertyAt(schema, key) : undefined;
        if (!prop) {
          issues.push({ key, message: 'unknown config key' });
          continue;
        }
        setValue(values, key, coerce(raw, prop));
      }
      if (issues.length) return issues;
      const result = validateDetailed(schema, values);
      if (!result.success) return result.issues;
      const next = result.value as Record<string, unknown>;
      const plain = structuredClone(next),
        secrets: Record<string, unknown> = {};
      const secretKeys = [
        ...new Set([...annotations(schema).secretKeys, ...storedKeys(stored.secrets)]),
      ];
      for (const key of secretKeys)
        if (hasValue(next, key)) {
          setValue(secrets, key, getValue(next, key));
          deleteValue(plain, key);
        }
      await this.persist(plugin, plain, secrets);
      return [];
    });
  }
  async unset(plugin: string, key: string): Promise<void> {
    if (!isSafeKey(key))
      throw new ConfigInvalidError(plugin, [{ key, message: 'invalid config key' }]);
    await withHomeLock(this.paths, async () => {
      const { plain, secrets } = await this.read(plugin);
      deleteValue(plain, key);
      deleteValue(secrets, key);
      await this.persist(plugin, plain, secrets);
    });
  }
  async remove(plugin: string): Promise<void> {
    await withHomeLock(this.paths, async () => {
      const files = this.files(plugin);
      await rm(files.plain, { force: true });
      await rm(files.secrets, { force: true });
    });
  }
  private async persist(
    plugin: string,
    plain: Record<string, unknown>,
    secrets: Record<string, unknown>,
  ): Promise<void> {
    const files = this.files(plugin);
    const before = await this.read(plugin);
    const hadPlain = await pathExists(files.plain),
      hadSecrets = await pathExists(files.secrets);
    let wroteSecrets = false;
    try {
      await writeJsonAtomic(files.secrets, secrets, { home: this.paths.home, mode: 0o600 });
      wroteSecrets = true;
      await writeJsonAtomic(files.plain, plain, { home: this.paths.home, mode: 0o600 });
    } catch (error) {
      if (wroteSecrets) {
        if (hadSecrets)
          await writeJsonAtomic(files.secrets, before.secrets, {
            home: this.paths.home,
            mode: 0o600,
          });
        else await rm(files.secrets, { force: true });
      }
      if (!hadPlain) await rm(files.plain, { force: true });
      throw error;
    }
  }
}
