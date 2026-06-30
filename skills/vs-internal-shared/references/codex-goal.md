# Codex Goal Integration

Use this reference for VS skills that run in Codex and have access to goal
tools.

## Ownership Rule

Only VS **workflow** skills should create or complete Codex goals. Building
blocks contribute evidence to the active workflow goal unless the user invoked
the building block as a standalone outcome.

- **Owns goals:** `shape-it` for shaping sessions, `improve`, `build-it`,
  `ship-it`, `bugfix`, `fix-pr`, `afk`, `baby-sit`
- **Usually contributes evidence:** `tdd`, `debug-mode`, `qa`, `verify`,
  `roast-review`, `deslop`, `brief`, `pushback`, `github-research`, `rfc-research`,
  `to-issues`, `steal`, `perf`
- **Standalone exception:** a building block may own a goal when the user invokes
  it directly as the whole task, for example "optimize this endpoint with perf"
  or "turn this spec into GitHub issues"

## Goal-Ready Shape

Before creating a goal, make sure the objective is concrete enough to complete.

A goal is ready when it has:

- **Objective:** one concise outcome suitable for `create_goal({ objective })`
- **Scope:** target files, surfaces, workflows, PR, issue, or product area
- **Success criteria:** observable conditions that prove the goal is done
- **Verification plan:** tests, guardrails, CI, UI checks, review state, or
  acceptance checks to run before completion

If intent is vague, route through `shape-it` or ask the minimum blocking
clarification needed to produce this shape. Do not create an implementation goal
for vague intent.

## Goal Tool Setup

When goal tools are available:

1. Call `get_goal`.
2. If there is no active goal, call `create_goal` with the goal-ready objective.
   Omit `token_budget` unless the user explicitly supplied one.
3. If an active goal matches the current workflow objective, reuse it and note
   that in the workflow decision log.
4. If an active goal conflicts with the current workflow objective, do not
   overwrite or complete it. Continue with the workflow's own handoff/decision
   log and report the conflict.
5. If goal tools are unavailable, continue normally and report goal state as
   unavailable in the handoff when the workflow has a handoff section.

Goal state is bookkeeping, not evidence. Do not use it as a replacement for
commits, tests, CI, review-thread state, issue links, or handoff summaries.

## Completion Rules

- Call `update_goal(status="complete")` only after the workflow's requested
  outcome is implemented or produced, verified, and reported.
- Do not mark a goal complete when a circuit breaker, external dependency,
  pending review, or human decision remains.
- Use `blocked` only when Codex goal policy allows it. Otherwise leave the goal
  active and report the blocker in the workflow handoff.

## Workflow Mapping

| Skill | Create/reuse goal when | Complete when |
|---|---|---|
| `shape-it` | A shaping session has a clear planning objective | Approved design/spec or challenge verdict produces goal-ready next step |
| `improve` | Audit scope and output target are clear | Findings/plans/index are written, or `execute` verdict is delivered |
| `build-it` | Build objective is goal-ready; vague intent has been shaped | Implementation, verification, review/QA, and handoff are complete |
| `ship-it` | Branch/PR outcome is clear | PR is created, pushed, evidence is included, and CI/reviewer state is handled or handed off |
| `bugfix` | Bug statement, target area, and reproduction/verification plan are clear | Root cause fixed, regression verified, guardrails run, handoff complete |
| `fix-pr` | Target PR and unresolved feedback scope are known | Accepted fixes are pushed, approved replies posted, approved threads resolved, build rechecked |
| `afk` | Work source and time-boxed session plan are selected | AFK handoff reports completed work/current state, or blocker is recorded |
| `baby-sit` | Target PR is known | PR is merge-ready, merged, or explicitly blocked with evidence |
| `to-issues` | Standalone issue-generation task is the whole request | Drafts/index/issues are created or ready for approval |
| `perf` | Standalone performance objective is the whole request | Baseline/target/evidence reaches PASS, FAIL, WARN, or BLOCKED status |

## Handoff Line

When a workflow has a handoff shell, include a compact line:

```markdown
### Codex Goal
[created/reused/completed/unavailable/left active because ...]
```

For planning-only workflows, phrase it as planning state if clearer:

```markdown
### Codex Goal
Planning goal completed; next implementation objective: <objective>
```
