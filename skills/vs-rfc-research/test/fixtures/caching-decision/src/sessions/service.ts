import { get, set, del } from '../cache/kv';

const SESSION_TTL_SEC = 24 * 60 * 60;

export function getSession(sid: string): Record<string, unknown> | null {
  const buf = get(`session:${sid}`);
  if (!buf) return null;
  return JSON.parse(buf.toString('utf8'));
}

export function setSession(sid: string, data: Record<string, unknown>): void {
  set(`session:${sid}`, Buffer.from(JSON.stringify(data), 'utf8'), SESSION_TTL_SEC);
}

export function destroySession(sid: string): void {
  del(`session:${sid}`);
}
