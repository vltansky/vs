# Task 5: Concept explainer

Write an explainer of idempotency keys. Audience: product managers and support staff who are technical enough to read an API doc but do not write code. They need to understand it well enough to reason about what customers experience.

Material you may use:
- an idempotency key is a unique value the client generates and sends with a request
- the server stores the key with the result of the first request that used it
- if the same key arrives again, the server returns the stored result instead of doing the work again
- the point: a network can fail after the server did the work but before the client heard back. the client cannot tell "it failed" from "it worked but the answer got lost". retrying without a key risks charging twice.
- keys are typically scoped per endpoint and expire (24h is common)
- a key only protects against duplicate delivery of the *same* request. two genuinely different charges need two different keys.
- if a client reuses a key with a *different* request body, most APIs reject it with an error rather than silently returning the old result. this is a common source of confusing support tickets.
