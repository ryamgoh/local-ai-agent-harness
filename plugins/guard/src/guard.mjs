import {
  readFileSync, mkdirSync, appendFileSync, openSync, closeSync,
  fstatSync, fchmodSync, constants, realpathSync,
} from 'node:fs';
import { join, resolve, dirname, basename, normalize } from 'node:path';
import { createHash } from 'node:crypto';
import { lintSource } from '@secretlint/core';
import { rules } from '@secretlint/secretlint-rule-preset-recommend';
import picomatch from 'picomatch';

const REDACTED = '[REDACTED]';
const defaults = {
  mode: 'enforce', deny: [], ask: ['*.delete'], askOnDestructive: true,
  redact: true, denyPaths: ['**/.env', '**/*.pem'],
  secretPatterns: ['sk-[A-Za-z0-9_-]{8,}', 'AKIA[0-9A-Z]{16}'],
};
// Secretlint 13 calls its comment-directive implementation filter-comments.
const scannerRules = rules
  .filter((rule) => !['@secretlint/secretlint-rule-comment-directive',
    '@secretlint/secretlint-rule-filter-comments'].includes(rule.meta.id))
  .map((rule) => ({ id: rule.meta.id, rule, severity: 'error', options: {} }));
const globOptions = { dot: true, nonegate: true, noextglob: true };

function loadConfig(raw) {
  if (!raw || Array.isArray(raw) || typeof raw !== 'object') throw new Error('Invalid configuration');
  const config = { ...defaults, ...raw };
  if (!['enforce', 'monitor'].includes(config.mode)) throw new Error('Invalid configuration');
  for (const key of ['redact', 'askOnDestructive']) {
    if (typeof config[key] !== 'boolean') throw new Error('Invalid configuration');
  }
  for (const key of ['deny', 'ask', 'denyPaths', 'secretPatterns']) {
    if (!Array.isArray(config[key]) || config[key].some((v) => typeof v !== 'string')) throw new Error('Invalid configuration');
  }
  // Compile before any policy evaluation, including when redaction is disabled.
  return { ...config, patterns: config.secretPatterns.map((pattern) => new RegExp(pattern, 'g')) };
}

function matches(patterns, value) {
  return patterns.some((pattern) => picomatch(pattern, globOptions)(value));
}

function pathArguments(value) {
  if (Array.isArray(value)) return value.flatMap(pathArguments);
  if (!value || typeof value !== 'object') return [];
  return Object.entries(value).flatMap(([key, item]) =>
    key === 'path' && typeof item === 'string' ? [item.replaceAll('\\', '/')] : pathArguments(item));
}

function pathCandidates(path, cwd) {
  const candidates = [path, normalize(path).replaceAll('\\', '/')];
  // Resolve existing symlinks, even for a new file below an existing ancestor.
  let parent = resolve(cwd, path);
  const tail = [];
  while (true) {
    try { candidates.push(join(realpathSync(parent), ...tail).replaceAll('\\', '/')); break; }
    catch {
      const next = dirname(parent);
      if (next === parent) break;
      tail.unshift(basename(parent)); parent = next;
    }
  }
  return candidates;
}

function policy(payload, config) {
  const reasons = [];
  const tool = payload._harness?.tool ?? '';
  let decision = 'allow';
  if (matches(config.deny, tool)) { decision = 'deny'; reasons.push('guard: denied by tool policy'); }
  if (pathArguments(payload.tool_input).some((path) =>
    pathCandidates(path, payload.cwd ?? process.cwd()).some((candidate) => matches(config.denyPaths, candidate)))) {
    decision = 'deny'; reasons.push('guard: denied by path policy');
  }
  if (decision !== 'deny') {
    if (matches(config.ask, tool)) { decision = 'ask'; reasons.push('guard: approval required by tool policy'); }
    if (config.askOnDestructive && payload._harness?.annotations?.destructiveHint === true) {
      decision = 'ask'; reasons.push('guard: approval required for destructive tool');
    }
  }
  return { decision, reasons };
}

async function redactString(text, config) {
  const scanned = await lintSource({
    source: { content: text, filePath: '/virtual/guard.txt', contentType: 'text' },
    options: { config: { rules: scannerRules }, noPhysicFilePath: true, maskSecrets: true },
  });
  const ranges = [];
  for (const message of scanned.messages) {
    const range = message.range;
    // Only GitHub token ranges have been independently validated. Other rules
    // may report labels or partial ranges: redact the entire value on any hit.
    if (message.ruleId !== '@secretlint/secretlint-rule-github'
      || !Array.isArray(range) || range.length !== 2
      || !Number.isInteger(range[0]) || !Number.isInteger(range[1])
      || range[0] < 0 || range[1] <= range[0] || range[1] > text.length
      || !/^(?:gh[pousr]_[A-Za-z0-9_]+|github_pat_[A-Za-z0-9_]+)$/.test(text.slice(...range))) {
      return { value: REDACTED, count: 1 };
    }
    ranges.push(range);
  }
  for (const pattern of config.patterns) {
    pattern.lastIndex = 0;
    for (const match of text.matchAll(pattern)) {
      if (match[0].length > 0) ranges.push([match.index, match.index + match[0].length]);
    }
  }
  const merged = [];
  for (const range of ranges.sort((a, b) => a[0] - b[0] || a[1] - b[1])) {
    const previous = merged.at(-1);
    if (previous && range[0] <= previous[1]) previous[1] = Math.max(previous[1], range[1]);
    else merged.push([...range]);
  }
  let value = text;
  for (const [start, end] of [...merged].reverse()) value = value.slice(0, start) + REDACTED + value.slice(end);
  return { value, count: merged.length };
}

async function redactValue(value, config) {
  if (typeof value === 'string') return redactString(value, config);
  if (!value || typeof value !== 'object') return { value, count: 0 };
  let count = 0;
  if (Array.isArray(value)) {
    const output = [];
    for (const item of value) {
      const result = await redactValue(item, config);
      output.push(result.value); count += result.count;
    }
    return { value: output, count };
  }
  const entries = [];
  for (const [key, item] of Object.entries(value)) {
    const result = await redactValue(item, config);
    const redactedKey = await redactString(key, config);
    entries.push([redactedKey.value, result.value]); count += result.count + redactedKey.count;
  }
  // Object.fromEntries preserves __proto__ as an own key, without pollution.
  return { value: Object.fromEntries(entries), count };
}

const hashMetadata = (value) => 'sha256:' + createHash('sha256').update(String(value ?? '')).digest('hex');

async function audit(payload, decision, reasons, redactions, config) {
  const directory = process.env.HARNESS_PLUGIN_DATA;
  if (!directory) throw new Error('Missing audit directory');
  mkdirSync(directory, { recursive: true, mode: 0o700 });
  // Audit never stores arguments, responses, scanner messages, paths, or config.
  // Invalid scanner config uses hashes, not a potentially incomplete sanitizer.
  const session = config ? (await redactString(String(payload.session_id ?? ''), config)).value : hashMetadata(payload.session_id);
  const tool = config ? (await redactString(String(payload._harness?.tool ?? ''), config)).value : hashMetadata(payload._harness?.tool);
  const fd = openSync(join(directory, 'audit.jsonl'), constants.O_WRONLY | constants.O_CREAT | constants.O_APPEND | constants.O_NOFOLLOW | constants.O_NONBLOCK, 0o600);
  try {
    if (!fstatSync(fd).isFile()) throw new Error('Invalid audit file');
    fchmodSync(fd, 0o600);
    appendFileSync(fd, JSON.stringify({
      ts: new Date().toISOString(), session, event: payload.hook_event_name,
      tool, decision, reasons, redactions,
    }) + '\n');
  } finally { closeSync(fd); }
}

function emit(output) {
  process.stdout.write(JSON.stringify({ hookSpecificOutput: output }) + '\n');
}

async function main() {
  let payload;
  let rawConfig;
  try {
    payload = JSON.parse(readFileSync(0, 'utf8'));
    rawConfig = JSON.parse(process.env.HARNESS_PLUGIN_CONFIG ?? '{}');
    const config = loadConfig(rawConfig);
    const event = payload.hook_event_name;
    if (!['PreToolUse', 'PostToolUse'].includes(event)) throw new Error('Unsupported event');
    const original = event === 'PreToolUse' ? policy(payload, config) : { decision: 'allow', reasons: [] };
    const source = event === 'PreToolUse' ? payload.tool_input : payload.tool_response;
    const redaction = config.redact ? await redactValue(source, config) : { value: source, count: 0 };
    await audit(payload, original.decision, original.reasons, redaction.count, config);
    if (event === 'PreToolUse' && original.decision === 'deny' && config.mode === 'enforce') {
      process.stderr.write(original.reasons.join('; ') + '\n');
      process.exitCode = 2;
      return;
    }
    const output = { hookEventName: event };
    if (event === 'PreToolUse') {
      output.permissionDecision = config.mode === 'monitor' ? 'allow' : original.decision;
      if (original.reasons.length && config.mode !== 'monitor') output.permissionDecisionReason = original.reasons.join('; ');
      if (redaction.count && config.mode !== 'monitor') output.updatedInput = redaction.value;
    } else if (redaction.count && config.mode !== 'monitor') output.updatedToolOutput = redaction.value;
    emit(output);
  } catch {
    // Parser, regexp and scanner errors may contain secrets: never print them.
    const reason = 'guard: configuration or processing failure';
    const event = payload?.hook_event_name;
    if (['PreToolUse', 'PostToolUse'].includes(event)) {
      try { await audit(payload, 'deny', [reason], 0, null); } catch { /* No unsafe logging on audit failure. */ }
      if (rawConfig?.mode === 'monitor') {
        emit({ hookEventName: event, ...(event === 'PreToolUse' ? { permissionDecision: 'allow' } : {}) });
        return;
      }
      if (event === 'PostToolUse') {
        // Fail closed on output scanning failure without returning raw content.
        emit({ hookEventName: event, updatedToolOutput: {
          isError: true, content: [{ type: 'text', text: REDACTED }],
        } });
        return;
      }
    }
    process.stderr.write(reason + '\n');
    process.exitCode = 2;
  }
}

await main();
