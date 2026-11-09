import { SettingsError } from '../errors.js';
import { readJson, withHomeLock, writeJsonAtomic } from '../fs-atomic.js';
import { assertWritePath, type HarnessPaths } from '../paths.js';
import { validateDetailed } from './validation.js';
import { getValue, isRecord, mergeValues, setValue } from './properties.js';

export interface ModelSettings {
  provider: 'openai-compatible' | 'openai' | 'anthropic' | 'mock';
  id: string;
  baseURL?: string;
  apiKeyEnv?: string;
}
export interface HostSettings {
  model: ModelSettings;
  approvals: 'destructive' | 'always' | 'off';
  maxSteps: number;
}
export const DEFAULT_SETTINGS: HostSettings = {
  model: { provider: 'openai-compatible', id: 'qwen3:8b', baseURL: 'http://localhost:11434/v1' },
  approvals: 'destructive',
  maxSteps: 20,
};
const SettingsSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['model', 'approvals', 'maxSteps'],
  properties: {
    model: {
      type: 'object',
      additionalProperties: false,
      required: ['provider', 'id'],
      properties: {
        provider: { type: 'string', enum: ['openai-compatible', 'openai', 'anthropic', 'mock'] },
        id: { type: 'string', minLength: 1 },
        baseURL: { type: 'string', format: 'uri' },
        apiKeyEnv: { type: 'string', pattern: '^[A-Za-z_][A-Za-z0-9_]*$' },
      },
    },
    approvals: { type: 'string', enum: ['destructive', 'always', 'off'] },
    maxSteps: { type: 'integer', minimum: 1 },
  },
};
async function storedSettings(paths: HarnessPaths): Promise<HostSettings> {
  assertWritePath(paths.home, paths.settingsFile);
  const raw = await readJson<unknown>(paths.settingsFile, {});
  if (!isRecord(raw)) throw new SettingsError('Settings must be an object');
  let merged: Record<string, unknown>;
  try {
    merged = mergeValues(DEFAULT_SETTINGS as unknown as Record<string, unknown>, raw);
  } catch {
    throw new SettingsError('Settings contain an invalid property key');
  }
  const result = validateDetailed(SettingsSchema, merged);
  if (!result.success) throw new SettingsError(`Invalid settings: ${result.errors.join('; ')}`);
  return result.value as HostSettings;
}
export async function loadSettings(
  paths: HarnessPaths,
  env: NodeJS.ProcessEnv = process.env,
): Promise<HostSettings> {
  const settings = await storedSettings(paths);
  if (env.HARNESS_MODEL !== undefined) {
    const split = env.HARNESS_MODEL.indexOf(':');
    const provider = env.HARNESS_MODEL.slice(0, split),
      id = env.HARNESS_MODEL.slice(split + 1);
    if (
      split < 1 ||
      !id ||
      !['openai-compatible', 'openai', 'anthropic', 'mock'].includes(provider)
    ) {
      throw new SettingsError('HARNESS_MODEL must be <supported-provider>:<nonempty-id>');
    }
    settings.model = { ...settings.model, provider: provider as ModelSettings['provider'], id };
  }
  return settings;
}
export async function saveSetting(paths: HarnessPaths, key: string, value: string): Promise<void> {
  if (
    ![
      'model.provider',
      'model.id',
      'model.baseURL',
      'model.apiKeyEnv',
      'approvals',
      'maxSteps',
    ].includes(key)
  )
    throw new SettingsError('Unknown settings key');
  await withHomeLock(paths, async () => {
    const current = await storedSettings(paths);
    const next = structuredClone(current) as unknown as Record<string, unknown>;
    setValue(next, key, key === 'maxSteps' ? Number(value) : value);
    const result = validateDetailed(SettingsSchema, next);
    if (!result.success)
      throw new SettingsError(`Invalid setting ${key}: ${result.errors.join('; ')}`);
    // Explicitly do not persist the environment-only model override.
    await writeJsonAtomic(paths.settingsFile, result.value, { home: paths.home, mode: 0o600 });
  });
}
export function getSetting(settings: HostSettings, key: string): unknown {
  return getValue(settings as unknown as Record<string, unknown>, key);
}
