# Caching Decision Fixture

A B2B SaaS API that uses an in-process SQLite KV cache for sessions and feature flags.

## Structure

- `src/app.ts` — Express entry
- `src/cache/kv.ts` — SQLite-backed KV store (WAL mode, prepared statements)
- `src/cache/metrics.ts` — in-process hit/miss counters
- `src/sessions/service.ts` — session storage via `cache/kv`
- `src/flags/service.ts` — feature-flag resolver with per-user caching
- `src/ops/LOAD_TEST_RESULTS.md` — production load-test data
- `REQUIREMENTS.md` — context for the pending caching-layer decision

## Current production characteristics

- 12k req/s peak, 3 pods, stateless routing
- p99 cache latency: 4.2ms
- Cache hit rate: 98.1%
- No cache-related incidents in 6 months
