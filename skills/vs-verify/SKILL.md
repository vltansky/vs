---
name: vs-verify
description: "Use when asked to verify, prove it works, check completion, or before claiming done. Produces evidence-backed PASS/WARN/FAIL status."
---

# Verify

Prove that a change actually works before anyone claims completion.

Use this as a standalone check or as the verification building block inside delivery
flows. It is intentionally smaller than QA: QA explores user-visible behavior;
verify proves the specific promised outcome with the cheapest sufficient
evidence.

## Flow Contract

- **Kind:** Building block
- **Inputs:** Claimed outcome, changed files or branch diff, and any known guardrail commands
- **Outputs:** `## Verification Result` with status, evidence, gaps, and next action
- **Status:** `PASS`, `WARN`, `FAIL`, or `BLOCKED`
- **Consumers:** `vs:build-it`, `vs:bugfix`, `vs:fix-pr`, `vs:ship-it`, standalone pre-handoff checks
- **Skip conditions:** Do not skip for non-trivial changes. For docs-only or trivial diffs, record `SKIPPED_TRIVIAL` with the reason.

## Verification Ladder

Use the cheapest check that proves the behavior. Stop when the proof is strong
enough; do not run the entire suite by reflex.

1. **Acceptance evidence** - identify the behavior or claim that must be true.
2. **Targeted tests** - run existing focused tests first.
3. **Guardrails** - run typecheck, lint, build, or full tests when they are the
   meaningful proof for this change.
4. **Direct checks** - run a small command, script, curl, or smoke path that
   demonstrates the behavior.
5. **Manual/visual evidence** - for UI or integration behavior that automation
   cannot prove, capture the observable state and any remaining manual gap.
6. **Independent reproduction** - for high-stakes or disputed claims (the user
   doubts the fix, the bug already survived one "fixed" claim, production is
   involved), dispatch one or more fresh-context agents to reproduce the
   behavior without telling them the suspected cause or expected result. Their
   observed behavior is the evidence; green unit tests alone stay `WARN`.
7. **Artifact identity** - for deploy or publish claims, prove the served
   artifact actually changed: compare bundle hash, version, or etag against
   the built output. Reachability (HTTP 200) alone proves nothing about which
   build is live.

## Rules

- Never report `PASS` without naming the command, check, or observation that
  proved the claim.
- If a check fails, report `FAIL` and the smallest useful failure excerpt.
- If the environment blocks verification, report `BLOCKED` and name exactly what
  is missing.
- If tests pass but the user-visible behavior was not exercised, report `WARN`,
  not `PASS`.
- A deploy claim verified only by reachability is `WARN` until artifact
  identity is confirmed.
- Keep logs concise. The result should be a proof summary, not a transcript dump.

## Status inheritance

Consumers repeat the verify status; they do not soften it:

- A workflow that includes verification reports the verify status verbatim in
  its completion summary. While the status is `WARN`, `FAIL`, or `BLOCKED`, the
  summary must not say "fixed", "working", or "complete" — say what was proven
  and what was not, e.g. "Deployed; fix not verified against the reported
  crash."
- A bug-fix claim requires the reproduction that defined the bug to pass now.
  Green adjacent tests, passing guardrails, or a successful deploy do not
  upgrade the claim.

## Output

```markdown
## Verification Result

- Status: PASS | WARN | FAIL | BLOCKED
- Claim: <what was being proven>
- Evidence:
  - `<command or observation>` - <result>
- Gaps:
  - <anything not proven, or "none">
- Next action:
  - <ship / fix / run QA / ask user / unblock environment>
```

## Workflow

**Prev:** `/vs-build-it`, `/vs-bugfix`, `/vs-fix-pr`, `/vs-qa`, direct implementation
**Next:** `/vs-brief`, `/vs-ship-it`, or fix the failing evidence
