---
name: tdd
description: "Use when the user says tdd, test first, red green refactor, or wants a bug fix proven by a failing test first."
disable-model-invocation: true
---

# TDD

Red → Green → Refactor. No exceptions.

## When to Use

- **Bug fixes** — prove the bug exists with a failing test before touching production code
- **New features** — define the behavior in tests before implementing
- **Autopilot integration** — build-it can invoke this for each execution step

## Phase 1: Understand

Read the code that needs to change. Before writing anything:

1. Find existing test files for the module. Match the project's test patterns:
   ```bash
   # Find test files near the target
   find . -path '*/node_modules' -prune -o -name '*.test.*' -print -o -name '*.spec.*' -print | head -20
   ```

2. Read 1-2 existing test files to learn:
   - Test runner and assertion style (jest, vitest, pytest, go test, etc.)
   - How fixtures and mocks are set up
   - Naming conventions
   - File location conventions (colocated vs `__tests__/` vs `test/`)

3. Identify the test command from CLAUDE.md, package.json, or Makefile.

Do not invent a new test style. Match what exists.

## Phase 2: Red (Write Failing Test)

Write the test FIRST. The test describes the expected behavior — it is the spec.

### For bug fixes

The test must reproduce the bug:

1. Write a test that exercises the exact code path that fails.
   - Prefer the public command, API, UI flow, or caller path where the bug was observed.
   - Do not test a private helper just because it is easy; a shallow seam can give false confidence.
   - If no correct seam exists yet, write down why and add the nearest durable public-facing guard.
2. Run it. It MUST fail. If it passes, your test doesn't cover the bug — rewrite it.
3. Verify the failure message matches the actual bug (not an unrelated failure).

```
Test: "should return user score as number, not NaN"
Expected: fail (because the bug produces NaN)
Actual: FAIL ✓ — test correctly catches the bug
```

### For new features

The test describes the desired behavior:

1. Pick one vertical behavior slice first — the smallest observable behavior that can ship.
2. Write the happy-path test for that slice, run it, and make it fail.
3. Implement only enough to pass that slice.
4. Repeat for edge cases: empty input, null, boundary values, error paths.

Do not write all tests first and then all implementation. That is specification-by-test, not TDD. TDD alternates red → green for each behavior slice.

### Rules for writing tests

- One logical assertion per test. Multiple related assertions are fine if they test
  the same behavior from different angles.
- Test names describe behavior, not implementation:
  `"returns empty array when no matches found"` not `"test filterResults method"`
- Do not mock what you don't own. Mock boundaries (HTTP, DB, filesystem), not
  internal modules.
- Assert observable behavior through public interfaces. Avoid private method imports,
  internal call-count assertions, or verifying persistence by bypassing the read API
  users actually rely on.
- If the project has no tests at all: create the test file following the nearest
  convention you can find (framework docs, similar projects). Note this in the
  decision log.

## Phase 3: Green (Implement)

Write the minimum code to make the test pass. Nothing more.

1. Implement the fix or feature.
2. Run the test. It MUST pass.
3. If it fails: read the error, fix the implementation (not the test), re-run.
   Max 3 attempts. If still failing, reassess — maybe the test expectation is wrong.
4. Run the full test suite to check for regressions.

```
Test: "should return user score as number, not NaN"
Expected: pass (bug is fixed)
Actual: PASS ✓
Full suite: 142 passed, 0 failed ✓
```

### If the full suite has failures

Distinguish between:
- **Your change broke something** — fix it before moving on
- **Pre-existing failure** — verify it fails on the base branch too. If yes, note it
  and continue. If no, it's your regression — fix it.

## Phase 4: Refactor (Optional)

Tests are green. Now clean up — but only if needed:

1. Remove duplication introduced by the implementation.
2. Improve naming if the intent isn't clear.
3. Simplify if there's an obviously cleaner way.

After every refactor step, re-run tests. If anything breaks, revert that refactor.

Do NOT refactor:
- Code you didn't change (out of scope)
- Working code that's merely "not how I'd write it"
- Test code that's clear and passing

## Phase 5: Commit

Two commits (or one if the change is small):

1. `test: add failing test for [description]` — the test alone, before the fix
   (optional, skip if the test and fix are trivially small)
2. `fix: [description]` or `feat: [description]` — the implementation that makes it pass

Stage specific files. Never `git add .`.

## Integration with Autopilot

When build-it invokes TDD for an execution step:

- Phase 1-2 (understand + red) run for the step's scope only
- Phase 3 (green) is the step's implementation
- Phase 4 (refactor) is skipped — build-it's review phase handles cleanup
- Phase 5 (commit) follows build-it's commit conventions

Autopilot passes: the step description, affected files, and test command.
TDD returns: test file path, implementation file paths, guardrail results.

## Rules

- **Never write implementation before the test.** The test comes first. Always.
- **Never modify the test to make it pass.** If the test is wrong, rewrite it with
  a clear reason — don't silently weaken assertions.
- **A passing test you wrote before the implementation is not TDD.** If the test
  passed on first run, it doesn't prove your code works — it proves the test is
  weak. Strengthen it until it fails, then implement.
- **Match existing test patterns.** TDD is about discipline, not about introducing
  your preferred test framework or assertion library.

## Workflow

**Prev:** `/debug-mode` (found root cause, need a regression test) | `/build-it` (uses TDD internally)
**Next:** `/roast-review` (review the implementation) | `/ship-it` (ship it)
