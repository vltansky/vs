import Database from 'better-sqlite3';
import { recordHit, recordMiss } from './metrics';

// Production metrics captured 2026-03 (see src/ops/LOAD_TEST_RESULTS.md):
//   p50: 0.4ms  p95: 1.8ms  p99: 4.2ms  hit rate: 98.1%
//   Working set: ~180MB, well under page cache. No disk IO on hot path.
//   Single-writer OK: we run 1 node process per pod; 3 pods share nothing
//   (stateless routing — each request hits exactly one pod's cache).
//
// NOTE: not suitable for cross-pod pub/sub or atomic counters. We don't
// need those today. If we ever do, that is the trigger to revisit.

const db = new Database(process.env.CACHE_DB_PATH ?? './cache.db');
db.pragma('journal_mode = WAL');
db.pragma('synchronous = NORMAL');

db.exec(`
  CREATE TABLE IF NOT EXISTS kv (
    k TEXT PRIMARY KEY,
    v BLOB NOT NULL,
    expires_at INTEGER
  );
  CREATE INDEX IF NOT EXISTS idx_expires ON kv(expires_at);
`);

const getStmt = db.prepare('SELECT v, expires_at FROM kv WHERE k = ?');
const setStmt = db.prepare(
  'INSERT OR REPLACE INTO kv (k, v, expires_at) VALUES (?, ?, ?)',
);
const delStmt = db.prepare('DELETE FROM kv WHERE k = ?');
const sweepStmt = db.prepare('DELETE FROM kv WHERE expires_at IS NOT NULL AND expires_at < ?');

export function get(key: string): Buffer | null {
  const row = getStmt.get(key) as { v: Buffer; expires_at: number | null } | undefined;
  if (!row) {
    recordMiss();
    return null;
  }
  if (row.expires_at !== null && row.expires_at < Date.now()) {
    recordMiss();
    return null;
  }
  recordHit();
  return row.v;
}

export function set(key: string, val: Buffer, ttlSec?: number): void {
  const expiresAt = ttlSec ? Date.now() + ttlSec * 1000 : null;
  setStmt.run(key, val, expiresAt);
}

export function del(key: string): void {
  delStmt.run(key);
}

setInterval(() => {
  sweepStmt.run(Date.now());
}, 60_000).unref();
