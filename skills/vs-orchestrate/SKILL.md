---
name: vs-orchestrate
description: "Use when the user says orchestrate, coordinate a long-running project, or run a multi-milestone build across hours or days. Maintains a living milestone roadmap and drives one milestone at a time."
disable-model-invocation: true
---

# Orchestrate

Coordinate a project that spans several milestones and is expected to uncover
new facts while it runs. Keep a living roadmap, drive one milestone at a time,
and stay oriented as the work changes.

<HARD-GATE>
Do NOT implement. Orchestrate owns the roadmap, the active objective, and
delegation. Each milestone's implementation goes to `/vs-build-it`; shipping
goes to `/vs-ship-it` and `/vs-baby-sit`. Output is roadmap state, delegation,
milestone gates, and concise progress reports.
</HARD-GATE>

## Use when

- The work is large enough to split into milestones, likely to run for hours or
  days, and expected to surface new implementation details or decisions midway.
- You want one place that stays current on objective, state, and next decision
  while workers churn through detail.

Do not reach for this on a single-session change (use `/vs-build-it`) or a
single PR to tend (use `/vs-baby-sit`). If the project fits one build-it run,
it does not need a coordinator.

A spec containing several desirable milestones is not enough. Orchestrate only
when the smallest valuable deployable outcome itself needs durable coordination
across milestones. If one build-it run can ship that slice, route there and
leave later capabilities as follow-ups.

## Boundaries

- `/vs-shape-it` produces the frozen spec (why, what, Goal Contract, Execution
  Strategy), approved once. Orchestrate does not rewrite the spec.
- `/vs-build-it` executes one milestone end to end. Orchestrate calls it per
  milestone and never duplicates its phases.
- `/vs-baby-sit` tends one PR. Orchestrate may hand a shipped milestone to
  ship-it/baby-sit, then continue.
- **GOALS.md** is the living execution state across milestones and is owned only
  by orchestrate. It is separate from the spec and cross-links to it. The spec's
  Execution Strategy describes lanes *within* a milestone; GOALS.md tracks state
  *across* milestones.

## Codex goal integration

When running in Codex, use
[`../vs-internal-shared/references/codex-goal.md`](../vs-internal-shared/references/codex-goal.md)
for goal ownership and completion rules. Keep exactly one Goal-mode objective
active at a time, set to the current milestone's outcome and its evidence.
Complete it only when that milestone's evidence exists, then activate the next.

In Claude Code or any host without native goals, GOALS.md is the persistent
objective: re-read it at the start of each milestone and after each gate, and
delegate through subagents instead of threads. The loop below is identical; only
the persistence and delegation primitives change.

## Flow

Follow [`../vs-internal-shared/references/subagents.md`](../vs-internal-shared/references/subagents.md)
for delegation limits, curated worker briefs, and collection.

### 1. Seed the roadmap

Read the approved spec's Goal Contract and Execution Strategy. Write GOALS.md as
a milestone list using the schema in
[`references/goals-roadmap.md`](./references/goals-roadmap.md). Cross-link the
spec and GOALS.md both ways. Do not re-derive an execution topology the spec
already provides; carry its milestones and lanes forward.

If no spec exists, route to `/vs-shape-it` first — orchestrate coordinates a
shaped project, it does not shape one.

Before writing GOALS.md, perform a proportionality check: name the smallest
deployable vertical slice and determine whether it fits one `/vs-build-it` run.
If it does, hand off to build-it and stop; do not create a roadmap merely because
the spec lists later providers, reliability work, dashboards, or experiments.
The slice must advance the approved outcome beyond the confirmed baseline; an
audit of behavior already known to work is evidence, not a substitute delivery.

### 2. Activate one milestone

Set the active objective to the current milestone's outcome and evidence.
Exactly one milestone is active. Keep this thread focused on objective,
constraints, decisions, and state — not implementation detail.

Order milestones by delivery uncertainty:

1. user help, external access, approval, or ownership needed for proof;
2. the cheapest test of a plan-invalidating assumption;
3. the smallest deployable vertical slice;
4. deeper reliability, scale, and optional capabilities.

An inventory or internal foundation is not automatically Milestone 0. Put it
first only when it changes a decision or unblocks the vertical slice.

### 3. Delegate

Hand the milestone to `/vs-build-it` (load `../vs-build-it/SKILL.md` directly;
if the host cannot resolve it, tell the user to type `/vs-build-it` for the
milestone and stop — do not hand-roll it). For bounded side work — a scoped
investigation, an audit, a fix — delegate a worker per the Execution Strategy's
lanes. Prefer a separate thread when the work should stay inspectable later; a
subagent for bounded work that needs no visible history. Workers return
conclusions, changes, and evidence, not transcripts.

### 4. Gate proportionally

Before activating the next milestone, audit GOALS.md against reality: is the
milestone actually done, is the next one still right, did evidence reorder the
work, and does the definition of done still hold? This audit is lightweight and
stays in the coordinator unless independence materially improves the evidence.

Use `/vs-roast-review` and `/vs-verify` at risky integration, irreversible data,
security, external mutation, deployment, or final acceptance boundaries. Group
several low-risk internal milestones behind one integration gate instead of
paying the full review/verify ceremony after each artifact. A milestone still
needs its stated evidence before completion; when `/vs-verify` runs, inherit the
verify status verbatim and never call `WARN` or `BLOCKED` complete.

Update GOALS.md with what the gate found, then activate the next milestone.

### 5. Report on change

Report only when state changes, using three short sections — what's done,
what's next, blockers. Between changes, stay silent; do not narrate idle polls.
On the initial roadmap report, and whenever dependencies or parallel lanes
materially change, include a compact Mermaid flowchart derived from GOALS.md.
Show the active milestone, parallel lanes, merge gates, and evidence gates; do
not diagram a short linear roadmap merely to decorate the update. Follow the
Mermaid guidance in
[`../vs-internal-shared/references/rich-artifacts.md`](../vs-internal-shared/references/rich-artifacts.md).
For a project with several milestones or parallel lanes, maintain the optional
`progress-dashboard.html` described in the reference so an away user can orient
without reading every worker.

Local machine checks — a signed-in browser, simulator, credentials, desktop
permissions — go to a local thread that tests the current diff and returns
screenshots, logs, and findings; a remote worker fixes and the local thread
re-checks.

## Stop conditions

- All milestones complete with their evidence → final report, stop.
- A milestone is blocked on a strategic decision, missing access, or a contradiction
  the roadmap cannot resolve → report it and stop for the user.
- The spec's premise no longer holds (discovery invalidated it) → stop and route
  back to `/vs-shape-it`; do not quietly redesign.

## Verification

Before finishing, check:

- GOALS.md exists, uses the milestone schema, and cross-links the spec
- exactly one milestone was active at a time
- the proportionality check did not turn a one-run vertical slice into a roadmap
- milestones addressed user dependencies and plan-invalidating risks before
  broad foundations
- every milestone passed a lightweight reality audit; full review and verify ran
  at the relevant risk, integration, deployment, or acceptance boundaries
- no milestone was marked done without its evidence
- no implementation happened in this thread; each milestone went to build-it
- reports were change-only; blockers are explicit
- non-trivial roadmap topology was explained with Mermaid when first shown or changed

## Workflow

Direct: emit **Next** only. Composed: return to caller.

**Prev:** `/vs-shape-it` | multi-milestone spec
**Next:** `/vs-build-it`
**Relevant:** `/vs-baby-sit` | `/vs-decide-for-me`
