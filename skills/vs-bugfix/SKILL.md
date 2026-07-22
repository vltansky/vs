---
name: vs-bugfix
description: "Use when the user says fix, bugfix, broken, or describes a bug. Reproduces, fixes, verifies, reviews, and hands back a clean branch."
disable-model-invocation: true
---

# Fix

Bug in, evidence-backed branch out with scoped progress inside the reported bug.

```
Classify → Understand → Hypothesize → Reproduce → Fix → Verify → Review → Handoff
```

Work only on changes directly required to reproduce and fix the reported bug. Stop when resolving the bug would require a product decision, unrelated refactor, or new scope.

Four circuit breakers halt the run:
1. Can't identify root cause after 3 investigation rounds
2. Bug cannot be reproduced after 3 attempts
3. Fix causes more test failures than it solves
4. Bug is in an external dependency or infrastructure (can't fix from this repo)

Before delegating, load and follow
[`../vs-internal-shared/references/subagents.md`](../vs-internal-shared/references/subagents.md).
Use the standard budget unless the user explicitly asks for deep investigation.

## Codex Goal Integration

When running in Codex, use
[`../vs-internal-shared/references/codex-goal.md`](../vs-internal-shared/references/codex-goal.md)
for goal ownership and completion rules.

Bugfix owns an execution goal only after the bug is concrete enough to verify:
bug statement, target area, and reproduction or verification plan are known. Do
not create a goal for a vague "something is broken" report until Phase 1 has
enough evidence. Complete the goal after the root cause is fixed, regression or
browser/script reproduction is verified green, guardrails run, and the Phase 7
handoff is reported. Leave it active or blocked when a circuit breaker stops the
run.

---

## Phase 0: Setup

### Step 1: Classify Input

| Input | Detection | Action |
|-------|-----------|--------|
| Bug description | Default — no URL, no stack trace | Proceed to Phase 1 |
| GitHub issue | URL or `#123` pattern | Fetch via `gh issue view`, extract repro steps + expected/actual |
| Error / stack trace | `Error:`, stack frames, exit codes | Extract error, file paths, line numbers — feed as hints to Phase 1 |
| Failing test | Test file path or `FAIL` output | Record the test, skip to Phase 4 (reproduction already done) |

For GitHub issues:
```bash
gh issue view <number> --json title,body,labels --jq '{title: .title, body: .body, labels: [.labels[].name]}'
```

### Step 2: Read Context

- Read CLAUDE.md for project-specific commands (test, build, lint).
- Run `git status` and `git diff` to understand the current state.
- Note the test command, build command, and lint command.
  If not found in CLAUDE.md, search package.json, Makefile, or equivalent.

### Step 3: Validate Guardrails

Dry-run each guardrail command:

```bash
[test command] 2>&1 | head -5
[typecheck command] --noEmit 2>&1 | head -5
```

If any command fails due to missing dependencies: install them now.
Do not proceed until guardrail commands execute without "command not found" errors.

### Step 4: Create Branch

```bash
GIT_USER=$(git config user.name 2>/dev/null | tr '[:upper:]' '[:lower:]' | tr ' ' '-')
```

Derive branch name from the bug: `{user-prefix}/fix-{bug-topic}`.
Use the branch prefix convention from CLAUDE.md if one exists.

```bash
git checkout -b <branch-name>
```

If already on a feature branch (not main/master/develop), stay on it.

### Step 5: Load Skills

Before each phase, load the relevant sibling skill from disk using
`../<skill-name>/SKILL.md`. A gated skill cannot be replaced safely: if its file
cannot be resolved, give the user the exact slash command below and stop.
Ungated building blocks may use the listed inline fallback.

Skills to load per phase:

| Phase | Skill | Fallback if not found |
|-------|-------|-----------------------|
| Phase 2 (Hypothesize) | `../vs-debug-mode/SKILL.md` | Inline hypothesis methodology |
| Phase 3 (Reproduce) | `../vs-tdd/SKILL.md` | Stop; tell the user to type `/vs-tdd` |
| Phase 3 (Web bugs) | `../vs-qa/SKILL.md` | Stop; tell the user to type `/vs-qa` |
| Phase 1 (Deep exploration) | Local repo search | Grep + read |
| Phase 5 (Verify) | `../vs-verify/SKILL.md` | Manual evidence summary |
| Phase 6 (Review) | `../vs-roast-review/SKILL.md` | Lightweight self-review |

---

## Phase 1: Understand

Goal: know exactly what's broken and where to look.

### From bug description (default)

1. Identify the affected area — search for keywords in the codebase:
   ```bash
   grep -r "keyword" --include="*.ts" --include="*.tsx" --include="*.js" --include="*.py" -l | head -20
   ```

2. Read the affected files. Trace the code path from user-facing behavior
   to the suspected failure point.

3. If the codebase is large or unfamiliar, do deep local exploration with
   search and read tools before changing code.

4. Check git history for recent changes to affected files:
   ```bash
   git log --oneline -10 -- <affected-files>
   ```

### From GitHub issue

Extract from the issue body:
- Steps to reproduce
- Expected vs actual behavior
- Environment details
- Any error messages or screenshots referenced

Map these to code paths using the same search approach.

### From error / stack trace

Parse the stack trace for:
- The error message
- File paths and line numbers
- The call chain

Read each file in the stack trace. Start from the innermost frame.

### Output

By end of Phase 1, you must have:
- A one-sentence bug statement
- 1-5 suspect files/functions
- Enough context to form hypotheses

---

## Phase 2: Hypothesize

Use the hypothesis generation approach from debug-mode's Phase 2. For
investigation, use the techniques below (adapted from debug-mode Phase 3
for a fix-oriented workflow).

Generate 3-5 specific, testable hypotheses. Order by likelihood.

```
H1: [specific cause]
    Test: [how to confirm or reject]

H2: [specific cause]
    Test: [how to confirm or reject]
```

Common root causes: state (wrong/missing/stale), timing (race/async),
environment (missing file/config), types (null/coercion), logic
(off-by-one/wrong condition), integration (contract mismatch).

### Investigate

For each hypothesis (most likely first):

- **Code path tracing** — find where the value comes from, trace callers
- **State inspection** — trace data backward from failure to origin
- **Diff analysis** — `git log --oneline -20 -- <files>` / `git diff <last-good>..HEAD`
- **Environment comparison** — versions, env vars, file existence

Classify each:
- **CONFIRMED** — evidence proves this is the cause
- **REJECTED** — evidence rules it out
- **INCONCLUSIVE** — need more evidence

### Circuit Breaker

Max 3 investigation rounds. If all hypotheses rejected/inconclusive after
3 rounds:

```
CIRCUIT BREAKER: Could not identify root cause.

Investigated:
- [hypothesis]: [why rejected]
- [hypothesis]: [why rejected]

Suspect area: [best guess with evidence]
Recommendation: [what to try next manually]
```

Stop. Present findings. Do not attempt a fix without understanding the cause.

---

## Phase 3: Reproduce

Prove the bug exists with a failing test. Follow the TDD skill's Phase 2
(Red) methodology.

### With test infrastructure

1. Find existing test files for the affected module.
2. Write a test that exercises the exact code path that fails.
3. Run it and confirm it fails.
4. Verify the failure message matches the actual bug (not an unrelated failure).

If the test passes: the hypothesis is wrong. Return to Phase 2 with this
new evidence.

5. Commit the failing test separately:
   ```bash
   git add <test-file>
   git commit -m "test: add failing test for <bug description>"
   ```

### Without test infrastructure

If no test infrastructure exists for the affected area:

1. Note it in the decision log.
2. If it's a web app bug and the QA skill is loaded: use browser-based
   reproduction instead. Follow QA skill's methodology to reproduce the
   bug visually.
3. If neither tests nor browser apply: reproduce via a minimal script or
   direct invocation. Document the reproduction command.

### Circuit Breaker

If the bug cannot be reproduced after 3 attempts with different approaches:

```
CIRCUIT BREAKER: Could not reproduce the bug.

Attempts:
- [approach 1]: [result]
- [approach 2]: [result]
- [approach 3]: [result]

The bug may be: intermittent / environment-specific / already fixed.
```

Stop. Present findings.

---

## Phase 4: Fix

Apply the minimal fix. Follow the TDD skill's Phase 3 (Green) methodology.

1. Write the minimum code to make the failing test pass. Nothing more.
2. Run the test and confirm it passes.
3. If it fails: read the error, fix the implementation (not the test), re-run.
   Max 3 attempts.
4. Run the full test suite to check for regressions.

```bash
[test command]
```

### Circuit Breaker

If the fix causes more test failures than existed before:

```
CIRCUIT BREAKER: Fix causes regressions.

New failures:
- [test]: [error]

The fix at [file:line] resolves the original bug but breaks [N] other tests.
This suggests the root cause analysis was incomplete or the fix approach
needs rethinking.
```

Revert the fix: `git checkout -- <changed-files>`. Stop. Present findings.

### External Dependency Circuit Breaker

If investigation reveals the bug is in:
- A third-party package
- Infrastructure / deployment configuration
- An external API or service

```
CIRCUIT BREAKER: Bug is outside this repository.

Root cause: [what and where]
Evidence: [how you confirmed it's external]
Workaround: [if one exists in this repo]
Upstream fix: [what needs to change externally]
```

Stop. Present findings with workaround options if applicable.

Do NOT commit yet — Phase 5 verifies first.

---

## Phase 5: Verify

Full validation after the fix:

If available, load `../vs-verify/SKILL.md` and use its
`## Verification Result` as the Phase 5 evidence wrapper. The checks below are
the required evidence inputs.

1. **Failing test now passes** — the specific test from Phase 3
2. **Full test suite passes** — no regressions
   ```bash
   [test command]
   ```
3. **Type check passes** (if applicable)
   ```bash
   [typecheck command]
   ```
4. **Build passes** (if applicable)
   ```bash
   [build command]
   ```
5. **If web app + QA skill loaded**: run QA in diff-aware mode on affected
   pages to verify the fix visually.
6. **If intermittent bug**: run the reproduction test multiple times.

### Pre-existing failures

Distinguish between:
- **Your change broke something** — fix it before moving on
- **Pre-existing failure** — verify it fails on the base branch too. If yes,
  note it and continue. If no, it's your regression — fix it.

### Commit (after all verification passes)

```bash
git add <implementation-files>
git commit -m "fix: <description of the bug fix>"
```

---

## Phase 6: Review

Two sub-phases: test verification first, then code review. Run both.

### Phase 6a: Test Verification

The parent first extends the regression test with the nearest boundary and
failure cases suggested by the root cause. Use a stress-test subagent only when
the fix touches auth, security, persistence, migrations, concurrency, payments,
or a public API; spans more than 3 production files; or the affected branch has
no meaningful test coverage. The subagent gets the bug description, exact
changed paths, the diff location, and one instruction:

> "Write tests that try to break this fix. Cover: the original bug,
> edge cases adjacent to the fix, and any state the fix assumes.
> Run the tests. Report which pass and which fail."

If the risk gate does not apply, run these focused cases in the parent and spend
no child budget. If a subagent finds failing tests:
- Fix each failure
- Re-run the full test suite
- Commit test + fix atomically

If no test infrastructure exists for the affected area, skip 6a and note
it in the decision log.

### Phase 6b: Code Review

For a small, low-risk fix, review the complete changed files in the parent:
search for existing helpers, inspect callers, and run the focused regression
test plus deterministic guardrails. Do not add a second model by default.

Load roast-review only when the Phase 6a risk gate applies or the diff exceeds
5 files or 300 changed lines. If found, follow its methodology within the shared
child budget; any cross-model review counts toward that same budget.

Auto-select option **b) Critical + serious** and apply immediately
(same as build-it's override).

If not found: run a lightweight self-review covering the same dimensions.

For each review finding that claims a bug: write a failing test first to
confirm it's real. If you can't write a failing test, the finding may be
a false positive — note it in the decision log instead of applying a
speculative fix.

After applying review fixes:
1. Re-run guardrails (test, typecheck, build).
2. If a review fix breaks something, revert it. The bug fix takes priority.
3. Commit review fixes separately: `refactor: <description>`

---

## Phase 7: Handoff

The handoff verdict inherits the verification status. Head every result with
`## Fix — <STATUS>`. Only `PASS` or `SKIPPED_TRIVIAL` may describe the bug as
fixed or complete, and `PASS` additionally requires the original reproduction
to pass. For `WARN`, `FAIL`, or `BLOCKED`, state what remains unproven.

Present the result:

```
## Fix — <PASS | WARN | FAIL | BLOCKED | SKIPPED_TRIVIAL>

### Branch
`{branch-name}` — [N] commits

### Bug
**Root cause:** [what and why — one sentence]
**Evidence:** [what confirmed it]

### Fix
**Files changed:** [list]
**Test added:** [test file:line] (or "browser-verified" / "script-verified")

### Pipeline
| Phase | Result |
|-------|--------|
| Understand | [affected area identified] |
| Hypothesize | [N] hypotheses, [root cause] confirmed |
| Reproduce | [test/browser/script] — verified failing |
| Fix | [minimal fix applied] |
| Verify | PASS/WARN/FAIL/BLOCKED — [evidence or gap] |
| Review | [N] found, [M] fixed |

### Codex Goal
[created/reused/completed/unavailable/left active because ...]

### Decision Log
| # | Phase | Decision | Rationale |
|---|-------|----------|-----------|
| 1 | ... | ... | ... |

List every auto-resolved decision here.

### Guardrails
- Tests: pass/fail ([N] passed, [M] failed)
- Types: pass/fail
- Build: pass/fail

### Suggested next step
[Based on results:]
- All green → `/vs-ship-it`
- Guardrail failures → list what's broken, recommend fixing
- Deferred issues → note for future work
```

---

## Rules

- **Understand before fixing.** A fix you can't explain is a timebomb.
- **Fix causes, not symptoms.** If a value is null, find out why before adding a null check.
- **Evidence over intuition.** "X is likely" is a hypothesis, not a conclusion.
- **Minimize the blast radius.** Fix the bug. Don't refactor the neighborhood.
- **TDD by default.** Failing test before fix. Skip only when no test
  infrastructure exists — and note it in the decision log.
- **Atomic commits.** Separate commits for test, fix, and review cleanup.
- **Match the codebase.** Follow existing patterns, naming, structure.
- **Log every decision.** No silent auto-decisions. The decision log is how
  the user audits what happened.
- **Do not expand scope.** Fix exactly the reported bug. If you notice other
  issues, log them in the handoff — do not fix them.

Before the final handoff, apply
[Phase Boundaries](../vs-internal-shared/references/phase-boundaries.md). Keep
`Next` below as the semantic route; report a session action only when required
by that contract.

## Workflow

Direct: emit **Next** only. Composed: return to caller.

**Prev:** bug report | issue | test failure | `/vs-debug-mode`
**Next:** `/vs-ship-it`
**Relevant:** `/vs-build-it` | `/vs-qa`
