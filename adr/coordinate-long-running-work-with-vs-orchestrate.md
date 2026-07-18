# Coordinate long-running work with vs-orchestrate

- Date: 2026-07-18

## Context

vs covered three time horizons and left one open. shape-it produces a frozen
spec with a Goal Contract and an Execution Strategy — a static blueprint for a
single build. build-it runs one session of seven phases. baby-sit tends one PR.
Nothing maintained a durable, milestone-based roadmap across hours or days,
re-audited it as implementation surfaced new facts, and moved a single active
objective from one milestone to the next.

The pattern is well established in practice (Gabriel Chua's "Collaborating with
Codex on Long-Running Tasks": a coordinator thread plus a milestone-based
GOALS.md, one active Goal-mode objective at a time, a per-milestone audit and
review before the next objective activates). It is exactly the layer vs lacked.

## Decision

Add `vs-orchestrate`, a thin coordinator skill above build-it.

- It owns a living GOALS.md roadmap, keeps exactly one milestone active, and
  delegates each milestone to `/vs-build-it` (or bounded workers per the
  Execution Strategy). It never implements.
- The spec and GOALS.md are separate and cross-linked. The spec stays frozen as
  the why/what/blueprint; GOALS.md is the living execution state and is written
  only by orchestrate. The Execution Strategy describes lanes within a
  milestone; GOALS.md tracks state across milestones.
- Between milestones a gate runs in fresh context: audit GOALS.md against
  reality, `/vs-roast-review` the implementation, and `/vs-verify` the
  milestone's required evidence. A milestone is complete only when its evidence
  exists; the verify status is inherited verbatim.
- Codex-first: one Goal-mode objective maps to the active milestone. Claude Code
  degrades to GOALS.md as the persistent objective and subagents for delegation.
- It is user-invoked only (`disable-model-invocation`); build-it and shape-it
  reference it as a handoff rather than auto-triggering it.

vs-afk is removed in the same change: duration-boxed autonomous sessions are
superseded by milestone-based coordination on a better axis.

## Consequences

- Positive: long-running projects keep a current, auditable roadmap; the next
  decision reflects what implementation actually uncovered
- Positive: reuses build-it, roast-review, verify, subagents.md, and codex-goal
  instead of duplicating them
- Negative: a fourth long-running entry point (shape-it/build-it/baby-sit/
  orchestrate) is more surface to teach; mitigated by a sharp "use when
  multi-milestone" trigger and explicit boundaries
- Follow-up: dashboard and report formats are conventions in a reference doc, not
  skill logic; keep them proportional

## Alternatives considered

- Extend build-it with a milestone loop: rejected — build-it is deliberately a
  single-run seven-phase workflow; a multi-day loop blows its scope and evals
- Convention-only (a GOALS.md doc plus wiring, no skill): rejected for the
  control loop itself (one active goal, delegate, audit, re-activate is real
  behavior that wants a body), but adopted for the dashboard and report formats,
  which live as reference conventions
- Keep vs-afk alongside it: rejected — the two overlap and afk's duration axis is
  the weaker framing for work that should be milestone- and evidence-bounded
