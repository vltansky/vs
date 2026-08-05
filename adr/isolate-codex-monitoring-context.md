# Isolate Codex monitoring context

- Date: 2026-08-06
- Supersedes the Codex waiting guidance in
  `use-runtime-specific-watch-primitives.md` where this decision is more
  specific.

## Context

Stateful watcher processes already suppress unchanged GitHub output, but that
does not eliminate Codex model cost. Resuming a terminal cell or task wait can
replay the surrounding conversation even when the process prints nothing.
Long implementation tasks therefore amplify a cheap external poll into a large
cached-context read.

The same issue applies to live task control. `wait_threads` wakes early for
completion, attention, or new user input, so a one-minute timeout does not make
those events arrive faster. It only forces more unchanged model turns.

## Decision

- Use event-aware waits with coarse checkpoints: five minutes initially and ten
  minutes after an unchanged cycle in Codex Desktop.
- Batch up to eight task targets in one `wait_threads` call and retain cursors.
- Run sustained PR or task monitoring outside a long implementation transcript.
  Use a fresh-context Codex subagent with `fork_turns="none"` and a standalone
  monitoring contract when the calling task contains substantial unrelated
  history.
- Use a routine lower-cost model for the waiting lane when model selection is
  available. Return difficult diagnosis and code changes to the owning task.
- Keep one watcher owner. The parent waits once for attention or completion and
  does not mirror the watcher with `wait_agent`, `list_agents`, terminal, or
  GitHub polling.

## Consequences

- Positive: unchanged waits stop repeatedly rereading implementation history.
- Positive: completion, attention, and user input still wake immediately.
- Positive: state classification, intervention, and terminal verification stay
  in the existing skills rather than being weakened for cost.
- Negative: a queued ninth task can wait up to the coarse checkpoint before its
  batch rotates.
- Negative: a fresh watcher needs a small explicit handoff and one coordination
  boundary.

## Alternatives considered

- Silent subprocess output only: rejected because model resumes still carry
  context cost.
- One-minute `wait_threads` timeouts: rejected because event wakes already
  provide low attention latency.
- Stop monitoring and ask the user to return later: rejected because it removes
  the autonomous value the workflow exists to provide.
- Use a cheap model for the whole task: rejected because CI diagnosis and code
  repair may still need the original high-capability owner.
