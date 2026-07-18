# Completion claims inherit the verify status

- Date: 2026-07-18

## Context

Transcript analysis of real vs sessions found the most damaging recurring
failure was overclaiming: build-it and ship-it summaries said "Fixed" or
"Build It Complete" while `vs-verify` had returned `WARN` and the reported bug
still reproduced in production. In one session the pipeline shipped "fixed and
deployed" three to four times for a crash that was never reproduced-then-made
green, driving an escalating user disbelief loop ("production test failed. its
still crashed"). The verify skill's own rule — behavior not exercised means
`WARN`, not `PASS` — was being produced correctly and then bypassed by the
consuming workflow's summary wording.

## Decision

The verify status is the single source of truth for completion claims across
the suite.

- Workflows that include verification report the verify status verbatim in
  their completion summaries. While the status is `WARN`, `FAIL`, or
  `BLOCKED`, a summary may not describe the outcome as fixed, working, or
  complete; it states what was proven and what was not.
- A bug-fix claim requires the reproduction that defined the bug to pass now.
  Green adjacent tests, passing guardrails, or a successful deploy do not
  upgrade the claim.
- Build-it's `## Build It Complete` banner is reserved for `PASS` or
  `SKIPPED_TRIVIAL`; other statuses head the handoff with the status itself.

## Consequences

- Positive: users can trust completion summaries; a WARN can no longer be
  laundered into "Fixed" by the workflow above it
- Positive: the disbelief loop (user re-testing every claim) goes away when
  claims are calibrated
- Negative: more handoffs will read as unfinished even when substantial work
  landed — that is the honest state
- Follow-up: evals for build-it/ship-it should assert the banner matches the
  verify status

## Alternatives considered

- Keep summary wording free and rely on the embedded Verification Result block:
  rejected — users read the banner, not the collapsed block, and both analyzed
  sessions show the banner won
- Make verify block the workflow on WARN: rejected — WARN is often a legitimate
  manual gap; the fix is honest wording, not a harder gate
