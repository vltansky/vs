import { mkdtemp, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Client, InMemoryTransport } from '@modelcontextprotocol/client';
import { StdioClientTransport } from '@modelcontextprotocol/client/stdio';
import { describe, expect, it } from 'vitest';
import { createVsServer } from './server.ts';

async function connectedClient(root: string) {
  const server = createVsServer(root);
  const client = new Client({ name: 'vs-test', version: '1.0.0' });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);
  return { client, server };
}

describe('VS MCP App', () => {
  it('serves the bundled App through the plugin stdio command', async () => {
    const client = new Client({ name: 'vs-built-test', version: '1.0.0' });
    await client.connect(new StdioClientTransport({ command: 'node', args: ['mcp/dist/server.mjs'] }));
    try {
      expect((await client.listTools()).tools.map((tool) => tool.name)).toEqual(['vs.show-me', 'vs.eli5']);
      const view = await client.readResource({ uri: 'ui://vs/show-me' });
      expect('text' in view.contents[0] && view.contents[0].text).toContain('vs-artifact-frame');
    } finally {
      await client.close();
    }
  });

  it('registers both presentation tools and their HTML views', async () => {
    const root = await mkdtemp(join(tmpdir(), 'vs-mcp-'));
    const { client, server } = await connectedClient(root);
    try {
      const tools = await client.listTools();
      expect(tools.tools.map((tool) => [tool.name, tool._meta?.ui])).toEqual([
        ['vs.show-me', { resourceUri: 'ui://vs/show-me' }],
        ['vs.eli5', { resourceUri: 'ui://vs/eli5' }],
      ]);
      const view = await client.readResource({ uri: 'ui://vs/eli5' });
      expect(view.contents[0].mimeType).toBe('text/html;profile=mcp-app');
      expect('text' in view.contents[0] && view.contents[0].text).toContain('vs-artifact-frame');
    } finally {
      await client.close();
      await server.close();
    }
  });

  it('sends a saved HTMDX artifact to the view and rejects paths outside its root', async () => {
    const root = await mkdtemp(join(tmpdir(), 'vs-mcp-'));
    const artifact = join(root, 'example.html');
    const outside = join(await mkdtemp(join(tmpdir(), 'vs-mcp-outside-')), 'outside.html');
    await writeFile(artifact, '<!doctype html><script type="text/htmdx"># Example</script>');
    await writeFile(outside, '<!doctype html><script type="text/htmdx"># Outside</script>');
    await symlink(outside, join(root, 'escape.html'));
    const { client, server } = await connectedClient(root);
    try {
      const result = await client.callTool({ name: 'vs.eli5', arguments: { path: artifact, reviewQuestion: 'What changed?' } });
      expect(result.isError).not.toBe(true);
      expect(result.structuredContent).toMatchObject({
        artifactPath: artifact,
        skill: 'vs-eli5',
        reviewQuestion: 'What changed?',
        html: '<!doctype html><script type="text/htmdx"># Example</script>',
      });
      const denied = await client.callTool({ name: 'vs.eli5', arguments: { path: outside } });
      expect(denied.isError).toBe(true);
      const symlinkDenied = await client.callTool({ name: 'vs.eli5', arguments: { path: join(root, 'escape.html') } });
      expect(symlinkDenied.isError).toBe(true);
    } finally {
      await client.close();
      await server.close();
    }
  });
});
