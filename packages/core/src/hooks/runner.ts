import { execa } from 'execa';
import { appendFile, mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';
import type { ResolvedHook } from '../runtime/types.js';
import { maskDiagnostic, secretValues } from '../runtime/log.js';
import { ensureDirectory, assertWritePath } from '../paths.js';
export type HookRunResult =
  | { kind: 'output'; output: Record<string, unknown> }
  | { kind: 'deny'; reason: string }
  | { kind: 'error'; error: string };
export async function runCommandHook(hook: ResolvedHook, payload: object): Promise<HookRunResult> {
  const mask = (s: string) => maskDiagnostic(s, hook.secrets ?? secretValues(hook.owner.config));
  const diagnostic = async (s: string) => {
    if (hook.logFile) {
      if (hook.harnessHome) {
        await ensureDirectory(hook.harnessHome, dirname(hook.logFile));
        assertWritePath(hook.harnessHome, hook.logFile);
      } else await mkdir(dirname(hook.logFile), { recursive: true, mode: 0o700 });
      await appendFile(hook.logFile, mask(s) + '\n', { mode: 0o600 });
    }
  };
  try {
    const result = await execa(hook.command, hook.args, {
      input: JSON.stringify(payload) + '\n',
      cwd: hook.owner.root,
      timeout: hook.timeout * 1000,
      killSignal: 'SIGTERM',
      forceKillAfterDelay: 100,
      killDescendants: true,
      cleanup: true,
      reject: false,
      extendEnv: false,
      env: hook.env,
      shell: false,
      maxBuffer: 1 << 20,
    });
    if (result.timedOut || result.signal) {
      const error = result.timedOut
        ? `Hook timed out after ${hook.timeout}s`
        : `Hook terminated by ${result.signal}`;
      await diagnostic(error);
      return { kind: 'error', error };
    }
    if (result.exitCode === 2)
      return {
        kind: 'deny',
        reason: mask(result.stderr.slice(0, 1000).trim() || 'hook denied the operation'),
      };
    if (result.exitCode !== 0) {
      const error = mask(`Hook exited ${result.exitCode}: ${result.stderr.slice(0, 200)}`);
      await diagnostic(error);
      return { kind: 'error', error };
    }
    if (!result.stdout.trim()) return { kind: 'output', output: {} };
    try {
      const output: unknown = JSON.parse(result.stdout);
      if (!output || typeof output !== 'object' || Array.isArray(output))
        throw new Error('Expected one JSON object');
      const specific = (output as Record<string, unknown>).hookSpecificOutput;
      if (specific && typeof specific === 'object' && !Array.isArray(specific)) {
        const metadata = specific as Record<string, unknown>;
        for (const key of ['permissionDecisionReason', 'additionalContext'])
          if (typeof metadata[key] === 'string') metadata[key] = mask(metadata[key]);
      }
      return { kind: 'output', output: output as Record<string, unknown> };
    } catch {
      const error = mask(`Invalid hook JSON: ${result.stdout.slice(0, 200)}`);
      await diagnostic(error);
      return { kind: 'error', error };
    }
  } catch (error) {
    const message = mask(error instanceof Error ? error.message : String(error));
    await diagnostic(message);
    return { kind: 'error', error: message };
  }
}
