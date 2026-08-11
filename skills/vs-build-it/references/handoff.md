## Phase 7: Handoff

The report is the audit record. Chat is the readable handoff. Its first line is
the plain-language outcome: what now works for the user, or exactly what remains
unproven. Do not lead with a phase name, score, or workflow status.

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

The full audit ledger lives in the report: branch and commits, phase results,
claim-to-proof evidence, Codex goal state, decision records and whether each was
written before implementation, every auto-resolved decision, final guardrails,
flagged review items, diff stat, and any preview process cleanup. A claim with
no proof is `UNPROVEN` there and names its blocker.
For a trivial run that owes no report, include only the few audit facts needed
to support the chat claim.

Load and run `../../vs-brief/SKILL.md` when the change touches more than 3 files,
records a durable design decision, the user asks for PR orientation, or there is
meaningful before-and-after evidence. Include the comparison even when the diff
is small. Pass the current branch diff, decision log, flagged items, and captured
comparison evidence. Otherwise put the minimal pipeline summary and diff stat in
the report; for a trivial run with no report, keep them to one compact chat line.

If not found: append a minimal fallback using the resolved default branch:

```bash
DEFAULT_BRANCH=$(git symbolic-ref refs/remotes/origin/HEAD 2>/dev/null | sed 's|refs/remotes/origin/||')
for candidate in "$DEFAULT_BRANCH" master main; do
  [ -n "$candidate" ] && BASE=$(git merge-base HEAD "$candidate" 2>/dev/null) && break
done
[ -z "$BASE" ] && BASE=$(git rev-parse HEAD~1)
git diff --stat "$BASE"..HEAD
```

Before sending the final response, audit the report for the complete ledger and
the chat response for first-pass comprehension. If the outcome, required
action, material gap, required report link, or explicit next step is missing,
revise it. A report link is required only when this run owed a report.
Do not make the user infer the result from git history or phase names.

Suggest next step based on results:
- All green → `/vs-ship-it`
- Guardrail failures → list what's broken, recommend fixing
- QA deferred issues → note them for future work
