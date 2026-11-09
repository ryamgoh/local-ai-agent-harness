#!/usr/bin/env node
import { Command, CommanderError, InvalidArgumentError } from 'commander';
import { realpathSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { Host } from '@harness/core';
import { CliError, type CommandContext } from './context.js';
import {
  installPlugin,
  uninstallPlugin,
  listPlugins,
  inspectPlugin,
  enablePlugin,
  disablePlugin,
  pluginConfig,
  validatePlugin,
  type InstallOptions,
} from './commands/plugin.js';
import { listTools, callTool } from './commands/tools.js';
import { runAgent, chatAgent } from './commands/agent.js';
import { getSetting, setSetting } from './commands/settings.js';

export function parseMaxSteps(value: string): number {
  if (!/^\d+$/.test(value) || !Number.isSafeInteger(Number(value)) || Number(value) < 1)
    throw new InvalidArgumentError('max-steps must be a positive integer');
  return Number(value);
}
export function createProgram(context: CommandContext): Command {
  const program = new Command();
  program
    .name('harness')
    .description('Local agent harness with plugin-provided capabilities')
    .version('0.1.0')
    .exitOverride()
    .configureOutput({
      writeOut: (text) => process.stdout.write(text),
      writeErr: (text) => process.stderr.write(text),
    })
    .showHelpAfterError();
  const plugin = program.command('plugin').description('Install, inspect, and configure plugins');
  plugin
    .command('install <path>')
    .option('--link', 'Link the source directory')
    .option('--yes', 'Approve plugin execution')
    .option('--no-enable', 'Install disabled')
    .option('--force', 'Replace an installed plugin')
    .action((path: string, options: InstallOptions) => installPlugin(context, path, options));
  plugin.command('uninstall <name>').action((name: string) => uninstallPlugin(context, name));
  plugin
    .command('list')
    .option('--json')
    .action((options: { json?: boolean }) => listPlugins(context, options.json));
  plugin
    .command('inspect <name>')
    .option('--json')
    .option('--live', 'Start the plugin and discover tools')
    .action((name: string, options: { json?: boolean; live?: boolean }) =>
      inspectPlugin(context, name, options),
    );
  plugin
    .command('enable <name>')
    .option('--yes', 'Approve plugin execution')
    .action((name: string) => enablePlugin(context, name));
  plugin.command('disable <name>').action((name: string) => disablePlugin(context, name));
  plugin
    .command('config <name> [operation] [values...]')
    .description('get [key], set key=value ..., unset key; no operation prompts interactively')
    .action((name: string, operation: string | undefined, values: string[]) =>
      pluginConfig(context, name, operation, values),
    );
  plugin
    .command('validate <dir>')
    .option('--strict', 'Treat warnings as errors')
    .action((dir: string, options: { strict?: boolean }) => validatePlugin(dir, options.strict));
  const tools = program.command('tools').description('List and call plugin tools');
  tools
    .command('list')
    .option('--json')
    .action((options: { json?: boolean }) => listTools(context, options.json));
  tools
    .command('call <qualified-name>')
    .requiredOption('--input <json>', 'JSON tool input')
    .option('--yes', 'Approve requested tool calls')
    .action((name: string, options: { input: string; yes?: boolean }) =>
      callTool(context, name, options.input, options.yes),
    );
  program
    .command('run <prompt>')
    .option('--json', 'Emit TurnEvents as JSON Lines')
    .option('--yes', 'Approve requested tool calls')
    .option('--max-steps <number>', 'Maximum model steps', parseMaxSteps)
    .action((prompt: string, options: { json?: boolean; yes?: boolean; maxSteps?: number }) =>
      runAgent(context, prompt, options),
    );
  program
    .command('chat')
    .description('Chat with /tools, /plugins, /exit')
    .action(() => chatAgent(context));
  const config = program.command('config').description('Host settings');
  config.command('get [key]').action((key?: string) => getSetting(context, key));
  config
    .command('set <key> <value>')
    .action((key: string, value: string) => setSetting(context, key, value));
  return program;
}
export function errorExitCode(error: unknown): number {
  if (error instanceof CliError) return error.exitCode;
  if (error instanceof CommanderError)
    return ['commander.helpDisplayed', 'commander.help', 'commander.version'].includes(error.code)
      ? 0
      : 2;
  if (error instanceof Error && error.name === 'ExitPromptError') return 3;
  const code = error && typeof error === 'object' && 'code' in error ? String(error.code) : '';
  return [
    'MANIFEST_INVALID',
    'CONFIG_INVALID',
    'UNKNOWN_VARIABLE',
    'UNDECLARED_ENV',
    'SETTINGS_INVALID',
    'PATH_ESCAPE',
  ].includes(code)
    ? 2
    : 1;
}
export async function main(argv = process.argv): Promise<number> {
  let host: Host | undefined;
  const context: CommandContext = {
    async host() {
      return (host ??= await Host.open());
    },
  };
  let closing: Promise<void> | undefined;
  const close = (): Promise<void> => (closing ??= host ? host.close() : Promise.resolve());
  const onSignal = (signal: NodeJS.Signals): void => {
    const code = signal === 'SIGINT' ? 130 : 143;
    void close().then(
      () => process.exit(code),
      (error: unknown) => {
        process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
        process.exit(1);
      },
    );
  };
  const interrupt = () => onSignal('SIGINT');
  const terminate = () => onSignal('SIGTERM');
  process.on('SIGINT', interrupt);
  process.on('SIGTERM', terminate);
  let result = 0;
  try {
    await createProgram(context).parseAsync(argv);
  } catch (error) {
    result = errorExitCode(error);
    if (!(error instanceof CommanderError))
      process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  } finally {
    try {
      await close();
    } catch (error) {
      result = 1;
      process.stderr.write(
        `Cleanup failed: ${error instanceof Error ? error.message : String(error)}\n`,
      );
    }
    process.off('SIGINT', interrupt);
    process.off('SIGTERM', terminate);
  }
  return result || (typeof process.exitCode === 'number' ? process.exitCode : 0);
}
if (process.argv[1] && realpathSync(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exitCode = await main();
}
