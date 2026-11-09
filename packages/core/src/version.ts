import { readFileSync } from 'node:fs';

export function getHostVersion(): string {
  const metadata: unknown = JSON.parse(
    readFileSync(new URL('../package.json', import.meta.url), 'utf8'),
  );
  if (
    !metadata ||
    typeof metadata !== 'object' ||
    !('version' in metadata) ||
    typeof metadata.version !== 'string'
  )
    throw new Error('Host package metadata is missing a version');
  return metadata.version;
}
