import { randomUUID } from 'node:crypto';
import { join } from 'node:path';
import { resolvePaths, ensureDirectory, type HarnessPaths } from './paths.js';
import { NotInstalledError, PolicyUnavailableError } from './errors.js';
import { PluginStore } from './store/plugin-store.js';
import type { RegistryEntry } from './store/registry.js';
import { ConfigStore, maskSecrets, type ConfigIssue } from './config/config-store.js';
import { loadSettings, type HostSettings } from './config/settings.js';
import type { PluginManifest } from './manifest/schema.js';
import type { LoadedManifest } from './manifest/load.js';
import { resolvePlugin } from './runtime/resolve.js';
import {
  RuntimeManager,
  type HostTool,
  type PluginStatus,
  type ResolvedPlugin,
  type ToolResult,
} from './runtime/runtime-manager.js';
import { maskDiagnostic, confidentialValues, maskStructured } from './runtime/log.js';
import { HookEngine } from './hooks/engine.js';
import { ToolGateway, type TurnIO, type TurnEvent } from './agent/gateway.js';
import { createModel } from './agent/model.js';
import { Session } from './agent/session.js';
export type PluginInspection = {
  entry: RegistryEntry;
  manifest: PluginManifest;
  config: { values: Record<string, unknown>; issues: ConfigIssue[] };
  commands: string[][];
  hooks: { event: string; match: string; command: string[] }[];
  status?: PluginStatus;
  tools?: HostTool[];
  warnings: string[];
};
export class Host {
  readonly plugins: PluginStore;
  readonly config: ConfigStore;
  private readonly runtime: RuntimeManager;
  private resolved: ResolvedPlugin[] = [];
  private failed: PluginStatus[] = [];
  private policyFailures: string[] = [];
  private started = false;
  private constructor(
    readonly paths: HarnessPaths,
    private readonly env: NodeJS.ProcessEnv,
  ) {
    this.plugins = new PluginStore(paths);
    this.config = new ConfigStore(paths);
    this.runtime = new RuntimeManager({ paths });
  }
  static async open(opts: { home?: string; env?: NodeJS.ProcessEnv } = {}): Promise<Host> {
    const env = opts.env ?? process.env;
    const paths = resolvePaths(opts.home ?? env.HARNESS_HOME);
    for (const dir of [
      paths.home,
      paths.pluginsDir,
      paths.configDir,
      paths.dataDir,
      paths.logsDir,
      paths.sessionsDir,
    ])
      await ensureDirectory(paths.home, dir);
    return new Host(paths, env);
  }
  settings(): Promise<HostSettings> {
    return loadSettings(this.paths, this.env);
  }
  async start(opts: { only?: string[] } = {}): Promise<PluginStatus[]> {
    this.resolved = [];
    this.failed = [];
    this.policyFailures = [];
    for (const entry of await this.plugins.list()) {
      if (!entry.enabled) continue;
      let loaded: LoadedManifest | undefined;
      try {
        loaded = await this.plugins.load(entry.name);
        const config = await this.config.resolve(entry.name, loaded.manifest.config);
        const p = resolvePlugin(entry, loaded, config, this.paths, this.env);
        if (!opts.only || opts.only.includes(p.name) || p.hooks.length) this.resolved.push(p);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        this.failed.push({
          plugin: entry.name,
          state: 'failed',
          error: message,
          logFile: join(this.paths.logsDir, `${entry.name}.log`),
          tools: 0,
        });
        if (
          !loaded ||
          loaded.manifest.hooks.some((h) => h.event === 'PreToolUse' || h.onError === 'deny')
        )
          this.policyFailures.push(`${entry.name}: ${message}`);
      }
    }
    const statuses = await this.runtime.start(this.resolved);
    this.started = true;
    return [...statuses, ...this.failed];
  }
  tools(): HostTool[] {
    return this.runtime.tools();
  }
  private async gateway(): Promise<ToolGateway> {
    if (!this.started) await this.start();
    if (this.policyFailures.length) throw new PolicyUnavailableError(this.policyFailures);
    return new ToolGateway({
      runtime: this.runtime,
      hooks: new HookEngine(this.resolved.flatMap((p) => p.hooks)),
      approvals: (await this.settings()).approvals,
    });
  }
  async callTool(
    qualifiedName: string,
    input: unknown,
    io: TurnIO,
    emit: (e: TurnEvent) => void = () => {},
  ): Promise<ToolResult> {
    const gateway = await this.gateway();
    return gateway.invoke(
      { id: randomUUID(), cwd: process.cwd(), interactive: io.interactive },
      qualifiedName,
      input,
      io,
      emit,
    );
  }
  async newSession(opts: { cwd?: string; maxSteps?: number } = {}): Promise<Session> {
    const gateway = await this.gateway();
    const settings = await this.settings();
    return new Session({
      model: createModel(settings.model, { env: this.env, home: this.paths.home }),
      gateway,
      tools: this.tools(),
      maxSteps: opts.maxSteps ?? settings.maxSteps,
      cwd: opts.cwd ?? process.cwd(),
    });
  }
  async inspect(name: string, opts: { live?: boolean } = {}): Promise<PluginInspection> {
    const entry = await this.plugins.get(name);
    if (!entry) throw new NotInstalledError(name);
    const loaded = await this.plugins.load(name);
    const c = await this.config.resolve(name, loaded.manifest.config);
    if (opts.live) await this.start({ only: [name] });
    const secrets = confidentialValues(
      c.values,
      c.secretKeys,
      loaded.manifest.permissions.env ?? [],
      this.env,
    );
    const maskArg = (s: string) => maskDiagnostic(s, secrets);
    const resolved = this.resolved.find((p) => p.name === name);
    const commands = resolved
      ? Object.values(resolved.servers).map((s) => [s.command, ...s.args].map(maskArg))
      : (await this.plugins.plan(entry.installPath)).commands.map((args) => args.map(maskArg));
    const hooks = resolved
      ? resolved.hooks.map((h) => ({
          event: h.event,
          match: h.match,
          command: [h.command, ...h.args].map(maskArg),
        }))
      : loaded.manifest.hooks.map((h) => ({
          event: h.event,
          match: h.match,
          command: [h.command, ...h.args].map((s) =>
            maskArg(s.replaceAll('${plugin.root}', entry.installPath)),
          ),
        }));
    return maskStructured(
      {
        entry,
        manifest: loaded.manifest,
        config: { values: maskSecrets(c.values, c.secretKeys), issues: c.issues },
        commands,
        hooks,
        status: [...this.runtime.status(), ...this.failed].find((s) => s.plugin === name) ?? {
          plugin: name,
          state: 'stopped',
          logFile: join(this.paths.logsDir, `${name}.log`),
          tools: 0,
        },
        tools: this.tools().filter((t) => t.plugin === name),
        warnings: loaded.warnings,
      },
      secrets,
    );
  }
  async close(): Promise<void> {
    await this.runtime.stop();
    this.started = false;
    this.resolved = [];
    this.failed = [];
  }
}
