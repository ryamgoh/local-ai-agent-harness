import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync, copyFileSync, symlinkSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { generateKeyPairSync } from 'node:crypto';
import { fileURLToPath } from 'node:url';

const hook = fileURLToPath(new URL('../dist/guard.mjs', import.meta.url));
const out = (result) => result.hookSpecificOutput;
const before = (input = {}, tool = 'demo.write', annotations = {}) => ({
  session_id: 'test-session', cwd: '/tmp', hook_event_name: 'PreToolUse',
  tool_name: 'mcp__demo__write', tool_use_id: 'call-1', tool_input: input,
  _harness: { protocol: 1, tool, plugin: 'demo', annotations, interactive: false },
});
const after = (response) => ({ ...before(), hook_event_name: 'PostToolUse', tool_response: response });
function runRaw(payload, config = {}, setup = () => hook) {
  const home = mkdtempSync(join(tmpdir(), 'guard-test-'));
  try {
    const script = setup(home, payload);
    const preload = join(home, 'no-network.mjs');
    writeFileSync(preload, `
      import net from 'node:net'; import tls from 'node:tls';
      import http from 'node:http'; import https from 'node:https';
      import dgram from 'node:dgram'; import dns from 'node:dns';
      import { syncBuiltinESMExports } from 'node:module';
      const deny = () => { throw new Error('Plugin tests must not use the network'); };
      net.connect = net.createConnection = net.Socket.prototype.connect = deny;
      tls.connect = http.request = http.get = https.request = https.get = deny;
      dgram.createSocket = dns.lookup = dns.resolve = deny; globalThis.fetch = deny;
      syncBuiltinESMExports();
    `);
    const raw = spawnSync(process.execPath, ['--import', preload, script], {
      input: JSON.stringify(payload), encoding: 'utf8', timeout: 5000,
      env: { PATH: process.env.PATH, HOME: home, HARNESS_HOME: home,
        HARNESS_PLUGIN_DATA: join(home, 'data'), HARNESS_PLUGIN_CONFIG: JSON.stringify(config), HARNESS_PROTOCOL: '1' },
    });
    let audit = [];
    try { audit = readFileSync(join(home, 'data/audit.jsonl'), 'utf8').trim().split('\n').map(JSON.parse); }
    catch (error) { if (error.code !== 'ENOENT') throw error; }
    const auditMode = audit.length ? statSync(join(home, 'data/audit.jsonl')).mode & 0o777 : undefined;
    return { ...raw, exitCode: raw.status, result: raw.stdout.trim() ? JSON.parse(raw.stdout) : undefined, audit, auditMode };
  } finally { rmSync(home, { recursive: true, force: true }); }
}
function run(payload, config) {
  const raw = runRaw(payload, config);
  assert.equal(raw.error, undefined);
  assert.equal(raw.exitCode, 0, raw.stderr);
  assert.equal(raw.audit.length, 1);
  return raw.result;
}

test('redacts secrets in PreToolUse input', () => {
  assert.equal(out(run(before({ content: 'k sk-abcdef123456' }))).updatedInput.content, 'k [REDACTED]');
});
test('redacts a GitHub token found by secretlint', () => {
  assert.equal(out(run(before({ content: 'k ghp_' + 'a'.repeat(36) }))).updatedInput.content, 'k [REDACTED]');
});
test('a secretlint-disable comment cannot switch scanning off', () => {
  assert.match(out(run(before({ content: '// secretlint-disable\nghp_' + 'a'.repeat(36) }))).updatedInput.content, /\[REDACTED\]/);
});
test('deny pattern exits 2 with a secret-free reason', () => {
  const raw = runRaw(before({}, 'notes.write'), { deny: ['notes.write'] });
  assert.equal(raw.exitCode, 2);
  assert.match(raw.stderr, /denied/i);
  assert.equal(raw.audit[0].decision, 'deny');
});
test('destructiveHint asks when askOnDestructive', () => {
  assert.equal(out(run(before({}, 'x.rm', { destructiveHint: true }))).permissionDecision, 'ask');
});
test('monitor mode allows but audits the original deny decision', () => {
  const raw = runRaw(before(), { mode: 'monitor', deny: ['**'] });
  assert.equal(raw.exitCode, 0);
  assert.equal(out(raw.result).permissionDecision, 'allow');
  assert.equal(raw.audit.length, 1);
  assert.equal(raw.audit[0].decision, 'deny');
});
test('redacts secrets in PostToolUse output', () => {
  const response = { isError: false, content: [{ type: 'text', text: 'token sk-abcdef123456' }] };
  assert.equal(out(run(after(response))).updatedToolOutput.content[0].text, 'token [REDACTED]');
});

test('tool deny wins over ask and annotations without logging input or secret-bearing reasons', () => {
  const secret = 'sk-abcdef123456';
  const raw = runRaw(before({ path: `private/${secret}.pem`, content: 'private content' }, `demo.${secret}`, { destructiveHint: true }), { deny: ['**'], ask: ['**'] });
  assert.equal(raw.exitCode, 2);
  assert.equal(raw.audit[0].decision, 'deny');
  const publicData = JSON.stringify(raw.audit) + raw.stderr + raw.stdout;
  assert.ok(!publicData.includes(secret));
  assert.ok(!publicData.includes('private content'));
  assert.ok(!publicData.includes('private/'));
  assert.deepEqual(Object.keys(raw.audit[0]).sort(), ['ts', 'session', 'event', 'tool', 'decision', 'reasons', 'redactions'].sort());
});
test('denyPaths applies recursively, to hidden paths and Windows separators', () => {
  for (const path of ['.env', 'nested/.env', 'keys/private.pem', 'keys\\private.pem']) {
    const raw = runRaw(before({ batch: [{ nested: { path } }] }));
    assert.equal(raw.exitCode, 2, path);
    assert.deepEqual(raw.audit[0].reasons, ['guard: denied by path policy']);
  }
});
test('ask globs use qualified names, not the model-facing tool name', () => {
  assert.equal(out(run(before({}, 'demo.write'), { ask: ['demo.*'] })).permissionDecision, 'ask');
  assert.equal(out(run(before({}, 'demo.write'), { ask: ['mcp__demo__*'] })).permissionDecision, 'allow');
  assert.equal(out(run(before({}, 'demo.delete'))).permissionDecision, 'ask');
});
test('askOnDestructive=false ignores annotations', () => {
  assert.equal(out(run(before({}, 'demo.remove', { destructiveHint: true }), { askOnDestructive: false })).permissionDecision, 'allow');
});
test('configured secret regexes replace repeated, nested and overlapping matches', () => {
  const input = { nested: [{ value: 'token=CUSTOM-123 token=CUSTOM-123', number: 4, nil: null, flag: false }], other: 'CUSTOM-123' };
  const raw = runRaw(before(input), { secretPatterns: ['CUSTOM-[0-9]+', 'CUSTOM-123'] });
  assert.deepEqual(out(raw.result).updatedInput, {
    nested: [{ value: 'token=[REDACTED] token=[REDACTED]', number: 4, nil: null, flag: false }], other: '[REDACTED]',
  });
  assert.equal(raw.audit[0].redactions, 3);
});
test('zero-width regexes terminate and do not erase harmless values', () => {
  const result = out(run(before({ value: 'safe' }), { secretPatterns: ['(?:)'] }));
  assert.equal(result.updatedInput, undefined);
});
test('unvalidated secretlint ranges redact the whole value', () => {
  const { privateKey } = generateKeyPairSync('rsa', { modulusLength: 1024,
    privateKeyEncoding: { type: 'pkcs1', format: 'pem' },
    publicKeyEncoding: { type: 'pkcs1', format: 'pem' } });
  const content = 'prefix\n' + privateKey + '\nsuffix';
  assert.equal(out(run(before({ content }))).updatedInput.content, '[REDACTED]');
});
test('redact=false does not modify values but still keeps audit content-free', () => {
  const raw = runRaw(before({ content: 'sk-abcdef123456' }), { redact: false });
  assert.equal(out(raw.result).updatedInput, undefined);
  assert.equal(raw.audit[0].redactions, 0);
  assert.ok(!JSON.stringify(raw.audit).includes('sk-abcdef123456'));
});
test('PostToolUse redacts error results and structuredContent while preserving shape', () => {
  const raw = runRaw(after({ isError: true, content: [{ type: 'text', text: 'sk-abcdef123456' }], structuredContent: { nested: ['sk-abcdef123456', 7] } }));
  assert.deepEqual(out(raw.result).updatedToolOutput, { isError: true, content: [{ type: 'text', text: '[REDACTED]' }], structuredContent: { nested: ['[REDACTED]', 7] } });
  assert.equal(raw.audit[0].event, 'PostToolUse');
  assert.equal(raw.audit[0].redactions, 2);
});
test('monitor records ask and detections without enforcing or rewriting', () => {
  const raw = runRaw(before({ content: 'sk-abcdef123456' }, 'demo.delete'), { mode: 'monitor' });
  assert.equal(out(raw.result).permissionDecision, 'allow');
  assert.equal(out(raw.result).updatedInput, undefined);
  assert.equal(raw.audit[0].decision, 'ask');
  assert.equal(raw.audit[0].redactions, 1);
});
test('invalid regex configuration fails closed without leaking regex or content and is audited', () => {
  const secret = 'sk-abcdef123456';
  const raw = runRaw(before({ content: secret }), { secretPatterns: [`[${secret}`] });
  assert.equal(raw.exitCode, 2);
  assert.equal(raw.audit.length, 1);
  assert.equal(raw.audit[0].decision, 'deny');
  assert.ok(!(raw.stdout + raw.stderr + JSON.stringify(raw.audit)).includes(secret));
});
test('monitor always allows even when a configured regex is invalid, auditing original denial', () => {
  const raw = runRaw(before(), { mode: 'monitor', secretPatterns: ['['] });
  assert.equal(raw.exitCode, 0);
  assert.equal(out(raw.result).permissionDecision, 'allow');
  assert.equal(raw.audit[0].decision, 'deny');
});
test('own configuration never appears in hook output or audit', () => {
  const raw = runRaw(before({ content: 'safe' }), { deny: ['PRIVATE-CONFIG-MARKER'], secretPatterns: ['PRIVATE-CONFIG-MARKER'] });
  assert.ok(!(raw.stdout + raw.stderr + JSON.stringify(raw.audit)).includes('PRIVATE-CONFIG-MARKER'));
});
test('secrets in session metadata are redacted even with redact=false', () => {
  const raw = runRaw({ ...before(), session_id: 'sk-abcdef123456' }, { redact: false });
  assert.equal(raw.audit[0].session, '[REDACTED]');
});
test('secret-bearing object keys are redacted without prototype mutation', () => {
  const input = JSON.parse('{"sk-abcdef123456":"safe","__proto__":{"content":"sk-abcdef123456"}}');
  const result = out(run(before(input))).updatedInput;
  assert.equal(result['[REDACTED]'], 'safe');
  assert.deepEqual(result.__proto__, { content: '[REDACTED]' });
  assert.ok(!JSON.stringify(result).includes('sk-abcdef123456'));
});

test('standalone bundle runs outside the workspace without node_modules', () => {
  const raw = runRaw(before({ content: 'ghp_' + 'a'.repeat(36) }), {}, (home) => {
    const script = join(home, 'guard.mjs'); copyFileSync(hook, script); return script;
  });
  assert.equal(raw.exitCode, 0, raw.stderr);
  assert.equal(out(raw.result).updatedInput.content, '[REDACTED]');
  assert.equal(raw.auditMode, 0o600);
});
test('symlinks cannot disguise denied path targets', () => {
  const raw = runRaw(before({ path: 'innocent.md' }), {}, (home, payload) => {
    const sensitive = join(home, '.env'); writeFileSync(sensitive, 'secret');
    symlinkSync(sensitive, join(home, 'innocent.md')); payload.cwd = home; return hook;
  });
  assert.equal(raw.exitCode, 2);
  assert.deepEqual(raw.audit[0].reasons, ['guard: denied by path policy']);
});
test('benign additive annotations alone do not ask', () => {
  assert.equal(out(run(before({}, 'demo.append', { readOnlyHint: false, destructiveHint: false }))).permissionDecision, 'allow');
});
test('AWS default pattern redacts known example credentials', () => {
  assert.equal(out(run(before({ value: 'key AKIAIOSFODNN7EXAMPLE' }))).updatedInput.value, 'key [REDACTED]');
});
test('invalid regex on PostToolUse replaces the result with a safe error', () => {
  const raw = runRaw(after({ isError: false, content: [{ type: 'text', text: 'sk-abcdef123456' }] }), { secretPatterns: ['['] });
  assert.equal(raw.exitCode, 0);
  assert.deepEqual(out(raw.result).updatedToolOutput, { isError: true, content: [{ type: 'text', text: '[REDACTED]' }] });
  assert.equal(raw.audit[0].decision, 'deny');
  assert.ok(!(raw.stdout + raw.stderr + JSON.stringify(raw.audit)).includes('sk-abcdef123456'));
});
test('monitor PostToolUse leaves outputs untouched but audits detections', () => {
  const raw = runRaw(after({ isError: false, content: [{ type: 'text', text: 'sk-abcdef123456' }] }), { mode: 'monitor' });
  assert.equal(out(raw.result).updatedToolOutput, undefined);
  assert.equal(raw.audit[0].redactions, 1);
});

test('audit symlinks fail closed without writing to their targets', () => {
  const raw = runRaw(before({ content: 'sk-abcdef123456' }), {}, (home) => {
    const target = join(home, 'outside.jsonl'); writeFileSync(target, '{"original":true}\n');
    const directory = join(home, 'data');
    mkdirSync(directory); symlinkSync(target, join(directory, 'audit.jsonl'));
    return hook;
  });
  assert.equal(raw.exitCode, 2);
  assert.match(raw.stderr, /processing failure/);
  assert.ok(!raw.stdout.includes('sk-abcdef123456'));
  assert.deepEqual(raw.audit, [{ original: true }]);
});
test('audit appends and tightens existing file permissions', () => {
  const raw = runRaw(before(), {}, (home) => {
    const directory = join(home, 'data'); mkdirSync(directory);
    writeFileSync(join(directory, 'audit.jsonl'), JSON.stringify({ previous: true }) + '\n', { mode: 0o644 });
    return hook;
  });
  assert.equal(raw.exitCode, 0);
  assert.deepEqual(raw.audit[0], { previous: true });
  assert.equal(raw.audit.length, 2);
  assert.equal(raw.auditMode, 0o600);
});
