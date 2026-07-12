import { get, set } from '../cache/kv';

const FLAG_TTL_SEC = 60;

interface FlagResolver {
  resolve(name: string, userId: string): Promise<boolean>;
}

export class CachedFlags {
  constructor(private readonly upstream: FlagResolver) {}

  async isEnabled(name: string, userId: string): Promise<boolean> {
    const key = `flag:${name}:${userId}`;
    const cached = get(key);
    if (cached) {
      return cached[0] === 1;
    }

    const value = await this.upstream.resolve(name, userId);
    set(key, Buffer.from([value ? 1 : 0]), FLAG_TTL_SEC);
    return value;
  }
}
