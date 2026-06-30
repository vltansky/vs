---
name: to-issues
description: "Use when asked to turn a plan, spec, RFC, or brief into vertical-slice GitHub issues with handoff-ready bodies."
disable-model-invocation: true
---

# To Issues

Take a plan, spec, RFC, or brief and turn it into a set of GitHub issues that an agent (or human) can pick up and ship independently. Each issue is a vertical slice with its own acceptance criteria, labeled for human-in-the-loop or AFK execution, and wired into a blocking dependency graph.

This skill exists because most plans die at the "now what?" moment. The plan is solid but the jump from prose to concrete, bounded, assignable work is too high. `/to-issues` makes that jump mechanical.

<HARD-GATE>
Do NOT start implementing the plan. Output is a set of GitHub issues (via `gh issue create`) and a short index comment. Code comes later via `/build-it` or direct agent work on the issues.
</HARD-GATE>

## Codex Goal Integration

When running in Codex, use
[`../internal-shared/references/codex-goal.md`](../internal-shared/references/codex-goal.md)
for standalone-goal rules.

To-issues normally contributes handoff material to a larger planning workflow.
If invoked as the whole task, it may own a goal to turn the source plan into
durable GitHub issues or draft issue files. Complete that goal only after the
draft set is approved and created, or after draft files/index are written when
GitHub issue creation is unavailable or not approved. Do not treat the later
implementation of those issues as part of the to-issues goal.

## When to use

- A plan or spec exists (in chat, in `~/.vs/$PROJECT_ID/specs/`, in a doc, or verbally) and the user wants to file it as tickets
- The user wants to hand off work to async agents and needs durable issue bodies that survive reorg
- A PRD-shaped doc exists and the implementation is non-trivial (3+ slices worth of work)

If the plan is still fuzzy on terminology or framing, route to `/shape-it` first. If the plan hasn't been stress-tested, route to `/pushback` first.

## Phase 0: Read the plan and the repo

Before slicing:

1. **Read the source plan.** Full text. Do not skim. If the plan references external docs (linked specs, related issues, ADRs), read those too.
2. **Read the repo.** Skim the modules the plan touches, existing issue labels (`gh label list`), and any `AGENTS.md` / `CLAUDE.md` / `CONTRIBUTING.md` conventions.
3. **Read issue tracker conventions.** If `docs/agents/issue-tracker.md` exists, follow it. Otherwise, check `AGENTS.md` for an `Agent skills` / issue workflow section. If neither exists:
   - GitHub remote present → use GitHub issues.
   - No GitHub remote → draft markdown issues under `~/.vs/$PROJECT_ID/issues/` and do not call `gh issue create`.
4. **Check for existing issues** that overlap. Use `gh issue list --search "<relevant keyword>"`. If GraphQL quota blocks `gh issue list`, parse `REPO` from `git config --get remote.origin.url` and use REST search:
   ```bash
   REPO=$(git config --get remote.origin.url | sed -E 's#\.git$##; s#.*[:/]([^/]+/[^/]+)$#\1#')
   gh api "search/issues?q=repo:$REPO+is:issue+state:open+<keyword>"
   ```
   Do not create duplicates; extend or link instead.

Resolve `$PROJECT_ID` per [`../internal-shared/SKILL.md`](../internal-shared/SKILL.md) so the index file ends up in the right place.

## Label contract

Map canonical roles to the repo's actual labels before drafting issues. Use existing labels when they clearly match; create only missing defaults.

| Role | Default label | Meaning |
|---|---|---|
| State: needs review | `needs-review` | Draft or stub, not ready for execution |
| State: ready for agent | `ready-for-agent` | Self-contained enough for agent work |
| State: ready for human | `ready-for-human` | Needs human judgment before or during execution |
| Category: bug | `bug` | Defect / regression work |
| Category: enhancement | `enhancement` | New or changed behavior |
| AFK eligibility | `afk-safe` | Safe for unattended agent runs |
| Human-in-loop note | `hitl` | A specific human decision point remains |

Every created issue gets exactly one state label and at most one category label. Use `afk-safe` and `hitl` as optional tags, not as replacements for the state label. If a local convention maps these roles to different labels, use the local names consistently.

## Phase 1: Decide slice granularity

A good issue is a **vertical slice**: a small end-to-end change that, when merged, moves the product forward visibly. Horizontal slicing (DB layer issue, then API layer issue, then UI layer issue) is the failure mode — each horizontal slice is un-shippable alone and the integration issue becomes a mega-issue.

Rules for slicing:

- Each slice should be mergeable in isolation without breaking the build
- Each slice should be describable in one sentence ending in a verb ("User can search orders by date")
- If a slice requires another slice's code to exist before it can be tested, add a `blocked by` dependency, don't merge them
- If you can't describe a slice without listing 6+ sub-tasks, it's too big — split it
- If two slices share >70% of the same implementation, they're probably one slice with two acceptance criteria

Typical slice count for a medium plan: **3–8 issues.** Fewer than 3 and you don't need this skill. More than 12 and the plan is too big to decompose in one pass — push back and ask the user to pick a Phase 1.

## Phase 2: Tag for execution mode

Every issue gets one of three execution tags:

| Role | Default label | Use when |
|---|---|---|
| State: ready for human | `ready-for-human` + optional `hitl` | Design decisions, UX calls, ambiguous specs, risky migrations |
| State: ready for agent | `ready-for-agent` + optional `afk-safe` | Clear acceptance criteria, stable interface, no surprises expected |
| State: needs review | `needs-review` | Use for drafts or stubs that need a second pass |

Default to `ready-for-human` unless the issue is genuinely afk-safe. If in doubt, the issue is not afk-safe. AFK issues that stall on a design question waste the agent's budget and the human's trust.

AFK-safe checklist (all must be true):

- Acceptance criteria are behavioral and checkable without asking the user
- No "we'll figure it out" clauses
- No net-new architecture decisions
- The agent has everything it needs to verify success (test command, eval, or observable state)
- Failure mode is reversible (branch work, not prod push)

## Phase 3: Write issue bodies as AGENT-BRIEF

Every issue body follows the AGENT-BRIEF shape from [`./references/agent-brief.md`](./references/agent-brief.md). Summary:

- **Context.** One paragraph. Why this slice exists. What the user outcome is.
- **Behavioral outcome.** What the system does after this is shipped, described as observable behavior (not "edit file X"). A future reader should understand the change without knowing the current file layout.
- **Acceptance criteria.** Bullet list. Each item is checkable by running a command or observing state. No `implements the design`, no `code reviewed`. Phrase as `When <input>, then <observable output>`.
- **Out of scope.** Explicit bullets of what this slice does *not* do. Prevents scope creep during execution.
- **Dependencies.** Blocking issues listed as `Blocked by #<n>`. GitHub renders these as a task graph.

Durability rules (the whole reason this format exists):

- **No file paths.** The repo reorgs; file paths rot. Describe the change in terms of modules/features, not paths.
- **No line numbers.** Same reason.
- **No "currently X" references** unless the current state is documented elsewhere. Describe the target state, not the delta.
- **No private shorthand.** If the issue references a concept, define it or link to `CONTEXT.md`.
- **No procedural steps** ("first do X, then Y"). Describe the outcome; let the implementer choose the path.

If the plan has details that *are* procedural or file-specific, they belong in a comment on the issue or in `~/.vs/$PROJECT_ID/issues/<issue-number>-notes.md`, not in the body.

## Phase 4: Wire dependencies

After drafting issue bodies, build the dependency graph:

- For each issue, list the issues it depends on (must merge first) and the issues it unblocks
- Use GitHub's native `Blocked by #<n>` convention in the body — most GitHub UIs render this as a graph
- If two issues depend on each other, you have one issue; merge them
- If the graph has a long chain (A → B → C → D → E), flag it: that's a horizontal slice masquerading as verticals

A healthy graph has a shallow root (one or two foundational slices) branching into parallelizable leaves.

## Phase 5: Create the issues

First show the **full draft set**: every title, body, label set, dependency edge, and planned creation order. Get one explicit approval for the full set before creating anything. Do not create issues one-by-one while the user is still reviewing later drafts.

Use `gh issue create` for each approved GitHub issue. If GraphQL quota blocks create paths, use REST after deriving `REPO` from `git config --get remote.origin.url`:

```bash
gh api -X POST "repos/$REPO/issues" \
  -f title="<one-sentence slice title>" \
  -f body=@/tmp/issue-body.md \
  -F labels='["ready-for-agent","enhancement","afk-safe"]'
```

Suggested flow:

```bash
gh issue create \
  --title "<one-sentence slice title>" \
  --body "$(cat <<'EOF'
## Context
...

## Behavioral outcome
...

## Acceptance criteria
- When <input>, then <observable output>
- ...

## Out of scope
- ...

## Dependencies
- Blocked by #<n>
EOF
)" \
  --label "<state-label>,<category-label>,<optional-tags>"
```

Rules:

- **Do not auto-create** — show the full draft issue set first, get confirmation, then create
- Create in dependency order (foundational issues first so their numbers exist before dependents reference them)
- If the user wants to review all at once, emit the draft as a markdown file under `~/.vs/$PROJECT_ID/issues/<date>-plan-name.md` and wait for approval
- Never modify existing issues without confirmation

## Phase 6: Write the index

After all issues are created, write an index file to `~/.vs/$PROJECT_ID/issues/<date>-<plan-slug>.md`:

```markdown
# <Plan title> — issues

Source: <link to plan/spec/RFC>
Created: <YYYY-MM-DD>

## Issues

- [ ] #<n> <title> — <human-in-the-loop|afk> — blocks: #<m>,#<o>
- [ ] ...

## Graph

<ascii or mermaid graph of dependencies if the plan warrants it>

## Notes

<anything the agent needs that didn't fit an issue body>
```

This index is the single place the user can see the whole plan's state. It's not the source of truth — GitHub is — but it's the human-scale overview.

## Phase 7: Handoff

Emit a handoff block:

```
## To-Issues Handoff

- Plan source: <path or link>
- Issues created: <count> (<n> human-in-the-loop, <m> afk)
- Index: ~/.vs/$PROJECT_ID/issues/<file>.md
- Codex Goal: completed / left active because ... / unavailable
- Dependency depth: <max blocked-by chain length>
- Recommended next step:
  - AFK: run `/build-it` or dispatch agents against the afk-labeled issues
  - HITL: pick up the first unblocked human-in-the-loop issue yourself
```

## References

- Agent-brief format: [`references/agent-brief.md`](./references/agent-brief.md)
- Shared conventions (project ID, storage): [`../internal-shared/SKILL.md`](../internal-shared/SKILL.md)

## Workflow

**Prev:** `/shape-it` (plan formed) | `/pushback` (plan stress-tested)
**Next:** `/build-it` (execute afk slices) | direct agent dispatch against issues | human review of `needs-review` drafts
