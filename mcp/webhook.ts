import { createHmac } from 'node:crypto';
import { lookup } from 'node:dns/promises';
import { request } from 'node:https';
import { isIP } from 'node:net';

export type WebhookTransport = (url: string, body: string, headers: Record<string, string>) => Promise<{ status: number; body: string }>;

export function validateCallbackUrl(value: string): URL {
  const url = new URL(value);
  if (url.protocol !== 'https:' || url.username || url.password || url.hash) throw new Error('Callback must be credential-free HTTPS without a fragment');
  return url;
}

export function isPublicAddress(address: string): boolean {
  if (isIP(address) === 4) {
    const [a, b, c] = address.split('.').map(Number);
    return !(a === 0 || a === 10 || a === 127 || a >= 224 ||
      (a === 100 && b >= 64 && b <= 127) || (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) || (a === 192 && (b === 168 || b === 0 || (b === 88 && c === 99))) ||
      (a === 198 && (b === 18 || b === 19 || (b === 51 && c === 100))) || (a === 203 && b === 0 && c === 113));
  }
  if (isIP(address) !== 6 || address.includes('%')) return false;
  // Restrict IPv6 to ordinary global unicast; transition and special-use ranges
  // can encapsulate a private IPv4 target and must never reach a callback.
  const first = parseInt(address.split(':')[0], 16);
  if (!Number.isFinite(first) || first < 0x2000 || first > 0x3fff) return false;
  const normalized = new URL(`https://[${address}]/`).hostname.slice(1, -1);
  const second = parseInt(normalized.split(':')[1] || '0', 16);
  return !((first === 0x2001 && (second < 0x200 || second === 0xdb8)) || first === 0x2002 || first === 0x3fff);
}

export function signingKey(secret: string): Buffer {
  if (!/^whsec_[A-Za-z0-9+/]+={0,2}$/.test(secret)) throw new Error('Expected a whsec_ base64 signing secret');
  const encoded = secret.slice(6);
  const key = Buffer.from(encoded, 'base64');
  if (key.length < 24 || key.length > 64 || key.toString('base64').replace(/=+$/, '') !== encoded.replace(/=+$/, '')) throw new Error('Signing secret must decode to 24–64 bytes');
  return key;
}

export function signedHeaders(id: string, body: string, subscription: { id: string; secret: string; previousSecret?: string }, now: number) {
  const timestamp = String(Math.floor(now / 1000));
  const secrets = subscription.previousSecret ? [subscription.secret, subscription.previousSecret] : [subscription.secret];
  const signatures = secrets.map(secret =>
    `v1,${createHmac('sha256', signingKey(secret)).update(`${id}.${timestamp}.${body}`).digest('base64')}`);
  return { 'Content-Type': 'application/json', 'webhook-id': id, 'webhook-timestamp': timestamp, 'webhook-signature': signatures.join(' '), 'X-MCP-Subscription-Id': subscription.id };
}

export const sendWebhook: WebhookTransport = async (value, body, headers) => {
  const url = validateCallbackUrl(value);
  const hostname = url.hostname.replace(/^\[|\]$/g, '');
  let deadline: ReturnType<typeof setTimeout> | undefined;
  const addresses = isIP(hostname) ? [{ address: hostname, family: isIP(hostname) }] : await Promise.race([
    lookup(hostname, { all: true }),
    new Promise<never>((_resolve, reject) => {
      deadline = setTimeout(() => reject(Object.assign(new Error('Callback DNS lookup timed out'), { name: 'TimeoutError' })), 10_000);
    }),
  ]).finally(() => clearTimeout(deadline));
  if (!addresses.length || addresses.some(({ address }) => !isPublicAddress(address))) throw new Error('Callback resolves to a non-public destination');
  const target = addresses[0];
  return new Promise((resolve, reject) => {
    // Pin the already-validated address while HTTPS retains the original host
    // for certificate verification. The transport never follows redirects.
    const req = request(url, { method: 'POST', headers, signal: AbortSignal.timeout(10_000), agent: false,
      lookup: (_host, lookupOptions, callback) => lookupOptions.all ? callback(null, [target]) : callback(null, target.address, target.family),
    }, (response) => {
      const chunks: Buffer[] = [];
      let size = 0;
      response.on('data', (chunk: Buffer) => {
        size += chunk.length;
        if (size > 16_384) req.destroy(new Error('Callback response exceeds 16 KiB'));
        else chunks.push(chunk);
      });
      response.on('error', reject);
      response.on('end', () => resolve({ status: response.statusCode ?? 0, body: Buffer.concat(chunks).toString('utf8') }));
    });
    req.on('error', reject);
    req.end(body);
  });
};
