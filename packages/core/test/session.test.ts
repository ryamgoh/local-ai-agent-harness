import { mkdtemp, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { Ajv2020 } from 'ajv/dist/2020.js';
import { generateText, ToolLoopAgent, type LanguageModel } from 'ai';
import { MockLanguageModelV4 } from 'ai/test';
import { createModel } from '../src/agent/model.js';
import { Session } from '../src/agent/session.js';
import type { ToolGateway, TurnEvent, TurnIO } from '../src/agent/gateway.js';
import type { ToolBeforeOutcome } from '../src/hooks/engine.js';
import type { HostTool, ToolResult } from '../src/runtime/runtime-manager.js';

let home: string;
beforeEach(async () => {
  home = await mkdtemp(join(tmpdir(), 'harness-session-'));
  vi.stubEnv('HARNESS_HOME', home);
});
afterEach(async () => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  await rm(home, { recursive: true, force: true });
});
const tool: HostTool = {
  plugin: 'echo',
  server: 'main',
  name: 'echo',
  qualifiedName: 'echo.echo',
  modelName: 'mcp__echo__echo',
  description: 'Echo text',
  inputSchema: {
    type: 'object',
    properties: { text: { type: 'string' } },
    required: ['text'],
    additionalProperties: false,
  },
};
const io: TurnIO = { interactive: false, autoApprove: false, confirm: async () => false };
const ok: ToolResult = { isError: false, content: [{ type: 'text', text: 'ok' }] };
async function drain(events: AsyncIterable<TurnEvent>) {
  const result: TurnEvent[] = [];
  for await (const event of events) result.push(event);
  return result;
}
function gateway(decision: 'allow' | 'deny' | 'ask' = 'allow', rewrite?: unknown) {
  const validateSchema = new Ajv2020({ allErrors: true }).compile(tool.inputSchema);
  const cache = new Map<string, ToolBeforeOutcome>();
  const before = vi.fn();
  const approved = new Set<string>();
  const approve = vi.fn((id: string) => {
    approved.add(id);
  });
  const execute = vi.fn(
    async (_ctx: unknown, id: string, qualifiedName: string, emit: (event: TurnEvent) => void) => {
      const outcome = cache.get(id)!;
      if (outcome.decision === 'deny' || (outcome.decision === 'ask' && !approved.has(id)))
        throw new Error('Gateway approval missing');
      calls.push(outcome.input);
      emit({ type: 'tool-call', tool: qualifiedName, input: outcome.input });
      emit({ type: 'tool-result', tool: qualifiedName, result: ok });
      return ok;
    },
  );
  const calls: unknown[] = [];
  const validate = vi.fn((_name: string, input: unknown) => {
    const valid = validateSchema(input);
    return {
      success: Boolean(valid),
      value: input,
      errors: valid
        ? []
        : (validateSchema.errors ?? []).map((e) => `${e.instancePath} ${e.message}`),
    };
  });
  const preflight = vi.fn(
    async (
      _ctx: unknown,
      id: string,
      _name: string,
      input: unknown,
    ): Promise<ToolBeforeOutcome> => {
      const previous = cache.get(id);
      if (previous) return previous;
      before();
      const outcome: ToolBeforeOutcome = {
        decision,
        reasons: decision === 'allow' ? [] : ['exact policy reason'],
        input: rewrite ?? input,
        trace: [{ plugin: 'policy', event: 'PreToolUse', decision, ms: 0 }],
      };
      cache.set(id, outcome);
      return outcome;
    },
  );
  return {
    instance: { validate, preflight, execute, approve } as unknown as ToolGateway,
    before,
    calls,
    validate,
    preflight,
    execute,
    approve,
  };
}
async function scripted(
  steps: ({ text: string } | { tool: string; input: unknown })[],
  options: { capture?: string; captureMessages?: string } = {},
) {
  const file = join(home, 'script.json');
  await writeFile(file, JSON.stringify({ steps, ...options }));
  return createModel({ provider: 'mock', id: file }, { home, env: {} }) as MockLanguageModelV4;
}
function session(
  model: LanguageModel,
  gw = gateway(),
  options: { maxSteps?: number; tools?: HostTool[] } = {},
) {
  return {
    session: new Session({
      model,
      gateway: gw.instance,
      tools: options.tools ?? [tool],
      maxSteps: options.maxSteps ?? 20,
      cwd: home,
    }),
    gw,
  };
}
function resultText(events: TurnEvent[]) {
  return JSON.stringify(events.filter((e) => e.type === 'tool-result'));
}
const toolStep = { tool: tool.modelName, input: { text: 'hello' } };
const usage = {
  inputTokens: { total: 0, noCache: 0, cacheRead: 0, cacheWrite: 0 },
  outputTokens: { total: 0, text: 0, reasoning: 0 },
};

// The test doubles use the installed v4 provider contract, not generateText stubs.
test('zero baseline offers no tools and captures a JSON array of tool-name arrays', async () => {
  const capture = join(home, 'tools.json');
  const model = await scripted([{ text: 'Hello' }], { capture });
  const events = await drain(session(model, gateway(), { tools: [] }).session.runTurn('hi', io));
  expect(JSON.parse(await readFile(capture, 'utf8'))).toEqual([[]]);
  expect(events.at(-1)).toEqual({ type: 'done', text: 'Hello', steps: 1 });
  expect(model.doGenerateCalls).toHaveLength(0);
  expect(model.doStreamCalls).toHaveLength(1);
});
test('maps model-facing names to qualified names and finishes in two steps', async () => {
  const model = await scripted([toolStep, { text: 'Finished' }]);
  const { session: s, gw } = session(model);
  const events = await drain(s.runTurn('echo', io));
  expect(events.filter((e) => e.type === 'tool-call').map((e) => e.tool)).toEqual(['echo.echo']);
  expect(gw.calls).toEqual([{ text: 'hello' }]);
  expect(events.at(-1)).toEqual({ type: 'done', text: 'Finished', steps: 2 });
});
test('Ajv schema errors are model-facing results, do not execute, and allow recovery', async () => {
  const captureMessages = join(home, 'messages.json');
  const model = await scripted(
    [{ tool: tool.modelName, input: { text: 42 } }, { text: 'Recovered' }],
    { captureMessages },
  );
  const { session: s, gw } = session(model);
  const events = await drain(s.runTurn('x', io));
  expect(gw.validate).toHaveBeenCalled();
  expect(gw.before).not.toHaveBeenCalled();
  expect(gw.execute).not.toHaveBeenCalled();
  expect(resultText(events)).toContain('/text must be string');
  expect(JSON.stringify(JSON.parse(await readFile(captureMessages, 'utf8'))[1])).toContain(
    '/text must be string',
  );
  expect(events.at(-1)).toMatchObject({ type: 'done', text: 'Recovered', steps: 2 });
});
test('malformed tool JSON reaches neither hooks nor execution and recovers', async () => {
  const model = new MockLanguageModelV4({
    doStream: [
      {
        stream: new ReadableStream({
          start(c) {
            c.enqueue({ type: 'stream-start', warnings: [] });
            c.enqueue({
              type: 'tool-call',
              toolCallId: 'bad-json',
              toolName: tool.modelName,
              input: '{oops',
            });
            c.enqueue({
              type: 'finish',
              finishReason: { unified: 'tool-calls', raw: 'tool_calls' },
              usage,
            });
            c.close();
          },
        }),
      },
      {
        stream: new ReadableStream({
          start(c) {
            c.enqueue({ type: 'text-start', id: 't' });
            c.enqueue({ type: 'text-delta', id: 't', delta: 'Recovered' });
            c.enqueue({ type: 'text-end', id: 't' });
            c.enqueue({ type: 'finish', finishReason: { unified: 'stop', raw: 'stop' }, usage });
            c.close();
          },
        }),
      },
    ],
  });
  const { session: s, gw } = session(model);
  const events = await drain(s.runTurn('x', io));
  expect(gw.execute).not.toHaveBeenCalled();
  expect(gw.before).not.toHaveBeenCalled();
  expect(resultText(events)).toMatch(/JSON|json/);
  expect(JSON.stringify(model.doStreamCalls[1]?.prompt)).toMatch(/JSON|json/);
  expect(events.at(-1)).toMatchObject({ type: 'done', text: 'Recovered', steps: 2 });
});
test('denial emits a tool result with the exact policy reason and autoApprove cannot bypass it', async () => {
  const model = await scripted([toolStep, { text: 'Blocked' }]);
  const { session: s, gw } = session(model, gateway('deny'));
  const confirm = vi.fn(async () => true);
  const events = await drain(s.runTurn('x', { interactive: true, autoApprove: true, confirm }));
  expect(confirm).not.toHaveBeenCalled();
  expect(gw.execute).not.toHaveBeenCalled();
  expect(resultText(events)).toContain('exact policy reason');
  expect(JSON.stringify(model.doStreamCalls[1]?.prompt)).toContain('exact policy reason');
});
test('non-interactive ask denies immediately without touching confirm', async () => {
  const model = await scripted([toolStep, { text: 'Blocked' }]);
  const { session: s, gw } = session(model, gateway('ask'));
  const confirm = vi.fn(async () => true);
  const events = await drain(s.runTurn('x', { ...io, confirm }));
  expect(confirm).not.toHaveBeenCalled();
  expect(gw.execute).not.toHaveBeenCalled();
  expect(resultText(events)).toContain('approval required but session is non-interactive');
  expect(JSON.stringify(model.doStreamCalls[1]?.prompt)).toContain(
    'approval required but session is non-interactive',
  );
});
test('autoApprove approves ask without prompting, but still runs policy', async () => {
  const model = await scripted([toolStep, { text: 'Done' }]);
  const { session: s, gw } = session(model, gateway('ask'));
  const confirm = vi.fn(async () => false);
  await drain(s.runTurn('x', { ...io, autoApprove: true, confirm }));
  expect(confirm).not.toHaveBeenCalled();
  expect(gw.before).toHaveBeenCalledTimes(1);
  expect(gw.calls).toHaveLength(1);
});
test('interactive SDK approval resumes with a signature, effective input, and one preflight', async () => {
  const stream = vi.spyOn(ToolLoopAgent.prototype, 'stream');
  const model = await scripted([toolStep, { text: 'Approved' }]);
  const { session: s, gw } = session(model, gateway('ask', { text: 'REWRITTEN' }));
  const confirm = vi.fn(async () => true);
  const events = await drain(s.runTurn('x', { interactive: true, autoApprove: false, confirm }));
  expect(confirm).toHaveBeenCalledExactlyOnceWith({
    tool: 'echo.echo',
    input: { text: 'REWRITTEN' },
    reasons: ['exact policy reason'],
  });
  expect(gw.before).toHaveBeenCalledTimes(1);
  expect(gw.calls).toEqual([{ text: 'REWRITTEN' }]);
  expect(events.filter((e) => e.type === 'tool-call')).toEqual([
    { type: 'tool-call', tool: 'echo.echo', input: { text: 'REWRITTEN' } },
  ]);
  expect(events.filter((e) => e.type === 'hook')).toHaveLength(1);
  expect(events.at(-1)).toMatchObject({ type: 'done', steps: 2 });
  const resumedPrompt = JSON.stringify(model.doStreamCalls[1]?.prompt);
  expect(JSON.stringify(stream.mock.calls[1]?.[0])).toMatch(/"signature":"[^"]+"/);
  expect(JSON.stringify(stream.mock.calls[1]?.[0])).toContain('tool-approval-response');
  expect(gw.approve).toHaveBeenCalledTimes(1);
  expect(resumedPrompt).toContain('tool-result');
  expect(gw.preflight.mock.calls.length).toBeGreaterThanOrEqual(2);
});
test('interactive refusal is a model-facing tool result, not an unresolved approval', async () => {
  const model = await scripted([toolStep, { text: 'Declined' }]);
  const { session: s, gw } = session(model, gateway('ask'));
  const events = await drain(
    s.runTurn('x', { interactive: true, autoApprove: false, confirm: async () => false }),
  );
  expect(gw.execute).not.toHaveBeenCalled();
  expect(resultText(events)).toContain('approval declined');
  expect(JSON.stringify(model.doStreamCalls[1]?.prompt)).toContain('approval declined');
  expect(events.at(-1)).toMatchObject({ type: 'done', steps: 2 });
});
test('maxSteps bounds runaway loops', async () => {
  const model = await scripted(Array.from({ length: 30 }, () => toolStep));
  const { session: s, gw } = session(model, gateway(), { maxSteps: 3 });
  const events = await drain(s.runTurn('x', io));
  expect(model.doStreamCalls).toHaveLength(3);
  expect(gw.calls).toHaveLength(3);
  expect(events.at(-1)).toMatchObject({ type: 'done', steps: 3 });
});
test('maxSteps is global across repeated manual approvals, including approval at the boundary', async () => {
  const model = await scripted(Array.from({ length: 30 }, () => toolStep));
  const { session: s, gw } = session(model, gateway('ask'), { maxSteps: 3 });
  const confirm = vi.fn(async () => true);
  const events = await drain(s.runTurn('x', { interactive: true, autoApprove: false, confirm }));
  expect(model.doStreamCalls).toHaveLength(3);
  expect(confirm).toHaveBeenCalledTimes(2);
  expect(gw.calls).toHaveLength(2);
  expect(resultText(events)).toContain('maximum steps reached before approval could resume');
  expect(events.at(-1)).toMatchObject({ type: 'done', steps: 3 });
});
test('text is delivered while the provider stream is still open', async () => {
  let finish!: () => void;
  const model = new MockLanguageModelV4({
    doStream: async () => ({
      stream: new ReadableStream({
        start(c) {
          c.enqueue({ type: 'text-start', id: 't' });
          c.enqueue({ type: 'text-delta', id: 't', delta: 'early' });
          finish = () => {
            c.enqueue({ type: 'text-delta', id: 't', delta: ' late' });
            c.enqueue({ type: 'text-end', id: 't' });
            c.enqueue({ type: 'finish', finishReason: { unified: 'stop', raw: 'stop' }, usage });
            c.close();
          };
        },
      }),
    }),
  });
  const iterator = session(model).session.runTurn('x', io)[Symbol.asyncIterator]();
  try {
    expect(await iterator.next()).toEqual({ value: { type: 'text', delta: 'early' }, done: false });
  } finally {
    finish();
  }
  const events: TurnEvent[] = [];
  for (;;) {
    const next = await iterator.next();
    if (next.done) break;
    events.push(next.value);
  }
  expect(events.at(-1)).toMatchObject({ type: 'done', text: 'early late' });
});
test('conversation history includes earlier user, assistant, and tool messages', async () => {
  const model = await scripted([toolStep, { text: 'First answer' }, { text: 'Second answer' }]);
  const { session: s } = session(model);
  await drain(s.runTurn('first prompt', io));
  await drain(s.runTurn('second prompt', io));
  const history = JSON.stringify(model.doStreamCalls[2]?.prompt);
  for (const expected of ['first prompt', 'First answer', 'tool-result', 'second prompt'])
    expect(history).toContain(expected);
});
test('parallel model tool calls execute sequentially', async () => {
  const first = await scripted([{ text: 'Done' }]);
  const model = new MockLanguageModelV4({
    doStream: async (options) => {
      if (model.doStreamCalls.length > 1) return first.doStream(options);
      return {
        stream: new ReadableStream({
          start(c) {
            for (const id of ['one', 'two'])
              c.enqueue({
                type: 'tool-call',
                toolCallId: id,
                toolName: tool.modelName,
                input: '{"text":"hello"}',
              });
            c.enqueue({
              type: 'finish',
              finishReason: { unified: 'tool-calls', raw: 'tool_calls' },
              usage,
            });
            c.close();
          },
        }),
      };
    },
  });
  const gw = gateway();
  let active = 0;
  let maxActive = 0;
  const execute = gw.execute.getMockImplementation()!;
  gw.execute.mockImplementation(async (...args) => {
    active++;
    maxActive = Math.max(maxActive, active);
    await new Promise((resolve) => setTimeout(resolve, 10));
    const result = await execute(...args);
    active--;
    return result;
  });
  await drain(session(model, gw).session.runTurn('x', io));
  expect(gw.calls).toHaveLength(2);
  expect(maxActive).toBe(1);
});
test('scripted model also supports the non-streaming SDK contract', async () => {
  const model = await scripted([{ text: 'Generated' }]);
  expect((await generateText({ model, prompt: 'x' })).text).toBe('Generated');
  expect(model.doGenerateCalls).toHaveLength(1);
});
test('capture rejects lexical and symlink escapes outside HARNESS_HOME', async () => {
  const outside = await mkdtemp(join(tmpdir(), 'harness-outside-'));
  try {
    await expect(
      scripted([{ text: 'x' }], { capture: join(outside, 'capture.json') }),
    ).rejects.toThrow(/HARNESS_HOME/);
    await symlink(outside, join(home, 'linked'));
    await expect(
      scripted([{ text: 'x' }], { captureMessages: join(home, 'linked', 'capture.json') }),
    ).rejects.toThrow(/HARNESS_HOME/);
  } finally {
    await rm(outside, { recursive: true, force: true });
  }
});
test('provider registry preserves colons in local model IDs and uses explicit injected credentials', async () => {
  const fetch = vi.fn(async (_url: unknown, init: RequestInit) => {
    expect(new Headers(init.headers).get('authorization')).toBe('Bearer injected-token');
    expect(JSON.parse(String(init.body)).model).toBe('qwen3:8b');
    return new Response(
      JSON.stringify({
        id: 'id',
        object: 'chat.completion',
        created: 0,
        model: 'qwen3:8b',
        choices: [
          { index: 0, message: { role: 'assistant', content: 'local' }, finish_reason: 'stop' },
        ],
        usage: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 },
      }),
      { headers: { 'Content-Type': 'application/json' } },
    );
  });
  vi.stubGlobal('fetch', fetch);
  const model = createModel(
    {
      provider: 'openai-compatible',
      id: 'qwen3:8b',
      baseURL: 'http://localhost:11434/v1',
      apiKeyEnv: 'LOCAL_KEY',
    },
    { env: { LOCAL_KEY: 'injected-token' }, home },
  );
  expect(typeof model).not.toBe('string');
  expect((await generateText({ model, prompt: 'x', maxRetries: 0 })).text).toBe('local');
  expect(fetch).toHaveBeenCalledTimes(1);
  expect(String(fetch.mock.calls[0]?.[0])).toBe('http://localhost:11434/v1/chat/completions');
});
test('missing explicit provider credentials fail without ambient fallback or secret disclosure', () => {
  vi.stubEnv('OPENAI_API_KEY', 'ambient-token');
  expect(() => createModel({ provider: 'openai', id: 'gpt-test' }, { env: {}, home })).toThrow(
    /OPENAI_API_KEY/,
  );
  expect(() =>
    createModel(
      { provider: 'anthropic', id: 'claude-test', apiKeyEnv: 'CUSTOM_KEY' },
      { env: {}, home },
    ),
  ).toThrow(/CUSTOM_KEY/);
});

test('real gateway caches one before-hook across signed approval resume and runs after-hooks on the exact effective input', async () => {
  const { ToolGateway: Gateway } = await import('../src/agent/gateway.js');
  const { HookEngine } = await import('../src/hooks/engine.js');
  const hooks: import('../src/runtime/runtime-manager.js').ResolvedHook[] = [
    'PreToolUse',
    'PostToolUse',
  ].map((event, index) => ({
    plugin: 'policy',
    priority: 10,
    index,
    event: event as 'PreToolUse' | 'PostToolUse',
    match: 'echo.*',
    command: 'unused',
    args: [],
    env: {},
    timeout: 5,
    onError: 'deny',
    owner: { name: 'policy', root: home, data: home, config: {} },
  }));
  const run = vi.fn(async (_hook: unknown, payload: object) => {
    const event = (payload as { hook_event_name: string }).hook_event_name;
    return {
      kind: 'output' as const,
      output: {
        hookSpecificOutput:
          event === 'PreToolUse'
            ? {
                permissionDecision: 'ask',
                permissionDecisionReason: 'review changed text',
                updatedInput: { text: 'EFFECTIVE' },
              }
            : { additionalContext: 'after-context' },
      },
    };
  });
  const call = vi.fn(async () => ok);
  const gw = new Gateway({
    runtime: { byQualifiedName: (name) => (name === tool.qualifiedName ? tool : undefined), call },
    hooks: new HookEngine(hooks, { run }),
    approvals: 'off',
  });
  const model = await scripted([toolStep, { text: 'Done' }]);
  const s = new Session({ model, gateway: gw, tools: [tool], maxSteps: 3, cwd: home });
  const confirm = vi.fn(async () => true);
  const events = await drain(s.runTurn('x', { interactive: true, autoApprove: false, confirm }));
  expect(confirm).toHaveBeenCalledExactlyOnceWith({
    tool: 'echo.echo',
    input: { text: 'EFFECTIVE' },
    reasons: ['review changed text'],
  });
  expect(call).toHaveBeenCalledExactlyOnceWith('echo.echo', { text: 'EFFECTIVE' });
  expect(run).toHaveBeenCalledTimes(2);
  expect((run.mock.calls[1]?.[1] as { tool_input: unknown }).tool_input).toEqual({
    text: 'EFFECTIVE',
  });
  expect(events.filter((e) => e.type === 'hook')).toHaveLength(2);
  expect(JSON.stringify(model.doStreamCalls[1]?.prompt)).toContain('after-context');
  expect(events.at(-1)).toMatchObject({ type: 'done', steps: 2 });
});
test('real gateway produces the same exact blocked-by reason for the model and event stream', async () => {
  const { ToolGateway: Gateway } = await import('../src/agent/gateway.js');
  const { HookEngine } = await import('../src/hooks/engine.js');
  const hook: import('../src/runtime/runtime-manager.js').ResolvedHook = {
    plugin: 'policy',
    priority: 10,
    index: 0,
    event: 'PreToolUse',
    match: 'echo.*',
    command: 'unused',
    args: [],
    env: {},
    timeout: 5,
    onError: 'deny',
    owner: { name: 'policy', root: home, data: home, config: {} },
  };
  const call = vi.fn(async () => ok);
  const gw = new Gateway({
    runtime: { byQualifiedName: () => tool, call },
    hooks: new HookEngine([hook], {
      run: async () => ({ kind: 'deny', reason: 'exact reason from stderr' }),
    }),
    approvals: 'off',
  });
  const model = await scripted([toolStep, { text: 'Blocked' }]);
  const s = new Session({ model, gateway: gw, tools: [tool], maxSteps: 3, cwd: home });
  const events = await drain(s.runTurn('x', { ...io, autoApprove: true }));
  expect(call).not.toHaveBeenCalled();
  expect(events.find((e) => e.type === 'tool-result')).toMatchObject({
    result: {
      isError: true,
      content: [{ type: 'text', text: 'blocked by policy: exact reason from stderr' }],
    },
  });
  expect(JSON.stringify(model.doStreamCalls[1]?.prompt)).toContain(
    'blocked by policy: exact reason from stderr',
  );
});
test('OpenRouter is routed through openai-compatible with the configured key environment name', async () => {
  const fetch = vi.fn(async (url: unknown, init: RequestInit) => {
    expect(String(url)).toBe('https://openrouter.ai/api/v1/chat/completions');
    expect(new Headers(init.headers).get('authorization')).toBe('Bearer router-token');
    expect(JSON.parse(String(init.body)).model).toBe('vendor/model:variant');
    return new Response(
      JSON.stringify({
        id: 'id',
        object: 'chat.completion',
        created: 0,
        model: 'vendor/model:variant',
        choices: [
          { index: 0, message: { role: 'assistant', content: 'router' }, finish_reason: 'stop' },
        ],
        usage: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 },
      }),
      { headers: { 'Content-Type': 'application/json' } },
    );
  });
  vi.stubGlobal('fetch', fetch);
  const model = createModel(
    {
      provider: 'openai-compatible',
      id: 'vendor/model:variant',
      baseURL: 'https://openrouter.ai/api/v1',
      apiKeyEnv: 'ROUTER_KEY',
    },
    { env: { ROUTER_KEY: 'router-token', OPENAI_API_KEY: 'unused-token' }, home },
  );
  expect((await generateText({ model, prompt: 'x', maxRetries: 0 })).text).toBe('router');
  expect(fetch).toHaveBeenCalledTimes(1);
});
test('the model adapter rejects a bare model string before any provider request', () => {
  expect(() => session('openai:unsafe')).toThrow(/resolved model/);
});

test('a gateway failure returned without emit still produces a tool-result event and model result', async () => {
  const model = await scripted([toolStep, { text: 'Recovered' }]);
  const gw = gateway();
  gw.execute.mockImplementation(async () => ({
    isError: true,
    content: [{ type: 'text', text: 'runtime is unavailable' }],
  }));
  const events = await drain(session(model, gw).session.runTurn('x', io));
  expect(resultText(events)).toContain('runtime is unavailable');
  expect(JSON.stringify(model.doStreamCalls[1]?.prompt)).toContain('runtime is unavailable');
  expect(events.at(-1)).toMatchObject({ type: 'done', steps: 2 });
});

test('a repeated provider tool-call ID in a later turn reruns validation, policy, and execution for the new input', async () => {
  const { ToolGateway: Gateway } = await import('../src/agent/gateway.js');
  const { HookEngine } = await import('../src/hooks/engine.js');
  const run = vi.fn(async () => ({ kind: 'output' as const, output: {} }));
  const h: import('../src/runtime/runtime-manager.js').ResolvedHook = {
    plugin: 'policy',
    priority: 1,
    index: 0,
    event: 'PreToolUse',
    match: '**',
    command: 'unused',
    args: [],
    env: {},
    timeout: 1,
    onError: 'deny',
    owner: { name: 'policy', root: home, data: home, config: {} },
  };
  const call = vi.fn(async (_name: string, input: unknown) => ({
    ...ok,
    structuredContent: input,
  }));
  const gw = new Gateway({
    runtime: { byQualifiedName: () => tool, call },
    hooks: new HookEngine([h], { run }),
    approvals: 'off',
  });
  const model = await scripted([
    { tool: tool.modelName, input: { text: 'first' } },
    { text: 'first complete' },
    { tool: tool.modelName, input: { text: 'second' } },
    { text: 'second complete' },
  ]);
  let index = 0;
  const original = model.doStream.bind(model);
  model.doStream = async (options) => {
    const result = await original(options);
    index++;
    if (index === 1 || index === 3)
      result.stream = result.stream.pipeThrough(
        new TransformStream({
          transform(part, controller) {
            controller.enqueue(
              part.type === 'tool-call' ? { ...part, toolCallId: 'reused-id' } : part,
            );
          },
        }),
      );
    return result;
  };
  const s = new Session({ model, gateway: gw, tools: [tool], maxSteps: 5, cwd: home });
  await drain(s.runTurn('first request', io));
  await drain(s.runTurn('second request', io));
  expect(call.mock.calls.map((c) => c[1])).toEqual([{ text: 'first' }, { text: 'second' }]);
  expect(run).toHaveBeenCalledTimes(2);
});
