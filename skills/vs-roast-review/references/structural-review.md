# Structural Review

Use this reference when the change technically works but may make the codebase
harder to maintain.

## Main Lens

Be ambitious about structural simplification, but stay inside the requested
scope. Do not stop at local polish when the better review finding is that a
state shape, ownership boundary, default flow, or canonical helper could make a
whole branch of complexity disappear.

Ask:

- Can this be reframed so fewer concepts, branches, helper layers, or modes are
  needed?
- Does the change improve or worsen the local architecture?
- Did a cohesive module become more coupled, more stateful, or harder to scan?
- Is the logic living in the file, package, or layer that owns the concept?
- Are repeated conditionals pointing at a missing model, dispatcher, helper, or
  policy object?
- Is the abstraction earning its keep, or is it a wrapper that hides a direct
  flow?
- Did the diff introduce casts, optionality, or loose object shapes that obscure
  the real invariant?
- Is orchestration more sequential or less atomic than it needs to be?

## Structural Smells

Flag these aggressively when they are supported by code evidence:

- a complicated implementation where a clearer model could delete whole
  categories of complexity
- refactors that move complexity around without reducing the number of concepts
  a reader must hold
- a file crossing 1000 lines due to the change, especially when new code can be
  split into focused modules
- new conditionals bolted onto unrelated paths
- one-off booleans, nullable modes, or flags that complicate existing control
  flow
- feature-specific logic leaking into general-purpose modules
- generic or magical handling that hides a simple data shape
- thin wrappers or identity abstractions that add indirection without clarity
- unnecessary casts, `any`, `unknown`, or optional params that muddy the real
  contract
- bespoke helpers where the codebase already has a canonical utility
- sequential async flow where independent work could be simpler in parallel
- partial-update logic that leaves state half-applied

## Preferred Remedies

Prefer suggestions that reduce the number of moving parts:

- delete a layer of indirection instead of polishing it
- reframe the state model so conditionals disappear
- move ownership so the feature naturally extends the right abstraction
- turn special cases into a simpler default flow with fewer exceptions
- extract a helper or pure function when it genuinely makes callers simpler
- split a large file into focused modules
- replace condition chains with a typed model or explicit dispatcher
- separate orchestration from business logic
- collapse duplicate branches into one clearer flow
- delete wrappers that do not clarify the API
- reuse the canonical helper instead of adding a near-duplicate
- make type boundaries explicit so control flow gets simpler
- move logic to the package/module/layer that owns the concept
- parallelize independent work when it also simplifies orchestration
- make related updates atomic when partial state would be harder to reason about

## Review Posture

Do not flood the review with low-value nits when structural issues exist. A
small number of high-conviction structural findings beats a long cosmetic list.

Behavior passing is not enough by itself. If the implementation works but makes
the surrounding code more tangled, say so and suggest a cleaner decomposition.
