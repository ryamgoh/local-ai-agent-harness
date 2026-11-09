import { expect, test, vi } from 'vitest';
import { ToolGateway, type TurnIO } from '../src/agent/gateway.js';
import { HookEngine, type SessionCtx } from '../src/hooks/engine.js';
import type { HostTool, ResolvedHook, ToolResult } from '../src/runtime/types.js';
const t: HostTool = {
  plugin: 'echo',
  server: 'main',
  name: 'echo',
  qualifiedName: 'echo.echo',
  modelName: 'mcp__echo__echo',
  description: '',
  inputSchema: {
    type: 'object',
    required: ['text'],
    additionalProperties: false,
    properties: { text: { type: 'string' } },
  },
};
const ctx: SessionCtx = { id: 'session', cwd: '/tmp', interactive: false };
const io: TurnIO = { interactive: false, autoApprove: false, confirm: async () => false };
function setup(
  decision: string = 'allow',
  rewritten?: unknown,
  approvals: 'off' | 'always' | 'destructive' = 'off',
) {
  const call = vi.fn(async (_q: string, input: unknown): Promise<ToolResult> => ({
    isError: false,
    content: [{ type: 'text', text: JSON.stringify(input) }],
    structuredContent: input,
  }));
  const run = vi.fn(async () => ({
    kind: 'output' as const,
    output: {
      hookSpecificOutput: {
        hookEventName: 'PreToolUse',
        permissionDecision: decision,
        permissionDecisionReason: 'policy reason',
        ...(rewritten !== undefined ? { updatedInput: rewritten } : {}),
      },
    },
  }));
  const h: ResolvedHook = {
    plugin: 'policy',
    priority: 1,
    index: 0,
    event: 'PreToolUse',
    match: '**',
    command: 'node',
    args: [],
    env: {},
    timeout: 1,
    onError: 'deny',
    owner: { name: 'policy', root: '/tmp', data: '/tmp', config: {} },
  };
  const hooks = new HookEngine([h], { run });
  const runtime = { byQualifiedName: (q: string) => (q === t.qualifiedName ? t : undefined), call };
  return { gateway: new ToolGateway({ runtime, hooks, approvals }), call, run };
}
test('schema-invalid input never reaches hooks or the plugin', async () => {
  const { gateway, call, run } = setup();
  const result = await gateway.invoke(ctx, t.qualifiedName, { text: 42 }, io, () => {});
  expect(result.isError).toBe(true);
  expect(JSON.stringify(result)).toContain('/text must be string');
  expect(call).not.toHaveBeenCalled();
  expect(run).not.toHaveBeenCalled();
});
test('deny cannot be overridden by auto-approval', async () => {
  const { gateway, call } = setup('deny');
  const r = await gateway.invoke(
    ctx,
    t.qualifiedName,
    { text: 'hi' },
    { ...io, autoApprove: true },
    () => {},
  );
  expect(JSON.stringify(r)).toContain('blocked by policy: policy reason');
  expect(call).not.toHaveBeenCalled();
});
test('noninteractive ask denies without reading confirmation', async () => {
  const { gateway, call } = setup('ask');
  const confirm = vi.fn();
  const r = await gateway.invoke(
    ctx,
    t.qualifiedName,
    { text: 'hi' },
    { ...io, confirm },
    () => {},
  );
  expect(JSON.stringify(r)).toContain('approval required but session is non-interactive');
  expect(confirm).not.toHaveBeenCalled();
  expect(call).not.toHaveBeenCalled();
});
test('interactive approval shows and executes only the rewritten effective input', async () => {
  const { gateway, call } = setup('ask', { text: 'CLEAN' });
  const confirm = vi.fn(async () => true);
  await gateway.invoke(
    { ...ctx, interactive: true },
    t.qualifiedName,
    { text: 'raw' },
    { interactive: true, autoApprove: false, confirm },
    () => {},
  );
  expect(confirm).toHaveBeenCalledWith(expect.objectContaining({ input: { text: 'CLEAN' } }));
  expect(call).toHaveBeenCalledWith(t.qualifiedName, { text: 'CLEAN' });
});
test('host policy always asks even when a hook allows', async () => {
  const { gateway, call } = setup('allow', undefined, 'always');
  expect((await gateway.invoke(ctx, t.qualifiedName, { text: 'hi' }, io, () => {})).isError).toBe(
    true,
  );
  expect(call).not.toHaveBeenCalled();
});
test('rewrites invalid for the tool schema deny before execution', async () => {
  const { gateway, call } = setup('allow', { text: 42 });
  expect((await gateway.invoke(ctx, t.qualifiedName, { text: 'hi' }, io, () => {})).isError).toBe(
    true,
  );
  expect(call).not.toHaveBeenCalled();
});
test('preflight and execution are cached per call id', async () => {
  const { gateway, call, run } = setup();
  await Promise.all([
    gateway.preflight(ctx, 'c1', t.qualifiedName, { text: 'hi' }),
    gateway.preflight(ctx, 'c1', t.qualifiedName, { text: 'hi' }),
  ]);
  await gateway.execute(ctx, 'c1', t.qualifiedName, () => {});
  await gateway.execute(ctx, 'c1', t.qualifiedName, () => {});
  expect(run).toHaveBeenCalledTimes(1);
  expect(call).toHaveBeenCalledTimes(1);
});
