import { randomBytes, randomUUID } from 'node:crypto';
import {
  ToolLoopAgent,
  dynamicTool,
  isStepCount,
  jsonSchema,
  type LanguageModel,
  type ModelMessage,
  type ToolSet,
} from './ai-sdk.js';
import { denialResult, type ToolGateway, type TurnEvent, type TurnIO } from './gateway.js';
import type { SessionCtx, ToolBeforeOutcome } from '../hooks/engine.js';
import type { HostTool, ToolResult } from '../runtime/runtime-manager.js';

function errorResult(message: string): ToolResult {
  return { isError: true, content: [{ type: 'text', text: message }] };
}
function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export class Session {
  readonly id = randomUUID();
  private readonly approvalSecret = randomBytes(32);
  private readonly history: ModelMessage[] = [];
  private active = false;

  constructor(
    private readonly deps: {
      model: LanguageModel;
      gateway: ToolGateway;
      tools: HostTool[];
      maxSteps: number;
      cwd: string;
    },
  ) {
    if (!Number.isSafeInteger(deps.maxSteps) || deps.maxSteps < 1)
      throw new Error('maxSteps must be a positive integer');
    if (typeof deps.model === 'string')
      throw new Error('Session requires a resolved model, not a bare model ID');
  }

  async *runTurn(prompt: string, io: TurnIO): AsyncIterable<TurnEvent> {
    if (this.active) {
      yield { type: 'error', message: 'A turn is already running in this session' };
      return;
    }
    this.active = true;
    const abort = new AbortController();
    const events: TurnEvent[] = [];
    let wake: (() => void) | undefined;
    let finished = false;
    const emit = (event: TurnEvent) => {
      events.push(event);
      wake?.();
      wake = undefined;
    };
    // A queue is necessary: gateway events and text must reach the caller even
    // while the provider is holding its stream open or consent is pending.
    const work = this.run(prompt, io, emit, abort.signal)
      .catch((error) => {
        if (!abort.signal.aborted) emit({ type: 'error', message: errorMessage(error) });
      })
      .finally(() => {
        finished = true;
        this.active = false;
        wake?.();
        wake = undefined;
      });
    try {
      while (!finished || events.length > 0) {
        const event = events.shift();
        if (event) yield event;
        else
          await new Promise<void>((resolve) => {
            wake = resolve;
          });
      }
      await work;
    } finally {
      abort.abort();
    }
  }

  private async run(
    prompt: string,
    io: TurnIO,
    emit: (event: TurnEvent) => void,
    signal: AbortSignal,
  ): Promise<void> {
    const { gateway } = this.deps;
    gateway.clearCache?.();
    const ctx: SessionCtx = { id: this.id, cwd: this.deps.cwd, interactive: io.interactive };
    this.history.push({ role: 'user', content: prompt });
    const byModelName = new Map(this.deps.tools.map((tool) => [tool.modelName, tool]));
    const outcomes = new Map<string, ToolBeforeOutcome>();
    const callsEmitted = new Set<string>();
    const resultsEmitted = new Set<string>();
    const approvalReasons = new Map<string, string>();
    const preflight = async (id: string, tool: HostTool, input: unknown) => {
      const outcome = await gateway.preflight(ctx, id, tool.qualifiedName, input);
      if (!outcomes.has(id)) {
        outcomes.set(id, outcome);
        for (const trace of outcome.trace) emit({ type: 'hook', trace });
        callsEmitted.add(id);
        emit({ type: 'tool-call', tool: tool.qualifiedName, input: outcome.input });
      }
      return outcome;
    };
    const emitResult = (id: string, tool: string, result: ToolResult) => {
      if (!resultsEmitted.has(id)) {
        resultsEmitted.add(id);
        emit({ type: 'tool-result', tool, result });
      }
    };
    const tools: ToolSet = Object.fromEntries(
      this.deps.tools.map((tool) => [
        tool.modelName,
        dynamicTool({
          description: tool.description,
          inputSchema: jsonSchema(tool.inputSchema, {
            validate: (input) => {
              const result = gateway.validate(tool.qualifiedName, input);
              return result.success
                ? { success: true, value: result.value }
                : { success: false, error: new Error(result.errors.join('\n')) };
            },
          }),
          execute: async (_input, { toolCallId }) =>
            gateway.execute(ctx, toolCallId, tool.qualifiedName, (event) => {
              if (event.type === 'tool-call') {
                if (callsEmitted.has(toolCallId)) return;
                callsEmitted.add(toolCallId);
              }
              if (event.type === 'tool-result') {
                emitResult(toolCallId, event.tool, event.result);
                return;
              }
              emit(event);
            }),
        }),
      ]),
    );
    let steps = 0;
    let text = '';
    while (steps < this.deps.maxSteps) {
      signal.throwIfAborted();
      const requests: { approvalId: string; toolCallId: string; toolName: string }[] = [];
      const agent = new ToolLoopAgent({
        model: this.deps.model,
        instructions:
          'Use available tools when needed. Tool policies can rewrite proposed inputs or deny execution. Treat tool results as authoritative for what actually happened; do not assume the original arguments were executed. Report failures and denials accurately, and never claim a side effect without a successful tool result.',
        tools,
        stopWhen: isStepCount(this.deps.maxSteps - steps),
        toolCallConcurrency: 1,
        experimental_toolApprovalSecret: this.approvalSecret,
        toolApproval: async ({ toolCall }) => {
          const tool = byModelName.get(toolCall.toolName);
          if (!tool) return { type: 'denied', reason: 'Unknown tool' };
          const outcome = await preflight(toolCall.toolCallId, tool, toolCall.input);
          const reason = outcome.reasons.join('\n');
          if (outcome.decision === 'deny') {
            const blocked = denialResult(outcome);
            const exact =
              blocked.content
                .map((content) => {
                  if (content !== null && typeof content === 'object' && 'text' in content)
                    return String(content.text);
                  return '';
                })
                .filter(Boolean)
                .join('\n') ||
              reason ||
              'Tool execution denied';
            approvalReasons.set(toolCall.toolCallId, exact);
            return { type: 'denied', reason: exact };
          }
          if (outcome.decision === 'ask') {
            if (io.autoApprove) {
              gateway.approve(toolCall.toolCallId);
              return { type: 'approved', reason };
            }
            if (!io.interactive) {
              const denied = [reason, 'approval required but session is non-interactive']
                .filter(Boolean)
                .join('\n');
              approvalReasons.set(toolCall.toolCallId, denied);
              return { type: 'denied', reason: denied };
            }
            return { type: 'user-approval', reason };
          }
          return 'not-applicable';
        },
      });
      const result = await agent.stream({ messages: [...this.history], abortSignal: signal });
      for await (const part of result.fullStream) {
        signal.throwIfAborted();
        if (part.type === 'text-delta') {
          text += part.text;
          emit({ type: 'text', delta: part.text });
        } else if (part.type === 'finish-step') {
          steps++;
        } else if (part.type === 'tool-call' && part.invalid) {
          const tool = byModelName.get(part.toolName)?.qualifiedName ?? part.toolName;
          if (!callsEmitted.has(part.toolCallId)) {
            callsEmitted.add(part.toolCallId);
            emit({ type: 'tool-call', tool, input: part.input });
          }
        } else if (part.type === 'tool-result' && !part.preliminary) {
          emitResult(
            part.toolCallId,
            byModelName.get(part.toolName)?.qualifiedName ?? part.toolName,
            part.output as ToolResult,
          );
        } else if (part.type === 'tool-error') {
          emitResult(
            part.toolCallId,
            byModelName.get(part.toolName)?.qualifiedName ?? part.toolName,
            errorResult(errorMessage(part.error)),
          );
        } else if (part.type === 'tool-approval-request' && !part.isAutomatic) {
          requests.push({
            approvalId: part.approvalId,
            toolCallId: part.toolCall.toolCallId,
            toolName: part.toolCall.toolName,
          });
        } else if (part.type === 'tool-approval-response') {
          const id = part.toolCall.toolCallId;
          const tool =
            byModelName.get(part.toolCall.toolName)?.qualifiedName ?? part.toolCall.toolName;
          emit({
            type: 'approval',
            tool,
            approved: part.approved,
            reasons: part.reason ? [part.reason] : [],
          });
          if (!part.approved) {
            approvalReasons.set(id, part.reason ?? 'Tool execution denied');
            emitResult(id, tool, errorResult(part.reason ?? 'Tool execution denied'));
          }
        } else if (part.type === 'tool-output-denied') {
          emitResult(
            part.toolCallId,
            byModelName.get(part.toolName)?.qualifiedName ?? part.toolName,
            errorResult(approvalReasons.get(part.toolCallId) ?? 'Tool execution denied'),
          );
        } else if (part.type === 'error') {
          throw part.error;
        }
      }
      this.history.push(...(await result.responseMessages));
      if (requests.length === 0) break;
      const responses: Extract<ModelMessage, { role: 'tool' }>['content'] = [];
      for (const request of requests) {
        const tool = byModelName.get(request.toolName)!;
        const outcome = outcomes.get(request.toolCallId)!;
        const exhausted = steps >= this.deps.maxSteps;
        signal.throwIfAborted();
        const approved =
          !exhausted &&
          (await io.confirm({
            tool: tool.qualifiedName,
            input: structuredClone(outcome.input),
            reasons: [...outcome.reasons],
          }));
        if (approved) gateway.approve(request.toolCallId);
        const reason = approved
          ? outcome.reasons.join('\n')
          : [
              ...outcome.reasons,
              exhausted
                ? 'maximum steps reached before approval could resume'
                : 'approval declined',
            ]
              .filter(Boolean)
              .join('\n');
        approvalReasons.set(request.toolCallId, reason);
        emit({
          type: 'approval',
          tool: tool.qualifiedName,
          approved,
          reasons: reason ? [reason] : [],
        });
        if (!approved) emitResult(request.toolCallId, tool.qualifiedName, errorResult(reason));
        responses.push({
          type: 'tool-approval-response',
          approvalId: request.approvalId,
          approved,
          reason,
        });
        // At the boundary there is no remaining model step for SDK resume.
        // Close the pending call with a denial instead of allowing an extra call
        // or leaving an approval that might execute on the next user turn.
        if (exhausted)
          responses.push({
            type: 'tool-result',
            toolCallId: request.toolCallId,
            toolName: request.toolName,
            output: { type: 'execution-denied', reason },
          });
      }
      this.history.push({ role: 'tool', content: responses });
    }
    emit({ type: 'done', text, steps });
  }
}
