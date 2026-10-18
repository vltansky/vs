import { createHmac } from 'node:crypto';
import { mkdtemp, mkdir, symlink, writeFile, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { InMemoryTransport, PROTOCOL_VERSION_META_KEY, CLIENT_INFO_META_KEY, CLIENT_CAPABILITIES_META_KEY, type JSONRPCMessage } from '@modelcontextprotocol/server';
import { serveStdio } from '@modelcontextprotocol/server/stdio';
import { createVsServer } from './server.ts';
import { DatabaseSync } from 'node:sqlite';
import { describe, expect, it } from 'vitest';
import { createEventService } from './events.ts';
import { isPublicAddress, validateCallbackUrl, type WebhookTransport } from './webhook.ts';

const secret = `whsec_${Buffer.alloc(32, 7).toString('base64')}`;
const request = { name: 'comment.created', arguments: { artifact_id: 'a', project_id: 'p' }, delivery: { mode: 'webhook', url: 'https://receiver.example/events', secret } };
const event = { eventId: 'evt_one', name: 'comment.created', timestamp: '2026-10-18T10:00:00Z', data: { artifact_id: 'a', project_id: 'p', comment_id: 'c', text: 'Please revise', revision: 'sha256-revision' }, cursor: null };
async function setup(statuses = [204]) {
  const directory = await mkdtemp(join(tmpdir(), 'vs-events-'));
  const calls: Array<{ body: string; headers: Record<string, string> }> = [];
  let now = Date.now();
  const transport: WebhookTransport = async (_url, body, headers) => {
    calls.push({ body, headers });
    const parsed = JSON.parse(body);
    return parsed.type === 'verification' ? { status: 200, body: JSON.stringify({ challenge: parsed.challenge }) } : { status: statuses.shift() ?? 204, body: '' };
  };
  const options = { transport, now: () => now, automaticDelivery: false };
  return { directory, calls, options, advance: (ms: number) => { now += ms; }, service: await createEventService(directory, options) };
}

describe('durable MCP events', () => {
  it('verifies before activation, signs exact bytes, filters and persists across restart', async () => {
    const s = await setup();
    try {
      expect(s.service.list().events[0]).toMatchObject({ name: 'comment.created', delivery: ['webhook'] });
      const subscription = await s.service.subscribe(request);
      expect(subscription).toMatchObject({ cursor: null, truncated: false });
      expect(s.calls).toHaveLength(1);
      await s.service.publish({ ...event, eventId: 'evt_other', data: { ...event.data, artifact_id: 'other' } });
      await s.service.publish(event);
      await s.service.close();
      const restarted = await createEventService(s.directory, s.options);
      await restarted.flush();
      await restarted.close();
      expect(s.calls).toHaveLength(2);
      const call = s.calls[1];
      expect(JSON.parse(call.body)).toEqual(event);
      expect(call.headers['webhook-id']).toBe('evt_one');
      const expected = createHmac('sha256', Buffer.alloc(32, 7)).update(`evt_one.${call.headers['webhook-timestamp']}.${call.body}`).digest('base64');
      expect(call.headers['webhook-signature']).toBe(`v1,${expected}`);
      expect(call.headers['X-MCP-Subscription-Id']).toBe(subscription.id);
      const db = new DatabaseSync(join(s.directory, 'events.sqlite'));
      expect(db.prepare('SELECT COUNT(*) AS count FROM outbox').get()?.count).toBe(0);
      db.close();
    } finally { await s.service.close(); }
  });

  it('refreshes canonical identities, rotates signatures, expires, and unsubscribes idempotently', async () => {
    const s = await setup();
    try {
      const first = await s.service.subscribe({ ...request, ttlMs: 2000 });
      const nextSecret = `whsec_${Buffer.alloc(32, 9).toString('base64')}`;
      const refreshed = await s.service.subscribe({ ...request, arguments: { project_id: 'p', artifact_id: 'a' }, delivery: { ...request.delivery, secret: nextSecret }, ttlMs: 3000 });
      expect(refreshed.id).toBe(first.id);
      await s.service.publish(event);
      await s.service.flush();
      expect(s.calls.at(-1)?.headers['webhook-signature'].split(' ')).toHaveLength(2);
      s.advance(3001);
      await s.service.publish({ ...event, eventId: 'evt_expired' });
      await s.service.flush();
      expect(s.calls.filter((c) => JSON.parse(c.body).eventId === 'evt_expired')).toHaveLength(0);
      await s.service.unsubscribe({ ...request, delivery: { mode: 'webhook', url: request.delivery.url } });
      await s.service.unsubscribe({ ...request, delivery: { mode: 'webhook', url: request.delivery.url } });
      await s.service.subscribe(request);
      await s.service.publish({ ...event, eventId: 'evt_cancelled' });
      await s.service.unsubscribe({ ...request, delivery: { mode: 'webhook', url: request.delivery.url } });
      await s.service.flush();
      expect(s.calls.filter((c) => JSON.parse(c.body).eventId === 'evt_cancelled')).toHaveLength(0);
    } finally { await s.service.close(); }
  });

  it('durably retries transient failures with unchanged event ID and stops 410/413', async () => {
    const s = await setup([503, 204, 410, 413]);
    try {
      await s.service.subscribe(request);
      await s.service.publish(event);
      await s.service.flush();
      expect(s.calls).toHaveLength(2);
      await s.service.flush();
      expect(s.calls).toHaveLength(2);
      s.advance(5000);
      await s.service.flush();
      expect(s.calls).toHaveLength(3);
      expect(s.calls[1].headers['webhook-id']).toBe(s.calls[2].headers['webhook-id']);
      expect(s.calls[1].headers['webhook-timestamp']).not.toBe(s.calls[2].headers['webhook-timestamp']);
      for (const eventId of ['evt_gone', 'evt_large']) {
        await s.service.publish({ ...event, eventId });
        await s.service.flush();
      }
      s.advance(60_000);
      await s.service.flush();
      expect(s.calls).toHaveLength(5);
    } finally { await s.service.close(); }
  });

  it('deduplicates recovery publishing and leases deliveries across two stdio instances', async () => {
    const s = await setup();
    let release: () => void = () => {};
    let deliveries = 0;
    const transport: WebhookTransport = async (_url, body) => {
      const parsed = JSON.parse(body);
      if (parsed.type === 'verification') return { status: 200, body: JSON.stringify({ challenge: parsed.challenge }) };
      deliveries++;
      await new Promise<void>((resolve) => { release = resolve; });
      return { status: 204, body: '' };
    };
    await s.service.close();
    const first = await createEventService(s.directory, { ...s.options, transport });
    const second = await createEventService(s.directory, { ...s.options, transport });
    try {
      await first.subscribe(request);
      await Promise.all([first.publish(event), second.publish(event)]);
      const draining = first.flush();
      await second.flush();
      expect(deliveries).toBe(1);
      release();
      await draining;
      await second.publish(event);
      await second.flush();
      expect(deliveries).toBe(1);
    } finally { release(); await first.close(); await second.close(); }
  });

  it('persists retry attempts across restart and records bounded exhaustion', async () => {
    const s = await setup([503, 503, 503, 503, 503]);
    await s.service.subscribe(request);
    await s.service.publish(event);
    await s.service.flush();
    await s.service.close();
    const stopped: string[] = [];
    const restarted = await createEventService(s.directory, { ...s.options, onDeliveryFailure: (id) => stopped.push(id) });
    try {
      for (let i = 0; i < 5; i++) { s.advance(60_000); await restarted.flush(); }
      expect(s.calls.filter((call) => JSON.parse(call.body).eventId === event.eventId)).toHaveLength(5);
      expect(stopped).toEqual([event.eventId]);
      const db = new DatabaseSync(join(s.directory, 'events.sqlite'));
      expect(db.prepare('SELECT COUNT(*) AS count FROM delivery_failures').get()?.count).toBe(1);
      db.close();
    } finally { await restarted.close(); }
  });

  it('rejects linked state directories, database files, and SQLite sidecars', async () => {
    const root = await mkdtemp(join(tmpdir(), 'vs-event-links-'));
    const target = join(root, 'outside');
    await mkdir(target);
    const linkedDirectory = join(root, 'linked');
    await symlink(target, linkedDirectory);
    await expect(createEventService(linkedDirectory)).rejects.toThrow('symlink');
    for (const suffix of ['', '-wal', '-shm']) {
      const directory = join(root, `state${suffix || '-db'}`);
      await mkdir(directory);
      const destination = join(target, `untouched${suffix}`);
      await writeFile(destination, 'untouched');
      await symlink(destination, join(directory, `events.sqlite${suffix}`));
      await expect(createEventService(directory)).rejects.toThrow('linked');
      expect(await readFile(destination, 'utf8')).toBe('untouched');
    }
  });

  it('rejects malformed requests and failed challenges without storing a subscription', async () => {
    const s = await setup();
    await s.service.close();
    const service = await createEventService(s.directory, { automaticDelivery: false, transport: async () => ({ status: 200, body: '{"challenge":"wrong"}' }) });
    try {
      await expect(service.subscribe({ ...request, delivery: { ...request.delivery, secret: 'bad' } })).rejects.toThrow();
      await expect(service.subscribe({ ...request, arguments: { artifact_id: 'a', extra: true } })).rejects.toThrow();
      await expect(service.subscribe(request)).rejects.toMatchObject({ code: -32015, data: { reason: 'challenge_failed' } });
      await service.publish(event);
      await service.flush();
      const db = new DatabaseSync(join(s.directory, 'events.sqlite'));
      expect(db.prepare('SELECT COUNT(*) AS count FROM subscriptions').get()?.count).toBe(0);
      db.close();
    } finally { await service.close(); }
  });
});

describe('MCP 2.0 events wire', () => {
  it('discovers event capability and serves custom methods with the modern envelope', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'vs-events-wire-'));
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    const handle = serveStdio(() => createVsServer(directory), { transport: serverTransport });
    await clientTransport.start();
    let id = 0;
    async function call(method: string, params: Record<string, unknown> = {}) {
      const response = new Promise<JSONRPCMessage>((resolve) => { clientTransport.onmessage = resolve; });
      await clientTransport.send({ jsonrpc: '2.0', id: ++id, method, params: { ...params, _meta: {
        [PROTOCOL_VERSION_META_KEY]: '2026-07-28',
        [CLIENT_INFO_META_KEY]: { name: 'events-wire-eval', version: '1' },
        [CLIENT_CAPABILITIES_META_KEY]: {},
      } } });
      const message = await response;
      if ('error' in message) throw new Error(JSON.stringify(message.error));
      if (!('result' in message)) throw new Error('Expected a JSON-RPC result');
      return message.result;
    }
    try {
      expect(await call('server/discover')).toMatchObject({ capabilities: { events: {} }, supportedVersions: ['2026-07-28'] });
      expect(await call('events/list')).toMatchObject({ events: [{ name: 'comment.created' }] });
      expect(await call('events/unsubscribe', { ...request, delivery: { mode: 'webhook', url: request.delivery.url } })).toMatchObject({});
    } finally { await handle.close(); await clientTransport.close(); }
  });
});

describe('callback SSRF boundaries', () => {
  it('requires a credential-free HTTPS callback', () => {
    for (const url of ['http://example.com', 'https://user:pass@example.com', 'https://example.com/#fragment']) expect(() => validateCallbackUrl(url)).toThrow();
    expect(validateCallbackUrl('https://example.com/callback').hostname).toBe('example.com');
  });
  it('blocks private, local, multicast, reserved, and IPv4 mapped IPv6 destinations', () => {
    for (const address of ['127.0.0.1', '10.0.0.1', '169.254.169.254', '172.16.0.1', '192.168.1.1', '100.64.0.1', '192.0.2.1', '198.18.0.1', '224.0.0.1', '0.0.0.0', '::1', '::ffff:127.0.0.1', 'fc00::1', 'fe80::1', 'ff02::1', '2001:db8::1']) expect(isPublicAddress(address), address).toBe(false);
    for (const address of ['8.8.8.8', '1.1.1.1', '2606:4700:4700::1111', '2001:4860:4860::8888']) expect(isPublicAddress(address), address).toBe(true);
  });
});
