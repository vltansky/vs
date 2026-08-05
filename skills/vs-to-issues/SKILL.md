---
name: vs-to-issues
description: "Use when asked to turn a plan, spec, RFC, or brief into vertical-slice GitHub issues with handoff-ready bodies."
disable-model-invocation: true
---

# To Issues

Take a plan, spec, RFC, or brief and turn it into a set of GitHub issues that an agent (or human) can pick up and ship independently. Each issue is a vertical slice with its own acceptance criteria, labeled for human-in-the-loop or AFK execution, and wired into a blocking dependency graph.

This skill exists because most plans die at the "now what?" moment. The plan is solid but the jump from prose to concrete, bounded, assignable work is too high. `/vs-to-issues` makes that jump mechanical.

<HARD-GATE>
Do NOT start implementing the plan. Output is a set of GitHub issues (via `gh issue create`) and a short index comment. Code comes later via `/vs-build-it` or direct agent work on the issues.
</HARD-GATE>

## Codex Goal Integration

When running in Codex, use
[`../vs-internal-shared/references/codex-goal.md`](../vs-internal-shared/references/codex-goal.md)
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

If the plan is still fuzzy on terminology or framing, route to `/vs-shape-it` first. If the plan hasn't been stress-tested, route to `/vs-pushback` first.

## Phase 0: Read the plan and the repo

Before slicing:

1. **Read the source plan.** Full text. Do not skim. If the plan references external docs (linked specs, related issues, ADRs), read those too.
2. **Read the repo — and verify you're reading the *current* repo.** Skim the modules the plan touches, existing issue labels (`gh label list`), and any `AGENTS.md` / `CLAUDE.md` / `CONTRIBUTING.md` conventions.

   A stale checkout silently produces confident, wrong issues. Before citing any code:

   ```bash
   git fetch origin -q && git rev-list --count HEAD..origin/<default-branch>
   ```

   If that number is non-trivial, read via `git show origin/<branch>:<path>` rather than the working tree. A feature landing after your checkout can move the live code path entirely — the module the plan *sounds* like it touches may be dead code. Confirm the path is live (recent commits, referenced by current callers) before building an issue on it.

   When you find a module that looks right but isn't, **say so in the issue**. A "don't start here, and here's why" note is worth more than the correct pointer alone — it pre-empts the same wrong turn by the next reader.
3. **Read issue tracker conventions.** If `docs/agents/issue-tracker.md` exists, follow it. Otherwise, check `AGENTS.md` for an `Agent skills` / issue workflow section. If neither exists:
   - GitHub remote present → use GitHub issues.
   - No GitHub remote → draft markdown issues under `~/.vs/$PROJECT_ID/issues/` and do not call `gh issue create`.
4. **Check for existing issues** that overlap. Use `gh issue list --search "<relevant keyword>"`. If GraphQL quota blocks `gh issue list`, parse `REPO` from `git config --get remote.origin.url` and use REST search:
   ```bash
   REPO=$(git config --get remote.origin.url | sed -E 's#\.git$##; s#.*[:/]([^/]+/[^/]+)$#\1#')
   gh api "search/issues?q=repo:$REPO+is:issue+state:open+<keyword>"
   ```
   Do not create duplicates; extend or link instead.

Resolve `$PROJECT_ID` per [`../vs-internal-shared/SKILL.md`](../vs-internal-shared/SKILL.md) so the index file ends up in the right place.

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

### When the work isn't slice-shaped

Some work can't be sliced yet because it's gated on something outside the repo — a permission, a vendor limit, an approval, a decision someone else owns. Slicing it produces fiction: acceptance criteria for code nobody can run.

Recognize this when the honest status is *"possible, but not by us, not today."* File **one proposal issue** instead of a slice set, and use the [proposal shape](#proposal-issues) in Phase 3. Decompose into slices later, once the gate clears.

Do not disguise a blocked proposal as a ready slice. An issue labeled `ready-for-agent` that cannot be started burns exactly the trust the label exists to protect.

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

If the plan has details that *are* procedural or file-specific, they belong in a comment on the issue, a collapsed agent-context block (below), or `~/.vs/$PROJECT_ID/issues/<issue-number>-notes.md` — not in the durable prose.

### Two audiences, one body

An issue is read by a human deciding *whether* to do this, and by an agent working out *how*. Those need different things, and mixing them serves neither: the human wades through line numbers, the agent gets prose without pointers.

When an issue carries real technical context, split the body:

1. **Prose section (default, visible).** Written for the human. Product framing, concrete examples, why it matters, what's blocking. No file paths, no line numbers — the durability rules apply in full.
2. **Agent section (collapsed).** Everything volatile and precise, fenced in `<details>`:

   ```markdown
   <details>
   <summary><b>Agent context</b> — technical detail, code references, prior art</summary>

   ...file table, exact functions, permalinks, prior art, unverified list...

   </details>
   ```

Why this works: the durability rules exist because rot is invisible and misleads. Inside a `<details>` block that is **explicitly pinned to a commit SHA**, rot is legible — a reader who checks the SHA knows what they're holding. So the collapsed section may carry what the prose must not: paths, line numbers, code excerpts, "start here / not there" pointers.

Rules for the agent section:

- **Pin it.** State the SHA or branch the references were read at (`All line references are against origin/master at <sha>`). Unpinned line numbers are the thing the durability rules ban.
- **Show, don't just cite.** Paste the 5–10 load-bearing lines. A reader who can see the current code in the issue can diff it against reality without a checkout.
- **Include prior art.** If someone already solved this — in this repo or another — link the file and quote the mechanism. Existing production code is the strongest possible evidence that an approach works.
- **Keep an `Unverified` list.** Name what you could not confirm and why. This is what separates a brief that can be trusted from one that must be re-derived.

Skip the split entirely for a straightforward slice. Two sections on a 200-word issue is ceremony.

### Proposal issues

For work gated outside the repo (see Phase 1), replace *Acceptance criteria* with:

- **What / why** — the feature as a product, with **concrete worked examples**. Show the interaction, don't describe it. A two-line before/after exchange communicates more than a paragraph of explanation, and it's what makes a proposal forwardable to someone who wasn't in the conversation.
- **How it would work** — the mechanism, plus the approaches ruled out and *why*. Rejected options carry as much weight as the chosen one; without them the first reviewer re-litigates settled ground.
- **Known tradeoff** — what this does *not* give you, stated plainly. A proposal that reads as pure upside invites the reviewer to find the catch themselves and distrust everything else.
- **Blocker** — the single thing standing in the way, who owns it, and what the exact ask is. If everything else is small, say that: *"this permission is the only thing between us and shipping"* converts a vague proposal into a decision someone can make.
- **Scope checklist** — unchecked boxes, with the blocking item first and marked as gating the rest.

Label these `hitl` (a human decision is required) plus the category label. Do not label them `ready-for-agent`.

When the blocker needs a message to another team, **draft that message as an issue comment** rather than sending it. It gets reviewed before it's sent, it's copy-pasteable, and the issue becomes the record of the ask. Include: the likely routing (and any known dead ends — a bot that will refuse, a queue that ignores), the ask framed in terms of the *approver's* interest, the blast radius stated honestly, and a fallback option so a "no" still yields a path forward.

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
  - AFK: run `/vs-build-it` or dispatch agents against the afk-labeled issues
  - HITL: pick up the first unblocked human-in-the-loop issue yourself
```

## References

- Agent-brief format: [`references/agent-brief.md`](./references/agent-brief.md)
- Shared conventions (project ID, storage): [`../vs-internal-shared/SKILL.md`](../vs-internal-shared/SKILL.md)

## Output style

Apply the [shared output style](../vs-internal-shared/references/output-style.md)
to every user-facing message.

## Workflow

Direct: emit **Next** only. Composed: return to caller.

**Prev:** `/vs-shape-it` | `/vs-pushback`
**Next:** `/vs-build-it`
**Relevant:** `/vs-improve` | `/vs-setup-adr`
