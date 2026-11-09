import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { format, resolveConfig } from 'prettier';
import { manifestJsonSchema } from '../packages/core/src/manifest/schema.js';

const directory = new URL('../schema/', import.meta.url);
await mkdir(fileURLToPath(directory), { recursive: true });
const target = new URL('plugin-v1.json', directory);
const options = await resolveConfig(fileURLToPath(target));
await writeFile(
  target,
  await format(JSON.stringify(manifestJsonSchema()), { ...options, parser: 'json' }),
);
