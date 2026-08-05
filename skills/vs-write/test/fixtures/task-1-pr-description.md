# Task 1: PR description

Write the pull request description for this change. Audience: reviewers on the team.

Raw notes from the author:
- replaced fixed-window rate limiter with sliding-window log
- reason: fixed window let a client burst 2x the limit across the window boundary (reported by @dana, ticket OPS-4412)
- touched: limiter/window.ts, limiter/eval.lua, config/schema.ts, server/middleware.ts
- counter moved from in-process Map to Redis. in-process broke as soon as we ran more than 1 replica, limits were effectively per-replica
- operators MUST set REDIS_URL. if unset the service falls back to in-memory and logs a warning at startup. it does not fail closed.
- p99 latency +3ms measured on staging over 40 min at 1.2k rps
- 11 new unit tests, 1 integration test that spins 3 replicas
- no test for redis failover yet. if redis goes away mid-request the limiter currently throws and the request 500s. we think that's wrong but fixing it is out of scope here.
- reviewers: the only place atomicity is actually enforced is the lua script in limiter/eval.lua, that's the part worth reading closely
