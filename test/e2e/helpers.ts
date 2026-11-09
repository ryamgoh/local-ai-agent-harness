import { spawn } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const root = fileURLToPath(new URL('../../', import.meta.url));
export function fixture(path: string): string {
  return resolve(root, 'test/fixtures', path);
}
export async function temporaryHome(): Promise<string> {
  return mkdtemp(resolve(tmpdir(), 'harness-cli-'));
}
export interface CliOptions {
  input?: string;
  env?: Record<string, string>;
  keepStdinOpen?: boolean;
  timeoutMs?: number;
}
export async function cli(
  args: string[],
  opts: CliOptions = {},
): Promise<{ code: number; stdout: string; stderr: string }> {
  const home = opts.env?.HARNESS_HOME ?? (await temporaryHome());
  const ownsHome = opts.env?.HARNESS_HOME === undefined;
  try {
    return await new Promise((resolveResult, reject) => {
      const child = spawn(
        process.execPath,
        [resolve(root, 'packages/cli/dist/index.js'), ...args],
        {
          cwd: root,
          env: { ...process.env, HARNESS_HOME: home, ...opts.env },
          stdio: ['pipe', 'pipe', 'pipe'],
        },
      );
      let stdout = '';
      let stderr = '';
      const timer = setTimeout(() => {
        child.kill('SIGKILL');
        reject(new Error(`CLI timed out: ${args.join(' ')}\n${stderr}`));
      }, opts.timeoutMs ?? 15000);
      child.stdout.setEncoding('utf8').on('data', (text: string) => {
        stdout += text;
      });
      child.stderr.setEncoding('utf8').on('data', (text: string) => {
        stderr += text;
      });
      child.on('error', (error) => {
        clearTimeout(timer);
        reject(error);
      });
      child.on('close', (code) => {
        clearTimeout(timer);
        resolveResult({ code: code ?? 1, stdout, stderr });
      });
      child.stdin.on('error', (error: NodeJS.ErrnoException) => {
        if (error.code !== 'EPIPE') reject(error);
      });
      if (opts.keepStdinOpen) {
        if (opts.input) child.stdin.write(opts.input);
      } else child.stdin.end(opts.input ?? '');
    });
  } finally {
    if (ownsHome) await rm(home, { recursive: true, force: true });
  }
}
