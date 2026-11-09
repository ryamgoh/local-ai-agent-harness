import { build } from 'esbuild';
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('.', import.meta.url));
const artifact = fileURLToPath(new URL('dist/guard.mjs', import.meta.url));
const result = await build({
  absWorkingDir: root,
  entryPoints: ['src/guard.mjs'],
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node22',
  outfile: 'dist/guard.mjs',
  write: false,
  banner: { js: "import { createRequire } from 'node:module'; const require = createRequire(import.meta.url);" },
});
const output = result.outputFiles[0].contents;
if (process.argv.includes('--check')) {
  if (!Buffer.from(output).equals(readFileSync(artifact))) {
    throw new Error('dist/guard.mjs is stale; run pnpm --filter guard build');
  }
  console.log('guard bundle is current');
} else {
  mkdirSync(dirname(artifact), { recursive: true });
  writeFileSync(artifact, output);
  console.log(`Built dist/guard.mjs (${output.length} bytes)`);
}
