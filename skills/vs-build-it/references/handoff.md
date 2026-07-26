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
| QA | [N]/100 health / blocked by `<exact prerequisite>` |

### Evidence
| Claim | Surface | Proof | Status |
|---|---|---|---|
| ... | route / command | screenshot, output, or test | proven / UNPROVEN |

Report: `~/.vs/$PROJECT_ID/build-it/YYYY-MM-DD-<slug>.html`
Previews started: `<command>` PID `<pid>` port `<port>` — stopped in Phase 6

Every claim the handoff makes appears here with the thing that proves it. A
claim with no proof is `UNPROVEN` and names its blocker. Omit the report line
only for a trivial run that owed no artifact; omit the previews line only when
the run started none.

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

Load and run `../../vs-brief/SKILL.md` when the change touches more than 3 files,
records a durable design decision, the user asks for PR orientation, or there is
meaningful before-and-after evidence. Include the comparison even when the diff
is small. Pass the current branch diff, decision log, flagged items, and captured
comparison evidence. Otherwise the pipeline summary and minimal diff stat are
the handoff.

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
- All green → `/vs-ship-it`
- Guardrail failures → list what's broken, recommend fixing
- QA deferred issues → note them for future work
