---
name: vs-build-it
description: "Use when the user says build-it, implement this plan, take it from here, or wants autonomous plan-to-code execution."
disable-model-invocation: true
---

# Build It

Work within the user's stated plan or requested outcome; stop for strategic blockers, product-intent changes, unrelated refactors, or explicit safety boundaries.

Build-it takes a plan (or generates one if needed) and runs seven phases within that scope:
1. **Roast** — load and follow the pushback skill to stress-test the plan
2. **Fix** — apply pushback findings directly to the plan
3. **Execute** — create branch and implement with TDD; escalate to debugging on evidence
4. **Review** — review the integrated diff once, with depth proportional to risk
5. **QA** — browser-test only changed user-visible browser behavior
6. **Cleanup** — remove temporary artifacts and verify everything still passes
7. **Handoff** — present results, suggest `/vs-ship-it`

Resolve tactical implementation decisions locally; do not expand scope beyond what is directly required for the stated outcome.

## Building Block Composition

Build-it is a workflow. It composes building blocks instead of inventing
one-off behavior:

- `vs-pushback` stress-tests the plan in Phase 1.
- `vs-decide-for-me` owns the no-questions decision ladder for tactical uncertainty.
- `vs-tdd` guides implementation; `vs-debug-mode` is loaded only after evidence
  shows that ordinary red/green feedback is insufficient.
- `vs-roast-review` and `vs-deslop` clean and review risky or substantial diffs
  in Phase 4; small diffs stay in the parent.
- `vs-qa` tests affected user-visible browser behavior in Phase 5.
- `vs-verify` produces the final evidence-backed completion status.
- `vs-brief` produces the human-readable orientation layer and renders captured
  before-and-after evidence for the handoff.
- `vs-walkthrough` explains how the shipped change behaves and how to prove it.

## Codex Goal Integration

When the user explicitly requests a Codex goal and goal tools are available,
use it as the run-level progress contract for build-it:

- Load [`../vs-internal-shared/references/codex-goal.md`](../vs-internal-shared/references/codex-goal.md) during Phase 0.
- Load [`../vs-internal-shared/references/subagents.md`](../vs-internal-shared/references/subagents.md) before delegating any work.
- Ensure vague intent is shaped into a Codex-goal-ready objective before calling
  `create_goal`.
- Keep goal state as bookkeeping only; the handoff still needs commits,
  guardrails, decision log, review findings, and the explicit next step.

## Decision Principles

These apply the shared `vs-decide-for-me` contract to every question that would normally go to the user:

1. **Completeness** — ship the whole thing. Pick the approach that covers more edge cases.
2. **Pragmatic** — if two options fix the same thing, pick the simpler one. 5 seconds choosing, not 5 minutes.
3. **DRY** — duplicates existing functionality? Reject. Reuse what exists.
4. **Explicit over clever** — 10-line obvious fix > 200-line abstraction.
5. **Bias toward action** — move forward. Flag concerns in the decision log but don't block.
6. **Match the codebase** — follow existing patterns, naming, and structure. Don't introduce new conventions.

## Circuit Breaker

Build-it runs fully autonomous with one exception:

If the roast phase produces a **NOT_READY** verdict (score below 60) with unresolved
high-severity issues, stop and present the findings to the user. The plan needs
human judgment before execution — build-it is not the right tool for a fundamentally
broken plan.

For READY or READY_WITH_RISKS verdicts: continue autonomously.

## Score-Critical Guidance

These are the behaviors evals punish hardest; prioritize them during autonomous runs.

1. **Commit as you go.** Every real implementation run should add at least one descriptive commit; multi-step work usually produces multiple commits. For a tiny single-bug TDD fix, one self-contained green commit is fine after the red failure is proven.
2. **Auto-generated plans choose concrete destination files.** Name target files up front; for new utilities, prefer a dedicated module and export from a barrel secondarily.
3. **Use the Phase 7 handoff shell.** End with `## Build It Complete`, the pipeline table, decision log, guardrail results, flagged review items, and an explicit next step.
4. **Make red/green evidence explicit.** When you claim TDD, name the failing test command (red) and the passing re-run (green) in the handoff or decision log — do not rely on commit order alone.
5. **Make atomic commits visible.** If commit quality matters to the work, list the commit hashes/messages in the handoff so the reviewer can see the sequence, not just infer it.

---

## Phase 0: Setup

### Step 0: Initialize Codex goal

Load and follow [`../vs-internal-shared/references/codex-goal.md`](../vs-internal-shared/references/codex-goal.md)
when the user asks build-it to use a Codex goal.

### Step 1: Read context

- Read CLAUDE.md for project-specific commands (test, build, lint).
- Read the plan file the user pointed to (or the most recent plan in conversation).
- If the plan is a shape-it spec, read its Goal Contract and Execution Strategy
  first. The Goal Contract defines done; the Execution Strategy's workstreams,
  waves, write scopes, and effort assignments govern Step 3 and Phase 3
  delegation. Do not re-derive an execution topology the spec already provides.
- Run `git status` and `git diff` to understand the current state.
- Note the project's test command, build command, and lint command from CLAUDE.md.
  If not found, search for them in package.json, Makefile, or equivalent.
  If still not found, note "unknown" — do not guess.

### Step 1a: Auto-generate plan if missing

If no plan was provided, inspect the relevant code and produce a concise plan in
the parent. Delegate planning only when the task is non-trivial and has a
distinct exploration lane that benefits from fresh context. Use one planning
subagent, give it exact paths and the expected plan shape, then verify its plan
against the code before adopting it.

Log whether the plan was produced inline or delegated and why.

This replaces the need for the user to run `/vs-shape-it` or write a plan manually.
The roast phase (Phase 1) still stress-tests whatever plan comes out, so a weak
auto-generated plan gets caught by the circuit breaker.

### Step 1b: Validate guardrails

Dry-run each guardrail command to confirm it works before starting execution:

```bash
# Test each detected command — we only care if it runs without "not found" errors
[test command] 2>&1 | head -5
[typecheck command] --noEmit 2>&1 | head -5
[lint command] 2>&1 | head -5
```

If any command fails due to missing dependencies: install them now.
Common fixes: `bun install`, `npm install`, `pip install -r requirements.txt`.
If installation is blocked by sandbox network limits but a declared guardrail is failing only because dev-only ambient types are missing (for example `bun-types`), prefer the smallest local compatibility fix in a dedicated support location (`types/`, test-only file move, or equivalent) rather than leaving the guardrail unverified. Do not change product/runtime behavior just to satisfy the guardrail.
If such a support-only guardrail fix is needed, treat it as a dedicated **prep step** before the real implementation loop:
- commit it separately as a chore/support change before the failing test commit
- keep it out of the product diff summary and decision rationale for the actual feature/vs-bugfix
- in the final handoff, report it under support/guardrail prep, not as part of the product behavior change
Do not proceed to Step 2 until all guardrail commands execute without
"command not found" or "module not found" errors.

### Step 1c: Capture the baseline before implementation

Determine whether the requested change has a meaningful user-visible output.
Capture the baseline now; do not reconstruct the before state after editing.
Store captures in a scoped temporary directory outside the repository so they
survive through Phase 7 without becoming product changes. Record the artifact
paths with the comparison metadata.

- **UI behavior:** capture a before image from an existing reachable preview,
  Storybook story, browser test, or other real render surface. Record the route,
  state, viewport, and fixture so the after image uses the same route, state,
  viewport, and fixture. Do not substitute a prose description for an image.
- **Text output:** run the exact CLI, formatter, report, generated text, or other
  representative surface and save its output. Record the command and input so
  the after capture uses the same command and representative input.
- **No meaningful comparison:** for internal refactors, tests, documentation,
  or changes without observable output, record `No meaningful comparison` and
  do not manufacture a before-and-after section.

Use existing render/test infrastructure. If the baseline cannot be captured
without a forbidden dev server, missing credentials, or unavailable fixture,
record the exact blocker; for UI work, do not downgrade to a text comparison.

### Step 2: Create branch

If not already on a feature branch, create one:

```bash
# Detect git user prefix from git config or CLAUDE.md conventions
GIT_USER=$(git config user.name 2>/dev/null | tr '[:upper:]' '[:lower:]' | tr ' ' '-')
```

Derive a branch name from the plan topic: `{user-prefix}/{plan-topic}`.
Use the branch prefix convention from CLAUDE.md if one exists.

```bash
git checkout -b <branch-name>
```

If already on a feature branch (not main/master/develop), stay on it.

### Step 3: Extract plan steps

Break the plan into discrete implementation steps. Each step should be:
- A single logical change (one file or a few tightly coupled files)
- Independently committable
- Ordered by dependency (foundations first, features on top)

List the steps and move on. Do not ask for confirmation.

---

## Phase 1: Roast the Plan

Load and follow the sibling skill at `../vs-pushback/SKILL.md`. If the host cannot resolve sibling skill paths, run a lightweight adversarial review yourself (premise challenge, assumptions, feasibility, edge cases — same dimensions, less ceremony).

### Auto-decision overrides for pushback

Vs-pushback is interactive by design. In build-it mode, every interactive point
is auto-resolved:

- **Step 0.5 (Idea Sharpening)**: Skip — build-it assumes the plan is already shaped.
- **Step 1 (Initial Assessment)**: Run the assessment. Do not wait for user acknowledgment.
- **Step 2 (Premise Challenge)**: Run it. Auto-decide: accept premises that are
  supported by evidence in the codebase or plan. Challenge premises that contradict
  what you found in pre-scan. For each challenged premise, apply decision principle
  #1 (completeness) — pick the interpretation that covers more ground.
- **Step 3 (Dimension Grilling)**: For each question pushback would ask the user:
  - Apply the 6 decision principles to pick an answer.
  - Log the question, your answer, and which principle drove it.
  - Do not wait for user input. Do not present options.
- **Step 4 (Outside Voice)**: Skip — the roast findings are sufficient for build-it.
  Subagent overhead is not worth it when the fix phase follows immediately.
- **Step 5 (Report)**: Produce the report. Do not persist to disk — the findings
  feed directly into Phase 2.

### Circuit breaker check

After the roast completes, check the verdict:

- **NOT_READY** (score < 60, unresolved high-severity): Stop. Present findings to
  the user. Explain what needs human judgment. Do not proceed to Phase 2.
- **READY** or **READY_WITH_RISKS**: Continue autonomously.

---

## Phase 2: Fix the Plan

Take every finding from Phase 1 and apply it to the plan:

1. **High severity** — must be addressed. Modify the plan to resolve each one.
2. **Medium severity** — address if the fix is clear and under ~5 lines of plan change.
   Otherwise note it as a known risk and continue.
3. **Low severity** — note in the decision log, do not modify the plan.
4. **Unresolved items** — apply decision principles to pick a resolution. Log it.

After fixing, re-extract plan steps if the structure changed (new steps, removed
steps, reordered dependencies).

Write the updated plan back to the plan file (or note the changes in the decision
log if there is no plan file on disk).

Emit a short transition summary:
> **Phase 1-2 complete.** Roast score: [N]/100. Fixed [X] high, [Y] medium issues.
> [Z] items noted as known risks. Proceeding to execution with [N] steps.

---

## Phase 3: Execute

Implement the fixed plan. Execute directly unless independent steps make
delegation materially faster or safer. Follow the shared subagent budget.

### Step 0: Load TDD; escalate to debugging only on evidence

Load sibling skill `../vs-tdd/SKILL.md` when the host can resolve it. Workers
follow TDD discipline: reproduce or specify behavior with a failing test, then
implement the minimum green change.

Load `../vs-debug-mode/SKILL.md` only after a reproduction or guardrail fails in
an unexplained way, two focused fix attempts fail, or runtime state cannot be
observed through existing tests and logs. Add temporary instrumentation only at
the boundary needed to distinguish the active hypotheses; do not instrument
every modified function preemptively. Mark any temporary code with
`build-it-debug` so Phase 6 can remove it.

### Step 1: Build dependency graph

Group plan steps into layers based on dependencies:

```
Layer 0: [steps with no dependencies — can all run in parallel]
Layer 1: [steps that depend on Layer 0]
Layer 2: [steps that depend on Layer 1]
...
```

If all steps are independent (no shared files, no import dependencies between
them), they are all Layer 0, but the selected shared effort budget still applies.

If the plan is small (3 or fewer steps) or all steps touch the same files:
skip parallelism, execute sequentially on the current branch.

### Step 2: Execute layers

For a layer with genuinely independent work, launch at most two subagents. Batch
additional independent steps or execute them in the parent. Each child gets:

- The overall plan context (one-liner summary, not the full plan)
- Its specific step(s) to implement
- Codebase conventions from CLAUDE.md
- The guardrail commands detected in Phase 0
- These worker instructions:

```
Implement the assigned step using TDD:
1. Write a failing test that defines the expected behavior.
   Match existing test patterns in the project. Run it — verify it fails.
   (If no test infrastructure exists for this area, skip to step 2 and note it.)
2. Write the minimum implementation to make the test pass.
3. Run guardrails: [type check command], [test command], [lint command]
4. If guardrails fail: read the error. Check build-it-debug logs for context.
   Fix and re-run. Max 2 retries. If still failing after retries, use the
   debug skill's hypothesis approach: generate 3 hypotheses, investigate each.
5. Commit with a descriptive message (not "build-it step N").
   Stage specific files only; avoid `git add .` or `git add -A`.
   For a tiny single-bug TDD fix, after proving the red failure you may keep the
   regression test uncommitted until the fix is ready, then make one self-contained
   green commit that includes both the test and the minimal implementation.
   [EASY TO MISS: "I ran the tests and they passed" without showing the
   command output is not evidence. Include the actual exit code or output.]
6. Report: list files changed, tests written, guardrail results (pass/fail),
   and any issues you could not resolve.
```

Parallel workers require disjoint write scopes. Before spawning, list each
worker's owned paths (from the Execution Strategy when present); if two lanes
intersect, run them sequentially or keep the shared files in the parent. A
worker commits only inside its owned paths.

Brief each worker with curated context — objective, owned paths, evidence
paths, guardrail commands, constraints, and expected return shape. Do not fork
the full parent transcript for a scoped lane. Match reasoning effort (and
model, when the host supports choosing one) to the lane: low for mechanical
inventory, higher for ambiguous integration; take assignments from the
Execution Strategy when present.

Every brief names a first milestone that produces evidence before broad edits —
for a fix lane, reproduce and report before editing. A worker that returns
without evidence or changes has failed; re-scope the brief before re-spawning.
After spawning, confirm each thread or subagent actually started; do not wait
on an ID the host cannot resolve.

If delegation adds coordination cost, the host does not support subagents, or
steps share files or dependencies, execute sequentially in the parent with the
same guardrail gate after each step.

**Layer transitions:** Wait for all subagents in a layer to complete before starting
the next layer. If a subagent in Layer N fails, assess whether Layer N+1 steps
depend on it — if yes, execute those sequentially yourself with the fix. If no,
continue the next layer in parallel.

### Step 3: Integrate once

Do not spend child budget reviewing partial layers. Inspect the integrated diff
and run the final review once in Phase 4, after dependency and merge issues are
visible together.

### Step 3b: Capture ADRs for durable decisions

If execution settled a durable, repo-level architecture decision — one that is
expensive to reverse and future readers will ask "why did we do it this way"
(a shaped ADR from `/vs-shape-it`, or a decision-principle resolution that
changed the approach) — write an ADR alongside the code.

- Follow the repo's ADR convention if one exists. Otherwise use `adr/` at the
  repo root with a slug-only filename (lowercase, dash-separated, no numeric
  prefix), and run `/setup-adr` to bootstrap scaffolding if none exists.
- Record the context, the decision, the alternatives considered, and the
  rationale. Never edit a merged ADR — supersede it with a new one.
- Commit the ADR separately: `docs: add ADR for [decision]`.
- Note it in the decision log and reference it in the Phase 7 handoff.

Skip this for tactical implementation choices — ADRs are for repo-level
decisions, not session notes.

### Step 4: Final validation

After all layers complete, run the full validation suite:
- Type check
- Full test suite
- Build

Fix any integration issues introduced by combining parallel work.

---

## Phase 4: Review

Measure the integrated diff. A small, low-risk diff (at most 5 changed files and
300 changed lines, with no auth, security, persistence, migration, concurrency,
payment, or public-API change) stays in the parent: inspect every changed file,
search for reuse, run deterministic checks, and review correctness, security,
error handling, and unnecessary complexity.

For larger or high-risk diffs, load `../vs-roast-review/SKILL.md` and follow its
bounded methodology within the remaining workflow child budget. Load
`../vs-deslop/SKILL.md` only when the integrated diff contains confirmed
duplication, indirection, or generated-looking boilerplate that the parent
cannot remove confidently during its review. Keep either skill scoped to the
branch diff.

### Auto-decision override for Pass 2

The skill normally waits for the user to pick which sins to fix. In build-it mode,
auto-select option **b) Critical + serious** and apply immediately. Do not wait.

### Test verification before applying fixes

Before applying review findings, stress the implementation with focused edge
case tests. Use one fresh subagent only when the remaining child budget permits
and independent context is valuable; otherwise do this in the parent. Provide:

> "Write tests that try to break this implementation. Cover edge cases,
> boundary conditions, and assumptions the code makes. Run the tests.
> Report which pass and which fail."

If the subagent finds failing tests: fix each failure, re-run the full test
suite, commit test + fix atomically.

### Applying review fixes

Merge findings from all review sources and deduplicate.
For each finding that claims a bug: write a failing test first to confirm
it's real. If you can't write a failing test, note it in the decision log
instead of applying a speculative fix.

Then for each validated finding:

1. Apply the fix.
2. Re-run guardrails (tsc, tests, lint). If the fix breaks something, revert it.
   Execution code takes priority over review polish.
3. Commit review fixes separately: `refactor: [description of cleanup]`

---

## Phase 5: QA (conditional — affected browser behavior only)

Detect if this is a web app:

```bash
# Check for web indicators
HAS_WEB=false
[ -f "next.config.js" ] || [ -f "next.config.ts" ] || [ -f "next.config.mjs" ] && HAS_WEB=true
[ -f "vite.config.ts" ] || [ -f "vite.config.js" ] && HAS_WEB=true
[ -f "angular.json" ] && HAS_WEB=true
grep -q '"start"' package.json 2>/dev/null && grep -qE '"(react|vue|svelte|next|nuxt|angular)"' package.json 2>/dev/null && HAS_WEB=true
echo "HAS_WEB=$HAS_WEB"
```

If not a web app, or the diff changes only server, build, test, documentation,
or internal library code with no user-visible browser behavior: skip Phase 5.

If the diff changes routes, rendered components, interaction handlers, browser
state, styles, accessibility behavior, or another user-visible browser contract,
load sibling skill `../vs-qa/SKILL.md` when the host can resolve it.

If the QA skill resolves: read it and follow its methodology in **diff-aware mode** — only test
pages affected by the branch diff, not the full app.

For a UI comparison captured in Phase 0, save the after image during QA using
the recorded route, state, viewport, and fixture. A screenshot of a different
state is validation evidence, but it is not a before-and-after comparison.

If not found: skip the QA methodology. When a before image was already captured,
use the same capture mechanism for the after image even when `vs-qa` is
unavailable; this completes the comparison but is not a substitute for browser
QA. Do not attempt exploratory browser testing without the QA skill.

Use an existing reachable preview and available authentication context. If QA
would require starting a forbidden dev server, obtaining new credentials, or
asking for a routine URL that repository configuration cannot resolve, mark QA
as not run with the exact missing prerequisite and continue to handoff.

### Auto-decision overrides for QA

- **Tier**: Standard (critical + high + medium).
- **Clean working tree check**: skip — build-it already committed everything.
- **Fix loop**: follow it. Auto-decide all triage. Commit each fix atomically.
  If a fix causes regression, revert and mark as deferred.
- **WTF self-regulation**: honor it. If WTF > 20%, stop fixing and log remaining
  issues for the handoff.
- **Re-run guardrails** after QA fixes (tsc, tests, lint). QA fixes must not
  break what the execution phase built.

---

## Phase 6: Cleanup

If no temporary instrumentation or artifacts were added in Phase 3, skip to
Phase 7. Otherwise remove everything marked `build-it-debug`.

```bash
# Find all build-it-debug regions
grep -rn "build-it-debug" --include="*.ts" --include="*.tsx" --include="*.js" --include="*.jsx" --include="*.py" .
```

Remove every `#region build-it-debug` / `#endregion build-it-debug` block and the
code between them. Verify no functional code was accidentally wrapped in a debug region.

After removal:
1. Run the full guardrail suite (tsc, tests, lint, build). The code must pass
   without the debug logs — they were observability only.
2. If anything breaks after removing debug logs, something depended on a side effect
   of the logging (rare but possible). Investigate and fix.
3. Commit: `chore: remove build-it debug instrumentation`

---

## Phase 7: Handoff

Load and run `../vs-verify/SKILL.md` when available and include its
`## Verification Result` in the handoff. If unavailable, record the final
guardrail commands and results manually.

The handoff verdict inherits the verification status. Use `## Build It
Complete` only for `PASS` or `SKIPPED_TRIVIAL`. For `WARN`, `FAIL`, or
`BLOCKED`, head the handoff `## Build It — <STATUS>`, state exactly what was
not proven, and do not describe the outcome as fixed or working. When the work
fixes a reported bug, completion additionally requires the original
reproduction to pass — local guardrails alone do not earn "fixed".

For text output captured in Phase 0, rerun the same command and representative
input after final validation and retain the exact after output. For UI output,
use the paired images captured before implementation and during QA. Pass the
comparison evidence to `vs-brief`; if a required capture was blocked, pass the
blocker instead of inventing evidence.

Use the required shell in [references/handoff.md](./references/handoff.md) and
include a minimal diff stat. If the user asked build-it to also ship, load and
follow `../vs-ship-it/SKILL.md`; if the host cannot resolve it, say to type
`/vs-ship-it` and stop — do not hand-roll a PR flow in its place. Load `../vs-brief/SKILL.md` only when the change is
non-trivial (more than 3 files, a durable design decision, user-requested PR
orientation, or meaningful before-and-after evidence). Load
`../vs-walkthrough/SKILL.md` only when the user asks for a
walkthrough or the changed behavior needs a scenario to explain how to prove it.

---

## Important Rules

- **Avoid user questions during Phases 1-6.** The exception is the circuit breaker
  (`NOT_READY` verdict in Phase 1).
- **Log every decision.** No silent auto-decisions. The decision log is how the user
  audits what happened while they were away. [EASY TO MISS: an empty decision log
  at handoff means decisions were made silently — go back and reconstruct them.]
- **TDD by default.** Every implementation step writes the failing test first. Skip
  only if no test infrastructure exists for that area — and note it in the log.
- **Debug instrumentation is temporary.** When added, remove it at Phase 6.
- **Run known guardrails.** If a project has no test/lint/build commands, note it
  and continue; if a guardrail exists, run it.
- **Atomic commits.** Prefer one commit per logical step.
- **Recover non-destructively.** When git state goes wrong (failed merge,
  mis-staged files), prefer `git stash --include-untracked` and scoped
  `git restore` over `git reset --hard` or `git clean` — stashes are
  recoverable and destructive commands trip harness guards mid-recovery.
- **Respect foreign work.** If the tree contains uncommitted changes you did
  not make (a parallel session, another agent), stage only your own paths and
  say so in the log; never sweep them with broad staging.
- **Match the codebase.** Build-it follows existing patterns, not its own preferences.
  If the codebase uses callbacks, don't switch to async/await. If it uses classes,
  don't switch to functions. Read before writing.
- **Do not expand scope.** Implement exactly what the plan says. If you notice
  something that should be done but isn't in the plan, log it in the handoff —
  do not implement it. [EASY TO MISS: "cleaning up" adjacent code or adding
  "helpful" extras IS scope expansion, even when it feels like good practice.]

**Prev:** `/vs-shape-it`, `/vs-pushback`, `/vs-rfc-research`, or none. **Next:** `/vs-ship-it` or `/vs-roast-review`.
