# Execution blueprints govern build-it delegation

- Date: 2026-07-18

## Context

A five-day multi-surface migration run in Codex exposed how build-it delegates
without a contract: fifteen workers were spawned, every one forking the full
parent transcript on the default model, so a single-purpose reproduction
worker carried ~232K tokens of migration history and the session hit token
exhaustion. Two parallel workers wrote the same branch and produced a commit
that "accidentally bundled backend work with mobile changes". One worker
consumed a full forked context and exited without returning evidence.

Separately, vs-shape-it recently gained a Goal Contract and Execution Strategy
section (workstreams with owner primitive, effort, inputs, outputs,
dependencies, write scope, verification; waves with merge gates). Nothing made
build-it consume it.

## Decision

The shape-it Execution Strategy is the delegation contract, and build-it
enforces its constraints even when no blueprint exists:

- Build-it reads the Goal Contract and Execution Strategy before planning and
  does not re-derive an execution topology the spec already provides.
- Parallel workers require disjoint write scopes; intersecting lanes run
  sequentially or stay in the parent. Workers commit only inside owned paths.
- Workers get curated briefs (objective, owned paths, evidence paths,
  guardrails, return shape), never a full parent-transcript fork for a scoped
  lane. Effort and model follow the lane's assignment.
- Every brief names a first milestone that produces evidence before broad
  edits; a worker returning without evidence or changes counts as failed and
  gets a re-scoped brief, not a re-run.
- Spawned thread/task IDs are confirmed live before anything waits on them.

## Consequences

- Positive: parallel lanes cannot collide on shared files or branches
- Positive: worker context cost scales with the lane, not with parent history
- Positive: silent worker failures are detected at the first milestone, not
  after a full context is spent
- Negative: writing per-lane briefs and path allowlists is upfront work that
  small tasks do not need — the direct execution path remains the default
- Follow-up: shape-it and build-it evals should exercise a blueprint handoff
  end to end

## Alternatives considered

- Keep delegation heuristics inside build-it only: rejected — the shaping
  phase already knows the topology, and re-deriving it at build time is where
  the analyzed session went wrong
- Full-history forks for continuity: kept only for genuine continuation
  threads; rejected as the default because context cost multiplies by worker
  count
