import pMap from 'p-map';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
import { ensureDirectory, assertWritePath, type HarnessPaths } from '../paths.js';
import { connect, type McpConnection } from './mcp-client.js';
import { maskDiagnostic } from './log.js';
import {
  errorResult,
  type HostTool,
  type PluginStatus,
  type ResolvedPlugin,
  type ToolResult,
} from './types.js';
export type {
  HostTool,
  PluginStatus,
  ResolvedPlugin,
  ResolvedHook,
  SpawnSpec,
  ToolResult,
} from './types.js';
export function toModelName(plugin: string, tool: string): string {
  const raw = `mcp__${plugin}__${tool}`.replace(/[^a-zA-Z0-9_-]/g, '_');
  return raw.length <= 64
    ? raw
    : raw.slice(0, 55) + '_' + createHash('sha1').update(raw).digest('hex').slice(0, 8);
}
export class RuntimeManager {
  private readonly states = new Map<string, PluginStatus>();
  private readonly connections = new Map<string, McpConnection>();
  private readonly offered = new Map<string, HostTool>();
  private readonly confidential = new Map<string, string[]>();
  constructor(private readonly opts: { paths: HarnessPaths }) {}
  async start(plugins: ResolvedPlugin[]): Promise<PluginStatus[]> {
    await this.stop();
    await ensureDirectory(this.opts.paths.home, this.opts.paths.logsDir);
    return pMap(
      plugins,
      async (p) => {
        const status: PluginStatus = {
          plugin: p.name,
          state: 'starting',
          logFile: join(this.opts.paths.logsDir, `${p.name}.log`),
          tools: 0,
        };
        this.states.set(p.name, status);
        const local: [string, McpConnection][] = [];
        const tools: HostTool[] = [];
        const names = new Set<string>();
        const secrets = p.secrets ?? [];
        this.confidential.set(p.name, secrets);
        try {
          await ensureDirectory(this.opts.paths.home, p.data);
          assertWritePath(this.opts.paths.home, status.logFile);
          for (const [id, spec] of Object.entries(p.servers)) {
            const connection = await connect(spec, status.logFile, secrets);
            local.push([`${p.name}/${id}`, connection]);
            for (const t of await connection.listTools()) {
              if (names.has(t.name)) throw new Error(`duplicate tool "${t.name}"`);
              names.add(t.name);
              const modelName = toModelName(p.name, t.name);
              if (tools.some((x) => x.modelName === modelName) || this.byModelName(modelName))
                throw new Error(`model tool name collision for "${t.name}"`);
              tools.push({
                plugin: p.name,
                server: id,
                name: t.name,
                qualifiedName: `${p.name}.${t.name}`,
                modelName,
                description: t.description ?? '',
                inputSchema: t.inputSchema,
                annotations: t.annotations,
              });
            }
          }
          local.forEach(([key, connection]) => {
            this.connections.set(key, connection);
            connection.onExit(() => {
              status.state = 'crashed';
              status.error = `Plugin ${p.name} crashed. Log: ${status.logFile}`;
              for (const [q, t] of this.offered) if (t.plugin === p.name) this.offered.delete(q);
            });
          });
          for (const t of tools) this.offered.set(t.qualifiedName, t);
          status.state = 'running';
          status.tools = tools.length;
        } catch (error) {
          await Promise.all(local.map(([, c]) => c.close().catch(() => undefined)));
          status.state = 'failed';
          status.error = maskDiagnostic(
            error instanceof Error ? error.message : String(error),
            secrets,
          );
          status.tools = 0;
        }
        return status;
      },
      { concurrency: 4 },
    );
  }
  tools(): HostTool[] {
    return [...this.offered.values()]
      .filter((t) => this.states.get(t.plugin)?.state === 'running')
      .sort((a, b) => a.qualifiedName.localeCompare(b.qualifiedName));
  }
  byModelName(name: string): HostTool | undefined {
    return this.tools().find((t) => t.modelName === name);
  }
  byQualifiedName(name: string): HostTool | undefined {
    return this.offered.get(name);
  }
  async call(qualifiedName: string, input: unknown, signal?: AbortSignal): Promise<ToolResult> {
    const t = this.byQualifiedName(qualifiedName);
    if (!t) return errorResult(`Unknown or unavailable tool ${qualifiedName}`);
    const state = this.states.get(t.plugin);
    const c = this.connections.get(`${t.plugin}/${t.server}`);
    if (!c || state?.state !== 'running')
      return errorResult(`Plugin ${t.plugin} is unavailable. Log: ${state?.logFile}`);
    try {
      return await c.callTool(t.name, input as Record<string, unknown>, signal);
    } catch (error) {
      return errorResult(
        `Plugin ${t.plugin} tool failed: ${maskDiagnostic(error instanceof Error ? error.message : String(error), this.confidential.get(t.plugin) ?? [])}. Log: ${state.logFile}`,
      );
    }
  }
  status(): PluginStatus[] {
    return [...this.states.values()].map((s) => ({ ...s }));
  }
  async stop(): Promise<void> {
    await Promise.all([...this.connections.values()].map((c) => c.close().catch(() => undefined)));
    this.connections.clear();
    this.offered.clear();
    this.states.clear();
    this.confidential.clear();
  }
}
