import { createHash, randomUUID, timingSafeEqual } from 'node:crypto';
import { lstat, mkdir, open } from 'node:fs/promises';
import { join } from 'node:path';
import { constants } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { z } from 'zod';
import { ProtocolError } from '@modelcontextprotocol/server';
import { sendWebhook, signedHeaders, signingKey, validateCallbackUrl, type WebhookTransport } from './webhook.ts';

const TransportMeta = z.record(z.string(), z.unknown()).optional();
const FiltersSchema = z.object({ artifact_id: z.string().min(1).max(256), project_id: z.string().min(1).max(256).optional() }).strict();
const DestinationSchema = z.object({ mode: z.literal('webhook'), url: z.string().max(2048) });
export const EventSubscribeSchema = z.object({
  name: z.literal('comment.created'), arguments: FiltersSchema,
  delivery: DestinationSchema.extend({ secret: z.string().max(100) }).strict(),
  _meta: TransportMeta, cursor: z.null().optional(), ttlMs: z.number().int().positive().nullable().optional(),
}).strict();
export const EventUnsubscribeSchema = z.object({ name: z.literal('comment.created'), arguments: FiltersSchema, delivery: DestinationSchema.strict(), _meta: TransportMeta }).strict();
const EventSchema = z.object({
  eventId: z.string().min(1).max(256), name: z.literal('comment.created'), timestamp: z.string().datetime({ offset: true }),
  data: z.object({ artifact_id: z.string(), project_id: z.string(), comment_id: z.string(), text: z.string(), revision: z.string().min(1), anchor: z.unknown().optional() }).strict(), cursor: z.null(),
}).strict();
type Subscription = { id: string; url: string; secret: string; filters: string; expires: number; previous_secret: string | null; rotation_until: number };
type Pending = { subscription_id: string; event_id: string; body: string; attempts: number };
export type EventOptions = { transport?: WebhookTransport; now?: () => number; automaticDelivery?: boolean; onDeliveryFailure?: (eventId: string, reason: string) => void };

function identity(params: z.infer<typeof EventUnsubscribeSchema>): string {
  // Fixed property order canonicalizes the only supported filter keys. The
  // stdio server has one OS-user principal; it is never a multi-tenant endpoint.
  return `sub_${createHash('sha256').update(JSON.stringify(['local-user', params.delivery.url, params.name, params.arguments.artifact_id, params.arguments.project_id ?? null])).digest('hex')}`;
}

export async function createEventService(directory: string, options: EventOptions = {}) {
  await mkdir(directory, { recursive: true, mode: 0o700 });
  if ((await lstat(directory)).isSymbolicLink()) throw new Error('VS state directory cannot be a symlink.');
  // Signing keys belong to the local OS user; create the database privately
  // before SQLite creates WAL files, which inherit its permissions.
  const databasePath = join(directory, 'events.sqlite');
  for (const path of [databasePath, `${databasePath}-wal`, `${databasePath}-shm`]) {
    try {
      const state = await lstat(path);
      if (state.isSymbolicLink() || state.nlink > 1) throw new Error('VS event database cannot be a linked file.');
    } catch (error) { if (!(error instanceof Error && 'code' in error && error.code === 'ENOENT')) throw error; }
  }
  const file = await open(databasePath, constants.O_CREAT | constants.O_APPEND | constants.O_WRONLY | constants.O_NOFOLLOW, 0o600);
  try { await file.chmod(0o600); } finally { await file.close(); }
  const db = new DatabaseSync(databasePath);
  db.exec(`PRAGMA busy_timeout = 5000; PRAGMA journal_mode = WAL;
    CREATE TABLE IF NOT EXISTS subscriptions (id TEXT PRIMARY KEY, url TEXT NOT NULL, secret TEXT NOT NULL, filters TEXT NOT NULL, expires INTEGER NOT NULL, previous_secret TEXT, rotation_until INTEGER NOT NULL DEFAULT 0);
    CREATE TABLE IF NOT EXISTS outbox (subscription_id TEXT NOT NULL, event_id TEXT NOT NULL, body TEXT NOT NULL, attempts INTEGER NOT NULL DEFAULT 0, next_attempt INTEGER NOT NULL, lease_until INTEGER NOT NULL DEFAULT 0, lease_owner TEXT, PRIMARY KEY(subscription_id,event_id));
    CREATE TABLE IF NOT EXISTS published (event_id TEXT PRIMARY KEY, published_at INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS delivery_failures (event_id TEXT NOT NULL, subscription_id TEXT NOT NULL, reason TEXT NOT NULL, failed_at INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS subscription_operations (id TEXT PRIMARY KEY, generation INTEGER NOT NULL);
  `);
  const transport = options.transport ?? sendWebhook;
  const now = options.now ?? Date.now;
  const owner = randomUUID();
  const verified = new Map<string, number>();
  let closed = false;
  let flushing: Promise<void> | undefined;
  const assertOpen = () => { if (closed) throw new Error('Event service is closed'); };
  const fail = (eventId: string, subscriptionId: string, reason: string) => {
    db.prepare('INSERT INTO delivery_failures VALUES (?,?,?,?)').run(eventId, subscriptionId, reason, now());
    (options.onDeliveryFailure ?? ((id, detail) => console.error(`VS event ${id}: ${detail}`)))(eventId, reason);
  };
  // SAFETY: only the validated subscribe transaction writes this private table's fixed columns.
  const active = (id: string) => db.prepare('SELECT * FROM subscriptions WHERE id = ? AND expires > ?').get(id, now()) as Subscription | undefined;
  const prune = () => {
    // TTL is checked both when enqueuing and immediately before delivery;
    // queued work must not outlive the monitoring authorization it came from.
    db.prepare('DELETE FROM subscriptions WHERE expires <= ?').run(now());
    db.exec('DELETE FROM outbox WHERE subscription_id NOT IN (SELECT id FROM subscriptions)');
  };
  async function drain() {
    assertOpen();
    prune();
    // Leases coordinate independent stdio processes sharing the user's store.
    // A crash releases a claim after 30 seconds; retries retain the event ID.
    while (!closed) {
      // SAFETY: RETURNING names exactly the four Pending columns from our own outbox schema.
      const pending = db.prepare(`UPDATE outbox SET lease_owner = ?, lease_until = ?
        WHERE rowid = (SELECT rowid FROM outbox WHERE next_attempt <= ? AND lease_until <= ? ORDER BY rowid LIMIT 1)
        RETURNING subscription_id,event_id,body,attempts`).get(owner, now() + 30_000, now(), now()) as Pending | undefined;
      if (!pending) break;
      const subscription = active(pending.subscription_id);
      if (!subscription) { db.prepare('DELETE FROM outbox WHERE subscription_id = ? AND event_id = ?').run(pending.subscription_id, pending.event_id); continue; }
      let status = 0;
      try {
        const headers = signedHeaders(pending.event_id, pending.body, { ...subscription, previousSecret: subscription.rotation_until > now() ? subscription.previous_secret ?? undefined : undefined }, now());
        status = (await transport(subscription.url, pending.body, headers)).status;
      } catch (error) { console.error(`VS event ${pending.event_id}: callback attempt failed (${error instanceof Error ? error.name : 'transport error'}); delivery will follow the bounded retry policy.`); }
      const acknowledged = status >= 200 && status < 300;
      const transient = status === 0 || status === 408 || status === 429 || status >= 500;
      const attempts = pending.attempts + 1;
      if (acknowledged || !transient || attempts >= 5) {
        if (!acknowledged) fail(pending.event_id, subscription.id, `Delivery stopped after ${attempts} attempt(s), HTTP ${status || 'network error'}`);
        db.prepare('DELETE FROM outbox WHERE subscription_id = ? AND event_id = ? AND lease_owner = ?').run(subscription.id, pending.event_id, owner);
      } else {
        db.prepare('UPDATE outbox SET attempts = ?, next_attempt = ?, lease_until = 0, lease_owner = NULL WHERE subscription_id = ? AND event_id = ? AND lease_owner = ?')
          .run(attempts, now() + 1000 * 2 ** (attempts - 1), subscription.id, pending.event_id, owner);
      }
    }
  }
  const flush = () => {
    assertOpen();
    flushing ??= drain().finally(() => { flushing = undefined; });
    return flushing;
  };
  const timer = options.automaticDelivery === false ? undefined : setInterval(() => {
    void flush().catch((error) => console.error(`VS event delivery worker: ${error instanceof Error ? error.message : 'failed'}`));
  }, 1000);
  timer?.unref();

  return {
    list() {
      return { events: [{ name: 'comment.created', description: 'A new review comment was persisted for the specified VS artifact.', delivery: ['webhook'],
        // oxlint-disable-next-line anti-slop/no-shape-in-symbol-names -- shape is Zod's schema API, not a domain name.
        inputSchema: z.toJSONSchema(FiltersSchema), payloadSchema: z.toJSONSchema(EventSchema.shape.data),
      }] };
    },
    // oxlint-disable-next-line anti-slop/no-unknown-parameters -- The protocol boundary parses untrusted requests here.
    async subscribe(input: unknown) {
      assertOpen();
      const params = EventSubscribeSchema.parse(input);
      validateCallbackUrl(params.delivery.url);
      signingKey(params.delivery.secret);
      const id = identity(params);
      // Verification crosses a network boundary. A newer refresh or unsubscribe
      // invalidates this operation, including across independent MCP processes.
      const operation = db.prepare(`INSERT INTO subscription_operations VALUES (?,1)
        ON CONFLICT(id) DO UPDATE SET generation=generation+1 RETURNING generation`).get(id);
      // A rotated key is verified separately, so a cached challenge cannot
      // activate an unusable secret. Cache entries expire after five minutes.
      const cacheKey = createHash('sha256').update(`${params.delivery.url}\0${params.delivery.secret}`).digest('hex');
      for (const [key, until] of verified) if (until <= now()) verified.delete(key);
      if ((verified.get(cacheKey) ?? 0) <= now()) {
        const challenge = randomUUID();
        const body = JSON.stringify({ type: 'verification', challenge });
        try {
          const result = await transport(params.delivery.url, body, signedHeaders(`msg_verification_${randomUUID()}`, body, { id, secret: params.delivery.secret }, now()));
          const received = Buffer.from(JSON.parse(result.body).challenge ?? '');
          const expected = Buffer.from(challenge);
          if (result.status < 200 || result.status >= 300 || received.length !== expected.length || !timingSafeEqual(received, expected)) throw new Error('challenge_failed');
        } catch (error) {
          const reason = error instanceof Error && (error.name === 'AbortError' || error.name === 'TimeoutError') ? 'timeout' : 'challenge_failed';
          throw new ProtocolError(-32015, 'Callback verification failed', { reason });
        }
        verified.set(cacheKey, now() + 300_000);
      }
      prune();
      const expires = now() + Math.min(params.ttlMs ?? 86_400_000, 86_400_000);
      db.exec('BEGIN IMMEDIATE');
      try {
        if (db.prepare('SELECT generation FROM subscription_operations WHERE id=?').get(id)?.generation !== operation?.generation) throw new Error('Subscription changed while callback verification was pending.');
        db.prepare(`INSERT INTO subscriptions(id,url,secret,filters,expires) VALUES (?,?,?,?,?)
        ON CONFLICT(id) DO UPDATE SET previous_secret = CASE WHEN secret != excluded.secret THEN secret ELSE previous_secret END,
          rotation_until = CASE WHEN secret != excluded.secret THEN ? ELSE rotation_until END,
          secret = excluded.secret, expires = excluded.expires`)
          .run(id, params.delivery.url, params.delivery.secret, JSON.stringify(params.arguments), expires, now() + 300_000);
        db.exec('COMMIT');
      } catch (error) { db.exec('ROLLBACK'); throw error; }
      return { id, refreshBefore: new Date(expires).toISOString(), cursor: null, truncated: false };
    },
    // oxlint-disable-next-line anti-slop/no-unknown-parameters -- The protocol boundary parses untrusted requests here.
    unsubscribe(input: unknown) {
      assertOpen();
      const id = identity(EventUnsubscribeSchema.parse(input));
      db.exec('BEGIN IMMEDIATE');
      try {
        db.prepare('INSERT INTO subscription_operations VALUES (?,1) ON CONFLICT(id) DO UPDATE SET generation=generation+1').run(id);
        db.prepare('DELETE FROM subscriptions WHERE id = ?').run(id);
        db.prepare('DELETE FROM outbox WHERE subscription_id = ?').run(id);
        db.exec('COMMIT');
      } catch (error) { db.exec('ROLLBACK'); throw error; }
      return {};
    },
    // oxlint-disable-next-line anti-slop/no-unknown-parameters -- Parse durable outbox JSON before accepting a publication.
    publish(input: unknown) {
      assertOpen();
      const event = EventSchema.parse(input);
      const body = JSON.stringify(event);
      if (Buffer.byteLength(body) > 262_144) throw new Error('Event payload exceeds 256 KiB');
      db.exec('BEGIN IMMEDIATE');
      try {
        prune();
        const inserted = db.prepare('INSERT OR IGNORE INTO published VALUES (?,?)').run(event.eventId, now());
        if (inserted.changes) {
          // SAFETY: validated subscriptions are read from the private table with our fixed Subscription columns.
          const subscriptions = db.prepare('SELECT * FROM subscriptions').all() as Subscription[];
          for (const subscription of subscriptions) {
            const filters = FiltersSchema.parse(JSON.parse(subscription.filters));
            if (filters.artifact_id === event.data.artifact_id && (!filters.project_id || filters.project_id === event.data.project_id))
              db.prepare('INSERT OR IGNORE INTO outbox(subscription_id,event_id,body,next_attempt) VALUES (?,?,?,?)').run(subscription.id, event.eventId, body, now());
          }
        }
        db.exec('COMMIT');
      } catch (error) { db.exec('ROLLBACK'); throw error; }
    },
    flush,
    async close() {
      if (closed) return;
      clearInterval(timer);
      await flushing;
      closed = true;
      db.close();
    },
  };
}
