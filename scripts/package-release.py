#!/usr/bin/env python3
"""Package the verified checkout without dependencies, caches, state or credentials."""
from pathlib import Path
import os
import sys
import zipfile

root = Path(__file__).resolve().parents[1]
output = Path(sys.argv[1]) if len(sys.argv) > 1 else root.parent / 'local-ai-agent-harness-mvp.zip'
excluded = {'node_modules', '.git', 'coverage', '.venv', '__pycache__', '.pytest_cache', '.harness'}
credentials = [value.encode() for name in ('OPENROUTER_API_KEY', 'OPENAI_API_KEY') if (value := os.environ.get(name))]
files = []
for path in sorted(root.rglob('*')):
    relative = path.relative_to(root)
    if any(part in excluded for part in relative.parts):
        continue
    if path.name.endswith(('.tsbuildinfo', '.secrets.json')) or (path.name.startswith('.env') and path.name != '.env.example'):
        continue
    if not path.is_file():
        continue
    if path.is_symlink():
        raise RuntimeError(f'Release source contains an unexpected symlink: {relative}')
    if any(secret in path.read_bytes() for secret in credentials):
        raise RuntimeError(f'Credential found in release source: {relative}')
    files.append(path)
output.parent.mkdir(parents=True, exist_ok=True)
with zipfile.ZipFile(output, 'w', compression=zipfile.ZIP_DEFLATED, compresslevel=9) as archive:
    for path in files:
        archive.write(path, 'harness/' + path.relative_to(root).as_posix())
with zipfile.ZipFile(output) as archive:
    assert archive.testzip() is None
    expected = {'harness/README.md', 'harness/VERIFICATION.md', 'harness/packages/core/src/host.ts', 'harness/packages/cli/src/index.ts', 'harness/plugins/notes/server.py', 'harness/plugins/guard/dist/guard.mjs', 'harness/pnpm-lock.yaml'}
    assert expected.issubset(set(archive.namelist()))
print(f'{output} — {len(files)} files, {output.stat().st_size} bytes; ZIP integrity passed; no connected credential matches.')
