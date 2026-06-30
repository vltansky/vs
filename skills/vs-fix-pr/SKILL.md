---
name: vs-fix-pr
description: "Use when developers left PR comments or the user says fix PR feedback, address comments, or resolve review threads."
disable-model-invocation: true
---

# Fix PR

## Building Block Composition

Fix-pr is a workflow for reviewer feedback. It composes:

- `vs-decide-for-me` for tactical uncertainty around implementation details.
- `vs-verify` after applying fixes so replies are backed by evidence.

When the current checkout is not already on the PR branch, fix-pr owns the
branch/worktree setup directly: inspect the PR, preserve unrelated dirty state,
then switch to or create the appropriate isolated checkout before editing.

## Codex Goal Integration

When running in Codex, use
[`../vs-internal-shared/references/codex-goal.md`](../vs-internal-shared/references/codex-goal.md)
for goal ownership and completion rules.

Fix-pr owns the reviewer-feedback goal after Step 0 resolves the target PR and
Step 2 identifies unresolved feedback. The objective should name the PR and the
unresolved thread/comment scope. Complete the goal only after every accepted
fix is committed and pushed, approved replies are posted, approved threads are
resolved, and the build/reviewer state has been rechecked. Declined or
human-decision threads keep the goal active or blocked according to Codex goal
policy.

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
PR_NUM=$(gh pr view <number-or-url> --json number --jq .number)
PR_BRANCH=$(gh pr view <number-or-url> --json headRefName --jq .headRefName)
```

If no — use the current branch's PR:
```bash
PR_NUM=$(gh pr view --json number --jq .number)
PR_BRANCH=$(gh pr view --json headRefName --jq .headRefName)
```

If `gh pr view` fails (no PR found): tell user "No PR found" and stop.

```bash
REPO=$(gh repo view --json nameWithOwner --jq .nameWithOwner)
```

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

## Step 1: Check Build Status

```bash
SHA=$(gh pr view $PR_NUM --json commits --jq '.commits[-1].oid')
BUILD_STATE=$(gh api repos/$REPO/commits/$SHA/status --jq '.state')
echo "Build: $BUILD_STATE"
```

Also check for CI status via checks API:
```bash
gh pr checks $PR_NUM
```

| Build Status | Action |
|--------------|--------|
| **success** | Proceed to Step 2 |
| **failure** | Analyze failure (Step 1a), then ask user |
| **pending** | Tell user: "Build still running. Proceed with comments or wait?" |
| **No status** | Proceed to Step 2 |

### Async reviewer checks

Some checks are automated reviewers that post comments asynchronously (e.g., `Repo Review (Codex)`, `claude-review`, Copilot PR reviewer). They may show as `queued` / `pending` / `in_progress` even after the build is green, and their feedback won't appear in Step 2 until they finish.

Detect them in the checks output — names containing `review` (e.g., `Repo Review (Codex)`, `PR Review`, `claude-review`), `codex`, `copilot`, or `claude`.

**If an outstanding check name contains `review` → wait for it. Don't ask.** These are reviewer bots whose comments are the whole point of Step 2.

Tell the user once: "`<check name>` is still running — waiting for it, will fetch comments when it finishes."

Then wait using whichever primitive your runtime supports:

- **Claude Code:** spawn `gh pr checks $PR_NUM --watch` with `run_in_background: true`; the harness wakes you when it exits. Do not run `--watch` in the foreground — the Bash tool caps foreground commands at 600s.
- **Codex CLI:** delegate the watch to the `awaiter` builtin sub-agent (already configured with `background_terminal_max_timeout = 3_600_000`), or spawn via unified-exec background terminal after raising `background_terminal_max_timeout` in `~/.codex/config.toml`. Do not busy-poll with `--json name,state` between other work.

When the check finishes, re-fetch comments and proceed to Step 2.

### If Build Failed

#### Step 1a: Analyze the Failure

```bash
# Check for CI bot comments with build output
gh pr view $PR_NUM --json comments --jq '.comments[-1].body' | head -50
```

1. **Identify the error** — parse for test failures, type errors, lint errors, build errors.
2. **Check if caused by this PR:**
   ```bash
   gh pr view $PR_NUM --json files --jq '.files[].path'
   ```

| Error Location | Action |
|----------------|--------|
| File in PR diff | Fix it — it's your change |
| File NOT in PR diff | Likely flaky/external — explain to user |

**If caused by PR:** Read the failing file, fix, commit: `fix: [description]`

**If external:** Present options to user:
- Post explanation as PR comment
- Re-run the build (if CI supports re-trigger comments)
- Skip and proceed with PR comments

## Step 2: Fetch Comments

The goal is **unresolved** feedback. Don't filter by `commit_id == HEAD` — bots re-attach open threads to every new commit, and a filter by HEAD misses legitimately active threads that were opened on an earlier commit and never resolved. Use GraphQL `reviewThreads` with `isResolved: false` as the primary filter, and carry `isOutdated` along so stale-against-HEAD threads can be flagged (not dropped).

```bash
OWNER=$(echo "$REPO" | cut -d/ -f1)
NAME=$(echo "$REPO" | cut -d/ -f2)

# Unresolved inline review threads (with isOutdated carried along)
gh api graphql -F owner="$OWNER" -F name="$NAME" -F pr="$PR_NUM" -f query='
query($owner:String!,$name:String!,$pr:Int!) {
  repository(owner:$owner,name:$name) {
    pullRequest(number:$pr) {
      reviewThreads(first:100) {
        nodes {
          id isResolved isOutdated path line
          comments(first:50) { nodes { databaseId body author { login } } }
        }
      }
    }
  }
}' | jq '[.data.repository.pullRequest.reviewThreads.nodes[] | select(.isResolved == false)]'

# General (issue-level) PR comments
gh pr view $PR_NUM --json comments --jq '.comments[] | {id, body, author: .author.login}'
```

Run the block above as-is — don't improvise on the jq filter. `$PR_NUM` and `$REPO` are the only substitutable vars.

For each unresolved thread, tag it:
- **Active** — `isOutdated == false`: still anchored to current HEAD, address normally.
- **Outdated** — `isOutdated == true`: the code the thread was pinned to has changed. Usually already addressed by the rewrite.

**Outdated bulk-resolve** — don't walk each outdated thread through Step 4 individually. Offer one prompt: "N outdated threads — resolve all as addressed-by-rewrite?" If the user keeps one open, label it `[OUTDATED]` in the finding list and re-evaluate whether the concern migrated to a new line.

Exit gate — only report "No PR comments to address" when **both** the unresolved-thread list and the issue-level comment list are empty. Issue-level reviewer summaries are valid feedback even when no inline threads remain.

## Step 3: Create TODO List

One TODO per **thread**, not per comment. Long threads have back-and-forth — act on the reviewer's **latest** comment (`.comments.nodes[-1]` from the GraphQL fetch), not the original one. Earlier comments in a thread are usually superseded by follow-ups.

Include file:line for inline threads.

## Step 4: For Each Thread

### 4a. Evaluate

Is the reviewer's latest ask valid feedback?
- Does it improve correctness or quality?
- Is it based on accurate understanding of the code?

### 4b. Decide Action

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

# Reply to general PR comment
gh pr comment $PR_NUM --body "<reply>" --reply-to $COMMENT_ID
```

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

## Critical Rules

1. **Never post or resolve without explicit approval** — show draft first, wait for confirmation
2. **Always reply to the specific comment** — use replies API, not a new top-level comment
3. **Never post a general PR comment** when addressing inline review comments (stay on-thread)
4. **Default: reply + resolve** for inline threads after user approves (unless they opt out)
5. **Cite the fix commit** — every reply to a fixed comment must name the SHA (`git log -n 1 --format=%h -- <path>`) and summarize what that commit actually changed on the flagged line
6. **No duplicate bodies across threads** — if the same text fits two threads, rewrite with thread-specific detail (file, line, diff) or drop the reply and just resolve
7. **Declined threads stay open** — when you disagree with a reviewer, reply with rationale but do NOT resolve. Resolution is the reviewer's call once they've seen the decline. Self-resolving a declined thread signals fake agreement.
8. **Act on the reviewer's latest comment per thread** — threads have back-and-forth; the last comment is the active ask. Replying to the original comment when there's been follow-up discussion is a correctness bug.

## Summary

| Scenario | Response |
|----------|----------|
| No comments | "No PR comments to address." |
| All addressed | "All done! Addressed X comments." |
| Some skipped | "Addressed X comments, skipped Y. Let me know if you want to revisit." |

## Verification

Blocked until all items pass — do not report "all addressed" without evidence for each.

- [ ] Every comment evaluated (accepted, rejected with reason, or deferred)
- [ ] Fixes committed for all accepted feedback
- [ ] Replies posted on-thread for every addressed comment (user approved each)
- [ ] Review threads resolved (user approved each resolution)
- [ ] Build still passes after fixes

## Workflow

**Prev:** `/vs-ship-it` (PR created, reviewers left comments)
**Next:** `/vs-ship-it` (re-push after fixes) | `/vs-roast-review` (self-review before re-push) | done
