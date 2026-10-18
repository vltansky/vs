import { mkdtemp } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { DatabaseSync } from 'node:sqlite';
import { describe, expect, it } from 'vitest';
import { createEventService } from './events.ts';

describe('independent event cancellation review', () => {
  it('keeps unsubscribe authoritative over an earlier pending verification across processes', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'vs-event-cancel-review-'));
    let release!: () => void;
    let verifying!: () => void;
    const reached = new Promise<void>(resolve => { verifying = resolve; });
    const first = await createEventService(directory, { automaticDelivery: false, transport: async (_url, body) => {
      const parsed = JSON.parse(body);
      verifying();
      await new Promise<void>(resolve => { release = resolve; });
      return { status: 200, body: JSON.stringify({ challenge: parsed.challenge }) };
    } });
    const second = await createEventService(directory, { automaticDelivery: false });
    const request = { name: 'comment.created', arguments: { artifact_id: 'a' }, delivery: { mode: 'webhook', url: 'https://receiver.example/events', secret: `whsec_${Buffer.alloc(32, 3).toString('base64')}` } };
    try {
      const subscribing = first.subscribe(request);
      // Cancellation belongs to the subscription identity, including other local server processes.
      await reached;
      await second.unsubscribe({ ...request, delivery: { mode: 'webhook', url: request.delivery.url } });
      release();
      await subscribing.catch(() => {});
      const db = new DatabaseSync(join(directory, 'events.sqlite'));
      try { expect(db.prepare('SELECT count(*) AS n FROM subscriptions').get()?.n).toBe(0); }
      finally { db.close(); }
    } finally { release?.(); await first.close(); await second.close(); }
  });
});
