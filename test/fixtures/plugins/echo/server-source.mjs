import { McpServer } from '@modelcontextprotocol/server';
import { StdioServerTransport } from '@modelcontextprotocol/server/stdio';
import { z } from 'zod';
const server = new McpServer({ name: 'fixture-echo', version: '1.0.0' });
server.registerTool(
  'echo',
  {
    description: 'Return text',
    inputSchema: z.object({ text: z.string() }),
    annotations: { readOnlyHint: true, destructiveHint: false },
  },
  ({ text }) => ({ content: [{ type: 'text', text }], structuredContent: { text } }),
);
server.registerTool(
  'fail',
  {
    description: 'Return an expected error',
    inputSchema: z.object({}),
    annotations: { readOnlyHint: true },
  },
  () => ({ isError: true, content: [{ type: 'text', text: 'expected failure' }] }),
);
console.error('fixture ready');
await server.connect(new StdioServerTransport());
