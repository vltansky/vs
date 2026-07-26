# Require live run artifacts for workflow communication

## Status

Accepted — 2026-07-26

Extends [completion-claims-inherit-verify-status](./completion-claims-inherit-verify-status.md).

## Context

The shape/build/ship loop promises three different relationships with the user:
shape-it is where the user is very active, build-it is autonomous but shows its
work, ship-it hands control back. Reviewing roughly a dozen real runs, none of
the three held.

- Shape-it's load-bearing interaction had drifted into build-it. Shaping replies
  were `ok` / `agree`; the real decisions arrived mid-build as pasted
  screenshots.
- Build-it's QA phase was structurally dead. Ten of twelve sampled QA rows read
  `Not run` or `Blocked`, and the dominant stated reason was that reaching the
  surface would require starting a dev server the agent treated as forbidden.
  Build-it then handed proof back to the human: *please eyeball the live grid*.
- Handoffs were prose. The required sections mandated six blocks of text and
  zero viewable output; baselines were captured into a temp directory and then
  described rather than rendered.
- Ship-it had no terminal handback. Its last act was watching CI, so the user
  was never told what they had to check themselves or what was never proven.

The common failure is not laziness in any one phase. It is that nothing in the
contract distinguished *implemented* from *proven*, so an unprovable claim cost
a run nothing.

`completion-claims-inherit-verify-status` already established that a completion
claim inherits its verification status. That rule governs guardrails — types,
tests, build. It says nothing about the outcome the user actually asked for,
which usually lives on a surface no guardrail touches.

## Decision

**A phase may not claim an outcome it cannot show.** Three mechanisms enforce
it, one per phase.

1. **Shape-it names the evidence.** The Goal Contract gains a required
   `Evidence plan` line: the surface, the route or command, and the state or
   fixture that will prove the outcome. When nothing today can prove it, that is
   an `OPEN DECISION` raised in the closing interaction — build a surface,
   accept weaker proof, or descope. It is a strategic call, so the user makes
   it. This is what makes shape-it genuinely interactive: the user is deciding
   how the result will be judged, not answering trivia.

2. **Build-it shows its work.** It reports at phase boundaries rather than
   running silently, writes a portable HTMDX run report for non-trivial runs,
   and carries a required Evidence table pairing every claim with the thing that
   proves it. When the Evidence plan named a surface and nothing was captured,
   the handoff heads `## Build It — UNPROVEN` and may not describe the outcome
   as working.

3. **Ship-it hands over a surface.** It ends with a deployed preview URL, a
   local server it deliberately leaves running with its stop command, or the
   precise blocker — never none of the three. It opens the QA report and lists
   what was exercised, so "tested" is readable rather than asserted.

Two supporting changes make this possible:

- **Agent-owned previews are permitted.** An ephemeral, port-scoped,
  phase-scoped preview started to capture evidence is a capture mechanism, not a
  forbidden interactive dev server. Whoever starts one owns its lifetime and
  records the command, PID, port, and stop command. Build-it stops everything it
  starts in Phase 6; ship-it is the single deliberate exception, leaving one
  running *for the human*.
- **Skill changes bump the plugin version.** Skill text has no effect until the
  installed copy matches source, and a stale cache is invisible. A version bump
  alone does not update anyone's install, so "the user has the new behavior"
  stays an unproven claim until verified.

## Alternatives considered

**Require a deployed preview only, never a local one.** Safest lifecycle — the
agent starts nothing and leaks nothing. Rejected because it preserves the exact
condition that killed ten of twelve QA runs. Most repositories have no
per-branch deployment, so this is a rule that reads as strict and behaves as
permanently blocked.

**Keep artifacts optional, gated on visual changes.** The status quo. Rejected
because that gate is why most runs produce nothing viewable: an agent deciding
whether its own change is "visual enough" resolves toward no.

**Make build-it ask the user when it cannot capture evidence.** Rejected as a
direct contradiction of build-it's premise. The autonomy is the feature; the
interrupt class stays narrow — access, credentials, ownership, product intent —
and everything else resolves into an honest `UNPROVEN`.

**Extend `completion-claims-inherit-verify-status` in place.** Rejected on
convention: merged ADRs are immutable here. This is also a distinct decision —
that one governs guardrail status, this one governs how a run communicates.

## Consequences

- **More red verdicts, deliberately.** Removing the blocker removes the excuse.
  Runs that used to report "QA skipped" now report `UNPROVEN`. The count of
  successful-looking runs will drop before it rises; that gap was always there
  and was simply unlabeled.
- **Orphaned processes become possible.** An interrupted run can leave a port
  bound. Mitigated by recording command/PID/port, stopping in Phase 6, and
  reclaiming a stale surface instead of silently binding a second one.
- **Previews must never reach production data.** A preview runs project code
  with project configuration. If the only route to the named surface is a
  production credential, that is a blocker to report, not a step to take.
- **The HTMDX runtime is remote code with DOM access.** The existing boundary in
  `rich-artifacts.md` applies unchanged: redact secrets and PII, or stay in
  Markdown.
- **Artifacts could become ceremony.** Mitigated by keeping chat short and
  moving detail into the report rather than adding the report on top of an
  unchanged wall of chat.
