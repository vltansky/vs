# Batch approvals and silent polling in long-running loops

- Date: 2026-07-18

## Context

Two frictions dominated the analyzed long-running baby-sit sessions. First,
approval fatigue with a contradiction at its core: the user's standing rule is
"never post PR comments without approval", while baby-sit's spec auto-replies
and auto-resolves — the run resolved the conflict by interrupting the user
four separate times for individual reply approvals. The same user's explicit
complaint elsewhere: "Claude ask for approvals non stop and becomes a serious
time waster… be more proactive go longer without asking me." Second, polling
narration: during a ~50-minute CI job the agent emitted ~30 near-identical
"still running at N minutes" messages, burning tokens and attention for zero
information.

## Decision

Long-running loops separate doing from asking and speak only on change:

- External-write policy is resolved once before the loop starts. When standing
  instructions forbid unapproved external writes, the loop runs in batch-ask
  mode: fixes are applied and pushed autonomously, and all pending
  replies/resolves are presented as one batched approval per cycle. Per-item
  interruptions are not allowed.
- Polls that observe no state change produce no user-facing message. Output is
  reserved for state changes, fixes/pushes, terminal conditions, and a coarse
  heartbeat (at most every 10 minutes).

## Consequences

- Positive: an away user returns to one approval prompt and a change-only log,
  not dozens of interrupts and status lines
- Positive: the skill no longer contradicts stricter user-level write policies
  — it adapts to them without losing autonomy on the fix loop
- Negative: batched replies land later than per-thread replies; reviewers see
  responses in bursts
- Follow-up: apply the same two rules to any future watch/monitor skill

## Alternatives considered

- Always auto-post (skill default wins over user policy): rejected — external
  writes are exactly where user policy must win
- Always ask per item: rejected — this is the measured failure mode
- Configurable poll verbosity: rejected as over-engineering; change-only output
  with a heartbeat covers the real cases
