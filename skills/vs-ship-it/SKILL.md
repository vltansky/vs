---
name: vs-ship-it
description: "Use vs-ship-it when the user asks to create or open a PR; says create PR, open PR, or ship it; asks to submit changes, commit and push, or push directly. This is the VS publishing workflow and takes precedence over generic publishers such as github:yeet unless the user names another publisher. Requires affirmative publish intent; excludes review/readiness-only requests. Creates and verifies regular PRs, then babysits them by default; honors explicit direct pushes and requests not to watch."
---

# Ship Changes — Publish and Follow Through

Create the PR quickly and independently. Ask the user only when a decision is
both necessary and impossible to infer safely. A missing optional input is a
reason to omit or mark a gap, not a reason to stop PR creation.
The [Video explainer check](#video-explainer-check) runs before anything else,
also when the user only says "create pr". For a big user-facing change (a new
screen or multi-step flow counts, even as one uncommitted file) your first
message carries its one-line offer. Then continue: the offer never ends the
turn or waits for an answer.

## Routing precedence

Treat phrases such as "create PR", "open PR", "ship it", "send this to review",
and "commit and push" as `vs-ship-it` requests. Prefer this workflow over a
generic publisher such as `github:yeet`; do not compose two publishers.

Use another publishing skill only when the user explicitly names it or this
skill is unavailable.

Compose `/vs-eval` only when the PR is a skill/eval contract. Skip it for
ordinary product PRs.

## Video explainer check

Run this first, before Nothing built yet, Direct-push, or Step 1. It decides
once whether to offer a narrated PR video (`vs-explain-pr`). The offer never
blocks: the PR work continues in the same turn, and the video starts only
after Step 4.

1. **User words win.** "with video", "make a video", or `--video` means yes:
   no offer, and Step 4b runs after the PR is verified. "no video", "skip the
   video", or `--no-video` means no: no offer. An explicit word overrides the
   rubric. Direct-push mode never makes a video.
2. **Else classify** from `git diff --shortstat origin/<default>...HEAD`, the
   working-tree diff, and untracked files (`git status --porcelain`; count the
   lines of each new file, because `--shortstat` does not see them), plus the
   changed paths (the same paths that decide Surfaces):
   - **Skip silently** when any is true: only docs, skill text, comments, tests,
     config, or dependency files changed; a typo, rename, format, or version
     bump; fewer than 150 changed lines and no user-facing flow; a refactor
     with the same visible behavior. Do not ask, and do not mention the video.
   - **Offer** when any is true: a user-facing flow changed (frontend paths
     with a click, form, navigation, or multi-step change, or a new screen);
     300 or more changed lines outside tests and docs; two or more Surfaces
     (UI, Endpoint, Schema, CLI, MCP); a new user-facing feature or screen,
     also when it is one new uncommitted file.
   - Neither list matches: skip silently.
3. **Offer means one line, then keep going.** Put this line in your opening
   message: `Want a narrated video of this PR? Reply yes and I'll add it.`
   Then continue at once with commit, push, `gh pr create`, the gate, and
   babysitting. Do not end the turn, wait, or ask again. Missing capture tools
   (no preview, browser, or Playwright) do not cancel the offer: the explainer
   is narrated from the diff and the PR body, with stills only when they
   exist. Unattended runs and the `vs-build-it` handoff keep the line and never
   stall on it.
4. **The answer can come at any time.** A yes before the PR exists: run Step
   4b after the PR is verified. A yes after the PR is open: run Step 4b on the
   open PR at its current head. No answer, or no: no video.

## Nothing built yet

At ship-it entry — before Direct-push or the PR workflow — detect whether
anything is built yet:

1. Inspect `git status -sb` and ahead/behind vs the default branch
   (`git rev-list --left-right --count origin/<default>...HEAD`).
2. If the working tree has **no scoped changes to publish** (clean index and
   worktree for the intended scope) **and** the current branch is not a feature
   branch with commits ahead of the default that constitute the thing to ship
   (nothing new vs base), do **not** create an empty PR and
   do **not** stop with only "nothing to ship".
3. When there is a **buildable intent** — a plan/spec/outcome the user just
   shaped, or an explicit "ship it" on work that was only discussed/planned —
   announce one line that you are running build-it first, **Read and follow
   `vs-build-it`**, then when the build-it handoff says ready, **resume ship-it**
   on the resulting branch/diff (full PR path unless the user named
   immediate/direct). Skill-only / docs-only empty trees still follow this when
   the user asked to ship a planned skill change that is not implemented yet.
4. If there is also **no plan/outcome** to build (empty tree and no prior plan),
   stop and ask once what to build — do not invent scope.
5. Do not recurse: if already inside a build-it→ship-it handoff, skip this gate.
6. Direct-push with an empty tree: same compose (build then push)
   only if the user named a destination; otherwise prefer the PR path after build.

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
not start `vs-baby-sit`.

## PR workflow

The default PR path has five outcomes: prepare the PR description, prepare
available media, create plus verify a regular PR, pin any spec/Walkthrough links to
the exact head, and hand it to `vs-baby-sit`.

Code review is outside this workflow. Do not add brief generation, broad
verification, reviewer discovery, or broad QA unless the user explicitly
requested that work. Focused frontend evidence capture in Step 3 is part of
PR preparation.
Babysitting is the default after PR verification unless the user opts out.

### Step 1: Inspect and prepare the branch

Inspect once:

```bash
git branch --show-current
git status -sb
git diff HEAD --stat
git remote -v
git fetch origin <default>
git diff --stat origin/<default>...HEAD
```

**Stale base:** if `origin/<default>...HEAD` lists files outside the intended
change (branch cut from a stale or diverged local default), rebuild the branch
on fresh `origin/<default>` and re-apply only the scoped change before writing
the body. **Scope check:** compare the diff with what the user asked for;
remove unrequested extras (a layout tweak riding a color fix) or ask once —
never ship them silently.

Preserve unrelated changes. If on `main`, `master`, `prod`, or detached HEAD,
create a short `username/topic` feature branch. Stage only scoped paths, commit
with a concise conventional message, and push with `git push -u origin HEAD`.

Run only checks required by repository instructions before push. Reuse current
results; do not introduce `vs-before-after`, `vs-verify`, broad test suites, or another
user question as shipping ceremony. Record existing checks honestly in the PR.
The Tests block and no-test flag in Step 2 come from the diff and add no runs.

**Failure baseline.** When a required check or test is red, classify each
failing one as exactly one class before writing the PR. Compare failing test
names, not whole jobs:
- **New** — passes on the base, or fails a test the base does not fail. A
  timeout, OOM, or rerun-pass with the base green is New.
- **Already failing on base** — every failing test also fails in the same job
  on the base run, or at the merge-base locally.
- **Environment** — only a fixed reason (`browser-not-installed`,
  `network-unreachable`, `runner-out-of-disk`, `missing-secret-on-fork`) plus
  the log line that shows it. A free-text reason is not Environment.
- **Unknown** — no baseline or no test-level data; state the reason. Do not
  guess a class. Renamed or matrix-reshaped jobs have no match and are Unknown.

Get the baseline from the base branch's latest completed CI run for the same
workflow whose conclusion is `success` or `failure` (skip cancelled and other
conclusions): `gh run list --branch <base> --workflow <wf> --status completed
-L 20 --json conclusion,headSha,url`, then `gh run view <run id from url>
--json jobs`. Use it only when `git merge-base --is-ancestor <mergeBase> <headSha>`
holds. Otherwise run only the failing test(s) at the merge-base in a temporary
worktree and record the OS and browsers present as evidence. Never run the full
suite to get a baseline. `skills/vs-baby-sit/scripts/classify-failures.mjs`
turns this evidence into classes (exit 1 New, 3 Unknown, 0 base/env only).

If authentication fails, stop after the first failure, identify the credential
used, and give the exact re-authentication step. Do not retry unchanged auth.

### Step 2: Prepare the PR description

Read and follow [PR body format](references/pr-body.md) before writing the body.

### Step 3: Prepare screenshots and video

For visible UI changes, matched Before/After screenshots are required.
All functional UI behavior changes require matched Before/After videos as well:
clicks, form submission, navigation, dragging, timing, and multi-step flows.
Screenshots do not replace videos; videos do not replace screenshots.
This requirement takes precedence over the shared recording guide's narrower
motion-only trigger. Available captures must be completed before publishing;
"not captured yet" is unfinished work, not a capture blocker.
Pass `--functional` to the proof gate for those changes. For static styling,
use `--static-ui`; for frontend code with identical visible output, state
`No visual change: <why>`. Missing captures must have an exact per-kind gap
(`Still unverified: screenshots; <blocker>` / `Still unverified: video; <blocker>`)
in Verification. Missing proof never silently becomes optional.


Before creating the PR, inspect the current session and known build/QA artifacts
for local media that directly proves the changed behavior.

- Use matched screenshots for static visual states.
- Use short matched recordings for motion, timing, scrolling, dragging,
  resizing, or multi-step interactions.
- Reuse valid existing proof tied to the actual base and head being compared.
- Reuse demo scenarios from the approved Evidence plan; fill only missing
  scenarios from the changed behavior. Use the shared `capture-demo.mjs` helper
  when the selected recording route is Playwright; do not switch browser routes
  merely to use it.
- For frontend changes, capture missing matched screenshots before publishing;
  add short matched recordings for interaction or motion changes. Use the
  same route, data, viewport, and interaction on both revisions. Label each
  revision and caption each image or recording with what to notice.
- Use the base revision in an isolated worktree or a verified base preview;
  preserve the user's working tree. Never recreate the Before state by editing
  the After screenshot or present head media as baseline evidence.
- Follow
  [`../vs-internal-shared/references/preview.md`](../vs-internal-shared/references/preview.md)
  to reuse a surface or start a focused preview, then capture with
  [`../vs-internal-shared/scripts/record-flow.mjs`](../vs-internal-shared/scripts/record-flow.mjs).
  Write the captions as data before capturing: a `flow.json` whose steps
  each carry a `caption` (what to notice), an action, and a `still` name.
  Run it once per revision from the project that has Playwright installed
  (or set `PLAYWRIGHT_MODULE`):

  ```bash
  node <vs-internal-shared>/scripts/record-flow.mjs flow.json --out "$EVIDENCE_DIR/after"
  ```

  The script draws the caption and pointer into every still and video frame,
  writes `captions.vtt`, and prints a manifest (paths, captions, bytes,
  sha256). Write the PR body from that manifest. Do not Read the captured
  images or video beyond one check frame: the manifest already states what
  each one shows, and a 1280x720 PNG costs more context than the whole PR
  body. The check frame is the decisive result still of each revision: open it
  once to confirm the caption, pointer, and changed state are visible before
  the body calls the media proof. Open more only when the user asks or when a
  capture step failed and the failure text points at the frame.
  [`../vs-internal-shared/references/recording.md`](../vs-internal-shared/references/recording.md)
  covers hand-rolled recordings, visible pointer/clicks, and transcoding.
  This capture needs no extra permission question within the authorized task;
  honor an explicit no-browser/no-capture constraint. Do not rerun broad QA.
  For this capture-only path, stop previews you started after capture unless
  the user requested a live preview; leave pre-existing servers alone. This
  overrides the shared preview's leave-running rule for human handoffs.
- If capture is blocked by missing tools, access, or a runnable baseline, keep
  the textual Before/After and any valid media; state the exact visual-proof gap
  under Verification. If no valid media exists, continue without asking the user to
  find it. Never fabricate or silently omit the missing side.

Upload each available image or video directly to GitHub's user-attachments CDN.
This is the same hosting surface as drag-and-drop, inherits repository
visibility, and needs no browser, Computer Use, draft comment, or vision tool.

Resolve the numeric repository ID (`gh repo view --json` has no such field):

```bash
gh api repos/{owner}/{repo} --jq .id
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

Embed images as `<img src="<returned-url>" alt="<concise caption>" width="260" />`
so a tall phone screenshot stays phone-sized; GitHub strips `style=`, so
`max-height` never survives and `width` is the only cap. Door, blast and surface
badges keep their own embed. Embed videos as the
returned URL on its own bare line; `![]()` does not render GitHub's video player.
Insert the URLs into the body file before `gh pr create` so the initial PR
description is complete. Use the manifest caption as the image caption.

Then run the proof gate on the body file. It reads git and the body, never the
media, and refuses a PR that shows nothing:

```bash
node <vs-internal-shared>/scripts/pr-media-gate.mjs "$BODY_FILE" --base origin/<base> --title "<PR title>" [--template <repo PR template>] [--bugfix] [--functional | --static-ui]
```

Run it against the `origin/<base>` fetched in Step 1, never a stale local ref.

- Exit 0: Before/After, door/blast risk and matching surface claims are present.
  Visible UI proof has at least two distinct hosted screenshots. Functional UI
  proof also has two distinct hosted videos. CSS-only changes need screenshots;
  other frontend paths default to functional unless `--static-ui` is justified.
  Each missing kind needs its own exact blocker; an endpoint gap does not
  excuse missing screenshots or video. No visible output change may be stated
  explicitly. Endpoint/schema proof and changed-test coverage remain required.
  A Walkthrough is optional; when included it must be collapsed, last, risk
  ordered, and linked to the current head. A no-test warning is non-blocking.
- Exit 1: add the missing side of the comparison, add the missing merge-risk
  line, or capture with `record-flow.mjs` and upload, or write the exact gap in
  the body. Do not create the PR from a failing body. Local paths never count:
  the reviewer cannot open them. Never fabricate the missing side to clear the
  gate.
- Exit 2: the gate could not check (no base ref); pass `--base` and re-run.
  Never report a not-checked run as a pass.

Keep each clip's scenario, viewport/fixture, recorded revision, and uploaded URL
with the evidence. After a later push, compare the recorded revision with the
current head for that demonstrated flow. Rerecord affected clips when visible
behavior changed; retain unaffected clips with their original revision and a
short reason they still apply. Do not relabel an old recording as current-head
proof. Preserve this mapping when refreshing the PR description.

Treat HTTP 422 as an unsupported media type and HTTP 404 as a bad repository ID
or missing push access. On upload failure, continue creating the PR, omit the
broken embed, and name the exact gap. Never commit proof assets to the product
branch or create a `.github/pr-assets` directory.

Vision may inspect, compare, or caption screenshots when already needed for the
PR evidence. It is not part of the upload transport.

### Step 4: Create and verify the PR

Create a regular PR from the prepared body file. Do not pass `--draft`: the PR
is reviewable from the first head, and the babysitter protects an unverified
head by converting to draft only around a repair.

```bash
gh pr create --title "<title>" --body-file "$BODY_FILE"
```

Immediately re-resolve it from the same checkout and verify open state, branch,
and exact head SHA:

```bash
PR_JSON=$(gh pr view --json number,url,title,state,isDraft,headRefName,headRefOid,changedFiles)
LOCAL_BRANCH=$(git branch --show-current)
LOCAL_HEAD=$(git rev-parse HEAD)

echo "$PR_JSON" | jq -e \
  --arg branch "$LOCAL_BRANCH" --arg head "$LOCAL_HEAD" \
  '.state == "OPEN" and .isDraft == false and .headRefName == $branch and .headRefOid == $head' >/dev/null || exit 1

PR_NUM=$(echo "$PR_JSON" | jq -r '.number')
PR_URL=$(echo "$PR_JSON" | jq -r '.url')
HEAD_SHA=$(echo "$PR_JSON" | jq -r '.headRefOid')
printf '%s\n' "$PR_URL"
```

On association failure, run authenticated `gh auth status`, report the exact
mismatch, and stop. Do not switch branches before this succeeds.

Re-open the PR description read-only and verify every uploaded image renders and
every video exposes a player. If rendering fails, remove or correct only the
broken embed in `$BODY_FILE`, then carry the live video block into it and
update the body over REST, as in Step 5 (`video-block.mjs keep`, then
`gh api -X PATCH repos/<owner/name>/pulls/<N> --input <payload>`). Never
`gh pr edit`. Do not claim the proof is attached.

Apply only explicitly requested PR modifiers. Do not suggest reviewers or run broad QA by default. Preview startup is
limited to the focused evidence capture in Step 3.

### Step 4b: Start the video explainer

Only on a yes: the user's words, or a yes to the offer at any time. Right
after the PR is verified, or when a late yes arrives on the open PR, start one fresh-context background agent that reads and follows
`vs-explain-pr`. Give it only: repo, PR number, the head SHA, the base ref,
the final body file path, the record-flow manifest paths (or media files with
their captions), and the gate flags used in Step 3. No transcript. Do not wait
for it. Start babysitting in the same turn. The agent renders, uploads, and
patches only the `<!-- vs:video -->` block of the body through REST. The
video's upload and body edit go only through
`node <vs-explain-pr>/scripts/attach.mjs --repo <owner/name> --pr <N> --sha <head SHA> --video <final.mp4> --base origin/<base>`,
also when a finished mp4 already exists or the host has no subagents and you
run it yourself. Never the Step 3 curl upload, `gh pr edit`, or a whole-body
rewrite for it. When it returns, report its status in one line. A failed
video is a note, not a PR blocker.

### Step 5: Start babysitting

Hand the verified PR to `vs-baby-sit` immediately. Babysit owns its single
watcher and the draft-around-repair transition back to ready for review;
ship-it does not duplicate that skill's CI or automated-review loop. At
every handoff where a repair push moved the head, refresh the Walkthrough links
to that head and rerun `pr-media-gate.mjs` before updating the body. The
local body file has no video block, because the video lands after the PR
opens. So before every body update after `gh pr create`, carry the live
block into the file:

```bash
node <vs-internal-shared>/scripts/video-block.mjs keep --repo <owner/name> --pr <N> "$BODY_FILE"
```

It reads the live body over REST and copies its `<!-- vs:video -->` block
into the file unchanged. Then run the gate on that file and update the body
over REST (`gh api -X PATCH repos/<owner/name>/pulls/<N> --input <payload>`).
If the live body does not read, do not update it.

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
PR created and verified: [#<N> — <title>](<PR_URL>)

- Head: `<short SHA>`
- State: open, ready for review — babysit follows CI and automated review on
  the exact head; a repair converts it to draft and returns it to ready for
  review only when the new head is green.
- Merge risk: <two-way | one-way> door, <blast radius in a few words>
- Media: <N screenshots, N videos attached | none available | exact upload gap>
- Video: <rendering in the background | offered, reply yes to add it | none>
- Checks: <fresh results reused or repository-required checks run>
```

Do not describe CI, deployment, preview behavior, or production as verified when
only PR creation succeeded.

The creation handoff is a progress message, not the end of the turn. Unless
the user explicitly opted out of watching, load `vs-baby-sit` and start it in
the same turn right after printing the handoff. Ending the turn with "Next: hand
off to vs-baby-sit" or an offer to watch is a skipped phase, not a handoff.
No CI workflow in the tree, a small PR, an unfamiliar or sandbox-looking
remote, and passing local tests are not opt-outs: `vs-baby-sit` reads the
checks and reviews GitHub reports for the exact head and decides from those.

When fresh verification evidence already exists with `WARN`, carry the WARN
wording into the PR and handoff; do not describe the change as fixed or
verified. Existing `FAIL` or `BLOCKED` evidence is reported as an open gap, not
silently replaced by PR-creation success.

If the change altered skill or plugin content, add the exact re-install command
to the handoff; the installed behavior remains stale until reinstalled.

### Closing link

Once a PR exists, the last line of the turn's final message is the
bare full PR URL (`PR_URL`, e.g. `https://github.com/<owner>/<repo>/pull/<N>`)
on its own line — not hidden behind a Markdown label, not followed by any other
text. This holds however the turn ends: the babysitter's `Review needed`
stop, a watch opt-out, a repair blocker, or an error after PR creation. Users
scan the end of the turn to find the PR; a label-only link or a status line
without the URL makes it hard to find.

## Codex goals

Create a Codex goal only when the user explicitly requested one. Complete the
finite shipping goal after the branch is pushed and the PR association plus
media rendering are verified. Babysitting remains a separate phase; create a
separate `vs-baby-sit` goal only when the user explicitly requested a Codex goal.

## Verification contract

- [ ] Only scoped changes were committed and pushed.
- [ ] The PR description was prepared without unnecessary user input.
- [ ] Available screenshots/video were uploaded before PR creation and render,
      or the exact per-kind media gap is visible in Verification.
- [ ] Every PR has a concrete Before/After comparison, including new features
      and internal changes; source-derived claims are labeled. The gate enforces
      the pair on every PR, not only frontend ones.
- [ ] Every PR classifies merge risk: a one-way/two-way door and a blast
      radius, both derived from the diff, both in the handoff.
- [ ] Merge risk shows the matching door/blast badges, on one compact line
      with supporting **Risk**, **Scope**, and **Review** bullets (wide-blast only when blast is
      wide), using
      `raw.githubusercontent.com/vltansky/vs/master/skills/vs-ship-it/assets/badge-*.svg`.
- [ ] Surfaces (when present) shows kind-colored chips on one line
      (`badge-surface-{kind}-{n}.svg`, count = deployable modules for that
      kind) and names the modules in Scope; only UI|Endpoint|Schema|CLI|MCP
      classes the paths prove (Infra alone on infra-only PRs), or the section is
      omitted for skill-only / docs-only; no backend/DB stamps; no separate
      Affected modules section; Door/Blast own risk.
- [ ] Visible UI changes have matched Before/After screenshots; functional UI
      changes also have matched Before/After videos. Each missing media kind
      has an exact capture blocker; captions explain the difference.
- [ ] Endpoint and schema changes show one request with both responses and a
      schema `diff`, or state why not.
- [ ] Changed test/eval files have a `## Verification` block (behavior per test,
      deleted tests included, one `Not covered:` line); a behavior change with
      no test/eval change has a `No tests changed` Verification bullet; both
      came from the diff and added no runs.
- [ ] `pr-media-gate.mjs` exited 0 on the final body file before `gh pr create`;
      only the decisive check frame per revision was inspected, unless a
      capture error or the user required further image inspection.
- [ ] A found repo PR template kept every heading and checklist in order
      (`N/A` where it does not apply) and was passed as `--template`; no
      template → vs body as is.
- [ ] A `Closes #N` / `Refs #N` and head-pinned spec line appears only when
      found, on its own line under the STE scenario.
- [ ] Open non-draft PR state, branch, and head SHA were re-resolved
      successfully.
- [ ] The body includes a collapsed Walkthrough only for multiple architectural areas: area groups ordered riskiest
      first, a logic pseudocode `diff` per group, links pinned to the head SHA.
- [ ] Walkthrough links pin the current head at every handoff; each refresh
      reran `pr-media-gate.mjs`.
- [ ] No brief, broad verify, reviewer lookup, or broad QA ran without an
      explicit request or repository requirement.
- [ ] The Video explainer check ran first: user words win; skip silently when
      the rubric says skip; at most one offer line in the opening message, and
      the PR work continued in the same turn.
- [ ] A yes started one background `vs-explain-pr` agent only after PR
      verification; ship-it did not wait for it.
- [ ] `vs-baby-sit` started after PR verification unless the user explicitly opted out.
- [ ] The handoff reports PR URL, head, media, and checks.
- [ ] The final message ends with the bare full PR URL on its own last line.

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
