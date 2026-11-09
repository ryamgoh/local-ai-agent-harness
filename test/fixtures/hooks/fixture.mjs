let raw = '';
for await (const chunk of process.stdin) raw += chunk;
const p = JSON.parse(raw);
const mode = process.argv[2];
if (mode === 'hang') {
  setInterval(() => {}, 1000);
} else if (mode === 'deny') {
  console.error('nope');
  process.exit(2);
} else if (mode === 'garbage') console.log('not json');
else if (mode === 'allow') {
  /* empty output means no opinion */
} else if (mode === 'after')
  console.log(
    JSON.stringify({
      hookSpecificOutput: {
        hookEventName: 'PostToolUse',
        updatedToolOutput: { isError: false, content: [{ type: 'text', text: '[CLEAN]' }] },
        additionalContext: 'extra context',
      },
    }),
  );
else {
  const o = { hookEventName: p.hook_event_name };
  if (mode === 'ask' || mode === 'defer' || mode === 'weird') {
    o.permissionDecision = mode === 'weird' ? 'unknown' : mode;
    o.permissionDecisionReason = 'needs approval';
  }
  if (mode === 'rewrite')
    o.updatedInput = { ...p.tool_input, text: p.tool_input.text.toUpperCase() };
  if (mode === 'invalid-rewrite') o.updatedInput = { text: 42 };
  if (mode === 'bad-output') o.updatedToolOutput = { content: 'not an array' };
  console.log(JSON.stringify({ hookSpecificOutput: o }));
}
