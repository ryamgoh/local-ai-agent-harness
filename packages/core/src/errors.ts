export interface ManifestIssue {
  path: string;
  message: string;
}
export interface ConfigIssue {
  key: string;
  message: string;
}

export class HarnessError extends Error {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = new.target.name;
  }
}
export class ManifestError extends HarnessError {
  constructor(
    readonly dir: string,
    readonly issues: ManifestIssue[],
  ) {
    super(
      'MANIFEST_INVALID',
      `Invalid plugin manifest in ${dir}:\n${issues.map((i) => `  - ${i.path}: ${i.message}`).join('\n')}`,
    );
  }
}
export class UnknownVariableError extends HarnessError {
  constructor(readonly variable: string) {
    super('UNKNOWN_VARIABLE', `Unknown variable "${variable}"`);
  }
}
export class UndeclaredEnvError extends HarnessError {
  constructor(readonly name: string) {
    super('UNDECLARED_ENV', `Environment variable "${name}" is not declared in permissions.env`);
  }
}
export class AlreadyInstalledError extends HarnessError {
  constructor(readonly plugin: string) {
    super(
      'ALREADY_INSTALLED',
      `Plugin "${plugin}" is already installed; use --force for a fresh install`,
    );
  }
}
export class NotInstalledError extends HarnessError {
  constructor(readonly plugin: string) {
    super('NOT_INSTALLED', `Plugin "${plugin}" is not installed`);
  }
}
export class ConfigInvalidError extends HarnessError {
  constructor(
    readonly plugin: string,
    readonly issues: ConfigIssue[],
  ) {
    super(
      'CONFIG_INVALID',
      `Invalid config for "${plugin}": ${issues.map((i) => `${i.key}: ${i.message}`).join('; ')}`,
    );
  }
}
export class PathContainmentError extends HarnessError {
  constructor(readonly path: string) {
    super('PATH_ESCAPE', `Path is not contained in its permitted root: ${path}`);
  }
}
export class RegistryError extends HarnessError {
  constructor(message = 'Invalid plugin registry') {
    super('REGISTRY_INVALID', message);
  }
}
export class ConsentRequiredError extends HarnessError {
  constructor(readonly plugin: string) {
    super(
      'CONSENT_REQUIRED',
      `Manifest for "${plugin}" changed since consent; perform a fresh install with --force`,
    );
  }
}
export class ManifestChangedError extends ConsentRequiredError {}
export class SettingsError extends HarnessError {
  constructor(message: string) {
    super('SETTINGS_INVALID', message);
  }
}

export class PolicyUnavailableError extends HarnessError {
  constructor(readonly failures: string[]) {
    super(
      'POLICY_UNAVAILABLE',
      `Enabled policy plugin failed; tool use blocked: ${failures.join('; ')}`,
    );
  }
}
