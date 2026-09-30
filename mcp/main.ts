import { StdioServerTransport } from '@modelcontextprotocol/server/stdio';
import { createVsServer } from './server.ts';

await createVsServer().connect(new StdioServerTransport());
