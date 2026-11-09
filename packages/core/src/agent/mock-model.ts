import {
  constants,
  closeSync,
  lstatSync,
  mkdirSync,
  openSync,
  readFileSync,
  realpathSync,
  writeFileSync,
} from 'node:fs';
import { homedir } from 'node:os';
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { randomUUID } from 'node:crypto';
import { MockLanguageModelV4 } from 'ai/test';

export type ScriptStep = { tool: string; input: unknown } | { text: string };
export type ModelScript = { steps: ScriptStep[]; capture?: string; captureMessages?: string };

type CallOptions = Parameters<MockLanguageModelV4['doGenerate']>[0];
type GenerateResult = Awaited<ReturnType<MockLanguageModelV4['doGenerate']>>;
type StreamPart =
  Awaited<ReturnType<MockLanguageModelV4['doStream']>>['stream'] extends ReadableStream<infer Part>
    ? Part
    : never;

function isWithin(home: string, target: string): boolean {
  const path = relative(home, target);
  return path !== '' && path !== '..' && !path.startsWith(`..${sep}`) && !isAbsolute(path);
}

function captureTarget(home: string, path: string): string {
  const root = resolve(home);
  const target = resolve(root, path);
  if (!isWithin(root, target)) throw new Error('Mock capture must be within HARNESS_HOME');
  mkdirSync(root, { recursive: true, mode: 0o700 });
  const realRoot = realpathSync(root);
  let parent = realRoot;
  // Check each ancestor before creating its child, including existing symlinks.
  for (const part of relative(root, dirname(target)).split(sep).filter(Boolean)) {
    const child = join(parent, part);
    try {
      mkdirSync(child, { mode: 0o700 });
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error;
    }
    parent = realpathSync(child);
    if (parent !== realRoot && !isWithin(realRoot, parent))
      throw new Error('Mock capture must be within HARNESS_HOME');
  }
  const file = join(parent, relative(dirname(target), target));
  try {
    if (lstatSync(file).isSymbolicLink())
      throw new Error('Mock capture must be within HARNESS_HOME (no file symlinks)');
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
  }
  return file;
}

function writeCapture(home: string, path: string, values: unknown[]): void {
  const file = captureTarget(home, path);
  const fd = openSync(
    file,
    constants.O_WRONLY | constants.O_CREAT | constants.O_TRUNC | constants.O_NOFOLLOW,
    0o600,
  );
  try {
    writeFileSync(fd, `${JSON.stringify(values, null, 2)}\n`);
  } finally {
    closeSync(fd);
  }
}

function loadScript(path: string): ModelScript {
  const raw: unknown = JSON.parse(readFileSync(path, 'utf8'));
  if (raw === null || typeof raw !== 'object' || !('steps' in raw) || !Array.isArray(raw.steps))
    throw new Error('Invalid mock script: steps must be an array');
  for (const step of raw.steps as unknown[]) {
    if (
      step === null ||
      typeof step !== 'object' ||
      !(
        ('text' in step && typeof step.text === 'string' && !('tool' in step)) ||
        ('tool' in step && typeof step.tool === 'string' && 'input' in step && !('text' in step))
      )
    )
      throw new Error('Invalid mock script: each step must contain text or tool and input');
  }
  for (const key of ['capture', 'captureMessages'] as const) {
    if (key in raw && typeof (raw as Record<string, unknown>)[key] !== 'string')
      throw new Error(`Invalid mock script: ${key} must be a string`);
  }
  return raw as ModelScript;
}

export function createScriptedModel(
  path: string,
  opts: { home?: string; env?: NodeJS.ProcessEnv } = {},
): MockLanguageModelV4 {
  const script = loadScript(path);
  const home = opts.home ?? (opts.env ?? process.env).HARNESS_HOME ?? join(homedir(), '.harness');
  const offered: string[][] = [];
  const conversations: unknown[] = [];
  let cursor = 0;
  for (const capture of [script.capture, script.captureMessages]) {
    if (capture !== undefined) captureTarget(home, capture);
  }
  function next(options: CallOptions): GenerateResult {
    offered.push((options.tools ?? []).map((tool) => tool.name));
    conversations.push(structuredClone(options.prompt));
    if (script.capture !== undefined) writeCapture(home, script.capture, offered);
    if (script.captureMessages !== undefined)
      writeCapture(home, script.captureMessages, conversations);
    const step = script.steps[cursor++] ?? { text: 'Done.' };
    const content: GenerateResult['content'] =
      'text' in step
        ? [{ type: 'text', text: step.text }]
        : [
            {
              type: 'tool-call',
              toolCallId: randomUUID(),
              toolName: step.tool,
              input: JSON.stringify(step.input),
            },
          ];
    return {
      content,
      finishReason: {
        unified: 'text' in step ? 'stop' : 'tool-calls',
        raw: 'text' in step ? 'stop' : 'tool_calls',
      },
      usage: {
        inputTokens: { total: 0, noCache: 0, cacheRead: 0, cacheWrite: 0 },
        outputTokens: { total: 0, text: 0, reasoning: 0 },
      },
      warnings: [],
    };
  }
  return new MockLanguageModelV4({
    provider: 'mock',
    modelId: path,
    doGenerate: async (options) => next(options),
    doStream: async (options) => {
      const generated = next(options);
      const parts: StreamPart[] = [{ type: 'stream-start', warnings: [] }];
      for (const part of generated.content) {
        if (part.type === 'text') {
          const id = randomUUID();
          parts.push({ type: 'text-start', id });
          // Separate chunks exercise the real SDK streaming path, not a generated-text facade.
          for (const delta of part.text.match(/.{1,16}/gs) ?? [])
            parts.push({ type: 'text-delta', id, delta });
          parts.push({ type: 'text-end', id });
        } else if (part.type === 'tool-call') {
          parts.push({ type: 'tool-input-start', id: part.toolCallId, toolName: part.toolName });
          parts.push({ type: 'tool-input-delta', id: part.toolCallId, delta: part.input });
          parts.push({ type: 'tool-input-end', id: part.toolCallId });
          parts.push(part);
        }
      }
      parts.push({ type: 'finish', finishReason: generated.finishReason, usage: generated.usage });
      let index = 0;
      return {
        stream: new ReadableStream<StreamPart>({
          pull(controller) {
            const part = parts[index++];
            if (part) controller.enqueue(part);
            else controller.close();
          },
        }),
      };
    },
  });
}
