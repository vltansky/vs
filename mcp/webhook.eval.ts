import { EventEmitter } from 'node:events';
import type { RequestOptions } from 'node:https';
import { describe, expect, it, vi } from 'vitest';

const network = vi.hoisted(() => ({ addresses: [{ address: '8.8.8.8', family: 4 }], status: 204, calls: [] as Array<{ url: URL; options: RequestOptions }> }));
vi.mock('node:dns/promises', () => ({ lookup: vi.fn(async () => network.addresses) }));
vi.mock('node:https', () => ({ request: (url: URL, options: RequestOptions, callback: (response: EventEmitter) => void) => {
  network.calls.push({ url, options });
  const req = new EventEmitter() as EventEmitter & { end: () => void; destroy: (error: Error) => void };
  req.destroy = (error) => { req.emit('error', error); };
  req.end = () => { queueMicrotask(() => {
    const response = Object.assign(new EventEmitter(), { statusCode: network.status });
    callback(response);
    response.emit('data', Buffer.from('response'));
    response.emit('end');
  }); };
  return req;
} }));
import { sendWebhook } from './webhook.ts';

describe('outbound webhook connections', () => {
  it('pins the validated DNS address for both lookup modes while preserving TLS host', async () => {
    network.calls = [];
    network.addresses = [{ address: '8.8.8.8', family: 4 }];
    network.status = 204;
    await expect(sendWebhook('https://callbacks.example/events', '{}', {})).resolves.toEqual({ status: 204, body: 'response' });
    const call = network.calls[0];
    expect(call.url.hostname).toBe('callbacks.example');
    expect(call.options.agent).toBe(false);
    const lookup = vi.fn();
    call.options.lookup('callbacks.example', { all: true }, lookup);
    expect(lookup).toHaveBeenLastCalledWith(null, [{ address: '8.8.8.8', family: 4 }]);
    call.options.lookup('callbacks.example', { all: false }, lookup);
    expect(lookup).toHaveBeenLastCalledWith(null, '8.8.8.8', 4);
  });

  it('revalidates DNS every delivery and rejects mixed public/private answers', async () => {
    network.calls = [];
    network.addresses = [{ address: '8.8.8.8', family: 4 }];
    await sendWebhook('https://callbacks.example/events', '{}', {});
    network.addresses.push({ address: '127.0.0.1', family: 4 });
    await expect(sendWebhook('https://callbacks.example/events', '{}', {})).rejects.toThrow('non-public');
    expect(network.calls).toHaveLength(1);
    await expect(sendWebhook('https://[::ffff:127.0.0.1]/events', '{}', {})).rejects.toThrow('non-public');
    await expect(sendWebhook('http://example.com/events', '{}', {})).rejects.toThrow('HTTPS');
    expect(network.calls).toHaveLength(1);
  });

  it('returns redirects as failures without making another request', async () => {
    network.calls = [];
    network.addresses = [{ address: '8.8.8.8', family: 4 }];
    network.status = 302;
    expect((await sendWebhook('https://callbacks.example/events', '{}', {})).status).toBe(302);
    expect(network.calls).toHaveLength(1);
  });
});
