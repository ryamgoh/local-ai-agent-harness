import { createInterface } from 'node:readline';
import type { Session } from '@harness/core';
import { type CommandContext } from '../context.js';
import { createTurnIO, isInteractive } from '../io.js';
import { renderEvent, renderTable, renderTools } from '../render.js';
import { startHost } from './tools.js';

async function runTurn(
  session: Session,
  prompt: string,
  options: { json?: boolean; yes?: boolean },
): Promise<void> {
  for await (const event of session.runTurn(prompt, createTurnIO(options.yes))) {
    renderEvent(event, options.json);
    if (event.type === 'error') process.exitCode = 1;
  }
}
export async function runAgent(
  context: CommandContext,
  prompt: string,
  options: { json?: boolean; yes?: boolean; maxSteps?: number },
): Promise<void> {
  const host = await context.host();
  await startHost(host);
  const session = await host.newSession({ cwd: process.cwd(), maxSteps: options.maxSteps });
  await runTurn(session, prompt, options);
}
export async function chatAgent(context: CommandContext): Promise<void> {
  const host = await context.host();
  await startHost(host);
  const session = await host.newSession({ cwd: process.cwd() });
  const interactive = isInteractive();
  const lines = createInterface({
    input: process.stdin,
    output: interactive ? process.stderr : undefined,
    terminal: interactive,
  });
  if (interactive) process.stderr.write('Chat: /tools, /plugins, /exit\n> ');
  try {
    for await (const raw of lines) {
      const prompt = raw.trim();
      if (prompt === '/exit') break;
      if (prompt === '/tools')
        process.stdout.write(host.tools().length ? renderTools(host.tools()) : 'No tools\n');
      else if (prompt === '/plugins') {
        const plugins = await host.plugins.list();
        process.stdout.write(
          plugins.length
            ? renderTable(
                ['Plugin', 'Enabled'],
                plugins.map((plugin) => [plugin.name, String(plugin.enabled)]),
              )
            : 'No plugins installed\n',
        );
      } else if (prompt) await runTurn(session, prompt, {});
      if (interactive) process.stderr.write('> ');
    }
  } finally {
    lines.close();
  }
}
