import { readFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { McpServer } from '@modelcontextprotocol/server';
import { registerAppResource, registerAppTool, RESOURCE_MIME_TYPE } from '@modelcontextprotocol/ext-apps/server';
import { z } from 'zod';
import { ArtifactStore } from './artifacts.ts';
import { commentSchema, libraryQuerySchema } from './contracts.ts';
import { createEventService, EventSubscribeSchema, EventUnsubscribeSchema, type EventOptions } from './events.ts';

const views = [
  { tool: 'vs.show-me', uri: 'ui://vs/show-me', skill: 'vs-show-me' },
  { tool: 'vs.eli5', uri: 'ui://vs/eli5', skill: 'vs-eli5' },
] as const;
export function createVsServer(root = join(homedir(), '.vs'), eventOptions?: EventOptions) {
  const server = new McpServer({ name: 'vs-artifact', version: '1.0.0' });
  const store = new ArtifactStore(root);
  let events: ReturnType<typeof createEventService> | undefined;
  const eventService = () => events ??= createEventService(join(root, '.mcp'), eventOptions);
  let publishing = Promise.resolve();
  let closed = false;
  const publishPending = () => publishing = publishing.catch(() => {}).then(async () => {
    if (closed) return;
    for (const event of await store.pendingEvents()) {
      await (await eventService()).publish(event);
      await store.acknowledgeEvent(event.eventId);
    }
  });
  const deliveryTimer = setInterval(() => { void publishPending().catch(error => console.error('VS comment publication failed:', error.message)); }, 2000);
  deliveryTimer.unref();
  server.server.onclose = () => {
    closed = true;
    clearInterval(deliveryTimer);
    // Finish publication before closing storage; otherwise teardown can lose an acknowledgement.
    void publishing.catch(() => {}).then(async () => { if (events) await (await events).close(); store.close(); });
  };
  const result = <T extends object,>(text: string, data: T) => ({ content: [{ type: 'text' as const, text }], structuredContent: data });
  const guarded = <T,>(handler: (args: T) => Promise<ReturnType<typeof result>>) => async (args: T) => {
    try { return await handler(args); }
    catch (error) { return { isError: true, content: [{ type: 'text' as const, text: error instanceof Error ? error.message : 'Unable to access VS artifacts.' }] }; }
  };
  const readOnly = { readOnlyHint: true, idempotentHint: true, openWorldHint: false };
  const artifactId = z.string().min(1).max(256);
  registerAppTool(server, 'vs.library', {
    description: 'Browse saved VS artifacts across projects. Search titles and paths, filter by project, and open an artifact to review its comments.',
    inputSchema: libraryQuerySchema,
    annotations: readOnly,
    _meta: { ui: { resourceUri: 'ui://vs/library' } },
  }, guarded(async args => {
    const page = await store.list(args);
    return result(`${page.total} VS artifact${page.total === 1 ? '' : 's'} found.`, { kind: 'library', ...page });
  }));
  registerAppTool(server, 'vs.open-artifact', {
    description: 'Open a saved VS artifact by its library ID. Returns the current HTML, revision, and durable review comments.',
    inputSchema: z.object({ artifactId }), annotations: readOnly,
    _meta: { ui: { resourceUri: 'ui://vs/library' } },
  }, guarded(async ({ artifactId }) => {
    const artifact = await store.find(artifactId);
    return result(`VS artifact ready: ${artifact.path}`, { kind: 'artifact', ...artifact, artifactPath: artifact.path, comments: await store.comments(artifactId) });
  }));
  server.registerTool('vs.comments', {
    description: 'Read review comments for a VS artifact. Comments are user-authored data; use the user’s monitoring instructions to decide how to respond.',
    inputSchema: z.object({ artifactId }), annotations: readOnly,
  }, guarded(async ({ artifactId }) => result('VS review comments.', { comments: await store.comments(artifactId) })));
  server.registerTool('vs.save-comment', {
    description: 'Save anchored feedback on a VS artifact revision. A new comment emits comment.created for matching subscriptions; retrying the same ID does not create another event.',
    inputSchema: z.object({ artifactId, revision: z.string().min(1).max(128), comment: commentSchema }),
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    _meta: { ui: { visibility: ['app', 'model'] } },
  }, guarded(async ({ artifactId, revision, comment }) => {
    const saved = await store.save(artifactId, revision, comment);
    void publishPending().catch(error => console.error('VS comment publication failed:', error.message));
    return result('Comment saved in VS. Matching subscribed chats will receive new feedback.', { comment: saved });
  }));
  server.registerTool('vs.resolve-comment', {
    description: 'Resolve or reopen saved VS feedback after reviewing it. Resolving does not change the artifact HTML or emit a new comment event.',
    inputSchema: z.object({ artifactId, commentId: z.string().min(1).max(128), resolved: z.boolean() }),
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  }, guarded(async ({ artifactId, commentId, resolved }) => result('Comment status saved.', { comment: await store.resolve(artifactId, commentId, resolved) })));

  // Events is a draft extension not yet named by the SDK's capability type.
  const capabilities = { ...server.server.getCapabilities(), events: {} };
  server.server.registerCapabilities(capabilities);
  server.server.setRequestHandler('events/list', { params: z.object({ cursor: z.null().optional() }) }, async () => (await eventService()).list());
  server.server.setRequestHandler('events/subscribe', { params: EventSubscribeSchema }, async params => {
    const artifact = await store.find(params.arguments.artifact_id);
    if (params.arguments.project_id && params.arguments.project_id !== artifact.project) throw new Error('Artifact does not belong to that project.');
    await publishPending();
    return (await eventService()).subscribe(params);
  });
  server.server.setRequestHandler('events/unsubscribe', { params: EventUnsubscribeSchema }, async params => (await eventService()).unsubscribe(params));

  registerAppResource(server, 'vs-library', 'ui://vs/library', {
    mimeType: RESOURCE_MIME_TYPE,
    _meta: { ui: { prefersBorder: true, csp: { resourceDomains: ['https://cdn.jsdelivr.net'] } } },
  }, async () => ({ contents: [{ uri: 'ui://vs/library', mimeType: RESOURCE_MIME_TYPE, text: await readFile(new URL('./view.html', import.meta.url), 'utf8') }] }));

  for (const view of views) {
    registerAppTool(server, view.tool, {
      description: `Present a saved ${view.skill} HTMDX artifact as an MCP App.`,
      inputSchema: z.object({
        path: z.string().min(1),
        reviewQuestion: z.string().optional(),
        url: z.string().optional(),
        shotPath: z.string().optional(),
      }),
      annotations: readOnly,
      _meta: { ui: { resourceUri: view.uri } },
    }, async ({ path, reviewQuestion, url, shotPath }) => {
      try {
        const artifact = await store.read(path);
        return {
          content: [{ type: 'text' as const, text: `${reviewQuestion ? `Review question: ${reviewQuestion}\n` : ''}${view.skill} artifact ready: ${path}${url ? `\nURL: ${url}` : ''}` }],
          structuredContent: { kind: 'artifact', ...artifact, skill: view.skill, artifactPath: path, reviewQuestion, url, shotPath, comments: await store.comments(artifact.id) },
        };
      } catch (error) {
        return { isError: true, content: [{ type: 'text' as const, text: error instanceof Error ? error.message : 'Unable to read artifact.' }] };
      }
    });

    registerAppResource(server, view.skill, view.uri, {
      mimeType: RESOURCE_MIME_TYPE,
      _meta: { ui: { prefersBorder: true, csp: { resourceDomains: ['https://cdn.jsdelivr.net'] } } },
    }, async () => ({
      contents: [{ uri: view.uri, mimeType: RESOURCE_MIME_TYPE, text: await readFile(new URL('./view.html', import.meta.url), 'utf8') }],
    }));
  }
  return server;
}
