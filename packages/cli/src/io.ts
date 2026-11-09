import { createInterface } from 'node:readline';
import type { TurnIO } from '@harness/core';
import { promptConfirm } from './prompts.js';

export function isInteractive(): boolean {
  return Boolean(process.stdin.isTTY && process.stdout.isTTY);
}
export async function readConsentLine(): Promise<boolean> {
  process.stderr.write('Trust this plugin and allow these commands? [y/N] ');
  const lines = createInterface({ input: process.stdin, terminal: false });
  try {
    for await (const line of lines) return /^(y|yes)$/i.test(line.trim());
    return false;
  } finally {
    lines.close();
  }
}
export async function consent(yes = false): Promise<boolean> {
  if (yes) return true;
  return isInteractive()
    ? promptConfirm('Trust this plugin and allow these commands?')
    : readConsentLine();
}
export function createTurnIO(autoApprove = false): TurnIO {
  const interactive = isInteractive();
  return {
    interactive,
    autoApprove,
    async confirm(request) {
      if (autoApprove) return true;
      if (!interactive) return false;
      process.stderr.write(
        `Approval requested: ${request.tool}\n${JSON.stringify(request.input, null, 2)}\n${request.reasons.join('\n')}\n`,
      );
      return promptConfirm('Approve this tool call?');
    },
  };
}
