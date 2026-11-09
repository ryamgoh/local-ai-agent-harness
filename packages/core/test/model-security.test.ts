import { afterEach, expect, test, vi } from 'vitest';
import { generateText } from 'ai';
import { createModel } from '../src/agent/model.js';
afterEach(() => vi.unstubAllGlobals());
test('OpenAI-compatible endpoint sends no implicit cloud credential without apiKeyEnv', async () => {
  const fetch = vi.fn(async (_url: unknown, init: RequestInit) => {
    expect(new Headers(init.headers).get('authorization')).toBeNull();
    return new Response(
      JSON.stringify({
        id: 'id',
        object: 'chat.completion',
        created: 0,
        model: 'local-model',
        choices: [
          { index: 0, message: { role: 'assistant', content: 'local' }, finish_reason: 'stop' },
        ],
        usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
      }),
      { headers: { 'Content-Type': 'application/json' } },
    );
  });
  vi.stubGlobal('fetch', fetch);
  const model = createModel(
    { provider: 'openai-compatible', id: 'local-model', baseURL: 'http://localhost:11434/v1' },
    { env: { OPENAI_API_KEY: 'must-not-forward', ANTHROPIC_API_KEY: 'also-private' } },
  );
  expect((await generateText({ model, prompt: 'hello', maxRetries: 0 })).text).toBe('local');
  expect(fetch).toHaveBeenCalledTimes(1);
});
