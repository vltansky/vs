# Plan: Add Redis Caching to API

## Problem
The `/products` endpoint runs a slow aggregation query on every request. Response times are around 800ms under load.

## Proposed Solution
Add Redis as a caching layer in front of the DB queries. Cache TTL: 5 minutes.

## Approach
- Add `redis` npm package
- Wrap DB calls in a `withCache(key, ttl, fn)` helper
- Cache `/products` response at the route level
- Cache `/users/:id` per user ID

## Implementation
1. Add Redis connection in `src/redis.js`
2. Create `src/cache.js` with `withCache` helper
3. Modify `src/api.js` to wrap DB calls
4. Add `REDIS_URL` env var

## Success Criteria
- `/products` p99 latency drops below 100ms
- Cache hit rate > 80% under normal load
