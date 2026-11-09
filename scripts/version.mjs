import { readFile, writeFile, access } from 'node:fs/promises';
import { constants } from 'node:fs';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const semver = createRequire(new URL('../packages/core/package.json', import.meta.url))('semver');
export const projectRoot = fileURLToPath(new URL('..', import.meta.url));
const manifests = ['package.json', 'packages/core/package.json', 'packages/cli/package.json'];

function requireVersion(version) {
  if (typeof version !== 'string' || semver.valid(version) !== version)
    throw new Error('Expected a canonical semantic version, for example 0.2.0 or 0.2.0-beta.1');
}
async function readManifests(root) {
  return Promise.all(
    manifests.map(async (name) => {
      const path = resolve(root, name);
      const text = await readFile(path, 'utf8');
      const metadata = JSON.parse(text);
      requireVersion(metadata.version);
      return { path, text, metadata };
    }),
  );
}
export async function assertVersions(root = projectRoot, tag) {
  const values = await readManifests(root);
  const version = values[0].metadata.version;
  if (values.some(({ metadata }) => metadata.version !== version))
    throw new Error('Host package versions must match (root, core, CLI)');
  if (tag !== undefined && tag !== `v${version}`)
    throw new Error(`Release tag ${tag} does not match package version v${version}`);
  return version;
}
export async function setVersion(root, version) {
  requireVersion(version);
  const values = await readManifests(root);
  await Promise.all(values.map(({ path }) => access(path, constants.W_OK)));
  try {
    for (const { path, metadata } of values)
      await writeFile(path, JSON.stringify({ ...metadata, version }, null, 2) + '\n');
  } catch (error) {
    await Promise.all(values.map(({ path, text }) => writeFile(path, text)));
    throw error;
  }
  return version;
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    if (process.argv.length !== 3) throw new Error('Usage: node scripts/version.mjs <semver>');
    const version = await setVersion(projectRoot, process.argv[2]);
    console.log(
      `Set root/core/CLI version to ${version}. Update CHANGELOG.md and verify before tagging v${version}.`,
    );
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
