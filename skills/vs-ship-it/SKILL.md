---
name: vs-ship-it
description: "Use vs-ship-it when the user asks to create or open a PR; says create PR, open PR, or ship it; asks to submit changes, commit and push, or push directly. This is the VS publishing workflow and takes precedence over generic publishers such as github:yeet unless the user names another publisher. Requires affirmative publish intent; excludes review/readiness-only requests. Creates and verifies PRs by default, honors explicit direct pushes, prepares descriptions and available media, and monitors only when requested."
---

# Ship Changes — Review Is Opt-in, PR Creation Is Not

**Mandatory default: no explicit approval to run review means skip review and
create the PR. Never block shipping because review has not run.**

Create the PR quickly and independently. Ask the user only when a decision is
both necessary and impossible to infer safely. A missing optional input is a
reason to omit or mark a gap, not a reason to stop PR creation.

Apply this decision table before doing anything else:

| Review state | Review action | Required next action |
| --- | --- | --- |
| A current review already ran | Reuse it | Description → media → create PR |
| User explicitly said to run review | Run it | Description → media → create PR |
| User explicitly declined review | Skip it | Description → media → create PR |
| Anything else, including silence or bare `ship it` | Offer once, then skip it | Description → media → create PR |

The offer is a notification, not a decision point. Never describe this branch
as pausing, waiting, requiring a clean review pass, or running review unless the
user explicitly approves it. The rule is simply: **no explicit yes to review
means no review**.

## Non-negotiable consent boundary

`ship it`, `create PR`, and equivalent publishing requests authorize the scoped
commit, push, and PR creation. They do **not** authorize running code review.
Review is independently opt-in: without an explicit "run review" instruction,
skip it. Never run review by default, never wait for review approval, and never
hold PR creation for review confirmation. Inspecting or captioning existing
media is PR preparation, not code review.

## Routing precedence

Treat phrases such as "create PR", "open PR", "ship it", "send this to review",
and "commit and push" as `vs-ship-it` requests. Prefer this workflow over a
generic publisher such as `github:yeet`; do not compose two publishers.

Use another publishing skill only when the user explicitly names it or this
skill is unavailable.

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

Do not create a feature branch or PR in direct-push mode.

## PR workflow

The default PR path has four outcomes: decide optional review, prepare the PR
description, prepare available media, and create plus verify the PR. Do not add
brief generation, broad verification, reviewer discovery, preview startup, QA,
or CI waiting unless the user explicitly requested that work.

### Step 0: Offer review without blocking

Check whether `vs-roast-code` or an equivalent review already ran against the
current diff in this session.

- **Review already ran:** reuse it and continue without asking.
- **User explicitly requested review or approved it earlier:** run
  `vs-roast-code`, apply the approved fixes, then continue directly through PR
  description, media preparation, and PR creation.
- **User explicitly declined or said to skip review:** skip it without asking.
- **No decision:** send one short, non-blocking commentary statement, not a
  blocking question:

  > Review has not run in this session. Say “run review” if you want it first;
  > otherwise I’ll skip it and continue creating the PR.

Continue gathering PR facts and creating the PR immediately. Do not call `request_user_input`, wait
for a response, or infer review approval from “ship it,” “create PR,” silence, a
previous generic approval, or the existence of a large diff. Immediately before
the first review action, check for a new explicit approval. If none exists, skip
review and continue. Only an explicit affirmative review instruction authorizes
running a reviewer, spawning review agents, or applying review-generated fixes.

The review offer never changes the authorization already granted to commit,
push, and open the PR. Do not ask for a second publishing confirmation.

The final handoff states `Review: reused`, `Review: ran with approval`, or
`Review: skipped — not explicitly approved`.

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
results; do not introduce `vs-brief`, `vs-verify`, broad test suites, or another
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

### Step 4: Create and verify the PR

Create the PR from the prepared body file:

```bash
gh pr create --title "<title>" --body-file "$BODY_FILE"
```

Immediately re-resolve it from the same checkout and verify open state, branch,
and exact head SHA:

```bash
PR_JSON=$(gh pr view --json number,url,title,state,headRefName,headRefOid)
LOCAL_BRANCH=$(git branch --show-current)
LOCAL_HEAD=$(git rev-parse HEAD)

echo "$PR_JSON" | jq -e \
  --arg branch "$LOCAL_BRANCH" --arg head "$LOCAL_HEAD" \
  '.state == "OPEN" and .headRefName == $branch and .headRefOid == $head' >/dev/null || exit 1

PR_NUM=$(echo "$PR_JSON" | jq -r '.number')
PR_URL=$(echo "$PR_JSON" | jq -r '.url')
printf '%s\n' "$PR_URL"
```

On association failure, run authenticated `gh auth status`, report the exact
mismatch, and stop. Do not switch branches before this succeeds.

Re-open the PR description read-only and verify every uploaded image renders and
every video exposes a player. If rendering fails, remove or correct only the
broken embed with `gh pr edit --body-file`; do not claim the proof is attached.

Apply only explicitly requested PR modifiers. Do not suggest reviewers, watch
CI, wait for automated review, start a preview, or run QA by default. If the user
explicitly requested continued monitoring, hand the verified PR to
`vs-baby-sit` after the creation handoff.

## Handoff

Return immediately after PR verification unless monitoring was requested:

The first line says what shipped in plain language. Translate literal check,
review, or PR status into the user-visible meaning before naming the status.

```markdown
PR created and verified: [#<N> — <title>](<PR_URL>)

- Head: `<short SHA>`
- Review: <reused | ran with approval | skipped — not explicitly approved>
- Media: <N screenshots, N videos attached | none available | exact upload gap>
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
media rendering are verified. Continued monitoring, when explicitly requested,
belongs to a separate `vs-baby-sit` goal.

## Verification contract

- [ ] Review was reused, explicitly approved and run, explicitly declined, or
      skipped because no explicit approval arrived; it was never auto-run.
- [ ] Only scoped changes were committed and pushed.
- [ ] The PR description was prepared without unnecessary user input.
- [ ] Available screenshots/video were uploaded before PR creation and render,
      or the exact media gap is visible in Evidence.
- [ ] PR state, branch, and head SHA were re-resolved successfully.
- [ ] No brief, broad verify, reviewer lookup, preview, QA, CI wait, or monitoring
      ran without an explicit request or repository requirement.
- [ ] The handoff reports PR URL, head, review decision, media, and checks.

Before the final handoff, apply
[Phase Boundaries](../vs-internal-shared/references/phase-boundaries.md). Keep
`Next` below as the semantic route; report a session action only when required
by that contract.

## Output style

Apply the [shared output style](../vs-internal-shared/references/output-style.md)
to every user-facing message.

## Workflow

Direct: emit **Next** only. Composed: return to caller.

**Prev:** `/vs-roast-code` | `/vs-build-it`
**Next:** done
**Relevant:** none
