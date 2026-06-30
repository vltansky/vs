---
name: pushback
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

If the input is raw or unformed, route to `/shape-it` first.

## Core rules

- Push back first. Do not accept the framing just because the user proposed it.
- Use evidence before opinion. Check code, docs, screenshots, metrics, and prior
  artifacts before asking what they can answer.
- Ask only strategic questions. The user owns intent and tradeoffs; you own
  mechanics, sequencing, wording, and safe defaults.
- One question at a time. Batch only tightly coupled choices, max 3.
- Every question must include a recommendation and concrete options.
- Keep each question turn short enough to answer quickly: one concern sentence,
  one recommendation sentence, and up to 4 options. No issue inventories.
- Make the recommendation option `A` and label it as the default. If the user
  replies `A`, `yes`, `recommended`, or similar, treat it as accepting the
  recommendation and move on.
- Show progress in every question header as `Q1 of N`. Use the planned minimum
  as `N`; if the grill may expand beyond the minimum, write `Q1 of 3+`.
- Demand numbers for claims like "fast", "simple", "small", or "scales".
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

Interactive first response must include `Stress-Test Assessment` and `**Q1 of`.
Keep it under about 160 words:

```text
Stress-Test Assessment
- Initial readiness: 58/100
- Weakest: premise

**Q1 of 3 - Premise**
Concern: ...
Recommendation: A
Options:
A) Accept recommendation (default)
B) Defend current plan
C) Modify
D) I don't know / skip / done
```

Never open with a standalone findings dump.

### 3. Grill

Cover the weakest dimensions first. Premise Challenge is mandatory.

For each question:

- re-ground the exact decision in one short sentence
- state the concern in one sentence
- give one recommendation
- offer options
- mark strong answers as well-defended
- mark unknown or deferred answers as unresolved, with severity
- stay under about 120 words unless the user asks for detail

Minimum coverage before verdict: 3 dimensions, including Premise Challenge. Once
that gate is met, stop and report when the user says `done`, signals closure, or
pivots toward implementation. Do not keep expanding just to be exhaustive.

### 4. Report

The chat report is compact by default, under about 500 words unless the user asks
for the full version. Save the same report to
`~/.vs/$PROJECT_ID/pushback/YYYY-MM-DD-<topic>.md` when file tools are available;
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
- `Recommended next step: rework the proposal first, then /build-it.`

## Workflow

**Prev:** `/shape-it`, `/rfc-research`, or a formed user idea/spec/plan
**Next:** `/build-it`, `/to-issues`, `/rfc-research`, or rework and run `/pushback` again
