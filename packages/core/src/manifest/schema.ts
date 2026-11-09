import { z } from 'zod';

export const MANIFEST_FILE = 'harness-plugin.json';
export const PluginNameSchema = z
  .string()
  .min(2)
  .max(40)
  .regex(/^[a-z][a-z0-9-]*[a-z0-9]$/);
const SemverSchema = z
  .string()
  .regex(
    /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-((?:0|[1-9]\d*|\d*[A-Za-z-][0-9A-Za-z-]*)(?:\.(?:0|[1-9]\d*|\d*[A-Za-z-][0-9A-Za-z-]*))*))?(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/,
    'must be a valid SemVer',
  );
export const HookEventNameSchema = z.enum([
  'PreToolUse',
  'PostToolUse',
  'SessionStart',
  'UserPromptSubmit',
  'SessionEnd',
]);
export type HookEventName = z.infer<typeof HookEventNameSchema>;
export const McpServerSpecSchema = z
  .object({
    command: z.string().min(1),
    args: z.array(z.string()).default([]),
    env: z.record(z.string(), z.string()).default({}),
    cwd: z.string().optional(),
    startupTimeoutMs: z.number().int().positive().default(10_000),
  })
  .strict();
export type McpServerSpec = z.infer<typeof McpServerSpecSchema>;
export const HookSpecSchema = z
  .object({
    event: HookEventNameSchema,
    match: z.string().default('**'),
    command: z.string().min(1),
    args: z.array(z.string()).default([]),
    timeout: z.number().positive().max(60).default(5),
    onError: z.enum(['allow', 'deny']).optional(),
  })
  .strict();
export type HookSpec = z.infer<typeof HookSpecSchema>;
export const PermissionsSchema = z
  .object({
    filesystem: z
      .array(z.object({ path: z.string().min(1), access: z.enum(['read', 'read-write']) }).strict())
      .optional(),
    network: z.union([z.boolean(), z.array(z.string().min(1))]).optional(),
    env: z.array(z.string().regex(/^[A-Za-z_][A-Za-z0-9_]*$/)).optional(),
    exec: z.boolean().optional(),
  })
  .strict();
export type Permissions = z.infer<typeof PermissionsSchema>;
export const CommandSpecSchema = z
  .object({ file: z.string().min(1), description: z.string().optional() })
  .strict();
export type CommandSpec = z.infer<typeof CommandSpecSchema>;
export type JsonSchemaObject = Record<string, unknown>;
export const ConfigSchemaSchema = z
  .object({
    type: z.literal('object'),
    properties: z.record(z.string(), z.record(z.string(), z.unknown())),
  })
  .passthrough();
const AuthorSchema = z.union([
  z.string(),
  z.object({ name: z.string(), email: z.string().optional(), url: z.string().optional() }).strict(),
]);
const RepositorySchema = z.union([
  z.string(),
  z.object({ type: z.string(), url: z.string() }).strict(),
]);
export const PluginManifestSchema = z
  .object({
    $schema: z.string().optional(),
    apiVersion: z.literal(1),
    name: PluginNameSchema,
    version: SemverSchema,
    description: z.string().optional(),
    author: AuthorSchema.optional(),
    license: z.string().optional(),
    homepage: z.string().optional(),
    repository: RepositorySchema.optional(),
    keywords: z.array(z.string()).optional(),
    config: ConfigSchemaSchema.optional(),
    permissions: PermissionsSchema.default({}),
    mcpServers: z.record(z.string().min(1), McpServerSpecSchema).default({}),
    hooks: z.array(HookSpecSchema).default([]),
    commands: z.record(z.string().min(1), CommandSpecSchema).default({}),
    priority: z.number().int().default(100),
  })
  .passthrough();
export type PluginManifest = z.infer<typeof PluginManifestSchema>;
export function manifestJsonSchema(): object {
  return z.toJSONSchema(PluginManifestSchema, { target: 'draft-2020-12', io: 'input' });
}
