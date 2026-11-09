import { createOpenAICompatible } from '@ai-sdk/openai-compatible';
import { createOpenAI } from '@ai-sdk/openai';
import { createAnthropic } from '@ai-sdk/anthropic';
import { createProviderRegistry, customProvider, type LanguageModel } from './ai-sdk.js';
import type { ModelSettings } from '../config/settings.js';
import { createScriptedModel } from './mock-model.js';

export function createModel(
  settings: ModelSettings,
  opts: { env?: NodeJS.ProcessEnv; home?: string } = {},
): LanguageModel {
  const env = opts.env ?? process.env;
  const keyName =
    settings.apiKeyEnv ??
    (settings.provider === 'anthropic'
      ? 'ANTHROPIC_API_KEY'
      : settings.provider === 'openai'
        ? 'OPENAI_API_KEY'
        : undefined);
  const apiKey = keyName ? env[keyName] : undefined;
  if (
    (settings.provider === 'openai' || settings.provider === 'anthropic' || settings.apiKeyEnv) &&
    !apiKey &&
    settings.provider !== 'mock'
  ) {
    throw new Error(`Model credentials missing: set ${keyName}`);
  }
  // Empty explicit keys on unused providers prevent their ambient-env fallback.
  const registry = createProviderRegistry({
    'openai-compatible': createOpenAICompatible({
      name: 'local',
      baseURL: settings.baseURL ?? 'http://localhost:11434/v1',
      apiKey: settings.provider === 'openai-compatible' ? (apiKey ?? '') : '',
    }),
    openai: createOpenAI({
      apiKey: settings.provider === 'openai' ? (apiKey ?? '') : '',
      ...(settings.provider === 'openai' && settings.baseURL ? { baseURL: settings.baseURL } : {}),
    }),
    anthropic: createAnthropic({
      apiKey: settings.provider === 'anthropic' ? (apiKey ?? '') : '',
      ...(settings.provider === 'anthropic' && settings.baseURL
        ? { baseURL: settings.baseURL }
        : {}),
    }),
    mock: customProvider({
      languageModels:
        settings.provider === 'mock'
          ? { [settings.id]: createScriptedModel(settings.id, { home: opts.home, env }) }
          : {},
    }),
  });
  return registry.languageModel(`${settings.provider}:${settings.id}`);
}
