import picomatch from 'picomatch';
import { randomUUID } from 'node:crypto';
import { validateValue } from '../config/validation.js';
import type { HostTool, ResolvedHook, ToolResult } from '../runtime/types.js';
import { runCommandHook, type HookRunResult } from './runner.js';
export type SessionCtx = { id: string; cwd: string; interactive: boolean; toolUseId?: string };
export type HookTrace = {
  plugin: string;
  event: string;
  decision?: string;
  reason?: string;
  error?: string;
  ms: number;
};
export type ToolBeforeOutcome = {
  decision: 'allow' | 'deny' | 'ask';
  reasons: string[];
  input: unknown;
  trace: HookTrace[];
};
export type ToolAfterOutcome = {
  result: ToolResult;
  additionalContext: string[];
  trace: HookTrace[];
};
function object(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}
function decode(
  result: HookRunResult,
  event: string,
): { specific: Record<string, unknown>; error?: string } {
  if (result.kind !== 'output') return { specific: {} };
  const output = result.output;
  const s = output.hookSpecificOutput;
  if (s === undefined) return { specific: {} };
  if (!object(s)) return { specific: {}, error: 'hookSpecificOutput must be an object' };
  if (s.hookEventName !== undefined && s.hookEventName !== event)
    return { specific: {}, error: `hookEventName must be ${event}` };
  if (s.permissionDecision !== undefined && typeof s.permissionDecision !== 'string')
    return { specific: {}, error: 'permissionDecision must be a string' };
  if (s.permissionDecisionReason !== undefined && typeof s.permissionDecisionReason !== 'string')
    return { specific: {}, error: 'permissionDecisionReason must be a string' };
  if ('updatedInput' in s && !object(s.updatedInput))
    return { specific: {}, error: 'updatedInput must be an object' };
  if (
    'updatedToolOutput' in s &&
    (!object(s.updatedToolOutput) ||
      !Array.isArray(s.updatedToolOutput.content) ||
      typeof s.updatedToolOutput.isError !== 'boolean')
  )
    return {
      specific: {},
      error: 'updatedToolOutput must be a ToolResult with content array and isError boolean',
    };
  if (s.additionalContext !== undefined && typeof s.additionalContext !== 'string')
    return { specific: {}, error: 'additionalContext must be a string' };
  return { specific: s };
}
export class HookEngine {
  private readonly ordered: ResolvedHook[];
  private readonly run: typeof runCommandHook;
  constructor(hooks: ResolvedHook[], opts: { run?: typeof runCommandHook } = {}) {
    this.ordered = [...hooks].sort(
      (a, b) => a.priority - b.priority || a.plugin.localeCompare(b.plugin) || a.index - b.index,
    );
    this.run = opts.run ?? runCommandHook;
  }
  private matching(event: string, tool: HostTool) {
    return this.ordered.filter(
      (h) =>
        h.event === event &&
        picomatch(h.match, { dot: true, nonegate: true, noextglob: true })(tool.qualifiedName),
    );
  }
  private payload(
    ctx: SessionCtx,
    event: string,
    tool: HostTool,
    input: unknown,
    result?: ToolResult,
  ) {
    return {
      session_id: ctx.id,
      cwd: ctx.cwd,
      hook_event_name: event,
      tool_name: tool.modelName,
      tool_input: input,
      tool_use_id: ctx.toolUseId ?? randomUUID(),
      ...(result ? { tool_response: result } : {}),
      _harness: {
        protocol: 1,
        tool: tool.qualifiedName,
        plugin: tool.plugin,
        annotations: tool.annotations ?? {},
        interactive: ctx.interactive,
      },
    };
  }
  async toolBefore(ctx: SessionCtx, tool: HostTool, input: unknown): Promise<ToolBeforeOutcome> {
    const outcome: ToolBeforeOutcome = { decision: 'allow', reasons: [], input, trace: [] };
    for (const h of this.matching('PreToolUse', tool)) {
      const start = Date.now();
      const result = await this.run(h, this.payload(ctx, h.event, tool, outcome.input));
      const decoded = decode(result, h.event);
      const trace: HookTrace = { plugin: h.plugin, event: h.event, ms: Date.now() - start };
      let decision: 'allow' | 'deny' | 'ask' = 'allow';
      let reason = '';
      const error = result.kind === 'error' ? result.error : decoded.error;
      if (error) {
        trace.error = error;
        decision = h.onError;
        reason = `hook error: ${error}`;
      } else if (result.kind === 'deny') {
        decision = 'deny';
        reason = result.reason;
      } else {
        const d = decoded.specific.permissionDecision;
        decision = d === undefined || d === 'allow' ? 'allow' : d === 'ask' ? 'ask' : 'deny';
        reason =
          typeof decoded.specific.permissionDecisionReason === 'string'
            ? decoded.specific.permissionDecisionReason
            : d !== undefined && !['allow', 'ask', 'deny'].includes(String(d))
              ? `unsupported permission decision ${d}`
              : '';
        if ('updatedInput' in decoded.specific) {
          const checked = validateValue(tool.inputSchema, decoded.specific.updatedInput);
          if (!checked.success) {
            decision = 'deny';
            reason = `invalid rewritten input: ${checked.errors.join('; ')}`;
          } else outcome.input = checked.value;
        }
      }
      trace.decision = decision;
      if (reason) {
        trace.reason = reason;
        outcome.reasons.push(reason);
      }
      outcome.trace.push(trace);
      if (decision === 'deny') {
        outcome.decision = 'deny';
        break;
      }
      if (decision === 'ask') outcome.decision = 'ask';
    }
    return outcome;
  }
  async toolAfter(
    ctx: SessionCtx,
    tool: HostTool,
    input: unknown,
    result: ToolResult,
  ): Promise<ToolAfterOutcome> {
    const o: ToolAfterOutcome = { result, additionalContext: [], trace: [] };
    for (const h of this.matching('PostToolUse', tool)) {
      const start = Date.now();
      const r = await this.run(h, this.payload(ctx, h.event, tool, input, o.result));
      const d = decode(r, h.event);
      const error = r.kind === 'error' ? r.error : d.error;
      const trace: HookTrace = { plugin: h.plugin, event: h.event, ms: Date.now() - start };
      if (error) {
        trace.error = error;
        if (h.onError === 'deny') {
          o.result = {
            isError: true,
            content: [{ type: 'text', text: `blocked by ${h.plugin}: hook error: ${error}` }],
          };
          o.trace.push(trace);
          break;
        }
      } else if (r.kind === 'output') {
        if (d.specific.updatedToolOutput) o.result = d.specific.updatedToolOutput as ToolResult;
        if (typeof d.specific.additionalContext === 'string')
          o.additionalContext.push(d.specific.additionalContext.slice(0, 10000));
      }
      o.trace.push(trace);
    }
    return o;
  }
}
