import { expect, test } from 'vitest';
import { resolve } from 'node:path';
import { HookEngine, type SessionCtx } from '../src/hooks/engine.js';
import { buildEnv } from '../src/runtime/env.js';
import type { HostTool, ResolvedHook } from '../src/runtime/types.js';
const ctx: SessionCtx = { id: 's1', cwd: '/tmp', interactive: false };
const tool: HostTool = {
  plugin: 'echo',
  server: 'main',
  name: 'echo',
  qualifiedName: 'echo.echo',
  modelName: 'mcp__echo__echo',
  description: '',
  inputSchema: { type: 'object', required: ['text'], properties: { text: { type: 'string' } } },
};
function hook(mode: string, options: Partial<ResolvedHook> = {}): ResolvedHook {
  const owner = { name: mode, root: resolve('test/fixtures/hooks'), data: '/tmp', config: {} };
  return {
    plugin: mode,
    priority: 100,
    index: 0,
    event: 'PreToolUse',
    match: '**',
    command: process.execPath,
    args: [resolve('test/fixtures/hooks/fixture.mjs'), mode],
    timeout: 1,
    onError: 'deny',
    owner,
    env: buildEnv(owner, {}),
    ...options,
  };
}
test('exit 2 denies with its stderr reason', async () => {
  const o = await new HookEngine([hook('deny')]).toolBefore(ctx, tool, { text: 'hi' });
  expect(o).toMatchObject({ decision: 'deny', reasons: ['nope'] });
});
test('chain ordering and precedence stop on first deny', async () => {
  const o = await new HookEngine([
    hook('allow', { priority: 1 }),
    hook('ask', { priority: 2 }),
    hook('deny', { priority: 3 }),
    hook('rewrite', { priority: 4 }),
  ]).toolBefore(ctx, tool, { text: 'hi' });
  expect(o.decision).toBe('deny');
  expect(o.trace).toHaveLength(3);
  expect(o.input).toEqual({ text: 'hi' });
});
test('rewrites are chained and revalidated', async () => {
  expect(
    (await new HookEngine([hook('rewrite')]).toolBefore(ctx, tool, { text: 'hi' })).input,
  ).toEqual({ text: 'HI' });
  expect(
    (await new HookEngine([hook('invalid-rewrite')]).toolBefore(ctx, tool, { text: 'hi' }))
      .decision,
  ).toBe('deny');
});
test('timeout kills the hook and fails closed within the budget', async () => {
  const start = Date.now();
  const o = await new HookEngine([hook('hang', { timeout: 0.2 })]).toolBefore(ctx, tool, {
    text: 'hi',
  });
  expect(o.decision).toBe('deny');
  expect(Date.now() - start).toBeLessThan(450);
  expect(o.trace[0]?.error).toMatch(/timed out/i);
});
test('malformed stdout uses onError and records the diagnostic', async () => {
  const o = await new HookEngine([hook('garbage')]).toolBefore(ctx, tool, {});
  expect(o.decision).toBe('deny');
  expect(o.trace[0]?.error).toContain('not json');
  expect(
    (await new HookEngine([hook('garbage', { onError: 'allow' })]).toolBefore(ctx, tool, {}))
      .decision,
  ).toBe('allow');
});
test.each(['defer', 'weird'])('unsupported permission decision %s denies', async (mode) => {
  expect((await new HookEngine([hook(mode)]).toolBefore(ctx, tool, {})).decision).toBe('deny');
});
test('match filters against qualified names', async () => {
  expect(
    (await new HookEngine([hook('deny', { match: 'other.*' })]).toolBefore(ctx, tool, {})).decision,
  ).toBe('allow');
});
test('post-tool hooks chain valid output and context', async () => {
  const o = await new HookEngine([
    hook('after', { event: 'PostToolUse', onError: 'allow' }),
  ]).toolAfter(ctx, tool, {}, { isError: false, content: [{ type: 'text', text: 'raw' }] });
  expect(o.result.content).toEqual([{ type: 'text', text: '[CLEAN]' }]);
  expect(o.additionalContext).toEqual(['extra context']);
});
test('wire payload includes event, model name, qualified name, and owner environment', async () => {
  let captured: object = {};
  const h = hook('allow');
  const engine = new HookEngine([h], {
    run: async (_h, p) => {
      captured = p;
      return { kind: 'output', output: {} };
    },
  });
  await engine.toolBefore({ ...ctx, toolUseId: 'c1' }, tool, { text: 'hi' });
  expect(captured).toMatchObject({
    session_id: 's1',
    hook_event_name: 'PreToolUse',
    tool_name: 'mcp__echo__echo',
    tool_use_id: 'c1',
    _harness: { protocol: 1, tool: 'echo.echo', plugin: 'echo' },
  });
});
