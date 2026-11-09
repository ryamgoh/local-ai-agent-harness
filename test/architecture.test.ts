import { expect, test } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
function files(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? files(join(dir, e.name)) : [join(dir, e.name)],
  );
}
test('SPEC #10 core and CLI contain no plugin-specific code or imports', () => {
  for (const root of ['packages/core/src', 'packages/cli/src'])
    for (const file of files(root).filter((f) => f.endsWith('.ts'))) {
      const source = readFileSync(file, 'utf8');
      expect(source, file).not.toMatch(/\b(notes|guard)\b/i);
      expect(source, file).not.toMatch(/(?:from|import\s*\()[\s'"]+[^'"\n]*plugins\//);
    }
});
