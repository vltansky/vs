# Bound non-trivial work with evidence checkpoints

- Date: 2026-08-21
- Related: [`completion-claims-inherit-verify-status.md`](./completion-claims-inherit-verify-status.md), [`batch-approvals-and-silent-polling-in-loops.md`](./batch-approvals-and-silent-polling-in-loops.md), [`deliver-complex-explanations-in-two-layers.md`](./deliver-complex-explanations-in-two-layers.md)

## Context

VS already has Goal Contracts in shaping, phase boundaries at workflow handoffs,
verification status, and task-specific monitoring rules. These controls activate
at different points and only after the user chooses the workflow that owns them.
Direct build, investigation, and coordination work can therefore continue
without one explicit boundary for outcome, proof, authority, and stopping.

The intended user wants VS to resolve facts and safe next steps autonomously,
while surfacing only decisions that change scope, authority, or outcome. Adding
more visible forms, timers, or commands would increase the same cognitive load
the change is meant to reduce.

## Decision

Every non-trivial owning workflow applies one inferred work contract before
broad execution:

- observable outcome;
- in-scope and out-of-scope boundaries;
- proof required;
- durable artifact when one is useful;
- authority already granted;
- reassessment and stop triggers.

The contract is internal by default. The agent states or asks about a field only
when it is unresolved and changes the next action. Simple, already-bounded work
does not emit a contract, checkpoint, ledger, or extra question.

Reassess at evidence events rather than elapsed-time intervals: a phase
completes; two focused hypotheses fail; the same connector or authorization
boundary fails again; scope or authority would expand; broad scanning or
expensive delegation is proposed; or the next claimed delivery gate lacks
proof. Choose one result: continue, narrow, hand off, park with a resume
condition, or stop.

Facts and mechanics remain the agent's responsibility. Ask the user only for a
strategic choice, access, ownership, or authority that the available evidence
cannot settle.

When an outcome crosses delivery boundaries, use one relevant-gate ledger. Its
available gates are code, tests, review, merge, deployment, live behavior, and
monitoring or analytics. Include only gates required by the claimed outcome.
Chat shows the current gate and next blocker; detailed state stays in the
workflow artifact.

## Consequences

- Positive: VS can continue safe work without making the user manage each step.
- Positive: repeated failures and scope expansion produce an explicit narrow,
  handoff, park, or stop decision instead of a loop.
- Positive: merge, deployment, live behavior, and monitoring remain distinct
  without forcing irrelevant gates into every report.
- Negative: a broad or verbose interpretation would add ceremony. Negative
  evals must prove that simple work stays simple.
- Negative: stochastic behavior evals can overstate confidence. At least one
  assertion must inspect an observable action or side effect, not only prose.

## Alternatives considered

- Add a new top-level focus or operating command: rejected because the user
  would have to remember to invoke the safeguard.
- Copy the rules into every owning skill: rejected because the copies would
  drift and direct workflows would behave differently.
- Check progress on a timer: rejected because elapsed time is not evidence that
  the plan should change.
- Enforce every delivery gate for every outcome: rejected because irrelevant
  gates create noise and false blockers.
