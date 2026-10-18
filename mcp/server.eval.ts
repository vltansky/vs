import { mkdir, mkdtemp, readFile, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Script } from 'node:vm';
import { Client, InMemoryTransport } from '@modelcontextprotocol/client';
import { StdioClientTransport } from '@modelcontextprotocol/client/stdio';
import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import type { EventOptions } from './events.ts';
import { createVsServer } from './server.ts';

async function connectedClient(root: string, eventOptions?: EventOptions) {
  const server = createVsServer(root, eventOptions);
  const client = new Client({ name: 'vs-test', version: '1.0.0' });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);
  return { client, server };
}

describe('VS MCP App', () => {
  it('delivers one subscribed event for persisted feedback and stops after unsubscribe', async () => {
    const root = await mkdtemp(join(tmpdir(), 'vs-comment-delivery-'));
    await writeFile(join(root, 'proposal.html'), '<script type="text/htmdx"># Proposal</script>');
    const delivered: any[] = [];
    const { client, server } = await connectedClient(root, { transport: async (_url, body) => {
      const payload = JSON.parse(body);
      if (payload.type === 'verification') return { status: 200, body: JSON.stringify({ challenge: payload.challenge }) };
      delivered.push(payload); return { status: 204, body: '' };
    } });
    try {
      const library = await client.callTool({ name: 'vs.library', arguments: {} });
      const artifact = (library.structuredContent as any).artifacts[0];
      // The test transport owns this callback; the default transport rejects loopback without connecting.
      const subscription = { name: 'comment.created', arguments: { artifact_id: artifact.id }, delivery: { mode: 'webhook', url: 'https://127.0.0.1/events', secret: `whsec_${Buffer.alloc(32, 1).toString('base64')}` } };
      await client.request({ method: 'events/subscribe', params: subscription }, z.object({ id: z.string() }).passthrough());
      const comment = { id: 'feedback-1', comment: 'Explain retries', intent: 'comment', status: 'open', createdAt: '2026-10-18T10:00:00Z', anchor: { kind: 'html', selector: 'h1', textHint: 'Proposal', point: { x: 10, y: 20 } } };
      expect((await client.callTool({ name: 'vs.save-comment', arguments: { artifactId: artifact.id, revision: artifact.revision, comment } })).isError).not.toBe(true);
      const reordered = { ...comment, anchor: { point: { y: 20, x: 10 }, textHint: 'Proposal', selector: 'h1', kind: 'html' } };
      expect((await client.callTool({ name: 'vs.save-comment', arguments: { artifactId: artifact.id, revision: artifact.revision, comment: reordered } })).isError).not.toBe(true);
      await vi.waitFor(() => expect(delivered).toHaveLength(1), { timeout: 3000 });
      expect(delivered[0]).toMatchObject({ name: 'comment.created', data: { artifact_id: artifact.id, comment_id: comment.id, text: comment.comment, revision: artifact.revision } });
      await client.request({ method: 'events/unsubscribe', params: { ...subscription, delivery: { mode: 'webhook', url: subscription.delivery.url } } }, z.object({}));
      await client.callTool({ name: 'vs.save-comment', arguments: { artifactId: artifact.id, revision: artifact.revision, comment: { ...comment, id: 'feedback-2' } } });
      await new Promise(resolve => setTimeout(resolve, 1100));
      expect(delivered).toHaveLength(1);
    } finally { await client.close(); await server.close(); }
  });
  it('discovers saved artifacts across projects and filters the library', async () => {
    const root = await mkdtemp(join(tmpdir(), 'vs-library-'));
    await mkdir(join(root, 'acme-web', 'specs'), { recursive: true });
    await writeFile(join(root, 'acme-web', 'specs', 'proposal.html'), '<title>Delivery proposal</title><script type="text/htmdx"># Delivery</script>');
    await writeFile(join(root, 'plain.html'), '<h1>Not an artifact</h1>');
    const { client, server } = await connectedClient(root);
    try {
      const result = await client.callTool({ name: 'vs.library', arguments: {} });
      expect(result.isError).not.toBe(true);
      expect(result.structuredContent).toMatchObject({ artifacts: [{ title: 'Delivery proposal', project: 'acme-web', openComments: 0 }], total: 1 });
      const filtered = await client.callTool({ name: 'vs.library', arguments: { query: 'missing' } });
      expect(filtered.structuredContent).toMatchObject({ artifacts: [], total: 0 });
    } finally { await client.close(); await server.close(); }
  });

  it('persists revision-bound comments across connections and resolves them without losing the anchor', async () => {
    const root = await mkdtemp(join(tmpdir(), 'vs-comments-'));
    await writeFile(join(root, 'proposal.html'), '<script type="text/htmdx"># Proposal</script>');
    const first = await connectedClient(root);
    const library = await first.client.callTool({ name: 'vs.library', arguments: {} });
    const artifact = (library.structuredContent as any)?.artifacts?.[0];
    expect(artifact).toBeDefined();
    const comment = { id: 'comment-1', comment: 'Explain retries', intent: 'comment', status: 'open', createdAt: '2026-10-18T10:00:00Z', anchor: { kind: 'html', selector: 'h1', textHint: 'Proposal' } };
    const saved = await first.client.callTool({ name: 'vs.save-comment', arguments: { artifactId: artifact.id, revision: artifact.revision, comment } });
    expect(saved.isError).not.toBe(true);
    await first.client.close(); await first.server.close();
    const second = await connectedClient(root);
    try {
      const read = await second.client.callTool({ name: 'vs.comments', arguments: { artifactId: artifact.id } });
      expect(read.structuredContent).toMatchObject({ comments: [{ ...comment, revision: artifact.revision }] });
      await second.client.callTool({ name: 'vs.resolve-comment', arguments: { artifactId: artifact.id, commentId: comment.id, resolved: true } });
      const counts = await second.client.callTool({ name: 'vs.library', arguments: {} });
      expect(counts.structuredContent).toMatchObject({ artifacts: [{ openComments: 0 }] });
      await writeFile(join(root, 'proposal.html'), '<script type="text/htmdx"># Revised</script>');
      const stale = await second.client.callTool({ name: 'vs.save-comment', arguments: { artifactId: artifact.id, revision: artifact.revision, comment: { ...comment, id: 'comment-2' } } });
      expect(stale.isError).toBe(true);
      expect(stale.content).toEqual(expect.arrayContaining([expect.objectContaining({ text: expect.stringContaining('revision') })]));
    } finally { await second.client.close(); await second.server.close(); }
  });

  it('embeds a syntactically valid browser script in the App resource', async () => {
    const html = await readFile(new URL('./dist/view.html', import.meta.url), 'utf8');
    const script = html.match(/<script>([\s\S]*?)<\/script>/)?.[1];
    expect(script).toBeDefined();
    expect(() => new Script(script)).not.toThrow();
  });

  it('serves the bundled App through the plugin stdio command', async () => {
    const client = new Client({ name: 'vs-built-test', version: '1.0.0' });
    await client.connect(new StdioClientTransport({ command: 'node', args: ['mcp/dist/server.mjs'] }));
    try {
      expect((await client.listTools()).tools.map((tool) => tool.name)).toEqual(['vs.library', 'vs.open-artifact', 'vs.comments', 'vs.save-comment', 'vs.resolve-comment', 'vs.show-me', 'vs.eli5']);
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
        ['vs.library', { resourceUri: 'ui://vs/library' }],
        ['vs.open-artifact', { resourceUri: 'ui://vs/library' }],
        ['vs.comments', undefined],
        ['vs.save-comment', { visibility: ['app', 'model'] }],
        ['vs.resolve-comment', undefined],
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
