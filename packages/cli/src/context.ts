import type { Host } from '@harness/core';

export class CliError extends Error {
  constructor(
    message: string,
    readonly exitCode: number,
  ) {
    super(message);
  }
}
export interface CommandContext {
  host(): Promise<Host>;
}
export function parseAssignments(assignments: string[]): Record<string, string> {
  if (!assignments.length) throw new CliError('Expected at least one key=value assignment', 2);
  const result: Record<string, string> = Object.create(null) as Record<string, string>;
  for (const assignment of assignments) {
    const equal = assignment.indexOf('=');
    if (equal <= 0) throw new CliError(`Expected key=value: ${assignment}`, 2);
    const key = assignment.slice(0, equal);
    if (key.split('.').some((part) => ['__proto__', 'prototype', 'constructor'].includes(part))) {
      throw new CliError('Invalid configuration key', 2);
    }
    result[key] = assignment.slice(equal + 1);
  }
  return result;
}
export function getValue(values: unknown, key: string): unknown {
  let current = values;
  for (const part of key.split('.')) {
    if (!current || typeof current !== 'object' || !Object.hasOwn(current, part)) return undefined;
    current = (current as Record<string, unknown>)[part];
  }
  return current;
}
export function printValue(value: unknown): void {
  if (value === undefined) throw new CliError('Unknown configuration key', 2);
  process.stdout.write(`${typeof value === 'string' ? value : JSON.stringify(value, null, 2)}\n`);
}
