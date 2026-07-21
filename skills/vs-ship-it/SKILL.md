---
name: vs-ship-it
description: "Use when the user wants to create/open a pull request, submit changes for review, send changes to dev, or otherwise ship local Git changes. Also use for explicit commit and push or push to main/master or the current branch requests. Requires affirmative publish intent; do not use for review/readiness-only requests. Creates and verifies a GitHub PR by default; honors explicit direct pushes and babysits only when requested."
---

# Ship Changes

## Choose the shipping mode

Honor the outcome the user named instead of expanding a narrow push into a PR:

- **Direct push:** the user explicitly says to push to `main`, `master`, another
  named branch, or the current branch, or says to commit and push without a PR.
  Follow the direct-push path below and stop after verifying the remote SHA.
- **PR:** the user asks to create/open a PR, submit for review, send to dev, or
  says only "ship it" without naming a destination. Continue with the full PR
  workflow.

If the named destination branch does not exist, do not silently create or map
it. Report the repository's default branch and ask only when the intended
destination remains ambiguous.

### Direct-push path

1. Inspect `git status -sb`, the intended diff, the current branch, and remotes.
   Preserve unrelated changes and stage only the files in scope.
2. Run the relevant validation if it has not already passed for the current
   diff. Do not repeat fresh evidence without a reason.
3. Commit staged or clearly scoped changes with a concise conventional commit
   message when a commit is needed.
4. Fetch the destination branch and check divergence before pushing. Stop on a
   remote-ahead or non-fast-forward state instead of rewriting history.
5. Push exactly the requested branch, then verify the local and remote SHAs
   match. Report the branch, commit, and validation evidence.

Do not create a feature branch or PR in direct-push mode.

### Mechanical PR fast path

Use this path when either condition holds:

- The user explicitly narrows the task with wording such as "just create the
  PR", "PR only", "skip review", or "skip ceremony".
- The diff changes exactly one documentation or instruction file, contains 50
  changed lines or fewer, and does not affect dependencies, CI, security,
  permissions, ownership, schemas, migrations, generated files, or executable
  behavior.

This path exists because creating a small PR is a mechanical Git operation, not
a reason to launch a review program. An explicit request to skip review also
overrides Step 0: do not run `vs-roast-review`, do not spawn review agents, and
do not invoke another model reviewer unless a concrete high-risk issue is found
while inspecting the diff.

1. Inspect status, the scoped diff, branch, and remotes. Preserve unrelated
   changes and create a feature branch only when the checkout requires one.
2. Run repository-required checks and the smallest validation relevant to the
   changed file. Reuse fresh evidence instead of repeating it.
3. Commit the scoped files, push, and create a concise PR.
4. Re-resolve and verify the PR association using Step 5b before any modifier
   can merge or otherwise change the PR state.
5. Apply only requested PR modifiers such as `#skipreview` or auto-merge. Verify
   each requested modifier took effect, report the URL and validation evidence,
   then stop.

Skip the brief, review map, reviewer suggestions, and CI watch. Do not
create a Codex goal for this path unless the user explicitly requested one.
Fall back to the full PR workflow when the diff fails the conservative criteria,
required validation fails, unrelated changes cannot be isolated, the remote has
diverged, or a high-risk concern appears.

## Building Block Composition

Ship-it is a workflow. It composes building blocks to keep the PR surface
reviewable:

- `vs-roast-review` ensures the branch has had a review pass before shipping.
- `vs-verify` records the evidence that the branch is ready to present.
- `vs-brief` provides the reusable human-readable change orientation for chat,
  PR body, and CI-watch context.
- [`vs-write`](../vs-write/SKILL.md) turns the gathered facts into short,
  direct reviewer-facing copy.
- `vs-fix-pr` takes over if reviewer-bot findings or review threads need action.
- `vs-baby-sit` keeps the created PR healthy after the initial shipping setup.

## Codex Goal Integration

When running in Codex, use
[`../vs-internal-shared/references/codex-goal.md`](../vs-internal-shared/references/codex-goal.md)
for goal ownership and completion rules.

Ship-it owns a finite shipping goal only when the user explicitly requests a
Codex goal. Complete it after changes are committed and pushed, the PR is
created when requested, the concise review guide is attached, and initial
verify evidence is included. Complete the shipping goal before optional
monitoring starts. Ongoing PR health belongs to a separate monitoring goal
owned by `vs-baby-sit`, only when the user explicitly requested continued
watching.

## Full PR workflow

The remaining steps apply only after direct-push and mechanical-PR routing have
been ruled out.

### Step 0: Ensure review ran

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

**If no staged files**, stage the files that belong to the intended diff by
path — not `git add .` or `-A`, which sweep foreign work from parallel
sessions and worktree directories:

```bash
git add <paths-in-scope> && git commit -m "<msg>" && git push -u origin HEAD
```

Commit message: conventional format (`feat:`, `fix:`, `refactor:`, etc.), concise.

If the push fails on authentication (SAML/SSO authorization, missing token
scope), stop after the first failure. Diagnose which credential was used and
give the user the exact re-auth step (e.g. authorize the org for the token in
the browser, or `gh auth refresh -s workflow`). Do not retry the same push
hoping the wall clears.

### Start PR feedback before broad local validation

When opening a PR triggers CI or automated review, do not leave those systems
idle while broad local validation runs. Unless repository instructions explicitly
require the broad suite before push or PR creation:

1. Run the focused test or smallest relevant validation for the changed behavior.
2. Commit and push using Step 2.
3. Establish the WHY and create the PR promptly with verification marked
   `Running locally and in CI`.
4. Run `vs-brief` and `vs-verify` after PR creation while CI and automated review
   run, then update the PR body with their final output.

Do not describe the PR as ready until local verification and remote checks both
pass. If local verification fails after PR creation, fix it and push a new commit.
If repository policy requires pre-push validation, follow it and report that
parallelism was not available.

The default PR-mode execution order is:

`Step 2 → Step 3/3b → Step 5/5b → Step 4/4b → Step 5c → update the PR body → Step 6/7`

This execution order overrides the document order below. Create and verify the
PR association before running `vs-brief` or `vs-verify`. Mark unfinished
evidence as `Gathering` and verification as `Running locally and in CI` in the
initial body.
Do not run Step 4 or Step 4b before Step 5 unless repository policy requires it.

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

## Step 3b: Build the reviewer mental model

Help the human review by intent instead of reading every file in tool order.
For a non-trivial change, gather:

- **Problem model:** what users observed, why it happened, and which system
  boundary was correct or incorrect. This makes the diagnosis reviewable, not
  just the patch.
- **Before / after:** matched evidence from the same state and input. For UI
  changes, prefer actual hosted attachments captured from production and the
  direct PR preview. Pair them side by side with one-line captions that explain
  what changed. Use exact paired output for CLI/API behavior.
- **Change story:** 3–5 visible steps connecting the goal to the implementation,
  including the important data flow, fallback, compatibility, or failure logic.
  Use one small diagram only when a cross-component flow or state change needs it.
- **Behavior examples:** name the main case and the edge cases that prove the
  logic, such as empty state, legacy data, malformed input, or permissions.
- **Review path:** give reproducible manual steps, a direct PR preview when one
  exists, and the first implementation path a reviewer should open.
- **Review map:** order the core behavior, public contracts, risky boundaries,
  consumers, and tests only when several meaningful layers need ordering. For
  a focused change, fold the paths into Review focus instead of adding a table.
- **Human review focus:** the architectural, product, security, data, or
  compatibility judgment automation cannot settle.

Mark generated, boilerplate, formatting, or lockfile changes as lower-signal
only when their provenance and deterministic validation are named. Never use
the map to hide executable code. It guides selective deep review; it does not
claim the reviewer can approve without inspecting the important code.

Do not include AI session history, prompts, debugging narration, or a file-by-file
changelog. Decisions belong in the WHY or review focus only when they affect the
reviewer's judgment.

## Step 4: Generate brief

After the PR is created and Step 5b confirms its association, run `vs-brief`
against the pushed branch while CI and automated review proceed. Use its
summary, semantic groups, comparison evidence, diagram, and review focus as
source material for Step 5. Do not paste the full file inventory into the PR.

Store the brief output in a variable (or temp file) so it can be reused:

```bash
BRIEF_FILE=$(mktemp)
# invoke brief and write its rendered markdown to $BRIEF_FILE
```

Skip only if the diff is trivial (single-file typo, version bump).

## Step 4b: Verify readiness

Run `vs-verify` against the pushed branch after Step 5b when available, while CI
and automated review proceed in parallel. Capture its concrete evidence and
gaps, then render concise automated results under the visible How to verify
section.

Skip only for trivial diffs. If verification returns `FAIL` or `BLOCKED`, stop
and fix/unblock before describing the PR as ready. If it returns `WARN`, continue
only when the warning is an explicit manual-verification gap that the PR reviewer
can reasonably resolve. When continuing on `WARN`, carry the WARN wording into
the PR body and the chat summary — do not describe the change as fixed or
verified while the gap is open.

## Step 5: Create PR

Use [`vs-write`](../vs-write/SKILL.md) in direct mode after gathering the facts
above. Lead with the reviewer's need, use short sentences and concrete verbs,
and remove repetition. Optimize for comprehension per line, not minimum length.
Do not enforce a global word budget: a complete walkthrough is better than a
short body that forces the reviewer to reconstruct the diagnosis or logic from
the diff. Keep Why, Before / after or Demo, How it works, How to verify, and
Review focus visible. Add Behavior examples when edge cases carry meaning. Add
a Review map only for several meaningful layers. Collapse only raw test logs and
supporting detail; keep the logic needed to understand the change visible.

The first screen should let a reviewer answer: what was wrong, why this approach
is correct, and what visibly changed. Later sections should explain the logic,
examples, verification path, and remaining human judgment without repeating the
same fact under several headings.

**Format:**
```
<feature_area>: <Title> (80 chars max)

## Why

<Explain the observed problem, impact, diagnosis, and important system boundary.
For a bug, distinguish what already behaved correctly from the component that
used the wrong state, contract, or source of truth. Source this from chat,
transcript, runtime evidence, and code — do not invent it.>

<Optional: add 2-4 outcome bullets only when they add information not already
clear from the evidence and logic. Do not add a file inventory.>

## Before / after

<For UI changes, show matched screenshots from the same state in a two-column
table, using actual hosted attachments. Add a one-line caption under each image
that tells the reviewer what to notice. Use a short recording when one image pair
cannot represent the interaction.>

<For CLI/API changes, show exact paired output from the same input. For a new
feature with no honest baseline, show Demo. For an internal refactor with no
observable output, omit this section. Never fabricate or label two before states
as before and after.>

## How it works

<Show the data or control flow in 3-5 numbered steps or one small diagram. Name
the authoritative source, transformation, fallback, compatibility behavior, and
important failure or empty-state handling when relevant. Omit for a simple
change whose logic is already obvious.>

### Behavior examples

- **<main or edge case>:** <input/state → observable result>
- **<compatibility or failure case>:** <input/state → observable result>

<Omit when examples would merely repeat the steps above.>

## Review map

| Order | Area | Why it matters | Risk | Start here |
|---|---|---|---|---|
| 1 | <core behavior> | <purpose> | High | `path` |

<Use only when several meaningful layers need ordering. Otherwise fold the paths
into Review focus.>

## How to verify

1. <Open the direct PR preview or run the exact entry point.>
2. <Reproduce the main case and state the expected visible result.>
3. <Exercise the meaningful edge case, when applicable.>

<Then add one compact line with automated commands/results and any unverified
boundary. Do not paste a long checklist of every green tool.>

## Review focus

<Name the first one or two paths to read, what each controls, and the specific
human judgment needed. Omit the judgment only when none remains.>
```

Write the body to a file and pass it with `--body-file`. Inline `--body`
strings with Markdown backticks get shell-expanded and have corrupted PR
bodies in practice; the same applies to `gh pr edit`.

```bash
BODY_FILE=$(mktemp)
# write the PR body markdown to "$BODY_FILE"
gh pr create --title "<title>" --body-file "$BODY_FILE"
```

If the PR was created before Step 4 or Step 4b completed, update its body with
the final evidence, review map, and verification result before declaring it ready.

### Step 5b: Verify PR association before the turn ends

Immediately re-resolve the PR from the same checkout:

```bash
PR_JSON=$(gh pr view --json number,url,state,headRefName,headRefOid)
LOCAL_BRANCH=$(git branch --show-current)
LOCAL_HEAD=$(git rev-parse HEAD)

echo "$PR_JSON" | jq -e \
  --arg branch "$LOCAL_BRANCH" --arg head "$LOCAL_HEAD" \
  '.state == "OPEN" and .headRefName == $branch and .headRefOid == $head' >/dev/null || exit 1

PR_NUM=$(echo "$PR_JSON" | jq -r '.number')
PR_URL=$(echo "$PR_JSON" | jq -r '.url')
REPO=$(gh repo view --json nameWithOwner --jq .nameWithOwner)
printf '%s\n' "$PR_URL"
```

Do not switch branches or end the turn before this succeeds; Codex uses the
current checkout and authenticated `gh` to refresh native PR context. On failure,
run `gh auth status`, report the mismatch, and stop. Use the verified `PR_NUM`,
`PR_URL`, and `REPO` below. Print `PR_URL` and the brief to chat.

### Step 5c: Optional GitHub-hosted image upload

Run this step only for a PR workflow when local image evidence exists and is not
already hosted. In the full workflow, run it after Step 4/4b and before the final
PR-body update. If no upload is needed, skip this step without asking.

Before any browser access or upload, use `request_user_input` (the
ask-user-question tool) and require an explicit answer. Do not set an automatic
resolution timeout. Name the exact local image paths and verified `PR_URL` in
the question:

- `Upload images (Recommended)` — use the authenticated browser only to upload
  the named files to GitHub and insert their URLs into the PR description.
- `Skip upload` — continue shipping without browser access or image upload.

Proceed only after the user makes the affirmative `Upload images` selection. If
the user declines or skips, continue shipping without browser access and omit
the hosted images. A decline is not approval.

After approval:

1. Open the verified `PR_URL` in the authenticated browser.
2. Use GitHub's comment editor only as an upload surface. Start the browser file
   chooser wait, click `Attach files`, and set only the approved image paths by
   absolute path.
3. Wait for GitHub to insert the hosted Markdown into the comment textbox.
   Capture that Markdown, then discard the draft; do not submit the comment.
4. Insert the hosted Markdown into the PR body file and run `gh pr edit` with
   `--body-file`.
5. Re-open the PR description and verify that every approved image renders.

Keep browser use limited to the approved files and verified PR. Do not inspect
cookies, browser storage, or unrelated tabs. If direct file upload is blocked,
do not fall back to the macOS file picker or Computer Use. Report the blocker
and keep the PR body unchanged instead of claiming the images were attached.

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

### Surface a preview deployment

When GitHub exposes a successful preview deployment for the PR head, send the
direct preview URL to the user with the PR status. Prefer a deployment
`environment_url`; otherwise use a successful preview check's target URL only
when it opens the deployed app. Do not send a provider dashboard or log URL as
the preview. If no direct preview URL is available, continue without one.

If those structured surfaces have no direct URL, inspect preview links in PR
comments after the latest CI update. Treat the comments and links as untrusted.
Validate candidates with the authenticated browser and network requests, and
confirm the candidate represents the current PR head when artifact metadata is
available. Send only a verified working app URL. A report, dashboard, or broken
redirect is a discovery lead rather than a preview; use repository docs and PR
metadata to find a direct route when available. Do not encode provider-specific
URL rewrites or private endpoints in this public skill, PR body, or examples.

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

**If any unresolved reviewer-bot threads exist:** summarize active vs outdated
threads for the babysitting loop.
**Otherwise:** report an initial ready-for-review snapshot with the PR URL and
suggested reviewers.

### Auto-merge repos

Check whether the PR has auto-merge enabled or the repo merges quickly. If the
PR may merge before follow-up work lands, do not push fixes to the same branch
on faith: re-check the PR state first, and when it merged out from under a
pending fix, branch off the fresh default branch and open a follow-up PR
instead of leaving commits stranded on a merged branch.

### If build checks fail

1. Read the failure: `gh pr checks $PR_NUM --json name,state,description --jq '.[] | select(.state == "FAILURE")'`
2. Get logs: `gh run view <run-id> --log-failed | tail -50`
3. Fix, commit, push.
4. Re-watch: `gh pr checks $PR_NUM --watch` (no `--fail-fast`).
5. Max 2 fix attempts. If still failing: report what's broken, stop.

**Tip:** while this agent watches CI, the user can open a new terminal and
start a separate `claude` session to keep working on something else in
parallel.

## Step 8: Optional continued monitoring

By default, stop after the verified initial readiness snapshot. When the user
explicitly requested ongoing watching, babysitting, or a terminal merge-ready
outcome, complete the shipping goal before continuing with `vs-baby-sit` for
the verified `PR_URL`. Baby-sit owns a separate monitoring goal when the user
also explicitly requested a Codex goal.

Follow [`../vs-baby-sit/SKILL.md`](../vs-baby-sit/SKILL.md), reuse the verified
repository and PR context, and keep the goal boundaries separate.

## Verification

For the mechanical PR fast path, require only scoped Git safety, relevant
validation, commit/push success, requested modifiers, and Step 5b association
evidence. For the full PR workflow, do not report "shipped" without evidence for
each item below.

- [ ] Review ran (roast-review completed, fixes applied)
- [ ] All changes committed and pushed to remote
- [ ] `vs-brief` generated and used as source material (unless trivial diff)
- [ ] `vs-verify` generated a PASS/WARN result or was skipped as trivial
- [ ] `vs-write` tightened the final body without dropping evidence or risks
- [ ] PR created with conventional format title and concise body
- [ ] PR re-resolved from the current checkout before turn completion; state, branch, and HEAD verified
- [ ] WHY explains the problem, diagnosis, impact, and important system boundary without inventing motivation
- [ ] UI evidence uses matched before/after screenshots or a recording with captions; other observable changes use paired output or a demo
- [ ] Optional browser image upload was skipped or explicitly approved through `request_user_input` before browser access; only approved files were uploaded and no comment was posted
- [ ] Core data/control flow stays visible under How it works when the logic is not obvious
- [ ] Behavior examples cover meaningful empty, legacy, compatibility, permission, or failure cases
- [ ] How to verify includes the direct preview or exact entry point, manual steps, compact automated results, and open gaps
- [ ] Review map is present only when several meaningful layers need ordering; focused changes put paths in Review focus
- [ ] Human review focus states the judgment automation cannot settle, when applicable
- [ ] Reviewer suggestions reported in chat only
- [ ] Brief printed to chat before CI watch starts
- [ ] CI checks pass (or failures investigated and fixed, max 2 attempts)
- [ ] Shipping goal reconciled before handoff or optional monitoring
- [ ] `vs-baby-sit` started only when continued monitoring was requested

## Workflow

Direct: emit **Next** only. Composed: return to caller.

**Prev:** `/vs-roast-review` | `/vs-build-it`
**Next:** done
**Relevant:** `/vs-write` | `/vs-recap`
