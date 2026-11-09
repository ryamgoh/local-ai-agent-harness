import { randomUUID } from 'node:crypto';
import { validateValue } from '../config/validation.js';
import type { HookEngine, HookTrace, SessionCtx, ToolBeforeOutcome } from '../hooks/engine.js';
import { errorResult, type HostTool, type ToolResult } from '../runtime/types.js';
export type ApprovalRequest = { tool: string; input: unknown; reasons: string[] };
export type TurnIO = {
  interactive: boolean;
  autoApprove: boolean;
  confirm(req: ApprovalRequest): Promise<boolean>;
};
export type TurnEvent =
  | { type: 'text'; delta: string }
  | { type: 'tool-call'; tool: string; input: unknown }
  | { type: 'hook'; trace: HookTrace }
  | { type: 'approval'; tool: string; approved: boolean; reasons: string[] }
  | { type: 'tool-result'; tool: string; result: ToolResult }
  | { type: 'done'; text: string; steps: number }
  | { type: 'error'; message: string };
type Runtime = {
  byQualifiedName(name: string): HostTool | undefined;
  call(name: string, input: unknown): Promise<ToolResult>;
};
export function denialResult(o: ToolBeforeOutcome): ToolResult {
  const blocker = o.trace.find((t) => t.decision === 'deny');
  return errorResult(
    blocker
      ? `blocked by ${blocker.plugin}: ${blocker.reason ?? o.reasons.join('; ')}`
      : o.reasons.join('; ') || 'Tool call denied',
  );
}
export class ToolGateway {
  private readonly pending = new Map<string, Promise<ToolBeforeOutcome>>();
  private readonly checked = new Map<
    string,
    { tool: HostTool | undefined; outcome: ToolBeforeOutcome }
  >();
  private readonly approved = new Set<string>();
  private readonly completed = new Map<string, Promise<ToolResult>>();
  constructor(
    private readonly deps: {
      runtime: Runtime;
      hooks: HookEngine;
      approvals: 'destructive' | 'always' | 'off';
    },
  ) {}
  validate(
    qualifiedName: string,
    input: unknown,
  ): { success: boolean; value: unknown; errors: string[] } {
    const t = this.deps.runtime.byQualifiedName(qualifiedName);
    return t
      ? validateValue(t.inputSchema, input)
      : { success: false, value: input, errors: [`Unknown or unavailable tool ${qualifiedName}`] };
  }
  async preflight(
    ctx: SessionCtx,
    toolCallId: string,
    qualifiedName: string,
    input: unknown,
  ): Promise<ToolBeforeOutcome> {
    const cached = this.pending.get(toolCallId);
    if (cached) return cached;
    const work = (async () => {
      const t = this.deps.runtime.byQualifiedName(qualifiedName);
      const checked = this.validate(qualifiedName, input);
      let outcome: ToolBeforeOutcome;
      if (!checked.success || !t)
        outcome = { decision: 'deny', reasons: checked.errors, input, trace: [] };
      else {
        outcome = await this.deps.hooks.toolBefore(
          { ...ctx, toolUseId: toolCallId },
          t,
          structuredClone(checked.value),
        );
        const validated = this.validate(qualifiedName, outcome.input);
        if (!validated.success) {
          outcome.decision = 'deny';
          outcome.reasons.push(...validated.errors);
        } else outcome.input = validated.value;
        if (
          outcome.decision !== 'deny' &&
          (this.deps.approvals === 'always' ||
            (this.deps.approvals === 'destructive' && t.annotations?.destructiveHint === true))
        ) {
          outcome.decision = 'ask';
          outcome.reasons.push('host approval policy requires confirmation');
        }
      }
      this.checked.set(toolCallId, { tool: t, outcome });
      return outcome;
    })();
    this.pending.set(toolCallId, work);
    return work;
  }
  getPreflight(id: string): ToolBeforeOutcome | undefined {
    return this.checked.get(id)?.outcome;
  }
  approve(id: string, approved = true): void {
    if (approved) this.approved.add(id);
    else this.approved.delete(id);
  }
  clearCache(): void {
    this.pending.clear();
    this.checked.clear();
    this.approved.clear();
    this.completed.clear();
  }
  async execute(
    ctx: SessionCtx,
    id: string,
    qualifiedName: string,
    emit: (e: TurnEvent) => void,
  ): Promise<ToolResult> {
    const cached = this.completed.get(id);
    if (cached) return cached;
    const work = (async () => {
      const checked = this.checked.get(id);
      if (!checked || checked.tool?.qualifiedName !== qualifiedName)
        return errorResult('Tool execution requires matching preflight');
      const { tool, outcome } = checked;
      if (outcome.decision === 'deny') return denialResult(outcome);
      if (outcome.decision === 'ask' && !this.approved.has(id))
        return errorResult('Tool execution requires approval');
      emit({ type: 'tool-call', tool: qualifiedName, input: outcome.input });
      let result = await this.deps.runtime.call(qualifiedName, outcome.input);
      const after = await this.deps.hooks.toolAfter(
        { ...ctx, toolUseId: id },
        tool,
        outcome.input,
        result,
      );
      after.trace.forEach((trace) => emit({ type: 'hook', trace }));
      result = after.result;
      if (after.additionalContext.length)
        result = {
          ...result,
          content: [
            ...result.content,
            ...after.additionalContext.map((text) => ({ type: 'text', text })),
          ],
        };
      emit({ type: 'tool-result', tool: qualifiedName, result });
      return result;
    })();
    this.completed.set(id, work);
    return work;
  }
  async invoke(
    ctx: SessionCtx,
    qualifiedName: string,
    input: unknown,
    io: TurnIO,
    emit: (e: TurnEvent) => void,
  ): Promise<ToolResult> {
    const id = randomUUID();
    const o = await this.preflight(ctx, id, qualifiedName, input);
    o.trace.forEach((trace) => emit({ type: 'hook', trace }));
    if (o.decision === 'deny') {
      const result = denialResult(o);
      emit({ type: 'tool-result', tool: qualifiedName, result });
      return result;
    }
    if (o.decision === 'ask') {
      const approved =
        io.autoApprove ||
        (io.interactive &&
          (await io.confirm({ tool: qualifiedName, input: o.input, reasons: o.reasons })));
      emit({ type: 'approval', tool: qualifiedName, approved, reasons: o.reasons });
      if (!approved) {
        const result = errorResult(
          !io.interactive
            ? 'approval required but session is non-interactive'
            : 'approval denied by user',
        );
        emit({ type: 'tool-result', tool: qualifiedName, result });
        return result;
      }
      this.approve(id);
    }
    return this.execute(ctx, id, qualifiedName, emit);
  }
}
