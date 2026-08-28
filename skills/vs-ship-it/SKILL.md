---
name: vs-ship-it
description: "Use vs-ship-it when the user asks to create or open a PR; says create PR, open PR, or ship it; asks to submit changes, commit and push, or push directly. This is the VS publishing workflow and takes precedence over generic publishers such as github:yeet unless the user names another publisher. Requires affirmative publish intent; excludes review/readiness-only requests. Creates and verifies PRs, then babysits them by default; honors explicit direct pushes and requests not to watch."
---

# Ship Changes — Publish and Follow Through

Create the PR quickly and independently. Ask the user only when a decision is
both necessary and impossible to infer safely. A missing optional input is a
reason to omit or mark a gap, not a reason to stop PR creation.

## Routing precedence

Treat phrases such as "create PR", "open PR", "ship it", "send this to review",
and "commit and push" as `vs-ship-it` requests. Prefer this workflow over a
generic publisher such as `github:yeet`; do not compose two publishers.

Use another publishing skill only when the user explicitly names it or this
skill is unavailable.

Compose `/vs-eval` only when the PR is a skill/eval contract. Skip it for
ordinary product PRs.

## Choose the outcome

- **Direct push:** when the user explicitly names `main`, `master`, the current
  branch, another destination branch, or asks to commit and push without a PR.
- **PR:** when the user asks to create/open a PR, submit for review, send to dev,
  or says bare `ship it` without naming a push destination.

If a named destination branch does not exist, report the repository default and
ask only when the intended destination remains ambiguous.

### Direct-push path

1. Inspect `git status -sb`, the scoped diff, current branch, and remotes.
   Preserve unrelated changes and stage only files in scope.
2. Reuse fresh validation. Run only repository-required or directly relevant
   checks that have not already passed.
3. Commit with a concise conventional message when needed.
4. Fetch the destination and stop on remote-ahead or non-fast-forward state.
5. Push exactly the requested branch and verify local and remote SHAs match.

Do not create a feature branch or PR in direct-push mode. Direct-push mode does
not start `vs-pr-walkthrough` or `vs-baby-sit`.

## PR workflow

The default PR path has five outcomes: prepare the PR description, prepare
available media, create plus verify a draft PR, start an exact-head walkthrough
for a large PR, and hand it to `vs-baby-sit`.

Code review is outside this workflow. Do not add brief generation, broad
verification, reviewer discovery, preview startup, or QA unless the user
explicitly requested that work.
Babysitting is the default after PR verification unless the user opts out.

### Step 1: Inspect and prepare the branch

Inspect once:

```bash
git branch --show-current
git status -sb
git diff HEAD --stat
git remote -v
```

Preserve unrelated changes. If on `main`, `master`, `prod`, or detached HEAD,
create a short `username/topic` feature branch. Stage only scoped paths, commit
with a concise conventional message, and push with `git push -u origin HEAD`.

Run only checks required by repository instructions before push. Reuse current
results; do not introduce `vs-before-after`, `vs-verify`, broad test suites, or another
user question as shipping ceremony. Record existing checks honestly in the PR.

If authentication fails, stop after the first failure, identify the credential
used, and give the exact re-authentication step. Do not retry unchanged auth.

### Step 2: Prepare the PR description

Write the description directly from the live conversation, scoped diff, runtime
evidence, and existing test results. Do not ask the user to write or approve PR
copy. If motivation cannot be established honestly, describe the observable
problem without inventing business impact; omit inapplicable optional detail.

The first screen answers what was wrong, why this repair is appropriate, and
what visibly changed. Use this structure:

```markdown
<feature_area>: <Title> (80 chars max)

## What Problem This Solves

<Observed problem, impact, diagnosis, and important system boundary.>

**Before** <same-state setup and what to notice>

<Hosted screenshot Markdown or hosted video URL on its own bare line.>

**After** <same-state setup and what changed>

<Matched hosted screenshot Markdown or bare video URL.>

## Why This Change Was Made

<Root cause, why this boundary owns the repair, and the important control/data
flow or trade-off. Use 3–5 steps only when the logic is not obvious.>

## User Impact

<Concrete user, developer, or operational outcome and intentionally unchanged
behavior.>

## Evidence

- **Before:** <observed or measured failure>
- **After:** <matched result>
- **Automated:** `<focused or required command>` — <result>
- **Still unverified:** <exact gap, only when one remains>

## Review focus

<The first one or two paths to read and any human judgment still needed. Omit
for a trivial change.>
```

For CLI/API behavior, replace visual proof with exact paired output from the
same input. For a new feature with no honest baseline, show a Demo. For internal
work with no observable output, omit Before/After. Never fabricate evidence,
include AI-session narration, or add a file-by-file changelog.

Write Markdown to a temporary body file and use `--body-file`; never pass
backtick-heavy Markdown through inline `--body` or `gh pr edit --body`.

### Step 3: Prepare screenshots and video

Before creating the PR, inspect the current session and known build/QA artifacts
for local media that directly proves the changed behavior.

- Use matched screenshots for static visual states.
- Use short matched recordings for motion, timing, scrolling, dragging,
  resizing, or multi-step interactions.
- Reuse valid existing proof. Do not rerun QA or start a browser/server solely
  to manufacture media during shipping.
- If no valid media exists, continue without asking the user to find it. State
  the exact visual-proof gap under Evidence.

Upload each available image or video directly to GitHub's user-attachments CDN.
This is the same hosting surface as drag-and-drop, inherits repository
visibility, and needs no browser, Computer Use, draft comment, or vision tool.

Resolve the numeric repository ID:

```bash
gh repo view --json databaseId --jq .databaseId
```

Upload each file using its real MIME type and a URL-encoded filename/MIME value:

```bash
curl -sS --fail-with-body \
  "https://uploads.github.com/user-attachments/assets?name=<url-encoded-filename>&content_type=<url-encoded-mime>&repository_id=<repository-id>" \
  -X POST \
  -H "Authorization: Bearer $(gh auth token)" \
  -H "Accept: application/json" \
  --data-binary @<absolute-file-path> | jq -er .url
```

Images use their actual type, such as `image/png`, `image/jpeg`, or `image/webp`.
Video uses `video/mp4` or `video/webm`. For broad playback, transcode Playwright
WebM when `ffmpeg` is available:

```bash
ffmpeg -i in.webm -c:v libx264 -pix_fmt yuv420p out.mp4
```

Embed images as `![concise caption](<returned-url>)`. Embed videos as the
returned URL on its own bare line; `![]()` does not render GitHub's video player.
Insert the URLs into the body file before `gh pr create` so the initial PR
description is complete.

Treat HTTP 422 as an unsupported media type and HTTP 404 as a bad repository ID
or missing push access. On upload failure, continue creating the PR, omit the
broken embed, and name the exact gap. Never commit proof assets to the product
branch or create a `.github/pr-assets` directory.

Vision may inspect, compare, or caption screenshots when already needed for the
PR evidence. It is not part of the upload transport.

### Step 4: Create and verify the draft PR

Create the PR from the prepared body file:

```bash
gh pr create --draft --title "<title>" --body-file "$BODY_FILE"
```

Immediately re-resolve it from the same checkout and verify open state, branch,
and exact head SHA:

```bash
PR_JSON=$(gh pr view --json number,url,title,state,isDraft,headRefName,headRefOid,changedFiles)
LOCAL_BRANCH=$(git branch --show-current)
LOCAL_HEAD=$(git rev-parse HEAD)

echo "$PR_JSON" | jq -e \
  --arg branch "$LOCAL_BRANCH" --arg head "$LOCAL_HEAD" \
  '.state == "OPEN" and .isDraft == true and .headRefName == $branch and .headRefOid == $head' >/dev/null || exit 1

PR_NUM=$(echo "$PR_JSON" | jq -r '.number')
PR_URL=$(echo "$PR_JSON" | jq -r '.url')
HEAD_SHA=$(echo "$PR_JSON" | jq -r '.headRefOid')
CHANGED_FILES=$(echo "$PR_JSON" | jq -r '.changedFiles')
printf '%s\n' "$PR_URL"
```

On association failure, run authenticated `gh auth status`, report the exact
mismatch, and stop. Do not switch branches before this succeeds.

Re-open the PR description read-only and verify every uploaded image renders and
every video exposes a player. If rendering fails, remove or correct only the
broken embed with `gh pr edit --body-file`; do not claim the proof is attached.

Apply only explicitly requested PR modifiers. Do not suggest reviewers, start a
preview, or run QA by default.

### Step 5: Start the walkthrough and babysitting

Use `changedFiles` from the verified PR instead of spawning a child merely to
rediscover the size gate:

- Fewer than 10 changed files: do not start a walkthrough child. Record
  `SKIPPED_SMALL_PR`; GitHub's native diff is the clearer review surface.
- 10 or more changed files: load and follow
  [`../vs-pr-walkthrough/SKILL.md`](../vs-pr-walkthrough/SKILL.md). Spawn one
  fresh-context child with the repository, `PR_URL`, exact `HEAD_SHA`, and that
  building block's return contract. The child owns only the walkthrough
  artifact; it must not mutate the PR or watch CI.

Confirm the walkthrough child is live. Hand the verified draft PR to `vs-baby-sit`
immediately without waiting for the artifact. The walkthrough and babysitter
are independent lanes, so this large-PR path may use the shared deep
allowance for exactly those two active children. Babysit still owns its single
watcher and the transition to ready for review; ship-it does not
duplicate that skill's CI or automated-review loop.
If the user explicitly says not to watch, collect the walkthrough once after
the creation handoff instead.

Collect a completed walkthrough at the next babysitting phase gate. Before
showing its `Saved` link, re-resolve the PR and require its current `headRefOid`
to equal the walkthrough's `Explains` SHA:

- Same head: surface the walkthrough in the handoff.
- Changed head: do not surface the stale artifact and do not regenerate after
  each repair push. At `reason: ready-for-review`, refresh it once on that exact
  head while the resumed watcher continues, then apply the same head check.
- Failed, incomplete, or stale again: continue babysitting and report the exact
  walkthrough gap. A review aid never blocks publishing, repair, or the
  `review-approval` stop.

The automatic path is bounded to one initial walkthrough and at most one final
refresh. Never prepare a walkthrough before the PR exists; its URL, exact head,
and authoritative GitHub diff are required inputs.

When the composed babysitter reaches `reason: review-approval`, return its
concise `Review needed: @<user-or-team>` handoff and end the workflow turn. Do
not resume watching because auto-merge is armed or because merge, deployment,
or production verification is planned afterward. Those phases require a new
user turn after the human review gate clears.

## Handoff

After PR verification, emit the creation handoff and start a visibly separate
babysitting phase unless the user explicitly says not to watch:

The first line says what shipped in plain language. Translate literal check,
review, or PR status into the user-visible meaning before naming the status.

```markdown
Draft PR created and verified: [#<N> — <title>](<PR_URL>)

- Head: `<short SHA>`
- State: draft — babysit keeps it draft until the exact head passes CI and
  automated review, then transitions it to ready for review.
- Media: <N screenshots, N videos attached | none available | exact upload gap>
- Walkthrough: <[open walkthrough](<URL>) — exact <short SHA> | generating for
  exact head | skipped — small PR | exact gap>
- Checks: <fresh results reused or repository-required checks run>
```

Do not describe CI, deployment, preview behavior, or production as verified when
only PR creation succeeded.

When fresh verification evidence already exists with `WARN`, carry the WARN
wording into the PR and handoff; do not describe the change as fixed or
verified. Existing `FAIL` or `BLOCKED` evidence is reported as an open gap, not
silently replaced by PR-creation success.

If the change altered skill or plugin content, add the exact re-install command
to the handoff; the installed behavior remains stale until reinstalled.

## Codex goals

Create a Codex goal only when the user explicitly requested one. Complete the
finite shipping goal after the branch is pushed and the PR association plus
media rendering are verified. Babysitting remains a separate phase; create a
separate `vs-baby-sit` goal only when the user explicitly requested a Codex goal.

## Verification contract

- [ ] Only scoped changes were committed and pushed.
- [ ] The PR description was prepared without unnecessary user input.
- [ ] Available screenshots/video were uploaded before PR creation and render,
      or the exact media gap is visible in Evidence.
- [ ] Draft PR state, branch, and head SHA were re-resolved successfully.
- [ ] A 10+ file PR started one exact-head walkthrough child without delaying
      babysitting; a smaller PR spawned none.
- [ ] Any surfaced walkthrough matches the current PR head; repair pushes caused
      at most one final refresh.
- [ ] No brief, broad verify, reviewer lookup, preview, or QA ran without an
      explicit request or repository requirement.
- [ ] `vs-baby-sit` started after PR verification unless the user explicitly opted out.
- [ ] The handoff reports PR URL, head, media, and checks.

Before the final handoff, apply
[Phase Boundaries](../vs-internal-shared/references/phase-boundaries.md). Keep
`Next` below as the semantic route; report a session action only when required
by that contract. Visual progress checkpoint: inherit
[`../vs-internal-shared/references/communication.md`](../vs-internal-shared/references/communication.md).
Pointer only; do not restate the map.

## Output style

Apply the [shared output style](../vs-internal-shared/references/output-style.md)
to every user-facing message.

## Workflow

Direct: emit **Next** only. Composed: return to caller.

**Prev:** `/vs-build-it`
**Next:** done
**Relevant:** `/vs-eval`
