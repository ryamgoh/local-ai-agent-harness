import type { HookEventName, Permissions } from '../manifest/schema.js';
export type SpawnSpec = {
  command: string;
  args: string[];
  env: Record<string, string>;
  cwd: string;
  startupTimeoutMs: number;
};
export type ResolvedPlugin = {
  name: string;
  priority: number;
  root: string;
  data: string;
  config: Record<string, unknown>;
  servers: Record<string, SpawnSpec>;
  hooks: ResolvedHook[];
  permissions: Permissions;
  secrets?: string[];
};
export type ResolvedHook = {
  plugin: string;
  priority: number;
  index: number;
  event: HookEventName;
  match: string;
  command: string;
  args: string[];
  env: Record<string, string>;
  timeout: number;
  onError: 'allow' | 'deny';
  owner: { name: string; root: string; data: string; config: Record<string, unknown> };
  logFile?: string;
  secrets?: string[];
  harnessHome?: string;
};
export type HostTool = {
  plugin: string;
  server: string;
  name: string;
  qualifiedName: string;
  modelName: string;
  description: string;
  inputSchema: object;
  annotations?: Record<string, unknown>;
};
export type ToolResult = { isError: boolean; content: unknown[]; structuredContent?: unknown };
export type PluginStatus = {
  plugin: string;
  state: 'stopped' | 'starting' | 'running' | 'failed' | 'crashed';
  error?: string;
  logFile: string;
  tools: number;
};
export function errorResult(message: string): ToolResult {
  return { isError: true, content: [{ type: 'text', text: message }] };
}
