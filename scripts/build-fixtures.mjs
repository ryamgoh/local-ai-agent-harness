import { build } from 'esbuild';
const banner =
  "import { createRequire } from 'node:module'; const require = createRequire(import.meta.url);";
for (const [source, target] of [
  ['server-source.mjs', 'server.mjs'],
  ['crash-source.mjs', 'crash.mjs'],
]) {
  await build({
    entryPoints: [`test/fixtures/plugins/echo/${source}`],
    outfile: `test/fixtures/plugins/echo/${target}`,
    bundle: true,
    platform: 'node',
    format: 'esm',
    target: 'node22',
    banner: { js: banner },
    minify: true,
  });
}
