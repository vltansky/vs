## Phase 7: Handoff

The handoff summary is the user's only window into what build-it decided.
You MUST include every section below. Do not abbreviate or skip sections.

Present the result to the user:

```
## Build It Complete

### Branch
`{branch-name}` — [N] commits

### Commits
- `<hash>` `<message>`
- `<hash>` `<message>`

### Pipeline
| Phase | Result |
|-------|--------|
| Roast | [N]/100, [X] issues fixed |
| Execute | [N] steps, guardrails pass/fail |
| Review | [N] found, [M] fixed |
| QA | skipped / [N]/100 health |

### Codex Goal
[created/reused/completed/unavailable/not created pending shape-it/left active because ...]

### Decision Log
| # | Phase | Decision | Principle | Rationale |
|---|-------|----------|-----------|-----------|
| 1 | ... | ... | ... | ... |

Every auto-resolved decision MUST appear here. If no decisions were logged
during execution, that is a bug — go back and reconstruct the log from
the work you did.

### Final Guardrails
- Types: pass/fail
- Tests: pass/fail ([N] passed, [M] failed)
- Build: pass/fail

### Flagged for human review
[Anything borderline or debatable — or "None"]
```

After presenting the summary, load and run `../../brief/SKILL.md` for the change
orientation brief when the host can resolve repo-relative skill paths. Follow its
steps using the current branch diff and this session's context (decisions log,
flagged items). The brief provides the reviewer-facing orientation layer on top
of the pipeline summary above.

Then load and run `../../walkthrough/SKILL.md` when available. Use the final diff,
verification result, and any QA evidence to produce a scenario-first walkthrough
of the shipped behavior, including branches and proof signal. Keep this separate
from the brief: the brief says what changed and where to review; the walkthrough
shows how the behavior works and how to prove it.

If not found: append a minimal fallback using the resolved default branch:

```bash
DEFAULT_BRANCH=$(git symbolic-ref refs/remotes/origin/HEAD 2>/dev/null | sed 's|refs/remotes/origin/||')
for candidate in "$DEFAULT_BRANCH" master main; do
  [ -n "$candidate" ] && BASE=$(git merge-base HEAD "$candidate" 2>/dev/null) && break
done
[ -z "$BASE" ] && BASE=$(git rev-parse HEAD~1)
git diff --stat "$BASE"..HEAD
```

Before sending the final response, audit it against the Phase 7 shell. If any required heading, commit list, decision row, guardrail result, or explicit next step is missing, revise before sending. Do not assume the user can infer the workflow from git history alone.

Suggest next step based on results:
- All green → `/ship-it`
- Guardrail failures → list what's broken, recommend fixing
- QA deferred issues → note them for future work
