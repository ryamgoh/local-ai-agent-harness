import Table from 'cli-table3';
import { styleText } from 'node:util';
import {
  substitute,
  maskSecrets,
  type Host,
  type HostTool,
  type InstallPlan,
  type ResolvedConfig,
  type TurnEvent,
} from '@harness/core';
import { getValue } from './context.js';

export function renderTable(headers: string[], rows: string[][]): string {
  const table = new Table({ head: headers, style: { head: [], border: [] } });
  table.push(...rows);
  return `${table.toString()}\n`;
}
export function formatConsent(plan: InstallPlan, config: ResolvedConfig, home: string): string {
  const ctx = {
    plugin: {
      name: plan.loaded.manifest.name,
      root: plan.loaded.dir,
      data: `${home}/data/${plan.loaded.manifest.name}`,
    },
    harness: { home },
    config: maskSecrets(config.values, config.secretKeys),
    env: process.env as Record<string, string>,
    allowedEnv: plan.permissions.env ?? [],
    pathKeys: config.pathKeys,
  };
  const secretValues = config.secretKeys
    .map((key) => getValue(config.values, key))
    .filter((value): value is string => typeof value === 'string' && value.length > 0);
  const display = (text: string): string => {
    const resolved = text.replace(
      /\$\{([a-z]+)\.([A-Za-z0-9_]+)\}/g,
      (token: string, namespace: string, key: string) => {
        if (
          namespace === 'config' &&
          (!Object.hasOwn(config.values, key) || config.values[key] === undefined)
        )
          return token;
        if ((namespace === 'config' && config.secretKeys.includes(key)) || namespace === 'env')
          return '••••';
        return substitute(token, ctx);
      },
    );
    return secretValues.reduce((value, secret) => value.split(secret).join('••••'), resolved);
  };
  const permissionRows: string[] = [];
  for (const item of plan.permissions.filesystem ?? [])
    permissionRows.push(`filesystem: ${display(item.path)} (${item.access})`);
  if (plan.permissions.network !== undefined)
    permissionRows.push(
      `network: ${Array.isArray(plan.permissions.network) ? plan.permissions.network.join(', ') : String(plan.permissions.network)}`,
    );
  if (plan.permissions.env?.length) permissionRows.push(`env: ${plan.permissions.env.join(', ')}`);
  if (plan.permissions.exec !== undefined)
    permissionRows.push(`exec: ${String(plan.permissions.exec)}`);
  return `Plugin: ${plan.loaded.manifest.name} ${plan.loaded.manifest.version}\nWill run:\n${plan.commands.length ? plan.commands.map((argv) => `  ${argv.map(display).join(' ')}`).join('\n') : '  (no executable contributions)'}\n${permissionRows.length ? `Permissions:\n${permissionRows.map((row) => `  ${row}`).join('\n')}` : 'Permissions: none declared'}\nTrust warning: permissions are declarations, not a sandbox. Plugin code runs with your user privileges.\n`;
}
export function renderTools(tools: HostTool[]): string {
  return renderTable(
    ['Tool', 'Description'],
    tools.map((tool) => [tool.qualifiedName, tool.description]),
  );
}
export function renderInspection(inspection: Awaited<ReturnType<Host['inspect']>>): string {
  const { entry, manifest, config } = inspection;
  return `${manifest.name} ${manifest.version}\n${manifest.description ?? ''}\nSource: ${JSON.stringify(entry.source)}\nInstalled: ${entry.installPath}${entry.linked ? ' (linked)' : ''}\nEnabled: ${entry.enabled}\nPermissions: ${JSON.stringify(manifest.permissions, null, 2)}\nConfig: ${config.issues.length ? config.issues.map((issue) => `${issue.key}: ${issue.message}`).join('; ') : 'valid'}\n${JSON.stringify(config.values, null, 2)}\nCommands:\n${inspection.commands.map((command) => `  ${command.join(' ')}`).join('\n')}\nHooks:\n${inspection.hooks.map((hook) => `  ${hook.event} ${hook.match}: ${hook.command.join(' ')}`).join('\n')}\n${inspection.status ? `Status: ${inspection.status.state}${inspection.status.error ? ` — ${inspection.status.error}` : ''}\nLog: ${inspection.status.logFile}\n` : ''}${inspection.tools ? `Tools:\n${inspection.tools.map((tool) => `  ${tool.qualifiedName}: ${tool.description}\n    ${JSON.stringify(tool.inputSchema)}`).join('\n')}\n` : ''}`;
}
export function renderEvent(event: TurnEvent, json = false): void {
  if (json) {
    process.stdout.write(`${JSON.stringify(event)}\n`);
    return;
  }
  switch (event.type) {
    case 'text':
      process.stdout.write(event.delta);
      break;
    case 'tool-call':
      process.stderr.write(`\nTool: ${event.tool} ${JSON.stringify(event.input)}\n`);
      break;
    case 'tool-result':
      process.stderr.write(
        `${event.result.isError ? 'Tool error' : 'Tool result'}: ${event.tool} ${JSON.stringify(event.result.structuredContent ?? event.result.content)}\n`,
      );
      break;
    case 'hook':
      if (event.trace.reason || event.trace.error)
        process.stderr.write(
          `Hook: ${event.trace.plugin}: ${event.trace.reason ?? event.trace.error}\n`,
        );
      break;
    case 'approval':
      process.stderr.write(
        `Approval: ${event.tool} ${event.approved ? 'approved' : 'denied'}${event.reasons.length ? ` — ${event.reasons.join('; ')}` : ''}\n`,
      );
      break;
    case 'done':
      process.stdout.write('\n');
      break;
    case 'error':
      process.stderr.write(`${styleText('red', 'Error:')} ${event.message}\n`);
      break;
  }
}
