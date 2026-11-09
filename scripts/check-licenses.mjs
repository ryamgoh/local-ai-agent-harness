import { execFileSync } from 'node:child_process';
const inventory = JSON.parse(
  execFileSync('pnpm', ['licenses', 'list', '--prod', '--json'], { encoding: 'utf8' }),
);
const allowed = new Set([
  'Apache-2.0',
  'MIT',
  'BSD-2-Clause',
  'BSD-3-Clause',
  'ISC',
  '(AFL-2.1 OR BSD-3-Clause)',
  '(MIT OR CC0-1.0)',
]);
const denied = Object.entries(inventory).filter(([license]) => !allowed.has(license));
if (denied.length) {
  for (const [license, packages] of denied)
    console.error(`Unapproved license ${license}: ${packages.map((p) => p.name).join(', ')}`);
  process.exitCode = 1;
} else
  console.log(
    `Approved licenses for ${Object.values(inventory).reduce((n, packages) => n + packages.length, 0)} production dependencies. Dual-licensed packages use their BSD-3-Clause or MIT option.`,
  );
