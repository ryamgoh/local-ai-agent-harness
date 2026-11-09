import { loadManifest, maskSecrets, type Host } from '@harness/core';
import {
  CliError,
  getValue,
  parseAssignments,
  printValue,
  type CommandContext,
} from '../context.js';
import { consent, isInteractive } from '../io.js';
import { promptConfirm, promptField, schemaFields, type SchemaObject } from '../prompts.js';
import { formatConsent, renderInspection, renderTable } from '../render.js';

export interface InstallOptions {
  link?: boolean;
  yes?: boolean;
  enable?: boolean;
  force?: boolean;
}
export async function installPlugin(
  context: CommandContext,
  source: string,
  options: InstallOptions,
): Promise<void> {
  const host = await context.host();
  const plan = await host.plugins.plan(source);
  const config = await host.config.resolve(plan.loaded.manifest.name, plan.loaded.manifest.config);
  process.stdout.write(formatConsent(plan, config, host.paths.home));
  for (const warning of plan.loaded.warnings) process.stderr.write(`Warning: ${warning}\n`);
  if (!(await consent(options.yes))) throw new CliError('Consent declined', 3);
  const entry = await host.plugins.install(plan, {
    link: options.link,
    enable: options.enable,
    force: options.force,
  });
  process.stdout.write(`Installed ${entry.name}${entry.enabled ? ' (enabled)' : ' (disabled)'}\n`);
  const resolved = await host.config.resolve(entry.name, plan.loaded.manifest.config);
  if (resolved.issues.length) {
    process.stderr.write(
      `Configuration required:\n${resolved.issues.map((issue) => `  ${issue.key}: ${issue.message}`).join('\n')}\n`,
    );
    if (isInteractive() && (await promptConfirm('Configure this plugin now?')))
      await configureInteractive(
        host,
        entry.name,
        plan.loaded.manifest.config as SchemaObject | undefined,
      );
  }
}
export async function enablePlugin(context: CommandContext, name: string): Promise<void> {
  const host = await context.host();
  await host.plugins.load(name);
  const entry = await host.plugins.get(name);
  if (!entry) throw new CliError(`Plugin not installed: ${name}`, 1);
  await host.plugins.setEnabled(name, true);
  process.stdout.write(`Enabled ${name}\n`);
}
export async function disablePlugin(context: CommandContext, name: string): Promise<void> {
  await (await context.host()).plugins.setEnabled(name, false);
  process.stdout.write(`Disabled ${name}\n`);
}
export async function uninstallPlugin(context: CommandContext, name: string): Promise<void> {
  const host = await context.host();
  await host.plugins.uninstall(name);
  await host.config.remove(name);
  process.stdout.write(`Uninstalled ${name}\n`);
}
export async function listPlugins(context: CommandContext, json = false): Promise<void> {
  const entries = await (await context.host()).plugins.list();
  if (json) process.stdout.write(`${JSON.stringify(entries)}\n`);
  else if (!entries.length) process.stdout.write('No plugins installed\n');
  else
    process.stdout.write(
      renderTable(
        ['Plugin', 'Version', 'Enabled', 'Source'],
        entries.map((entry) => [
          entry.name,
          entry.version,
          entry.enabled ? 'yes' : 'no',
          entry.installPath,
        ]),
      ),
    );
}
export async function inspectPlugin(
  context: CommandContext,
  name: string,
  options: { live?: boolean; json?: boolean },
): Promise<void> {
  const result = await (await context.host()).inspect(name, { live: options.live });
  process.stdout.write(options.json ? `${JSON.stringify(result)}\n` : renderInspection(result));
}
export async function validatePlugin(source: string, strict = false): Promise<void> {
  const loaded = await loadManifest(source);
  for (const warning of loaded.warnings)
    process.stderr.write(`${strict ? 'Error' : 'Warning'}: ${warning}\n`);
  if (strict && loaded.warnings.length)
    throw new CliError('Validation failed: warnings are errors in strict mode', 2);
  process.stdout.write('Validation passed\n');
}
export async function configureInteractive(
  host: Host,
  name: string,
  schema?: SchemaObject,
): Promise<void> {
  if (!isInteractive())
    throw new CliError(
      'Interactive configuration requires a terminal; use config set key=value',
      2,
    );
  const config = await host.config.resolve(name, schema);
  const assignments: Record<string, string> = {};
  for (const field of schemaFields(schema ?? {}, config.values)) {
    const value = await promptField(field);
    if (value !== undefined) assignments[field.key] = value;
  }
  if (!Object.keys(assignments).length) {
    process.stdout.write('No configuration changes\n');
    return;
  }
  const issues = await host.config.set(
    name,
    schema ?? { type: 'object', properties: {} },
    assignments,
  );
  if (issues.length)
    throw new CliError(issues.map((issue) => `${issue.key}: ${issue.message}`).join('\n'), 2);
  process.stdout.write(`Configured ${name}\n`);
}
export async function pluginConfig(
  context: CommandContext,
  name: string,
  operation?: string,
  args: string[] = [],
): Promise<void> {
  if (
    (operation === 'get' && args.length > 1) ||
    (operation === 'unset' && args.length !== 1) ||
    (operation && !['get', 'set', 'unset'].includes(operation))
  )
    throw new CliError(
      'Usage: plugin config <name> [get [key] | set key=value ... | unset key]',
      2,
    );
  const host = await context.host();
  const loaded = await host.plugins.load(name);
  if (!operation) {
    await configureInteractive(host, name, loaded.manifest.config as SchemaObject | undefined);
    return;
  }
  if (operation === 'set') {
    if (!loaded.manifest.config) throw new CliError('Plugin declares no configuration schema', 2);
    const issues = await host.config.set(name, loaded.manifest.config, parseAssignments(args));
    if (issues.length)
      throw new CliError(issues.map((issue) => `${issue.key}: ${issue.message}`).join('\n'), 2);
    process.stdout.write(`Configured ${name}\n`);
  } else if (operation === 'unset') {
    await host.config.unset(name, args[0]!);
    process.stdout.write(`Unset ${name}.${args[0]}\n`);
  } else {
    const resolved = await host.config.resolve(name, loaded.manifest.config);
    const values = maskSecrets(resolved.values, resolved.secretKeys);
    printValue(args[0] ? getValue(values, args[0]) : values);
    if (resolved.issues.length)
      process.stderr.write(
        resolved.issues.map((issue) => `${issue.key}: ${issue.message}`).join('\n') + '\n',
      );
  }
}
