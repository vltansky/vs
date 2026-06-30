---
name: vs-perf
description: "Use when optimizing latency, throughput, memory, startup, bundle size, or any performance target that needs evaluator-backed proof."
---

# Perf

Performance work needs a scoreboard before code changes. This building block turns a
performance goal into an evaluator-backed loop: baseline, optimize, compare,
guard against regressions.

## Codex Goal Integration

When running in Codex, use
[`../vs-internal-shared/references/codex-goal.md`](../vs-internal-shared/references/codex-goal.md)
for standalone-goal rules.

Perf normally contributes measurement evidence to another workflow. If invoked
as the whole task, it may own a performance goal after the objective, metric,
evaluator, and pass contract are defined. Complete that goal when the result
reaches `PASS`, `FAIL`, `WARN_NO_BASELINE`, or `BLOCKED` with baseline/target
evidence and correctness guardrails reported.

## Flow Contract

- **Kind:** Building block
- **Inputs:** Performance objective, metric, evaluator command or benchmark path, acceptable regression boundaries
- **Outputs:** Baseline, target, optimization plan, checkpoints, and final pass/fail evidence
- **Status:** `PERF_READY`, `PASS`, `FAIL`, `WARN_NO_BASELINE`, or `BLOCKED`
- **Consumers:** `vs:shape-it` for performance-shaped plans, `vs:build-it` before implementation, standalone optimization runs
- **Skip conditions:** Skip when the requested change is not performance-sensitive or no measurable performance claim is being made

## Non-Negotiable Rule

Do not optimize before you know how to measure. If there is no evaluator, create
or identify one first. If no evaluator is realistic, report `WARN_NO_BASELINE`
and frame the work as cleanup or architecture, not proven performance.

## Procedure

1. **Define the target.** Name the metric: p95 latency, startup time, memory,
   bundle size, query count, render count, throughput, or another concrete value.
2. **Find or create the evaluator.** Prefer existing benchmarks, profiling
   scripts, integration tests with timing, or bundle analyzers.
3. **Record the baseline.** Run the evaluator before edits and capture the result.
4. **Set the pass contract.** Example: "PASS when p95 improves by 20% and tests
   still pass."
5. **Optimize in small patches.** Re-run the evaluator after each meaningful
   change.
6. **Guard correctness.** Pair performance checks with relevant regression tests.

## Output

```markdown
## Perf Result

- Status: PERF_READY | PASS | FAIL | WARN_NO_BASELINE | BLOCKED
- Objective: <performance goal>
- Metric: <what is measured>
- Evaluator: `<command or tool>`
- Baseline: <value or unavailable>
- Target: <pass contract>
- Evidence:
  - <checkpoint results>
- Correctness guardrails:
  - <tests/build/lint results>
```

## Workflow

**Prev:** `/vs-shape-it`, `/vs-rfc-research`, direct optimization request
**Next:** `/vs-build-it`, `/vs-verify`, `/vs-ship-it`
