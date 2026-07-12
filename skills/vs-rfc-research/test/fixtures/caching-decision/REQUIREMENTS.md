# Caching Layer — Open Question

We need to decide whether to adopt Redis as our caching layer for session
storage and feature-flag resolution. Leadership has asked for an RFC.

## Perceived problems (from a recent all-hands)

- "Our caching story feels home-grown"
- "We should use industry-standard infrastructure"
- "What if we need to scale?"
- "Redis is battle-tested — why are we rolling our own?"

## Scope

- Session storage: currently ~200k sessions, 24h TTL, read-heavy (70% of
  cache traffic)
- Feature flag lookups: currently ~60/sec, 60s TTL, read-heavy
- Workload is B2B SaaS, 12k rps peak, 3 pods, stateless routing

## What leadership wants in the RFC

- Clear recommendation (adopt / don't adopt / defer)
- Trade-offs with evidence
- If adopting: migration plan
- If not adopting: what would have to change for us to reconsider

## Non-goals

- Rewriting the storage layer
- Adding a messaging system (pub/sub)
- Multi-region replication
