import { Client } from '@modelcontextprotocol/client';
import { StdioClientTransport } from '@modelcontextprotocol/client/stdio';
import { StringDecoder } from 'node:string_decoder';
import type { SpawnSpec, ToolResult } from './types.js';
import { openLog, maskDiagnostic } from './log.js';
export type McpTool = {
  name: string;
  description?: string;
  inputSchema: object;
  annotations?: Record<string, unknown>;
};
export type McpConnection = {
  listTools(): Promise<McpTool[]>;
  callTool(name: string, input: Record<string, unknown>, signal?: AbortSignal): Promise<ToolResult>;
  onExit(cb: () => void): void;
  close(): Promise<void>;
};
export async function connect(
  spec: SpawnSpec,
  logFile: string,
  secrets: string[] = [],
): Promise<McpConnection> {
  const log = openLog(logFile);
  const transport = new StdioClientTransport({
    command: spec.command,
    args: spec.args,
    env: spec.env,
    cwd: spec.cwd,
    stderr: 'pipe',
  });
  const client = new Client(
    { name: 'harness', version: '0.1.0' },
    {
      versionNegotiation: {
        mode: 'auto',
        probe: { timeoutMs: Math.min(250, Math.max(10, spec.startupTimeoutMs / 4)) },
      },
      inputRequired: { autoFulfill: false },
    },
  );
  const decoder = new StringDecoder('utf8');
  let buffer = '';
  let stopped = false;
  let exited = false;
  const exits: (() => void)[] = [];
  const flush = () => {
    if (buffer) {
      log.write(maskDiagnostic(buffer, secrets));
      buffer = '';
    }
  };
  transport.stderr?.on('data', (chunk: Buffer) => {
    buffer += decoder.write(chunk);
    const end = buffer.lastIndexOf('\n');
    if (end >= 0) {
      log.write(maskDiagnostic(buffer.slice(0, end + 1), secrets));
      buffer = buffer.slice(end + 1);
    }
  });
  client.onerror = (error) => log.write(maskDiagnostic(`MCP error: ${error.message}\n`, secrets));
  client.onclose = () => {
    exited = true;
    flush();
    if (!stopped) exits.forEach((cb) => cb());
  };
  const deadline = Date.now() + spec.startupTimeoutMs;
  const signal = AbortSignal.timeout(spec.startupTimeoutMs);
  try {
    await client.connect(transport, { timeout: spec.startupTimeoutMs, signal });
    const listed = await client.listTools(
      {},
      { timeout: Math.max(1, deadline - Date.now()), signal },
    );
    return {
      listTools: async () => listed.tools,
      callTool: async (name, input, signal) => {
        const result = await client.callTool(
          { name, arguments: input },
          { signal, timeout: 30000, maxTotalTimeout: 30000 },
        );
        return {
          isError: result.isError ?? false,
          content: result.content,
          ...(result.structuredContent !== undefined
            ? { structuredContent: result.structuredContent }
            : {}),
        };
      },
      onExit: (cb) => {
        exits.push(cb);
        if (exited && !stopped) cb();
      },
      close: async () => {
        stopped = true;
        await client.close();
        flush();
        await new Promise<void>((done) => log.end(done));
      },
    };
  } catch (error) {
    stopped = true;
    await client.close().catch(() => undefined);
    flush();
    await new Promise<void>((done) => log.end(done));
    throw error;
  }
}
