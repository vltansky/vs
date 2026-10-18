import { serveStdio } from '@modelcontextprotocol/server/stdio';
import { createVsServer } from './server.ts';

serveStdio(() => createVsServer());
