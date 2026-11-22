### Step 2: Prepare the PR description

**Proof first.** Write one plain sentence that says what changes and for whom,
then show the primary Before/After proof. Follow it with one `**Risk:**` paragraph
and one collapsed expander. Add a short visible caption only where the proof
needs explanation. Use line breaks when they help each side read clearly. Put recordings,
additional comparisons, verification, template fields, and the walkthrough
inside that same expander. Name the contents in the summary. Skip empty vs
sections (never a repo template section) and avoid repeating the same claim in the sentence, captions, and details.

**Merge blocker.** Move the same risk paragraph to the very top only when a known
condition must be resolved before merge. Start it with
`**Risk:** Block merge until …` and end that action row with `<br>`.
Put both badges on the next row and end it with `<br>`. Put the consequence
or rollback guidance on the third row. For example:

```markdown
**Risk:** Block merge until staging confirms staff can still sign in.<br>
<img alt="Two-way door" height="20" src="https://raw.githubusercontent.com/vltansky/vs/master/skills/vs-ship-it/assets/badge-two-way-door.svg"> <img alt="Narrow blast radius" height="20" src="https://raw.githubusercontent.com/vltansky/vs/master/skills/vs-ship-it/assets/badge-narrow-blast.svg"><br>
A revert restores the previous staff sign-in rules.
```

A risky change, a pending routine check, or a post-merge follow-up alone does
not move the risk line. Keep the summary sentence immediately before the proof.
Put the verification procedure inside the expander when the blocker needs steps.

**Retention before compression.** Make a private fact ledger from the source:
conditions, failure consequences, unchanged behavior, recovery/deploy effects,
evidence limits, media URLs and revision mapping, and real rejected alternatives.
Check the final body against it. Keep each fact once. Compare the full-body word count
for a rewrite and keep it no longer than the source unless missing required proof
or risk detail justifies the increase. Unknown templates or missing inputs are not reviewer tasks.

Write the description from the scoped diff, conversation, and available evidence.
Do not ask the user to write or approve PR copy. Do not echo the PR title.

**Repo PR template first.** Before writing, look for the target repo template,
case-insensitively, in this order: `.github/pull_request_template.md`,
`.github/PULL_REQUEST_TEMPLATE.md`, `PULL_REQUEST_TEMPLATE.md`,
`docs/pull_request_template.md`, then `.github/PULL_REQUEST_TEMPLATE/*.md`.

- **Exactly one template:** keep its headings and checklist items in order
  inside the single expander. A section is any `#`–`######` heading or bold-label
  line (`**Notes:**`). Use matching headings for supporting content (for
  example `## Evidence` can hold verification). Point a required summary,
  risk, or proof section to the material above when it would repeat it.
  Keep inapplicable sections with `N/A`. Keep template checkboxes unchecked unless the diff or
  evidence proves them. Do not ask about a single template.
- **Several templates (a directory), none clearly fits:** ask once with the
  template names as options. This is the only question ship-it may ask.
- **No template:** use the vs body below.

Pass the template used as `--template <path>`. A missing or reordered heading,
or a dropped checklist item, fails the gate. Do not append a second template.
Urgency does not shrink the template: an incident, hotfix, or "keep it short"
request still keeps every section and checklist item. Shorten the prose, write
`N/A`, or mark missing proof `Pending: <what>` instead of dropping a section.

**Linked issue and spec.** Put them on one separate line inside the expander.
Take the issue number from the branch name (`fix/123-x`), commit
messages, or the shape-it/build-it handoff. Never invent an issue; if nothing
is found, skip the line. Default to `Refs #N`. Use `Closes` only when this PR
meets every acceptance criterion in the issue. Read it with `gh issue view <N>`.
Pin the spec link to the head SHA and refresh it alongside walkthrough links.
Use the Markdown link label `[Spec]` so the gate can recognize and pin it.

**Root cause (bugfix PRs only).** A bugfix has a branch starting
with `fix/`, `fix-`, or `hotfix/` (including after `<user>/`), a PR title or
FIRST commit subject after the merge-base with a `fix:` / `fix(<scope>):`
conventional prefix, a linked issue labeled `bug`, or ship-it was entered from a `/vs-bugfix` handoff.
Put `Root cause: <mechanism>` inside the expander. Explain the failure
mechanism in at least 4 words, never a `<…>` placeholder or TBD/TODO/unknown/N/A.
From `/vs-bugfix`, reuse its `**Root cause:**` sentence as is. Non-bug PRs skip the line.
The gate auto-detects a bugfix from the head branch, `--title "<PR title>"`,
or the first commit subject. Later `fix:` commits (CI repairs, review fixes) never count.
Pass `--bugfix` for a bug-label or vs-bugfix handoff, and use `--bugfix=false` only when
a `fix` name does not represent a bug fix. When a repo template asks for Why,
write the problem from one user/admin or system perspective in ASD-STE100
(actor → attempt → block). Do not name the fix in that block. Example:
Agent sends `POST /api/assistant/preview` → request fails → only a browser session works.
From the admin perspective: Admin needs an agent to call Playground preview →
agent has no browser session → call is blocked.

Make the description visual first. Every PR description must include **Before** and **After**
for the same actor, input, and precondition. State the concrete
result in each caption. Put `**Before:**` and `**After:**` outside code fences, or
use the plain headers `| Before | After |`.
Pick the smallest visual that shows the change. For behavior changes, prefer
matched captures, exact output, or the same focused regression failing on base
and passing on head. Show the decisive assertion or output. For a structural
change, show the smallest diff, call tree, or diagram that explains the change.
When you have source evidence alone, label it **Source-derived**. Put secondary
evidence in the expander.

| What changed | Primary proof |
| --- | --- |
| UI | Matched screenshots, preferably side by side. Functional UI also needs matched recordings in the expander. |
| CLI, API, log, or error output | Paired output blocks copied verbatim from the same input |
| A command, flags or args, config, or a small code snippet | One fenced `diff`, never separate Before and After blocks (see Text diffs) |
| Endpoint or Schema | One request with both responses, or a diff of the resulting schema |
| Numbers such as latency, size, count, rate | A table with both operands beside any derived figure |
| Multi-hop flow or ordering | A Mermaid diagram when needed to see the behavior |
| Decisive logic | A fenced `diff` block of the key hunk |

**Text diffs.** When the change itself is text (a command, flags, config, a
short snippet), write `**Before** <old>` and `**After** <new>` on separate lines
when that reads better. The gate needs both labels. Follow them with one `diff`.
Split long lines one flag, arg or key per
line, flag and value together (`\` continuations for commands), so `-`/`+` mark
only what changed and the rest stays context. When an edit moves a trailing
`\` or JSON comma, mark that neighbor line too. UI and user-visible output keep
the separate Before and After proof.

**Before:** Loads user and project settings.

**After:** Loads user settings only.

```diff
 claude --print --output-format stream-json \
-  --setting-sources user,project \
+  --setting-sources user \
   --no-session-persistence
```

When removing the last JSON key, the preceding line changes too:

```diff
 {
-  "schedule": ["weekly"],
-  "automerge": true
+  "schedule": ["weekly"]
 }
```

Put **Source-derived** after the diff, never inside the Before/After label.
Prefer a compact comparison table when there are multiple decisive outcomes.
Label proof observed, tested, or source-derived. Claim no metric or status the
evidence does not contain. Never paste the whole diff.
Borrow this discipline from the explaining skills and apply it inline; do not
spawn them as shipping phases. Write in `vs-write` STE mode. Pointer only:
[STE guide](../../vs-internal-shared/references/ste-writing.md). Before
`gh pr create`, run `node skills/vs-write/scripts/check-ste.mjs "$BODY_FILE"`.
Fix flagged sentences and rerun. Preserve exact code, outputs, and technical names.

The title is passed separately as `--title`. The body starts with the sentence,
or the risk line when it names a merge blocker. Retain the invisible format marker
after the expander summary so later refreshes apply the same layout. Start with
this example and omit optional rows without evidence.

````markdown
<one sentence that says what changes and for whom>

| Before | After |
| --- | --- |
| ![Previous inspector stays assigned](<hosted-before-screenshot>) | ![New inspector is assigned](<hosted-after-screenshot>) |

**Risk:** <img alt="One-way door" height="20" src="https://raw.githubusercontent.com/vltansky/vs/master/skills/vs-ship-it/assets/badge-one-way-door.svg"> <img alt="Narrow blast radius" height="20" src="https://raw.githubusercontent.com/vltansky/vs/master/skills/vs-ship-it/assets/badge-narrow-blast.svg"><br>
Reverting the Reportan Web editor won't undo saved assignments.

<details>
<summary>Recordings and verification</summary>

<!-- vs:proof-first -->

Refs #<N> · [Spec](https://github.com/<owner>/<repo>/blob/<HEAD_SHA>/<spec path>)

Root cause: <mechanism that made the bug happen>

**Before recording**

<hosted-before-video-URL on its own bare line>

**After recording**

<hosted-after-video-URL on its own bare line>

## Verification

- **Automated:** `<command>` passed.
- **Coverage:** <changed tests grouped by behavior, including deleted guards>
- **Not covered:**
  - [ ] <action the reviewer runs and expected result>

<!-- For failed checks, keep one evidence class per check and link the baseline when available.
  - New: `<check>` — <failure> ([base run](<base run URL>))
  - Already failing on base: `<check>` — <failure> ([base run](<base run URL>))
  - Environment: `<check>` — <allowlisted reason and log line>
  - Unknown: `<check>` — <why no baseline>
-->

</details>
````

### Risk and scope

Classify from the scoped diff. Use the one risk paragraph to explain who can be
affected and what a revert or recovery can do. Two-way means a revert restores
the prior behavior. One-way means an effect can outlive the revert, as with data
writes, released contracts, permissions or customer sends. Name the recovery
path for irreversible or broad changes. Say when it is unknown. The line is
required even for low-risk changes. Keep supporting scope, rollback steps, and
rollout instructions inside the expander.

Embed one door badge (`badge-one-way-door.svg` or `badge-two-way-door.svg`) and
one blast-radius badge (`badge-wide-blast.svg` or `badge-narrow-blast.svg`)
on one rendered line in that paragraph. Put `<br>` after both badges and place
the risk explanation below. Use accessible alt text and the published URLs
from the example. Keep the rendered rows in one Markdown paragraph.

### Surfaces

Use the affected surfaces to select proof: UI · Endpoint · Schema · CLI · MCP.
Endpoint covers handlers and Schema covers wire + persistence (no separate DB).
Infra only when the PR is solely CI/deploy/flags/env. Never stack Infra with a product surface.
MCP wrap of unchanged route → MCP only; CLI shim of unchanged MCP → CLI only.
Omit Surfaces when paths prove no product surface and the PR is not solely Infra
(skill-only / docs-only). Otherwise name relevant modules in the expander when
that helps a reviewer. Surface and old merge-risk badges never count as proof.

### Endpoint and schema proof

Endpoint and Schema PRs show the contract move, the same way UI PRs show pixels.
`pr-media-gate.mjs` enforces both shapes from the changed paths:

- **Endpoint** — handler, controller, resolver, route, or RPC code changed.
  Name the method and path, give one request, then the Before and After
  response to that same request. Capture real output (curl, test client,
  recorded fixture) against each revision; fold a large payload into one
  fenced `diff` of the response. Handler change with identical responses:
  write `No contract change: <why>`.
- **Schema** — migration, SQL, Prisma, GraphQL, proto, Avro, OpenAPI, or JSON
  Schema changed (wire + persistence; no separate DB surface). Show a fenced
  `diff` of the resulting shape (columns, fields, types, nullability, defaults),
  not the migration script. No shape change (index, comment, reformat): write
  `No schema change: <why>`.

````markdown
**Endpoint** `POST /v1/tokens/refresh`

```http
POST /v1/tokens/refresh
{"refreshToken": "r_123"}
```

```diff
 {
   "token": "t_456",
+  "expiresAt": "2026-09-30T12:00:00Z"
 }
```

**Schema** `tokens`

```diff
 CREATE TABLE tokens (
   id          text PRIMARY KEY,
+  expires_at  timestamptz NOT NULL
 );
```
````

These blocks are the Before/After proof for an Endpoint or Schema PR: put them
directly under **Before**/**After** for a contract-first change. Supporting
contract proof can go in the expander when the primary proof is UI. Response JSON written from source rather
than captured is labeled source-derived, and Verification adds
`**Still unverified:** endpoint response; <blocker>`. An Endpoint/Schema-only
PR needs no visual-proof line at all.

Pass `--api <regex>` or `--schema <regex>` when the repository's layout does
not match the defaults. A capture blocker is stated per kind:
`**Still unverified:** endpoint response; <blocker>` or
`**Still unverified:** schema diff; <blocker>`.

### Verification block and no-test flag

**Rule.** The PR body says what the changed tests prove and what nothing
tests. Both come from the scoped diff only and add no runs: do not run the
suite, a focused test, `vs-verify`, or `vs-before-after` to fill them. Pass or
fail stays in Verification `Automated:` and the handoff `Checks:` line; test intent
does not repeat these results.

**Why.** A reviewer cannot see test intent in the Files tab without reading
every test. One line per test, plus the gap, replaces that read.

Test/eval files: `*.test.*`, `*.spec.*`, `*.eval.*` (such as `*.eval.ts`),
`*_test.go`, `test_*.py`, code under `spec/`, and any file under `__tests__/`,
`test/`, `tests/`, `evals/`, or `e2e/`. A `*.spec.*` or `spec/` file that is
not code (an OpenAPI `api.spec.yaml`, a design doc) is not a test. Also honor an obvious repository convention (a test
runner `include` glob, a `checks/` folder) and pass it to the gate as
`--tests <regex>`.

- **Tests block.** When any test/eval file was added, changed, or deleted, add
  coverage bullets inside `## Verification` (or a matching template heading such
  as `## Evidence`). Write one line per behavior:
  `<path or case>` — the behavior it proves, in behavior words, not the test
  name restated. List deleted tests too, with the behavior they no longer
  guard. Keep it to about 5 lines; group many tests into one line per behavior.
  Use the canonical label for deletions too: `- **Coverage:** Deleted <guard> —
  <behavior no longer guarded>`. Existing `Coverage removed:` labels are accepted
  by the gate; automated results alone never count as coverage intent.
- **Reviewer checklist.** End the block with `**Not covered:**`. When changed
  behavior has no test, leave the label alone and list it under it as `- [ ]`
  checkboxes the reviewer must verify before merge. Each box is one concrete
  check the human runs: the action and the expected result (`- [ ] Open
  /settings on Safari: the save button stays enabled`), never a vague area
  ("test auth"). When nothing needs a human, write `**Not covered:** none` with
  no boxes. Never tick a box yourself. Bring any actual pre-merge blocker
  into the opening risk line.
- **No-test flag.** When the diff changes behavior (product or runtime code,
  or a skill contract: `SKILL.md`, a skill `references/*.md`, `CONTEXT.md`)
  and touches zero test/eval files,
  add one bullet under **Verification**:
  `**No tests changed:** <the behavior that changed with no test>`. Inspect the
  diff first: unknown test changes never justify this flag. It is a
  warning only: it never blocks PR creation, never asks the user, and never
  starts a test run or new test writing. Exempt docs-only, copy/styling-only,
  config/CI-only, and test-only PRs.

`pr-media-gate.mjs` fails a body that has changed test/eval files but no
`## Verification` block whose `Not covered:` is `none` or the label followed by
`- [ ]` reviewer checkboxes (inline prose after the label fails). It prints a non-blocking warning
when behavior paths changed with no test/eval file and Verification has no
`No tests changed` bullet.

### Prototype links

For an HTML prototype or interactive demo, give the reviewer a hosted link
instead of a local file: `using-wix-stash` (Wix Stash) or a Claude Artifact
(the `Artifact` tool), whichever the environment has; `vs-prototype` builds
the page. Private-by-default hosts need an explicit share step before the link
is useful. A link complements matched screenshots; it does not replace them.

For CLI/API behavior, replace visual proof with exact paired output from the
same input. For a new feature, describe the previous absence or workaround under Before
and the new capability under After; keep the pair even when only After has media.
For internal work, compare the old and new mechanism and explicitly state when
observable behavior is unchanged. Never fabricate evidence,
include AI-session narration, or add a file-by-file changelog.

Write Markdown to a temporary body file and use `--body-file`; never pass
backtick-heavy Markdown through inline `--body` or `gh pr edit --body`.

### Video explainer block

Only `vs-explain-pr` writes the marked `<!-- vs:video -->` block after the PR
opens. Its attachment script places it inside the one expander, before the
Walkthrough when present. It does not count as Before/After proof. Preserve
the marked block when refreshing a body.

### Walkthrough

Only include a Walkthrough when the change crosses multiple architectural areas.
Supporting tests, docs, ADRs, lockfiles and release metadata do not create an
architectural area by themselves; count independent behavior/ownership boundaries.
Omit it for a single-area change; file count is not the trigger. There is no size gate and no child agent: ship-it writes it
from the scoped diff while it writes the rest of the body, with no extra runs.

- **Collapsed:** add `## Walkthrough` at the end of the existing expander,
  after Verification. Use the same expander for all supporting content.
- **Grouped by area, not by file:** one group per deployable module, skill,
  package, or subsystem. Several files of one area share a group.
- **Riskiest first:** each group heading is `### <marker> <Area> · <risk>`
  with High, Medium, or Low risk. Example: `### High Routing · broad blast`. Judge risk with the Merge risk
  vocabulary: blast radius (who breaks and how widely) and reversibility
  (one-way or two-way door). Order High groups, then Medium, then Low.
- **Logic pseudocode diff:** under each heading, one fenced `diff` block of
  language-agnostic logic pseudocode: `-` lines for old behavior, `+` lines
  for new behavior, about 2–8 lines. Pure additions are `+` only; a trivial
  group (version bump, docs) is one line. No real code, no hunks, no file
  contents: GitHub's Files tab already shows those. Describe only logic the
  diff really changes; never invent a step.
- **Head-pinned links:** after the fence, one line of file links pinned to the
  exact head, `https://github.com/<owner>/<repo>/blob/<HEAD_SHA>/<path>`,
  separated by ` · `. Branch-name links drift; never use them.

The branch is pushed before `gh pr create`, so write the links with the pushed
head SHA (`git rev-parse HEAD` after the push). `pr-media-gate.mjs` fails a
Walkthrough link to a file in this repository (a `blob`/`tree` path or a
relative path, in Markdown, `<a href>`, or a bare URL) that is not
`/blob/<40-hex sha>/` or whose SHA is not the current head. Issue, PR, and
external links (including other repositories) are allowed unpinned. An
unresolvable head exits 2 (not checked); pass `--head <ref>`. Refresh the links at every handoff where the head moved: rewrite
them to the new head SHA, rerun `pr-media-gate.mjs` on the body, then update the
PR body. When that rerun fails on an older body's inline `Not covered: <text>`
(breaking since 1.23.0), convert the text to `- [ ]` reviewer checkboxes, or to
`none`, before updating. Existing bodies with the old format still validate
under its original rules. When rewriting an existing body to proof-first,
keep the evidence, template fields, and live explainer, then validate the new shape.
