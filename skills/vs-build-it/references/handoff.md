## Phase 7: Handoff

The visual report is the explanation, not the audit record. Chat is the tiny
handoff. Its first line is the plain-language outcome: what now works for the
user, or exactly what remains unproven. Do not lead with a phase name, score, or
workflow status.

Use this adaptive shell and omit every empty section:

```markdown
<What now works, who it helps, and the main caveat if one remains.>

**Your action**

- <Only the action the user must take now.>

**Verified**

- <The strongest behavioral proof, in plain English.>
- <Tests or checks that materially increase confidence.>

**Still unverified**

- <Material claim> — <exact blocker>.

Report: `~/.vs/$PROJECT_ID/build-it/YYYY-MM-DD-<slug>.html`
Next: `/vs-ship-it` with branch `<branch-name>`.
```

When proof is blocked, name the exact observation that did not happen, not only
the prerequisite that was unavailable. Saying only that a surface or environment
was unavailable is not enough; state the missing event, interaction, or output
the next run must observe.

When that proof gates release, state the release gate explicitly in `Your
action`: `Do not ship, merge, or roll out until <evidence> passes.` A softer
future-state sentence is insufficient: saying the branch can move to shipping
is not an equivalent gate because it leaves the prohibited action implicit.

For a non-trivial run, write a machine audit Markdown sidecar beside the visual
report as `YYYY-MM-DD-<slug>-audit.md`. The full audit ledger lives there:
branch and commits, phase results, claim-to-proof evidence, Codex goal state,
decision records and whether each was written before implementation, every
auto-resolved decision, final guardrails, flagged review items, diff stat, and
preview process cleanup. A claim with no proof is `UNPROVEN` there and names its
blocker. Do not expose this ledger as the visual report's main content.

The visual report follows the problem-first recipe: concrete problem, one to
three before-and-after examples, one-sentence proposal, three to five rules, and
the next review action. Remove alternatives, long acceptance lists, process
history, and repeated evidence unless the current decision needs them. For a
trivial run that owes no report, include only the few audit facts needed to
support the chat claim.

Load and run `../../vs-brief/SKILL.md` when the change touches more than 3 files,
records a durable design decision, the user asks for PR orientation, or there is
meaningful before-and-after evidence. Include the comparison even when the diff
is small. Pass the current branch diff, decision log, flagged items, and captured
comparison evidence. Otherwise put the minimal pipeline summary and diff stat in
the machine audit sidecar; for a trivial run with no report, keep them to one
compact chat line.

If not found: append a minimal fallback using the resolved default branch:

```bash
DEFAULT_BRANCH=$(git symbolic-ref refs/remotes/origin/HEAD 2>/dev/null | sed 's|refs/remotes/origin/||')
for candidate in "$DEFAULT_BRANCH" master main; do
  [ -n "$candidate" ] && BASE=$(git merge-base HEAD "$candidate" 2>/dev/null) && break
done
[ -z "$BASE" ] && BASE=$(git rev-parse HEAD~1)
git diff --stat "$BASE"..HEAD
```

Before sending the final response, audit the sidecar for the complete ledger,
the visual report for the problem-first recipe, and chat for first-pass
comprehension. If the outcome, required action, material gap, required report
link, or explicit next step is missing, revise it. A report link is required
only when this run owed a report.
Do not make the user infer the result from git history or phase names.

Suggest next step based on results:
- All green → `/vs-ship-it`
- Guardrail failures → list what's broken, recommend fixing
- QA deferred issues → note them for future work
