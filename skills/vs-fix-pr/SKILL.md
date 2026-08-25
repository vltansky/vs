---
name: vs-fix-pr
description: "Primary VS workflow whenever the user asks to see, check, review, address, or fix a PR, its comments or feedback, or its failing CI; handle requested changes; or resolve review threads. Use this instead of a generic GitHub PR-comments workflow when available. Inspect-only requests stay read-only; action requests repair actionable CI and feedback, gate every reply or resolution on approval, then babysit the updated PR by default."
---

# Fix PR

## Choose the PR mode

Preserve the difference between inspecting a PR and acting on it:

- **Inspect only:** the user says see, check, list, review, or summarize PR
  comments/feedback without asking to address them. Resolve the PR, wait for
  relevant reviewer checks, fetch all feedback surfaces in Step 2, and report
  CI plus the actionable, outdated, resolved, and informational feedback. Do
  not edit, commit, push, rerun CI, reply, or resolve threads. Stop after the
  report.
- **Address PR:** the user says address, fix, handle, apply, or resolve a PR or
  its comments/feedback. Treat both actionable CI failures and reviewer
  feedback as owned work. Continue through the full workflow, including the
  approval gates before posting replies or resolving threads.

If the request combines both, inspect first and then continue in address mode.

## Building Block Composition

Fix-pr is a workflow for making an existing PR healthy after review or CI
feedback. It composes:

- `vs-decide-for-me` for tactical uncertainty around implementation details.
- `vs-verify` after applying fixes so replies are backed by evidence.
- `vs-baby-sit` after address-mode work so the updated PR stays owned while
  CI and new review feedback arrive.

Inspect-only mode stops after its report and does not start `vs-baby-sit`.

When the current checkout is not already on the PR branch, fix-pr owns the
branch/worktree setup directly: inspect the PR, preserve unrelated dirty state,
then switch to or create the appropriate isolated checkout before editing.

## Codex Goal Integration

When running in Codex, use
[`../vs-internal-shared/references/codex-goal.md`](../vs-internal-shared/references/codex-goal.md)
for goal ownership and completion rules.

Fix-pr owns the PR-health goal after Step 0 resolves the target PR and either
Step 1 finds actionable CI or Step 2 identifies unresolved feedback. The
objective should name the PR plus its failing-check and unresolved-feedback
scope. Complete the goal only after every owned CI failure and accepted review
fix is committed and pushed, approved replies are posted, approved threads are
resolved, and the build/reviewer state has been rechecked. Declined feedback,
external CI blockers, or human-decision threads keep the goal active or blocked
according to Codex goal policy.

## Entry Points

If the user drops you into a later state such as "already inside Step 4b/4c", "continue from that exact state", or provides the current thread + drafted reply directly:

- Skip the earlier steps that would rediscover that state.
- Continue from the named step using this skill's rules for that step.
- Do **not** bypass the skill by answering ad hoc just because the state is already provided.

This matters most for decision gates:

- **Step 4b unsure path** → if the host exposes an ask-user question tool, invoke it.
- **Step 4c-decline gate** → if the host exposes an ask-user question tool, invoke it.
- **Step 4c approval gate** → if the host exposes an ask-user question tool, invoke it.

`continue from that exact state` means "skip discovery", not "skip AskUserQuestion".

Non-negotiable rule: when `AskUserQuestion` is available, do **not** render the final decision options as plain chat bullets or numbered lists first. Calling `AskUserQuestion` is the action. The follow-up chat message, if any, should only say that the question is up and you are waiting.

## Step 0: Resolve PR & Ensure Correct Branch

### 0a. Determine Target PR

Check if the user mentioned a PR number or URL in the conversation.

If yes — use that:
```bash
PR_JSON=$(gh pr view <number-or-url> --json number,headRefName,url)
```

If no — use the current branch's PR:
```bash
PR_JSON=$(gh pr view --json number,headRefName,url)
```

If `gh pr view` fails (no PR found): tell user "No PR found" and stop.

```bash
PR_NUM=$(echo "$PR_JSON" | jq -r .number)
PR_BRANCH=$(echo "$PR_JSON" | jq -r .headRefName)
PR_URL=$(echo "$PR_JSON" | jq -r .url)
REPO=$(echo "$PR_JSON" | jq -r '.url | capture("^https://github.com/(?<repo>[^/]+/[^/]+)/pull/[0-9]+$").repo')
```

Derive `REPO` from the PR URL, not the checkout remote. A fork PR's number
belongs to the base repository even when the current branch lives in the head
repository.

### 0b. Check Current Branch

```bash
CURRENT_BRANCH=$(git branch --show-current)
```

If `CURRENT_BRANCH` equals `PR_BRANCH` — proceed to Step 1.

### 0c. Handle Branch Mismatch

Check for uncommitted changes:
```bash
git status --porcelain
```

**If uncommitted changes exist:** Ask the user with the file list. Options:
- **Stash & switch** — `git stash --include-untracked --message "fix-pr: auto-stash from $CURRENT_BRANCH"`, then checkout
- **Switch without stashing** — Checkout directly (changes carry over if no conflicts)
- **Cancel** — Stop, keep current branch

**If clean:** Switch automatically — no need to ask when there's nothing at risk.

Switching:
```bash
git checkout $PR_BRANCH && git pull
```

## Step 1: Check and Repair CI

```bash
SHA=$(gh pr view $PR_NUM --json commits --jq '.commits[-1].oid')
BUILD_STATE=$(gh api repos/$REPO/commits/$SHA/status --jq '.state')
echo "Build: $BUILD_STATE"
```

Also check for CI status via checks API:
```bash
gh pr checks $PR_NUM
```

Treat the returned checks for the exact current head as the source of truth. A
user's belief that the PR is red, an older notification, or a stale PR card is
not a failure event. First confirm that the exact current head has a failing
check. Only then say that you will open the failed check logs and enter Step
1a. If the current-head snapshot is green, say the red state has cleared and do
not run the failure inspector.

| Build Status | Action |
|--------------|--------|
| **success** | Proceed to Step 2 |
| **failure** | Analyze failure (Step 1a); in address mode, repair owned failures |
| **pending** | Process available feedback, but wait before the final handoff |
| **No status** | Proceed to Step 2 |

CI is a first-class input, not merely context for reviewer comments. In address
mode, a red required check is actionable work even when Step 2 finds no
comments. Do not stop with "No PR comments to address" while a required check
is failing or still running.

### Async reviewer checks

Some checks are automated reviewers that post comments asynchronously (e.g., `Repo Review (Codex)`, `claude-review`, Copilot PR reviewer). They may show as `queued` / `pending` / `in_progress` even after the build is green, and their feedback won't appear in Step 2 until they finish.

Detect them in the checks output — names containing `review` (e.g., `Repo Review (Codex)`, `PR Review`, `claude-review`), `codex`, `copilot`, or `claude`.

**If an outstanding check name contains `review` → wait for it. Don't ask.** These are reviewer bots whose comments are the whole point of Step 2.

Tell the user once: "`<check name>` is still running — waiting for it, will fetch comments when it finishes."

Then wait with the bundled PR watcher. It stays in one process and prints nothing until the state actually changes:

```bash
python3 <resolved-vs-baby-sit-skill-directory>/scripts/watch_pr.py \
  --repo "$REPO" \
  --pr "$PR_NUM" \
  --until merge-ready
```

Exit `10` carries an `attention` event — the reviewer posted findings or a check failed. Exit `0` means the PR reached a clean terminal state. Resume that same process with the longest wait and the smallest output budget your runtime supports; an unchanged tick emits nothing, so a large output budget only buys a larger buffer replay.

Do not wait with `gh pr checks $PR_NUM --watch` (foreground or background), a `sleep` poll loop, or a busy-poll on `--json name,state`. Each of those repaints a full check table into context on every wake, which is the dominant token cost of a long CI wait.

When the check finishes, re-fetch comments and proceed to Step 2.

### If CI Failed

#### Step 1a: Analyze the Failure

```bash
# Check for CI bot comments with build output
gh pr view $PR_NUM --json comments --jq '.comments[-1].body' | head -50
```

1. **Open the failed check logs** — do not infer the cause from the check name or
   last PR comment alone. Parse the failing step and its first causal error.
2. **Check whether the failure is owned by this PR:**
   ```bash
   gh pr view $PR_NUM --json files --jq '.files[].path'
   ```

| Cause | Address-mode action |
|-------|---------------------|
| Product/test/workflow behavior introduced or exposed by the PR | Fix it, verify locally, commit, and push |
| Deterministic repository failure repairable on the PR branch | Fix it, verify locally, commit, and push |
| Confirmed transient/flaky check | Re-run the failed job once when supported, then recheck |
| External infrastructure, quota, permission, or secret blocker | Repair it only when the PR safely owns that configuration; otherwise report the exact blocker |

Do not classify a failure as external merely because the reported file is not in
the diff. A PR can expose existing tests, generated artifacts, workflow steps,
or repository-wide constraints. Establish the causal link from logs, the diff,
and a local reproduction when practical.

In address mode, iterate until required CI is green or an external blocker is
proven: diagnose, fix or re-run, push if needed, and re-fetch the exact HEAD
checks. Continue to Step 2 in the same run so newly posted reviewer feedback is
not missed. CI fixes do not require the review-reply approval gate; posting a PR
comment about the failure still does.

In inspect-only mode, report the same diagnosis without editing, pushing, or
re-running anything.

## Step 2: Fetch Comments

The goal is **unresolved** feedback. Don't filter by `commit_id == HEAD` — bots re-attach open threads to every new commit, and a filter by HEAD misses legitimately active threads that were opened on an earlier commit and never resolved. Use GraphQL `reviewThreads` with `isResolved: false` as the primary filter, and carry `isOutdated` along so stale-against-HEAD threads can be flagged (not dropped).

```bash
COMMENTS_JSON=$(python3 <skill-dir>/scripts/fetch_comments.py --pr "$PR_URL")
UNRESOLVED_THREADS=$(echo "$COMMENTS_JSON" | jq '[.review_threads[] | select(.isResolved == false)]')
GENERAL_COMMENTS=$(echo "$COMMENTS_JSON" | jq '.conversation_comments')
REVIEW_BODIES=$(echo "$COMMENTS_JSON" | jq '[.reviews[] | select((.body | length) > 0)]')
```

Resolve `<skill-dir>` to this skill's installed directory. Use the bundled
script instead of rebuilding the GraphQL query ad hoc. It independently
paginates conversation comments, review submissions, review threads, and long
thread conversations; it also resolves fork PRs against their base repository.

Inspect all three feedback surfaces:

- `UNRESOLVED_THREADS` — inline conversations where resolution state matters.
- `GENERAL_COMMENTS` — top-level PR conversation comments.
- `REVIEW_BODIES` — review submission summaries, including requested changes
  that may not appear in either of the other surfaces.

Cluster feedback by file or behavior area, then remove semantic duplicates.
Separate actionable requests from approvals, informational notes, already
resolved threads, and superseded discussion.

For each unresolved thread, tag it:
- **Active** — `isOutdated == false`: still anchored to current HEAD, address normally.
- **Outdated** — `isOutdated == true`: the code the thread was pinned to has changed. Usually already addressed by the rewrite.

**Outdated bulk-resolve** — don't walk each outdated thread through Step 4 individually. Offer one prompt: "N outdated threads — resolve all as addressed-by-rewrite?" If the user keeps one open, label it `[OUTDATED]` in the finding list and re-evaluate whether the concern migrated to a new line.

Feedback exit gate — only report "No PR comments to address" when the
unresolved-thread list, issue-level comment list, and actionable
review-submission bodies are all empty. This is not a workflow exit: Step 1's CI
gate must also be green or have no required checks. A review body can contain
valid feedback even when no inline threads remain.

## Step 3: Create TODO List

One TODO per **thread**, not per comment. Long threads have back-and-forth — act on the reviewer's **latest** comment (`.comments.nodes[-1]` from the GraphQL fetch), not the original one. Earlier comments in a thread are usually superseded by follow-ups.

Create one TODO per actionable top-level comment or review-body feedback cluster
too. Include file:line for inline threads. If feedback asks only for an
explanation, draft a response instead of forcing an unnecessary code change.

## Step 4: For Each Feedback Item

### 4a. Evaluate

Is the reviewer's latest ask valid feedback?
- Does it improve correctness or quality?
- Is it based on accurate understanding of the code?

### 4b. Decide Action

For an accepted code change, apply [`vs-ponytail`](../vs-ponytail/SKILL.md) in
composed mode after confirming the feedback is PR-owned. Prefer the smallest root-cause fix
that satisfies the comment and CI; do not minimize the approval boundary.

| Confidence | Action | Next |
|------------|--------|------|
| **High (agree)** | Implement the fix | 4c (fix → reply → resolve) |
| **High (disagree)** | Decline with rationale | 4c-decline (reply only, leave open) |
| **Unsure** | Ask the user | route to 4c or 4c-decline based on answer |

For unsure, explain your concern then ask:
- "The reviewer suggested X, but [concern]. What should we do?"
- Options: "Implement it" / "Decline with rationale" / "Edit my draft reply first"

Use the host's ask-user question tool for this decision when available. Do not render the options as plain chat bullets unless the runtime has no ask-user tool.

If `AskUserQuestion` is available, use it immediately for the three-way choice. Good shape:
- header: `Thread action`
- question: brief concern + "How should we handle this thread?"
- options:
  - `Implement it`
  - `Decline with rationale`
  - `Edit draft reply first`

After the tool call, send only a short status line such as "The question is up — waiting on your call."

Bad:
```text
Which path?
1. Implement it
2. Decline with rationale
3. Edit draft reply first
```

Good: the three options live inside `AskUserQuestion`, and chat only says the question is up.

### 4c-decline. Decline Path (when the reviewer is wrong)

Use this when the team chose "Decline with rationale". No fix, no resolve — the reviewer decides whether to close the thread after seeing your reasoning.

Draft reply format:

```
> [reviewer's latest comment]

Draft reply:
[1-3 sentence rationale — why you're not changing the code. Cite existing code/tests/docs if relevant.]

Leaving thread open for your call.

Why (internal): [brief reasoning shown to the user]
```

Options: "Post decline reply" / "Edit rationale first" / "Actually implement it instead"

Use the host's ask-user question tool for this gate when available. Fall back to plain chat options only if the runtime does not expose one.

After posting: **mark TODO done, skip 4c/4d/4e, move to next thread.** Declined threads stay open — resolving them would signal fake agreement.

### 4c. Draft Reply & Get Approval

**After committing the fix**, find the commit that touched the flagged line so the reply can cite it. Use a line-scoped lookup — `git log -- <path>` returns the latest commit touching the *file*, which is often not the commit that touched the flagged *line*:

```bash
# <line> is .line from the inline comments API
FIX_SHA=$(git blame -L <line>,<line> --porcelain <path> | awk 'NR==1 {print substr($1,1,7); exit}')
git log -p -n 1 "$FIX_SHA" -- <path> | head -40
```

For a range, use `-L <start>,<end>` and pick the SHA of the most relevant hunk. Use the SHA and a one-line summary of the actual diff in the reply — not a restatement of the comment.

Show the comment and your draft reply:

```
> [original comment text]

Draft reply:
Fixed in <SHA>: <one-line diff summary — what changed on this specific line/hunk>.
[optional: 1 sentence of rationale if non-obvious]

Why: [brief reasoning]

After posting: resolve this review thread?
```

**Never post identical bodies across threads.** If the same boilerplate ("done", "fixed", "good catch, updated") would fit two threads, you are being lazy — each thread must reference its own commit SHA and its own diff. If a thread genuinely has nothing unique to say, drop the reply entirely and just resolve (or skip both).

Before posting, diff your draft against every reply already posted in this run. On collision: rewrite with the per-thread specifics (file, line, hunk, SHA) or drop it.

Options: "Post reply and resolve" / "Post reply only" / "Edit reply first"

Use the host's ask-user question tool for this approval gate when available. Fall back to plain chat options only if the runtime does not expose one.

If `AskUserQuestion` is available, use it immediately for the approval choice. Good shape:
- header: `Reply action`
- question: "What should we do with this drafted reply?"
- options:
  - `Post reply and resolve`
  - `Post reply only`
  - `Edit reply first`

After the tool call, send only a short status line such as "The question is up — waiting on your call."

Bad:
```text
What would you like to do?
1. Post reply and resolve
2. Post reply only
3. Edit reply first
```

Good: the three options live inside `AskUserQuestion`, and chat only says the question is up.

### 4d. Post Reply (after approval only)

```bash
# Reply to inline review comment
gh api repos/$REPO/pulls/$PR_NUM/comments/$COMMENT_ID/replies \
  -f body="<reply>"

# Respond to a general PR comment or review-body summary
gh pr comment "$PR_URL" --body "<reply>"
```

Top-level PR conversation comments and review submissions are not resolvable
inline threads. After approval, post an attributed top-level response and skip
Step 4e. Never call `resolveReviewThread` for these feedback items.

### 4e. Resolve Thread (only if user chose "Post reply and resolve")

Skip this step entirely if the user picked **"Post reply only"** in 4c. Run it only when the user explicitly approved both reply **and** resolution.

Resolve via GraphQL — find the review thread containing this comment, then resolve it:

```bash
OWNER=$(echo "$REPO" | cut -d/ -f1)
NAME=$(echo "$REPO" | cut -d/ -f2)

THREADS_JSON=$(gh api graphql -f query='
query($owner:String!,$name:String!,$pr:Int!) {
  repository(owner:$owner,name:$name) {
    pullRequest(number:$pr) {
      reviewThreads(first:100) {
        nodes { id isResolved comments(first:50) { nodes { databaseId } } }
      }
    }
  }
}' -f owner="$OWNER" -f name="$NAME" -f pr="$PR_NUM")

THREAD_ID=$(echo "$THREADS_JSON" | jq -r --argjson cid "$COMMENT_ID" '
  .data.repository.pullRequest.reviewThreads.nodes[]
  | select(.isResolved == false)
  | select([.comments.nodes[].databaseId] | contains([$cid]))
  | .id
' | head -1)

if [ -n "$THREAD_ID" ]; then
  gh api graphql -f query='mutation($id:ID!){ resolveReviewThread(input:{threadId:$id}) { thread { isResolved } } }' -f id="$THREAD_ID"
fi
```

If `THREAD_ID` is empty: tell user the reply was posted and they can resolve manually in the PR UI.

Mark TODO complete, move to next comment.

## Post-fix handoff

After address-mode work is committed and pushed, re-resolve the PR URL, branch,
and exact head SHA. Emit the fix summary, then hand the updated PR to
`vs-baby-sit` unless the user explicitly says not to watch. Start it as a
visibly separate babysitting phase and pass the resolved repository, PR number,
head SHA, and external-write policy already established in this workflow.

Fix-pr does not duplicate that skill's CI or review loop. Once composed,
`vs-baby-sit` owns new check failures, newly posted feedback, state-change
waiting, and the merge-ready or attention handoff. Return the babysitter's
terminal result as the workflow result. A pending check is therefore a handoff
condition, not a reason for fix-pr to invent another polling loop.

The handoff is a real ownership boundary: after it starts, new feedback belongs
only to `vs-baby-sit`, even when the next event looks like another fix-pr cycle.
Keep the user-facing phase named `baby-sit`; do not present later work as a new
fix-pr run. Do not ask the user to invoke either skill again. Thread-write
approval pauses and resumes the composed babysitter according to its policy.

## Critical Rules

1. **Never post or resolve without explicit approval** — show draft first, wait for confirmation
2. **Keep inline feedback on-thread** — use the replies API for inline comments
3. **Use top-level comments only for non-inline feedback** — general PR comments and review-body summaries have no resolvable inline thread
4. **Default: reply + resolve** for inline threads after user approves (unless they opt out)
5. **Cite the fix commit** — every reply to a fixed comment must name the SHA (`git log -n 1 --format=%h -- <path>`) and summarize what that commit actually changed on the flagged line
6. **No duplicate bodies across threads** — if the same text fits two threads, rewrite with thread-specific detail (file, line, diff) or drop the reply and just resolve
7. **Declined threads stay open** — when you disagree with a reviewer, reply with rationale but do NOT resolve. Resolution is the reviewer's call once they've seen the decline. Self-resolving a declined thread signals fake agreement.
8. **Act on the reviewer's latest comment per thread** — threads have back-and-forth; the last comment is the active ask. Replying to the original comment when there's been follow-up discussion is a correctness bug.

## Summary

| Scenario | Response |
|----------|----------|
| No comments, CI green | "No PR comments to address; required CI is green." |
| CI fixed, no comments | "CI fixed; no PR comments needed changes." |
| All addressed | "All done: required CI is green and X comments were addressed." |
| Some skipped or blocked | Report fixed CI/comments plus one `Your action` item per unresolved decision or external blocker |

## Verification

Blocked until all items pass — do not report "all addressed" without evidence for each.

- [ ] Every comment evaluated (accepted, rejected with reason, or deferred)
- [ ] Every required failing check diagnosed from logs
- [ ] Every owned CI failure fixed or rerun and rechecked on exact HEAD
- [ ] Fixes committed for all accepted feedback
- [ ] Replies posted on-thread for every addressed comment (user approved each)
- [ ] Review threads resolved (user approved each resolution)
- [ ] Required CI and automated reviewer checks are terminal and green after fixes
- [ ] In address mode, `vs-baby-sit` started after the updated PR was re-resolved unless the user explicitly opted out

Before the final handoff, apply
[Phase Boundaries](../vs-internal-shared/references/phase-boundaries.md). Keep
`Next` below as the semantic route; report a session action only when required
by that contract.

## Output style

Apply the [shared output style](../vs-internal-shared/references/output-style.md)
to every user-facing message.

## Workflow

Direct: emit **Next** only. Composed: return to caller.

**Prev:** `/vs-ship-it` | PR feedback
**Next:** `/vs-baby-sit`
**Relevant:** none
