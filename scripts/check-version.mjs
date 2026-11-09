import { assertVersions } from './version.mjs';

try {
  const version = await assertVersions(undefined, process.argv[2]);
  console.log(
    `Version check passed: root/core/CLI ${version}${process.argv[2] ? `, tag ${process.argv[2]}` : ''}`,
  );
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
