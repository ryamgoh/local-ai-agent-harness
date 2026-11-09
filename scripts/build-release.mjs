import { build } from 'esbuild';
import { mkdir, mkdtemp, readFile, writeFile, copyFile, cp, chmod, rm } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { createHash } from 'node:crypto';
import { assertVersions, projectRoot } from './version.mjs';

const exec = promisify(execFile);
const version = await assertVersions();
const output = resolve(projectRoot, 'release');
const stage = await mkdtemp(join(tmpdir(), 'harness-release-'));
console.log(`Building installable release ${version}`);
try {
  await mkdir(join(stage, 'dist'), { recursive: true });
  await mkdir(output, { recursive: true });
  await build({
    absWorkingDir: projectRoot,
    entryPoints: ['packages/cli/src/index.ts'],
    outfile: join(stage, 'dist/harness.mjs'),
    bundle: true,
    packages: 'external',
    alias: { '@harness/core': join(projectRoot, 'packages/core/src/index.ts') },
    platform: 'node',
    target: 'node22',
    format: 'esm',
    sourcemap: false,
    legalComments: 'none',
  });
  await chmod(join(stage, 'dist/harness.mjs'), 0o755);
  const dependencies = {};
  for (const dir of ['packages/core', 'packages/cli']) {
    const pkg = JSON.parse(await readFile(join(projectRoot, dir, 'package.json'), 'utf8'));
    for (const name of Object.keys(pkg.dependencies ?? {})) {
      if (name === '@harness/core') continue;
      const installed = JSON.parse(
        await readFile(join(projectRoot, dir, 'node_modules', name, 'package.json'), 'utf8'),
      );
      dependencies[name] = installed.version;
    }
  }
  const metadata = {
    name: 'local-ai-agent-harness',
    version,
    private: true,
    description: 'Local AI agent harness with external MCP tool and command-hook plugins',
    type: 'module',
    license: 'UNLICENSED',
    engines: { node: '>=22.22.2' },
    bin: { harness: 'dist/harness.mjs' },
    files: ['dist', 'plugins', 'docs', 'schema', 'README.md', 'npm-shrinkwrap.json'],
    repository: { type: 'git', url: 'git+https://github.com/ryamgoh/local-ai-agent-harness.git' },
    dependencies,
  };
  await writeFile(join(stage, 'package.json'), JSON.stringify(metadata, null, 2) + '\n');
  await copyFile(join(projectRoot, 'README.md'), join(stage, 'README.md'));
  await cp(join(projectRoot, 'docs'), join(stage, 'docs'), { recursive: true });
  await cp(join(projectRoot, 'schema'), join(stage, 'schema'), { recursive: true });
  for (const [plugin, files] of Object.entries({
    notes: ['harness-plugin.json', 'README.md', 'server.py'],
    guard: ['harness-plugin.json', 'README.md', 'dist/guard.mjs'],
  })) {
    for (const file of files) {
      const destination = join(stage, 'plugins', plugin, file);
      await mkdir(resolve(destination, '..'), { recursive: true });
      await copyFile(join(projectRoot, 'plugins', plugin, file), destination);
    }
  }
  console.log('Locking runtime dependencies for the release tarball (no lifecycle scripts)');
  await exec(
    'npm',
    ['install', '--package-lock-only', '--ignore-scripts', '--no-audit', '--no-fund'],
    { cwd: stage, maxBuffer: 4 * 1024 * 1024 },
  );
  await exec('npm', ['shrinkwrap', '--ignore-scripts'], { cwd: stage });
  await exec('npm', ['audit', '--omit=dev', '--audit-level=high'], {
    cwd: stage,
    maxBuffer: 4 * 1024 * 1024,
  });
  const { stdout } = await exec(
    'npm',
    ['pack', '--ignore-scripts', '--json', '--pack-destination', output],
    { cwd: stage, maxBuffer: 4 * 1024 * 1024 },
  );
  const [packed] = JSON.parse(stdout);
  const tarball = join(output, packed.filename);
  if (packed.filename !== `local-ai-agent-harness-${version}.tgz`)
    throw new Error('Unexpected npm release artifact name');
  const source = join(output, `local-ai-agent-harness-${version}-source.zip`);
  const packedSource = await exec('python3', ['scripts/package-release.py', source], {
    cwd: projectRoot,
    maxBuffer: 4 * 1024 * 1024,
  });
  console.log(packedSource.stdout.trim());
  const checksums = await Promise.all(
    [tarball, source].map(async (path) => {
      const name = path.slice(output.length + 1);
      return `${createHash('sha256')
        .update(await readFile(path))
        .digest('hex')}  ${name}`;
    }),
  );
  await writeFile(join(output, 'SHA256SUMS'), checksums.join('\n') + '\n');
  console.log(
    `Release ready: ${tarball} (${packed.size} bytes), source ZIP and SHA256SUMS. Nothing was published.`,
  );
} finally {
  await rm(stage, { recursive: true, force: true });
}
