import { McpServer } from '@modelcontextprotocol/server';
import { StdioServerTransport } from '@modelcontextprotocol/server/stdio';
import { z } from 'zod';
const server = new McpServer({ name: 'crash-fixture', version: '1.0.0' });
server.registerTool('boom', { inputSchema: z.object({}) }, () => {
  process.exit(1);
});
await server.connect(new StdioServerTransport());
