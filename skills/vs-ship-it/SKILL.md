---
name: vs-ship-it
description: "Use when the user says create PR, open PR, ship it, submit changes, or send to dev. Creates a GitHub PR with session context."
disable-model-invocation: true
---

# Create PR

## Building Block Composition

Ship-it is a workflow. It composes building blocks to keep the PR surface
reviewable:

- `vs-roast-review` ensures the branch has had a review pass before shipping.
- `vs-verify` records the evidence that the branch is ready to present.
- `vs-brief` provides the reusable human-readable change orientation for chat,
  PR body, and CI-watch context.
- `vs-fix-pr` takes over if reviewer-bot findings or review threads need action.

## Codex Goal Integration

When running in Codex, use
[`../vs-internal-shared/references/codex-goal.md`](../vs-internal-shared/references/codex-goal.md)
for goal ownership and completion rules.

Ship-it owns the shipping goal once the branch/diff and PR target are clear.
The objective should be "create a review-ready PR for <change>" rather than the
broader implementation goal that produced the diff. Complete it after changes
are committed and pushed, the PR is created with brief/session context, verify
evidence is included, and CI/reviewer checks are either clean or handed off to
`/vs-fix-pr` or `/vs-baby-sit` with explicit status.

## Step 0: Ensure review ran

Before shipping, check if `vs-roast-review` was already run in this session.

If **not run yet**: run it now. Wait for both passes to complete (Pass 1 auto-fixes,
Pass 2 presents sins — auto-select option b for critical + serious). Apply fixes
before proceeding.

If **already run**: continue to Step 1.

## Step 1: Check state

```bash
git branch --show-current && git status -s && git diff HEAD --stat
```

- Detect username: `git config user.name` or extract from branch prefix
- If on `master`/`main`/`prod`: create a feature branch:

```bash
git checkout -b <username>/<feature-name>
```

Branch name from the diff context — short, descriptive, kebab-case.

## Step 2: Commit + Push

If uncommitted changes exist:

**If staged files exist** (respect user's selection):
```bash
git commit -m "<msg>" && git push -u origin HEAD
```

**If no staged files** (stage everything):
```bash
git add . && git commit -m "<msg>" && git push -u origin HEAD
```

Commit message: conventional format (`feat:`, `fix:`, `refactor:`, etc.), concise.

## Step 3: Establish the WHY

The PR body leads with **why** this change is needed — the motivation, not the
mechanics. Get this right before anything else; it's the part a reviewer reads
first and the part a diff can't reconstruct on its own.

### Source the WHY (in order)

1. **Live conversation first.** You usually have full context of what problem was
   discussed, what approaches were considered, what decisions were made and why,
   and what trade-offs were evaluated. Synthesize the WHY directly from your
   memory of this session.

2. **Transcript fallback.** If the WHY isn't recoverable from live context — the
   session was resumed, compacted, or the change predates this conversation —
   read the session transcript before falling back to the diff:

   ```bash
   PROJECT_SLUG=$(pwd | sed 's/[^a-zA-Z0-9]/-/g')
   SESSION_DIR="$HOME/.claude/projects/$PROJECT_SLUG"
   SESSION_FILE=$(ls -t "$SESSION_DIR"/*.jsonl 2>/dev/null | head -1)

   jq -r 'select(.message.role == "user" or .message.role == "assistant") |
     .message.role as $role |
     (if (.message.content | type) == "string" then .message.content
      else [.message.content[] | select(.type == "text") | .text] | join("\n")
      end) as $text |
     select($text != "") | "\($role): \($text)"' "$SESSION_FILE" | tail -150
   ```

   Mine the earliest user turns — the original request and its justification are
   usually there. Prefer the user's own framing of the problem over your later
   paraphrase.

3. **Ask, don't invent.** If neither source yields a real motivation, ask the
   user one concise line for the WHY rather than fabricating one. A diff-derived
   "what" with no "why" is the trivial-change case (skip the WHY section).

Ground the WHY in what was actually said. Do not manufacture business
justification the conversation never contained.

## Step 3b: Generate AI Session Context

Generate a privacy-safe summary for reviewers from the same source (live context
or transcript) captured above.

### What to include vs exclude

| Include | Exclude |
|---------|---------|
| Problem being solved | Exact user prompts |
| Solution approach chosen | Mistakes/failed attempts |
| Key decisions + WHY | Debugging struggles |
| Trade-offs considered | Personal info/credentials |
| Technical rationale | Anything embarrassing |

### Format as collapsible block

The WHY already leads the PR body (Step 5), so this collapsed block carries the
deeper detail — approach, decisions, and trade-offs — not a restated problem.

```markdown
<details>
<summary>AI Session Context</summary>

**Approach:** [1 sentence - solution strategy]

**Key Decisions:**
- [Decision]: [Rationale - the WHY]
- [Decision]: [Rationale - the WHY]

**Trade-offs Considered:**
- [Option A vs B]: Chose A because [reason]

</details>
```

### Skip Conditions

Skip AI Session Context if:
- Trivial change (typo, version bump, config)
- No meaningful decisions were made
- User says "no context" or "skip context"

## Step 4: Generate brief

Always run `vs-brief` against the pushed branch. Capture the rendered markdown —
it goes into the PR body (Step 5) and is shown again while watching CI (Step 7).

Store the brief output in a variable (or temp file) so it can be reused:

```bash
BRIEF_FILE=$(mktemp)
# invoke brief and write its rendered markdown to $BRIEF_FILE
```

Skip only if the diff is trivial (single-file typo, version bump) — same bar as
the AI Session Context skip conditions.

## Step 4b: Verify readiness

Run `vs-verify` against the pushed branch before creating the PR when available.
Capture the rendered `## Verification Result` and include a concise version in
the PR body or handoff.

Skip only for trivial diffs. If verification returns `FAIL` or `BLOCKED`, stop
and fix/unblock before creating the PR. If it returns `WARN`, continue only when
the warning is an explicit manual-verification gap that the PR reviewer can
reasonably resolve.

## Step 5: Create PR

**Format:**
```
<feature_area>: <Title> (80 chars max)

## Why

<2-4 sentences: the problem/motivation from Step 3 and why it matters now.
Sourced from chat context or transcript — not invented. Omit this section only
for trivial changes.>

## What changed

- bullet 1
- bullet 2

<details>
<summary>Change Brief</summary>

<brief output>

</details>

<details>
<summary>Verification</summary>

<verify output>

</details>

<details>
<summary>AI Session Context</summary>
...
</details>
```

```bash
gh pr create --title "<title>" --body "<body>"
```

Display the returned PR URL on its own line so it's clickable. Also print the
brief to chat once so the user sees it without opening the PR.

## Step 6: Suggest reviewers

Rank candidates by commits touching the changed files. Exclude the current user
and bots (`*[bot]*`, `*-ci-*`, `noreply`).

```bash
ME=$(git config user.email)
BASE=$(gh pr view --json baseRefName --jq .baseRefName)
git diff --name-only "origin/$BASE"...HEAD | \
  xargs -I{} git log --format='%aN <%aE>' -n 50 -- {} 2>/dev/null | \
  grep -viE "\[bot\]|-ci-|noreply|$ME" | \
  sort | uniq -c | sort -rn | head -5
```

Pick the top 1–3 by commit count. If the diff also touches a clearly owned area
(e.g., one file with a dominant author), prefer that author for it.

Report the suggestions in chat only — do **not** post them as a PR comment or
add them to the PR body. Format:

```
Suggested reviewers:
- @<gh-handle> — most commits in <path>
- @<gh-handle> — recent author of <path>
```

Map git author → GitHub handle via `gh api -X GET search/users -f q="<email>" --jq '.items[0].login'`
when the handle isn't obvious. Skip anyone you can't map confidently.

## Step 7: Watch CI

Print the brief to chat again before starting the watch — the user is about to
wait on CI, so give them something useful to read:

```
=== Change Brief ===
<contents of $BRIEF_FILE>
====================
Watching CI…
```

Then block until CI checks complete. This keeps the agent in context so it can
fix failures immediately without the user having to start a new session and
re-explain the change.

Use `--watch` without `--fail-fast`. `--fail-fast` exits on any terminal conclusion, and reviewer bots commonly use non-SUCCESS conclusions (`NEUTRAL`, `FAILURE`) to signal "I posted findings" — bailing on first non-success would skip the findings fetch:

```bash
gh pr checks $PR_NUM --watch
```

Then classify each check. A check is a **reviewer bot** when its name matches a reviewer keyword (`review`, `codex`, `copilot`, `claude`, etc.) **as a whole word** — use `\breview\b|\bcodex\b|\bcopilot\b|\bclaude\b` in regex. Raw substring matching misclassifies `Deploy Preview` as a reviewer. Keep the keyword list extensible so new bots can be added without rewriting detection.

| Check | Conclusion | Action |
|-------|-----------|--------|
| Build | SUCCESS | Pass |
| Build | FAILURE | Fix (see below) |
| Reviewer bot | any terminal conclusion | **Fetch findings** — the comments are the signal, not the conclusion |
| Reviewer bot | still pending | Wait in background (Claude Code: `run_in_background: true` — harness wakes on exit; Codex: delegate to `awaiter` builtin sub-agent or unified-exec background terminal with `background_terminal_max_timeout` raised in `~/.codex/config.toml`) and re-classify when terminal |

### Fetch reviewer-bot findings

Whenever a reviewer-bot check reached a terminal state — regardless of conclusion, regardless of whether it was still pending on first poll — fetch **unresolved** findings. The correct filter is `isResolved == false` on `reviewThreads`, not `commit_id == HEAD_SHA` — bots re-attach open threads to every new commit, so a HEAD filter both misses legitimately active threads and re-surfaces already-fixed ones. Carry `isOutdated` along to distinguish "still anchored to HEAD" from "line has since moved":

```bash
OWNER=$(echo "$REPO" | cut -d/ -f1)
NAME=$(echo "$REPO" | cut -d/ -f2)

# Unresolved inline review threads from reviewer bots
gh api graphql -F owner="$OWNER" -F name="$NAME" -F pr="$PR_NUM" -f query='
query($owner:String!,$name:String!,$pr:Int!) {
  repository(owner:$owner,name:$name) {
    pullRequest(number:$pr) {
      reviewThreads(first:100) {
        nodes {
          isResolved isOutdated path line
          comments(first:10) { nodes { author { login } body } }
        }
      }
    }
  }
}' | jq '[.data.repository.pullRequest.reviewThreads.nodes[]
          | select(.isResolved == false)
          | select((.comments.nodes[0].author.login // "") | test("\\breview\\b|\\bcodex\\b|\\bcopilot\\b|\\bclaude\\b|\\bbot\\b|\\bactions\\b"; "i"))
          | {path, line, isOutdated, body: .comments.nodes[0].body}]'

# Sticky summary comments (bots' N findings rollup) — scope by last push
LAST_PUSH=$(gh pr view $PR_NUM --json commits --jq '.commits[-1].committedDate')
gh api repos/$REPO/issues/$PR_NUM/comments \
  | jq -r --arg t "$LAST_PUSH" '.[] | select(.user.login | test("\\breview\\b|\\bcodex\\b|\\bcopilot\\b|\\bclaude\\b|\\bbot\\b|\\bactions\\b"; "i")) | select(.updated_at >= $t) | .body'
```

Flag outdated threads (`isOutdated: true`) separately in the summary — the concern may already be addressed; `/vs-fix-pr` re-evaluates each against HEAD.

**If any unresolved reviewer-bot threads exist:** summarize (active vs outdated), hand off with `/vs-fix-pr`.
**Otherwise:** "Ready for human review." Include PR URL + suggested reviewers.

### If build checks fail

1. Read the failure: `gh pr checks $PR_NUM --json name,state,description --jq '.[] | select(.state == "FAILURE")'`
2. Get logs: `gh run view <run-id> --log-failed | tail -50`
3. Fix, commit, push.
4. Re-watch: `gh pr checks $PR_NUM --watch` (no `--fail-fast`).
5. Max 2 fix attempts. If still failing: report what's broken, stop.

**Tip:** while this agent watches CI, the user can open a new terminal and
start a separate `claude` session to keep working on something else in
parallel.

## Verification

Blocked until all items pass — do not report "shipped" without evidence for each.

- [ ] Review ran (roast-review completed, fixes applied)
- [ ] All changes committed and pushed to remote
- [ ] `vs-brief` generated and captured (unless trivial diff)
- [ ] `vs-verify` generated a PASS/WARN result or was skipped as trivial
- [ ] PR created with conventional format title and body
- [ ] WHY established from chat context or transcript (not invented) and shown as the lead `## Why` section (unless trivial)
- [ ] Change Brief included in PR body as collapsed `<details>` (unless trivial)
- [ ] AI Session Context included (unless skip conditions met)
- [ ] Reviewer suggestions reported in chat only
- [ ] Brief printed to chat before CI watch starts
- [ ] CI checks pass (or failures investigated and fixed, max 2 attempts)
- [ ] Final "Ready for human review" message sent with PR URL and reviewers

## Workflow

**Prev:** `/vs-roast-review` (review passed) | `/vs-build-it` (handoff suggests ship-it)
**Next:** `/vs-fix-pr` (address reviewer feedback) | done
