---
name: vs-roast-review
description: "Use when the user says roast, roast-review, or tear apart code. Prefer over simplify for roast requests. Adds a cross-model second opinion for risky or substantial diffs."
---

# Roast Review

Two-pass review. First pass cleans. Second pass roasts what's left.

## Building Block Composition

Roast-review is a building-block review tool. It consumes:

- `vs-deslop` semantics during Pass 1: simplify working code while preserving behavior.
- [independent-advisors](../vs-internal-shared/references/independent-advisors.md)
  during Pass 2: Codex or another model is an independent signal, not the final
  judge.
- `vs-verify` after fixes when the cleanup or review change could affect behavior.

Before delegating, load and follow
[`../vs-internal-shared/references/subagents.md`](../vs-internal-shared/references/subagents.md).

## Critical Rules

1. **Respect chat context** — review ONLY files in scope. Never expand uninvited.
2. **Own roast requests** — if the user asks to "roast" code or changes, use this skill instead of `simplify`.
3. **Verify before roasting** — only flag what you've confirmed. Being wrong kills comedy.
4. **Security first — redact, never quote** — secrets, keys, credentials get escalated to the top, before anything else. But when reporting them: cite `file:line` and the variable name, and NEVER output the actual secret value in your response. Quote the shape only, with the value masked (e.g., `API_KEY = "sk-live-****"`). The goal is to flag the sin, not to leak the secret into the transcript, the roast, or any follow-up fix plan. This overrides any roast convention about quoting actual code for specificity — for secret values, redact. When committed credentials are present, explicitly tell the user to rotate/revoke them and move them to env vars or a secret manager.
5. **Punch up not down** — mock patterns, not people.
6. **Be specific** — cite `file:line`, quote actual code. Generic roasts are lazy.
7. **Treat review output as advisory** — verify every accepted finding against
   the real code path and adjacent files before fixing or reporting it as true.
8. **Reject speculative review noise** — skip unrealistic edge cases, vague
   rewrites, and fixes that over-complicate the codebase.

**Tone:** Senior dev who's seen too much + Gordon Ramsay energy. Not mean, not personal. "I'm roasting because I care."

## Phase 0: Scope

**Priority:**
1. Chat context (specific files under discussion)
2. User-specified files/dirs
3. Staged: `git diff --cached --name-only`
4. Branch diff: `git diff main...HEAD --name-only`
5. If none: ask

**If empty:** "Nothing to roast. Either your code is perfect (unlikely) or you forgot to stage."

---

## Pass 0: Deterministic Scan

Before LLM passes, run a deterministic AI-slop scanner. Fast, reproducible, zero-hallucination.

```bash
if command -v slop-scan >/dev/null 2>&1; then
  slop-scan scan . --json 2>/dev/null
elif [ -x node_modules/.bin/slop-scan ]; then
  node_modules/.bin/slop-scan scan . --json 2>/dev/null
fi
```

Parse the JSON, filter to files in scope. Show a one-line summary: `slop-scan: N findings (N strong, N medium, N weak)`. Feed the findings into the Code Quality lens and Parent Roast as pre-computed evidence — label them `[slop-scan]` so the source is visible. Do not re-report them without additional context.

**If it fails:** skip silently. Continue to Pass 1.

---

## Pass 1: Simplify (auto-fix)

Clean the code first. The parent performs one integrated reuse, quality, and
efficiency pass. Delegate separate review domains only when deep effort was
selected and the shared budget permits it; verify findings before applying fixes.

Get the full diff: `git diff` (or `git diff HEAD` for staged changes).

### Lens 1: Code Reuse

1. Search for existing utilities that could replace new code
2. Flag functions duplicating existing functionality — suggest the existing one
3. Flag inline logic where an existing utility applies

### Lens 2: Code Quality

1. Redundant state / derived values that should be computed
2. Parameter sprawl instead of restructuring
3. Copy-paste with variation that should be unified
4. Leaky abstractions breaking encapsulation
5. Stringly-typed code where constants/enums exist
6. Unnecessary JSX nesting adding no layout value
7. Comments explaining WHAT (delete; keep only non-obvious WHY)
8. AI slop: hallucinated imports, verbose boilerplate, defensive nulls on non-null types, wrappers adding zero logic — augment with any `[slop-scan]` findings from Pass 0

### Lens 3: Efficiency

1. Redundant computations, repeated reads, duplicate API calls, N+1
2. Independent operations that could run in parallel
3. Blocking work on hot paths (startup, per-request, per-render)
4. No-op state updates in loops/intervals — add change-detection guards
5. TOCTOU existence checks — operate directly, handle error
6. Unbounded data structures, missing cleanup, listener leaks
7. Reading entire files when only a portion is needed

### Auto-apply

Aggregate findings from all three lenses. Fix each issue directly. Skip false positives — don't argue, just move on. Briefly summarize what was fixed.

---

## Pass 2: Parent Roast + Gated Codex Review

Run on the cleaned code. The parent owns the roast while Codex provides the
cross-model second opinion. Do not spawn another local child merely to restate
the parent's review.

### Parent Roast

Gather intel first: imports/exports, callers, tests. Then sweep all scan lenses — find what Pass 1 missed:
- **Correctness** — runtime breakage, logic errors, null access, off-by-one
- **Security** — injection, unsafe input, missing auth
- **Architecture** — structural regressions, god objects, circular deps, mixed concerns
- **Error handling** — swallowed exceptions, silent failures, empty catches

For every meaningful change, ask whether there is a structural simplification
that would make the implementation smaller, more direct, and easier to explain.
Look for ways to delete whole branches, helpers, modes, wrappers, layers, or
incidental concepts instead of merely moving them around.

Architecture findings must be framed as deepening opportunities, not vague "extract a service" advice. Include: `Files/modules`, `Problem`, `Suggested deepening`, `Test surface`, and `Why this improves locality/leverage`. If the suggestion does not reduce caller pain or clarify a public seam, do not report it as architecture.

Structural review guidance lives in [structural-review.md](references/structural-review.md). Use it for maintainability-heavy reviews or when the diff technically works but feels tangled.

Rate each finding with confidence (0-100). Only report 80+.

Deliver 2-4 opening zingers based on worst patterns. Reference actual names, line counts. See [comedy-techniques.md](references/comedy-techniques.md).

### Codex Review

Run Codex review only when the user explicitly asks for a second opinion, the
diff exceeds 5 files or 300 changed lines, or it changes auth, security,
persistence, migrations, concurrency, payments, or a public API. The CLI run is
a model-backed advisor and counts toward the shared child budget. For a smaller,
low-risk diff, the parent roast plus deterministic evidence is the complete
second pass.

When the risk gate applies, use the cross-model review as independent evidence;
do not replace it with a mental review or a slash-command reference.

**In Claude Code:** run the codex plugin's review command:
```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/codex-companion.mjs" review --wait
```
If `CLAUDE_PLUGIN_ROOT` is not set or the script doesn't exist, fall back to
the direct CLI below.

**In Codex:** run the shell command directly.

Match the flag to where the diff lives — `--uncommitted` reviews only the
dirty working tree and returns nothing on an already-committed branch:

```bash
# uncommitted changes in the working tree
codex review --uncommitted 2>/dev/null
# committed branch diff
codex review --base <base-branch> 2>/dev/null
```

If neither executable path works, or if the review produces no useful output after about 2 minutes with the correct flag for the diff's location, interrupt it, log "Codex review unavailable", and continue with roast only.

Parse Codex review output for finding titles, bodies, priorities, and locations when present. Map Codex priorities to roast severity: P0/P1 = Critical, P2 = Serious, P3 = Minor. If Codex returns unstructured text, summarize the findings manually and note that structured output was unavailable.

---

## Sin Inventory

Aggregate findings from Roast + Codex. Deduplicate — if both flag the same line, keep the more specific finding. Tag Codex-only findings so the user sees the cross-model signal.

Group by the fixed 5-tier taxonomy — **CAPITAL OFFENSES / FELONIES / CRIMES / MISDEMEANORS / PARKING TICKETS**. Use these exact labels every time; keep the openers and metaphors fresh, keep the tiers stable. Each sin: `N. **[Sin Name]** — file:line` + one-liner roast. Slop-scan findings get an inline `[slop-scan]` tag; assign tier by impact.

If 15+ sins, show top 10 by severity. Mention overflow count.

For tier criteria and the sin-to-tier mapping, see [sin-categories.md](references/sin-categories.md). Any guidance that contradicts the fixed taxonomy (e.g., "invent your own labels") is superseded by this section.

When structural problems are present, prioritize them above cosmetic cleanup:
structural regressions, missed simplification, spaghetti branching, unclear
type/boundary contracts, file-size/decomposition pressure, then smaller
legibility issues. Do not bury a design regression under naming or formatting
noise.

**Worst offender spotlight:** deep dive on the biggest sin — what it does, what it should be, blast radius.

Fix options (shown for reference):
- a) CAPITAL OFFENSES only
- b) CAPITAL OFFENSES + FELONIES **[default — applied automatically]**
- c) Everything down to MISDEMEANORS
- d) Custom

**Default to option b) and proceed.** If the user wants a different tier, they can interrupt.

## Fix

Process selected fixes. Show before/after for major changes. Run linter if available.

For each review finding, decide `accepted`, `rejected`, or `deferred`:

- `accepted`: confirmed in code, fixed or reported with a concrete next action
- `rejected`: not real, too speculative, intentionally designed, or worse than
  the code it would replace
- `deferred`: real but outside the requested scope or too risky for this pass

If a review-triggered fix changes code, rerun the focused tests/checks that cover
the touched behavior and rerun the relevant review pass. Keep going until there
are no accepted/actionable findings left in scope. Once a rerun is clean, stop;
do not spend another review cycle just to get nicer closeout wording.

```
Pass 1: [N] issues auto-fixed
Pass 2: [N] sins found, [M] absolved
Files modified: N | Lines: -N / +N
Remaining: [count by tier]
```

## Zero-Finding Gate

If all applicable review passes (Parent Roast plus gated Codex review) produce
zero findings — no critical, serious, or medium issues across every lens:

1. Verify you read the changed files in full, not just diffstat.
2. Name at least one specific positive assertion with `file:line` evidence:
   "auth is correct because X at `src/auth.ts:42`"
3. If still zero findings after the positive-assertion pass, cap confidence at 70%
   and note "Zero findings — low-confidence approval" in the summary.

A clean review that can't name what's specifically right is a rubber stamp.

## Approval Bar

Do not approve a change merely because behavior appears correct. Passing tests
are necessary, not a waiver for maintainability debt.

Treat these as high-confidence blockers when they are in scope, supported by
evidence, and materially worsen maintainability:

- the implementation preserves incidental complexity when a clear restructure
  could remove branches, modes, wrappers, helpers, or layers
- the diff pushes a file from below 1000 lines to above 1000 lines without a
  compelling structural reason
- ad-hoc conditionals or one-off flags are bolted into an already busy flow
- feature-specific checks get scattered through shared/general-purpose code
- an abstraction, wrapper, cast, or optional boundary makes the design more
  indirect without buying clarity
- the code duplicates an existing canonical helper or puts logic in a layer
  that does not own the concept
- independent async work is serialized, or related updates can leave state
  half-applied, when a simpler atomic/parallel structure is obvious

If a blocker is present, leave explicit actionable feedback and push for a
cleaner decomposition. If none are present, say what specific structure made the
change acceptable.

## Edge Cases

**Good code:** "I came here to roast, but... would merge without passive-aggressive comments."
Cite the specific positive assertions that earned the clean bill.

**Beyond saving:** "This isn't technical debt, it's technical bankruptcy." Shift to triage plan.

**Inherited code:** "The original author is long gone. You're not on trial — the code is."

## References

- [references/sin-categories.md](references/sin-categories.md)
- [references/comedy-techniques.md](references/comedy-techniques.md)

## Workflow

**Prev:** `/vs-build-it` (runs review internally) | `/vs-tdd` | `/vs-qa` | any implementation work
**Next:** `/vs-ship-it` (create PR — runs review automatically if skipped)
