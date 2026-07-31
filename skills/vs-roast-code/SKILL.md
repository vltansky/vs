---
name: vs-roast-code
description: "Use when the user says roast, roast-code, or tear apart code. Prefer over simplify for roast requests. Classifies the change first and scales review depth to it, adding a cross-model second opinion for risky or substantial diffs."
---

# Roast Code

Classify the change, then review it at the depth it deserves. First pass cleans.
Second pass roasts what's left.

## Building Block Composition

Roast Code is a building-block review tool. It consumes:

- `vs-deslop` semantics during Pass 1: simplify working code while preserving behavior.
- [independent-advisors](../vs-internal-shared/references/independent-advisors.md)
  during Pass 2: Codex or another model is an independent signal, not the final
  judge.
- `vs-verify` after fixes when the cleanup or review change could affect behavior.

Before delegating, load and follow
[`../vs-internal-shared/references/subagents.md`](../vs-internal-shared/references/subagents.md).

## Critical Rules

1. **Respect chat context** — review ONLY files in scope. Never expand uninvited.
2. **Scale to the change** — classify in Phase 1 and run only that class's
   program. A two-line fix does not get an evidence file, five tier headers, and
   a cross-model review.
3. **Keep SMALL output flat** — after classifying a change as SMALL, announce
   `SMALL review`, skip Pass 2 and the Sin Inventory, and use no taxonomy tier
   names anywhere in the response. Finding a normal bug does not unlock tiered
   ceremony; only a Phase 1 escalation changes the class.
4. **Never manufacture findings to fill ceremony** — an empty tier, an unused
   worst-offender spotlight, or an approval bar with no blocker is the correct
   output when the change is clean. Inventing a structural finding, a severity
   tier, or a blocker to justify the program you ran is a review defect.
5. **Own roast requests** — if the user asks to "roast" code or changes, use this skill instead of `simplify`.
6. **Verify before roasting** — only flag what you've confirmed. Being wrong kills comedy.
7. **Security first — redact, never quote** — secrets, keys, credentials get escalated to the top, before anything else. But when reporting them: cite `file:line` and the variable name, and NEVER output the actual secret value in your response. Quote the shape only, with the value masked (e.g., `API_KEY = "sk-live-****"`). The goal is to flag the sin, not to leak the secret into the transcript, the roast, or any follow-up fix plan. This overrides any roast convention about quoting actual code for specificity — for secret values, redact. The ban covers the whole response, not just the finding that flags the secret: masking it once does not license quoting it in a zinger, an aside, or a finding about some other sin. A secret is funniest masked. When committed credentials are present, explicitly tell the user to rotate/revoke them and move them to env vars or a secret manager.
8. **Punch up not down** — mock patterns, not people.
9. **Be specific** — cite `file:line`, quote actual code. Generic roasts are lazy.
10. **Treat review output as advisory** — verify every accepted finding against
   the real code path and adjacent files before fixing or reporting it as true.
11. **Reject speculative review noise** — skip unrealistic edge cases, vague
    rewrites, and fixes that over-complicate the codebase.

**Tone:** Senior dev who's seen too much + Gordon Ramsay energy. Not mean, not personal. "I'm roasting because I care."

## Phase 0: Scope

**Priority:**
1. Chat context (specific files under discussion)
2. User-specified files/dirs
3. Staged: `git diff --cached --name-only`
4. Branch diff: `git diff main...HEAD --name-only`
5. If none: ask

Resolve the scope once and retain its exact diff arguments, base branch, paths,
and kind for every later phase. Use these scope kinds:

- `explicit-uncommitted` when a chat- or user-selected path is staged,
  unstaged, or untracked
- `explicit-branch` when selected paths belong to the committed branch diff
- `explicit-file` for a current-file review with no diff
- `staged` for the staged fallback
- `branch` for the branch-diff fallback

Unrelated working-tree changes never replace the selected scope. If the user
selected an untracked file, retain it as `explicit-uncommitted`; do not infer
scope from a tracked-files-only status query later.

**If empty:** "Nothing to roast. Either your code is perfect (unlikely) or you forgot to stage."

---

## Phase 1: Classify the Change

Measure before reviewing. One stat read plus a look at the changed lines decides
which program runs, and the whole review is scoped to that program.

```bash
git diff --stat <resolved-scope-arguments>
```

For explicitly named files with no diff to measure (a file review rather than a
change review), use the files themselves as the size signal.

**Signal 1 — size:** changed files, changed lines, and whether the change is
docs, comments, tests, or formatting only.

**Signal 2 — risk surface:** does the change touch auth or authorization,
secrets and credentials, crypto, query construction, shell or dynamic execution,
untrusted input parsing, persistence or migrations, concurrency, payments, a
public API or wire contract, or CI, release, permission, and ownership config?

Sniff it deterministically on the changed lines, then confirm by reading the hunks
it hits — a keyword is a pointer, not a verdict:

```bash
git diff -U0 <resolved-scope-arguments> \
  | rg -n '^[+-]' \
  | rg -v '^[0-9]+:(\+\+\+|---) ' \
  | rg -in 'password|secret|token|api[_-]?key|credential|authn|authz|authoriz|permission|jwt|crypto|exec|spawn|eval\(|innerHTML|SELECT |INSERT |UPDATE |DELETE |migrat|lock|mutex|Promise\.all|charge|refund|price'
```

Keep the pattern tight. A sniff that matches every TypeScript diff escalates
every review and buys nothing; public-API and wire-contract changes are a
judgment call on the hunks, not a keyword.

Paths carry the same signal: `.github/workflows/`, `migrations/`, `*.sql`,
`Dockerfile`, lockfiles, `CODEOWNERS`, and dependency manifests are risk surface
regardless of how few lines changed.

| Class | When | Program |
|-------|------|---------|
| **SMALL** | Docs, comments, or formatting only, or at most 2 files and 30 changed lines — and no risk surface | One integrated pass (Pass 1 lenses plus correctness, run inline). No disk-backed capture, no Codex, no tiers. |
| **STANDARD** | Everything else up to 5 files and 300 changed lines, no risk surface | Pass 1 inline, parent roast, tiered Sin Inventory, approval bar. Codex only if the parent pass ends with nothing confirmed. |
| **HIGH-RISK** | Any risk surface touched, or more than 5 files or 300 changed lines, or the user asked for a deep review, an exhaustive roast, or a second opinion | The full program: disk-backed evidence plus the Codex cross-model review. |

Set the class from this table before reviewing and announce it before any other
review commentary. The class is a program choice, not a severity label. Keep it
fixed unless the evidence meets the explicit escalation rule below.

**Risk surface outranks size.** A five-line diff that hardcodes a credential,
loosens an auth check, or builds a query by string concatenation is HIGH-RISK.
Size can only downgrade a change that touches no risk surface.

Announce the class in one line before reviewing, so the user can see which
program ran and override it:

```
Scope: 2 files, 18 lines, no risk surface — SMALL review (single pass, no Codex).
```

**Escalate on evidence, never on suspicion.** Upgrade mid-review only when the
pass confirms a security, data-loss, or crash-level problem, the diff turns out
materially larger than the stat implied, or the user asks for more depth. Say so
in one line — `Upgrading to HIGH-RISK: unsanitized input reaches exec at
src/thumb.ts:44` — and continue with the larger program.

An ordinary bug that the cheap pass found is the cheap pass working. Fix it,
report it, and stay in the class you started in — do not inflate a finding's
severity to justify a bigger program.

Never downgrade a depth the user explicitly asked for, and never upgrade because
the code looks interesting.

---

## Pass 1: Simplify (auto-fix)

Clean the code first. The parent performs one integrated reuse, quality, and
efficiency pass. Delegate separate review domains only when deep effort was
selected and the shared budget permits it; verify findings before applying fixes.

**SMALL and STANDARD:** read the diff directly (`git diff
<resolved-scope-arguments>`) plus the enclosing functions and their callers. Skip
the evidence capture below — under 300 changed lines, writing a patch file, an
index, and a manifest costs more than the change is worth. Sweep the three lenses
plus correctness and security inline and fix what is confirmed. SMALL then goes
straight to the SMALL Verdict section; STANDARD continues to Pass 2.

**HIGH-RISK:** persist the authoritative diff instead of printing it
into model context. Resolve the shared `evidence-manifest.mjs`, write `git diff`
(or `git diff HEAD` for staged changes) to an evidence file under
`~/.vs/$PROJECT_ID/reviews/evidence/`, then emit its manifest and a bounded
`diff --git` / `@@` hunk index. Inspect only the relevant diff hunks, owning
source functions, callers, and tests. This keeps the full review surface
available without paying for it on every pass. Follow the
[disk-backed evidence contract](../vs-internal-shared/references/disk-backed-evidence.md).

```bash
PROJECT_ID=$(git config --get remote.origin.url 2>/dev/null \
  | sed -E 's#\.git$##; s#.*[:/]([^/]+/[^/]+)$#\1#; s#/#-#g')
[ -z "$PROJECT_ID" ] && PROJECT_ID=$(basename "$PWD")
REVIEW_EVIDENCE_DIR="$HOME/.vs/$PROJECT_ID/reviews/evidence"
EVIDENCE_TOOL="<resolved-vs-internal-shared-skill-directory>/scripts/evidence-manifest.mjs"
mkdir -p "$REVIEW_EVIDENCE_DIR"

DIFF_PATH="$REVIEW_EVIDENCE_DIR/diff-$(date +%Y%m%d-%H%M%S).patch"
HUNK_INDEX_PATH="$DIFF_PATH.index.txt"
git diff --no-color <resolved-scope-arguments> > "$DIFF_PATH"
rg -n '^(diff --git|@@)' "$DIFF_PATH" > "$HUNK_INDEX_PATH"
node "$EVIDENCE_TOOL" manifest "$DIFF_PATH" "$HUNK_INDEX_PATH"
head -200 "$HUNK_INDEX_PATH"
```

Replace `<resolved-scope-arguments>` from Phase 0 (`--cached`, `main...HEAD`, or
the explicit user scope). Search the complete disk-backed hunk index by filename
or symbol when a relevant hunk falls beyond the initial orientation sample.

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
8. AI slop: hallucinated imports, verbose boilerplate, defensive nulls on non-null types, wrappers adding zero logic

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

**Sweep for the other copies.** Before calling a fix done, grep the repository
for further copies of what you just changed — the same CSS selector, constant,
threshold, validation rule, or copy-pasted block. A rule that exists twice and is
fixed once ships the bug in the copy you did not read, and the diff will not show
it to you. Fix every copy in scope, or name the unfixed ones as a finding.

---

## Pass 2: Parent Roast + Gated Codex Review

**STANDARD and HIGH-RISK only.** A SMALL change already got correctness and
security coverage in its single pass; a second sweep over 18 lines finds nothing
the first one missed.

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

Deliver 1-3 opening zingers based on worst patterns — one per real finding, never
more than the findings support. Reference actual names, line counts. See [comedy-techniques.md](references/comedy-techniques.md).

### Codex Review

Run the advisor lane when either trigger fires:

- **HIGH-RISK** — the Phase 1 class already encodes it: an explicit
  second-opinion request, a diff past 5 files or 300 changed lines, or a touched
  risk surface.
- **A clean parent pass on a STANDARD change** — the parent roast confirmed
  nothing. A clean self-review is the least trustworthy verdict this skill
  produces, and it is the cheapest moment to buy an independent one: the lane
  fires only on diffs where there is nothing else left to do.

Skip it for SMALL unless the user asked. Never replace it with a mental review or
a slash-command reference — the point is that a different model read the code.

**In Claude Code:** run the codex plugin's review command:
```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/codex-companion.mjs" review --wait
```
If `CLAUDE_PLUGIN_ROOT` is not set or the script doesn't exist, fall back to
the direct CLI below.

**In Codex:** run the shell command directly.

**Derive the advisor scope from the Phase 0 selection — never from global git
state and never by probing.** `--uncommitted` reviews the dirty working tree,
while `--base` reviews the branch diff. Preserve the chosen review surface even
when unrelated dirty files exist:

```bash
case "$REVIEW_SCOPE_KIND" in
  explicit-uncommitted|staged) CODEX_SCOPE_ARGS=(--uncommitted) ;;
  explicit-branch|branch) CODEX_SCOPE_ARGS=(--base "$BASE_BRANCH") ;;
  explicit-file) CODEX_SCOPE_ARGS=() ;;
esac
CODEX_SCOPE_PROMPT="Review only the Phase 0 scope: $REVIEW_SCOPE_DESCRIPTION"

if [ "$REVIEW_CLASS" = "HIGH-RISK" ]; then
  timeout 120 codex review "${CODEX_SCOPE_ARGS[@]}" "$CODEX_SCOPE_PROMPT" 2>/dev/null \
    | node "$EVIDENCE_TOOL" capture "$REVIEW_EVIDENCE_DIR/codex-review.txt"
else
  timeout 120 codex review "${CODEX_SCOPE_ARGS[@]}" "$CODEX_SCOPE_PROMPT" 2>/dev/null
fi
```

Re-resolve the scope only after you changed its source yourself (for example,
you committed the staged change mid-review). Running `codex review --help`,
retrying another flag on empty output, or polling a backgrounded review with
`sleep` is wasted budget.

For HIGH-RISK, resolve `$EVIDENCE_TOOL` and `$REVIEW_EVIDENCE_DIR` as in Pass 1
and inspect the artifact with bounded `slice` ranges around concrete findings.
For STANDARD, the command reads advisor stdout directly and does not reference
the HIGH-RISK-only evidence variables.

`timeout 120` is the whole retry policy. If `timeout` is unavailable, run the
review in the foreground and abort at two minutes — never hand it to a background
task and poll. When the executable is missing, the environment blocks it, the
user declines to share the diff externally, or it produces nothing within the
window: log the lane as skipped with the reason and honor the missing-lane rule
below.

**Missing-lane rule.** The advisor lane failing does not make the review
stronger, so the verdict may not read as though it ran:

- Report the lane explicitly in the closeout — `Lanes: codex ✗ (timeout)`.
- On HIGH-RISK, the verdict is "reviewed, not independently verified — human
  review required". Never `Remaining: 0` on its own.
- Cap confidence at 70%, exactly as the Zero-Finding Gate does.

The one confirmed miss this skill has on record happened exactly this way: a
parent pass closed a review with `Remaining: 0` and no advisor lane, on a diff an
independent reviewer then broke into two capital-level and three felony-level
findings.

**Re-review only when it earned a re-run.** After fixes, re-run the advisor only
if a CAPITAL OFFENSE or FELONY was fixed. For lower tiers the focused tests plus
a re-read of the changed hunks are the proof; a second full advisor pass to
confirm a misdemeanor is budget spent on wording.

Parse Codex review output for finding titles, bodies, priorities, and locations when present. Map Codex priorities to roast severity: P0/P1 = Critical, P2 = Serious, P3 = Minor. If Codex returns unstructured text, summarize the findings manually and note that structured output was unavailable.

---

## SMALL Verdict

A SMALL review answers in a few lines: no tier headers, no worst-offender
spotlight, no fix menu.

Start with the Phase 1 scope announcement containing the literal words `SMALL
review`. Then report only the flat finding list below. Do not print `CAPITAL
OFFENSES`, `FELONIES`, `CRIMES`, `MISDEMEANORS`, or `PARKING TICKETS` anywhere
in a SMALL response; those labels mean the wrong program ran.

- One zinger, and only if the code earned it.
- A flat list of at most 3 findings, worst first: `**[Sin Name]** — file:line`
  plus one line on what to do.
- Fix the confirmed ones directly, then one line on what changed.
- Nothing wrong? Say so, name the one thing that is specifically right with
  `file:line` evidence, and stop. Do not open a tier to hold a single nitpick.

Escalate to the Sin Inventory below only when the pass confirms one of:

- a security, data-loss, or crash-level problem
- a provable no-op — the fix cannot execute or affect the path it targets, the
  guard is checked where it is never armed, or the test asserts something other
  than the behavior in question

A plain correctness bug, fixed inline with a one-line finding, is a complete
SMALL review — do not reach for a severity tier to dress it up. A no-op fix is
different in kind: green tests and a confident summary are actively laundering it,
so it earns the spotlight even on a twenty-line diff.

Wrong output from a path that does execute is an ordinary correctness bug, not a
no-op and not an escalation trigger.

---

## Sin Inventory

**STANDARD and HIGH-RISK.** Aggregate findings from Roast + Codex. Deduplicate — if both flag the same line, keep the more specific finding. Tag Codex-only findings so the user sees the cross-model signal.

Entry guard: if the Phase 1 class is SMALL, stop and return the SMALL Verdict.
Do not open this section or use any taxonomy tier label.

Group by the fixed 5-tier taxonomy — **CAPITAL OFFENSES / FELONIES / CRIMES / MISDEMEANORS / PARKING TICKETS**. Use these exact labels every time; keep the openers and metaphors fresh, keep the tiers stable. Each sin: `N. **[Sin Name]** — file:line` + one-liner roast; assign tier by impact.

Drop a tier that has nothing in it rather than filling it. A finding that is moot
by its own admission — a guard that can never fire, a nitpick on a line you just
deleted — is not a PARKING TICKET, it is padding.

If 15+ sins, show top 10 by severity. Mention overflow count.

For tier criteria and the sin-to-tier mapping, see [sin-categories.md](references/sin-categories.md). Any guidance that contradicts the fixed taxonomy (e.g., "invent your own labels") is superseded by this section.

When structural problems are present, prioritize them above cosmetic cleanup:
structural regressions, missed simplification, spaghetti branching, unclear
type/boundary contracts, file-size/decomposition pressure, then smaller
legibility issues. Do not bury a design regression under naming or formatting
noise.

**Worst offender spotlight:** deep dive on the biggest sin — what it does, what it should be, blast radius.

**Fix CAPITAL OFFENSES + FELONIES automatically and proceed.** Do not print a
tier menu — say which tiers you fixed in one line; the user can interrupt for
more or less.

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

Closeout for STANDARD and HIGH-RISK is one line, not a scorecard block:

```
Pass 1: [N] fixed | Pass 2: [N] found, [M] absolved | Files: N | Lanes: codex ✓ | Remaining: [by tier]
```

`Lanes` is mandatory and names every evidence lane the class called for, with a
reason when one is missing: `Lanes: codex ✗ (declined — private diff)`. A verdict
that hides which lanes ran is the defect the missing-lane rule exists to prevent.

SMALL closes out in one line: `SMALL review: [N] fixed, [N] left — <files>`.

## Zero-Finding Gate

Applies in every class. If all applicable review passes produce zero findings —
no critical, serious, or medium issues across every lens:

1. Verify you read the changed files in full, not just diffstat.
2. Name at least one specific positive assertion with `file:line` evidence:
   "auth is correct because X at `src/auth.ts:42`"
3. For STANDARD and HIGH-RISK, spend the advisor lane before declaring clean —
   this is the trigger described under Codex Review. A clean parent pass is a
   reason to get a second opinion, not a reason to skip one.
4. If still zero findings after the positive-assertion pass and the advisor lane,
   cap confidence at 70% and note "Zero findings — low-confidence approval" in the
   summary.

A clean review that can't name what's specifically right is a rubber stamp. A
clean review that invents a finding rather than say "clean" is worse.

## Approval Bar

Do not approve a change merely because behavior appears correct. Passing tests
are necessary, not a waiver for maintainability debt.

Walk this list for STANDARD and HIGH-RISK. For SMALL, only report a blocker you
actually tripped over while reading the diff — a 20-line change rarely has a
decomposition problem, and hunting for one is how a small review turns into a
long one.

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

Direct: emit **Next** only. Composed: return to caller.

**Prev:** `/vs-build-it` | `/vs-tdd` | `/vs-qa`
**Next:** `/vs-ship-it`
**Relevant:** `/vs-pushback` | `/vs-explain-diff`
