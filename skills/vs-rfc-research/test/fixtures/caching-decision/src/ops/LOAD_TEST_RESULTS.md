# Cache Load Test — 2026-03-18

Ran k6 against a staging pod with production-shaped traffic for 30 minutes.

## Setup

- 3 pods, stateless routing (k8s service round-robin)
- Each pod runs 1 node process, SQLite KV cache local to the pod
- Sustained load: 12,000 requests/sec across pods (~4,000/sec/pod)
- Workload mix: 70% session reads, 25% feature-flag reads, 5% writes

## Results

| Metric | Value |
|--------|-------|
| p50 latency | 0.4 ms |
| p95 latency | 1.8 ms |
| p99 latency | 4.2 ms |
| p99.9 latency | 11 ms |
| Cache hit rate | 98.1% |
| Errors | 0 |
| Disk IO on hot path | 0 (working set fits in page cache) |
| Memory per pod | ~180 MB |

## 6-month stability

No latency regressions observed since 2025-09. No cache-related incidents. No
"cache is the bottleneck" pager alerts. Working set has grown ~14% YoY, still
well below RAM budget.

## Known limitations (not blockers today)

- No cross-pod pub/sub — we don't need it; routing is sticky at the pod level
- No atomic INCR/DECR — we don't do rate-limiting in cache
- WAL checkpoint spikes at ~2am cause a ~40ms p99 blip for one minute; not
  user-visible because traffic is low

## k6 snippet

```js
import http from 'k6/http';
export const options = { vus: 200, duration: '30m' };
export default function () {
  const sid = `s_${Math.floor(Math.random() * 200000)}`;
  http.get(`https://stg.example.com/session/${sid}`);
}
```
