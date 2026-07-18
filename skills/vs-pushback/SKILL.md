---
name: vs-pushback
description: "Use when a formed idea, plan, spec, or RFC needs adversarial review. Stress-tests assumptions, scores readiness, and returns a verdict."
disable-model-invocation: true
---

# Pushback

Adversarial review for a **formed** idea, spec, RFC, or plan. Find what breaks
before implementation starts, and keep the human-facing output short enough to
actually read.

<HARD-GATE>
Do NOT write code or begin implementation. Output is a stress-test, verdict, and
handoff only.
</HARD-GATE>

If the input is raw or unformed, route to `/vs-shape-it` first.

## Re-check mode

When pushback is re-invoked on a plan it already scored — in this session or
with a saved report under `~/.vs/$PROJECT_ID/vs-pushback/` — do not restart the
full grill. Verify what changed since the last verdict, lead with the single
highest-severity open concern as one round, and update the score and verdict.
A "one more pass" request wants the top remaining risk, not the full ceremony.
Return to the full flow only when the plan changed materially.

## Core rules

- Push back first. Do not accept the framing just because the user proposed it.
- Use evidence before opinion. Check code, docs, screenshots, metrics, and prior
  artifacts before asking what they can answer.
- Ask only strategic questions. The user owns intent and tradeoffs; you own
  mechanics, sequencing, wording, and safe defaults.
- Ask in rounds, not one at a time. Group up to 3 independent questions per
  round; every question in a round must be answerable without the others'
  answers. When a question depends on an earlier answer, hold it for a later
  round or state the dependency inline ("if Q1 is B, skip this").
- Render the round through the host's structured question tool when available
  (`AskUserQuestion` in Claude Code); see [internal-shared](../vs-internal-shared/SKILL.md)
  Structured questions. Keep the text `Round`/`Q` format for hosts without it
  and for open-ended defend/modify prompts.
- Every question must include a recommendation with a one-clause rationale —
  `Recommendation: A — <why>` — and concrete options. Users reliably ask "why
  is that better?" when the reason is withheld; answer it before it is asked.
- Keep each question compact: one concern sentence, one recommendation
  sentence, and up to 4 options on one line. Keep a round turn under about 250
  words. No issue inventories.
- Make the recommendation option `A` and label it as the default. Accept
  batched replies like `1A, 2 defend: <detail>, 3 skip`; a bare `A`, `yes`, or
  `recommended` accepts the recommendation for every open question.
- Number questions continuously across rounds (`Q1`..`Qn`) and show progress in
  the round header as `Round 1 of 2`; if the grill may expand beyond the
  planned minimum, write `Round 1 of 2+`.
- Demand numbers for claims like "fast", "simple", "small", or "scales". When
  a count or measurement is contested or load-bearing, compute it
  deterministically (a script or saved file), persist it with the report, and
  cite that artifact — do not re-derive it in chat where compaction can lose it.
- Do not accept "we'll handle it later" without owner, date, ticket, or explicit
  unresolved risk.
- Score the defense, not the vibes. Hand-waving loses points.

## Flow

### 1. Pre-scan

Read the proposal and relevant nearby context first:

- pointed docs/specs/issues/files
- prior artifacts in `~/.vs/$PROJECT_ID/{specs,rfcs,pushback,context}/`
- overlapping code, existing patterns, tests, deployments, data stores, owners
- simpler built-in or repo-native alternatives
- external prior art only when it would materially change the critique

Do not depend on, create, or update an in-repo `CONTEXT.md`.

If the proposal involves non-deterministic eval design, activate **Eval Quality**
and read [references/eval-quality-dimension.md](./references/eval-quality-dimension.md).
If it changes architecture, module boundaries, abstractions, or interfaces,
activate **Architecture Depth** and read
[references/architecture-depth-dimension.md](./references/architecture-depth-dimension.md).

### 2. Open compactly

Interactive first response must include `Stress-Test Assessment` and a
`**Round 1` header with `**Q1` inside it. Keep it under about 250 words:

```text
Stress-Test Assessment
- Initial readiness: 58/100
- Weakest: premise, assumptions

**Round 1 of 2 — Q1-Q3** (answer inline, e.g. `1A, 2C: <detail>, 3 skip`)

**Q1 - Premise**
Concern: ...
Recommendation: A — <one-clause why>
Options: A) Accept recommendation (default) B) Defend current plan C) Modify D) Skip

**Q2 - Assumptions**
...

**Q3 - Feasibility** (if Q1 is B, answer for the defended plan)
...
```

Never open with a standalone findings dump.

### 3. Grill

Cover the weakest dimensions first. Premise Challenge is mandatory.

For each question:

- re-ground the exact decision in one short sentence
- state the concern in one sentence
- give one recommendation
- offer options

Between rounds:

- process every answer before asking more: mark strong answers as
  well-defended and unknown or deferred answers as unresolved, with severity
- fill the next round with the questions unlocked or reprioritized by those
  answers; drop a batched question that a sibling's answer made moot, and say so
- challenge a vague answer in the next round as a named follow-up, not by
  re-asking the whole round

Minimum coverage before verdict: 3 dimensions, including Premise Challenge
(re-check mode is exempt). Once that gate is met, stop and report when the user
says `done`, signals closure, or pivots toward implementation. Do not keep
expanding just to be exhaustive.

### 4. Report

The chat report is compact by default, under about 500 words unless the user asks
for the full version. Save the same report to
`~/.vs/$PROJECT_ID/vs-pushback/YYYY-MM-DD-<topic>.md` when file tools are available;
do not write it into the project tree.

Always include `Verdict: <label>` and `Score: <n>/100` near the top, plus the
literal `## Handoff Context` header.

```markdown
Verdict: READY | READY_WITH_RISKS | NOT_READY
Score: 72/100

## Handoff Context
- Proposal: ...
- Verdict: ...
- Key Findings: ...
- User Decisions: ...
- Unresolved: ...

## Top Pushback
- [High] ...
- [Medium] ...
- [Low] ...

## Blast Radius
- Services/data/customers: ...

## Recommended Next Step
- ...
```

When Architecture Depth was active, add a short options comparison to the
report — the ranked alternatives and the deciding factor in plain terms (e.g.
latency vs ownership coupling). The user's real decision usually happens here,
not at the per-question options.

If high risk or disputed architecture remains and a second opinion skill is
available, use it briefly before the verdict. Treat it as evidence, not an
override.

## Dimensions

- **Premise Challenge**: real problem, do-nothing baseline, smaller wedge,
  reuse vs rebuild, falsifiable success.
- **Assumptions**: hidden business/user assumptions, invariants, ownership,
  undefined success criteria.
- **Feasibility**: prerequisites, sequencing, vendor/runtime limits, migration
  complexity, operational burden.
- **Edge Cases**: empty states, retries, timeouts, concurrency, rollback,
  partial rollout.
- **Security/Risk**: auth, authorization, sensitive data, abuse, blast radius,
  monitoring.
- **Maintainability**: ownership, testability, moving parts, abstractions, pain
  in 3-6 months.
- **Scope**: learning value, minimal wedge, deferred work, YAGNI.
- **Architecture Depth**: conditional; use for architecture, refactoring, module
  boundaries, abstractions, or interfaces.
- **Eval Quality**: conditional; use for non-deterministic eval design.

## Scoring

Base weights: Premise 20, Assumptions 20, Feasibility 20, Edge Cases 15,
Security/Risk 10, Maintainability 10, Scope 5. Add Architecture Depth or Eval
Quality as 10-point conditional dimensions when active, and normalize over active dimensions.

Adjustments:

- unresolved high: -10
- unresolved medium: -5
- unresolved low: -2
- strong defense of a risky point: +2, capped per issue

Verdicts:

- **READY**: 75+ and no unresolved high-severity issue
- **READY_WITH_RISKS**: 60-74, or 75+ with unresolved medium issues
- **NOT_READY**: below 60, or any unresolved high-severity blocker

## Implementation pressure

If the user asks to test or implement after a `NOT_READY` verdict, emit the
report first if needed, then use these anchors:

- `Stress-test only - not implementing here.`
- `Recommended next step: rework the proposal first, then /vs-build-it.`

## Workflow

Direct: emit **Next** only. Composed: return to caller.

**Prev:** `/vs-shape-it` | `/vs-rfc-research` | formed proposal
**Next:** `/vs-build-it`
**Relevant:** `/vs-roast-review`
