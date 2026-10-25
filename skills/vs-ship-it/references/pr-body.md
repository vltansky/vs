### Step 2: Prepare the PR description

**Compact default.** Give each fact one home. Use the two-line TL;DR, then
`## Review map`, `## Change and proof`, and `## Verification`.
Aim for 60 visible lines for ordinary PRs; media and necessary security,
contract, migration, rollout, or recovery detail are never cut to meet a budget.
Review map combines risk badges, surface chips, scope and review pointers.
Change and proof owns the scenario, root cause, matched evidence and at most
three implementation bullets. Verification combines check results, test intent
and remaining gaps. Do not repeat the comparison in User Impact, Evidence,
Tests, or a separate implementation section. Replace stale verification history
with current results; retain revision provenance only where it matters.

**Retention before compression.** Make a private fact ledger from the source:
conditions, failure consequences, unchanged behavior, recovery/deploy effects,
evidence limits, media URLs and revision mapping, and real rejected alternatives.
Check the final body against it. Keep each fact once; fold secondary rationale
rather than deleting it to meet a bullet or line budget. Retain exact commands,
outputs and security constraints; do not infer a new assurance from a shorter summary.

**Do not expand a rewrite to fill the format.** Compare the full-body word count
before finalizing: keep the rewrite no longer than the source. Growth is allowed
only for mandatory proof, risk or template detail the source lacked; name that
exception in the handoff. Shorten boilerplate first, never required evidence.
For historical inputs, state provenance once outside the body instead of repeating
it in every result. Preserve known revision limits where they qualify a claim.
Unknown templates or missing inputs are not reviewer tasks; do not invent gaps,
checklists or verification results merely because the supplied context lacks them.
Keep actionable, source-supported unverified behavior in Verification.

**Final shape check.** Use `**Before:**` and `**After:**` outside code fences;
table-only proof uses the plain headers `| Before | After |` without colons.
Keep the final collapsed Walkthrough for multiple architectural areas, even
when compressing. Check these directly in description-only replays; never run
the git-aware gate against an unrelated checkout to validate a historical PR.

Write the description directly from the live conversation, scoped diff, runtime
evidence, and existing test results. Do not ask the user to write or approve PR
copy. If motivation cannot be established honestly, describe the observable
problem without inventing business impact; omit inapplicable optional detail.

**TL;DR first.** The first thing in every PR body is a two-line TL;DR, above
Review map. Line 1 says what changes and for whom; line 2 says the effect or
result. Write exactly 2 short plain lines (3 to 20 words each) in STE
style, with no heading or only a lone `**TL;DR**` label above them. No links (not even a bare `github.com/…`),
no code, no badges, no HTML, no list markers, no bold or italic inside the lines. Do not echo the PR title: say
what it means for the reader. With a repo template, the TL;DR still goes
first, before the template content. `pr-media-gate.mjs` fails a body whose
first non-empty content is not this block.

**Repo PR template first.** Before you write the body, look for the target
repo's PR template in this order, case-insensitive:
`.github/pull_request_template.md`, `.github/PULL_REQUEST_TEMPLATE.md`,
`PULL_REQUEST_TEMPLATE.md`, `docs/pull_request_template.md`, then
`.github/PULL_REQUEST_TEMPLATE/*.md`.

- **Exactly one template:** keep all of its headings and checklists, in its
  order, and fill them. A section is any `#`–`######` heading or a bold-label
  line (`**Notes:**`). Put a vs section into a template heading only when they
  clearly match; append the other vs sections after the template content
  (Walkthrough stays last). Never delete a template section: write `N/A` under
  one that does not apply. Keep template checkboxes unchecked unless the diff or
  evidence proves them. Do not ask about a single template.
- **Several templates (a directory), none clearly fits:** ask once with the
  template names as options. This is the only question ship-it may ask.
- **No template:** use the vs body below as is.

Pass the template you used to the gate (`--template <path>`) so a dropped or
reordered template section, or a dropped checklist item, fails it. A template
with no sections exits 2 (could not check). The locked vs sections stay required either way.

**Linked issue and spec.** Under **Change and proof**, after the STE
scenario, add one separate line (never part of the scenario prose) only when
something is found: `Closes #N` and a link to the shape-it spec, ADR, or plan
this PR implements. Take `#N` from the branch name (`fix/123-x`), commit
messages, or the shape-it/build-it handoff. Never invent an issue; if nothing
is found, skip the line. Default to `Refs #N`. Use `Closes` only when this PR
meets every acceptance criterion in the issue: read it with
`gh issue view <N>` first. Pin the spec link to the head SHA like the
Walkthrough links (`blob/<HEAD_SHA>/<path>`) and refresh it with them;
`pr-media-gate.mjs` fails an unpinned repo file link under this section.

Under **Change and proof**, write a short ASD-STE100 scenario
flow: **actor → attempt → block**. One perspective per PR — **user/admin** or
**system**; either is OK (do not lock the skill to one forever). Keep it to one
tight line (or a single arrow chain), not a multi-paragraph prose wall.

**No How in Why.** "Why" means only the opening scenario line under
**Change and proof**: **actor → attempt → block**. Do not name the fix in that block (mintable tokens,
rewrite, JSON shape, OAuth piggyback, collections, new routes, "this PR adds …"
as the solution). Mechanism How stays in **Endpoint** / **Schema** / **UI**
Before→After — those fenced proofs stay primary alongside Surfaces chips and
Door/Blast bullets. Use up to three implementation bullets only when the proof does not explain the mechanism.

**Root cause (bugfix PRs only).** A PR is a bugfix when the branch starts
with `fix/`, `fix-`, or `hotfix/` (also after `<user>/`), the PR title or the
FIRST commit subject after the merge-base has the `fix:` / `fix(<scope>):`
conventional prefix, the linked issue is labeled `bug`, or
ship-it was entered from a `/vs-bugfix` handoff. For a bugfix, add one line
after the STE scenario (and after the Refs/spec line): `Root cause: <mechanism>`
— what in the code made the bug happen, at least 4 words, never a `<…>`
placeholder or TBD/TODO/unknown/N/A. From a `/vs-bugfix` handoff, reuse its
`**Root cause:**` sentence as is. The root-cause sentence explains the failure
mechanism; proof and implementation bullets explain the repair. The scenario itself still has no How.
Non-bug PRs skip the line. `pr-media-gate.mjs` auto-detects a bugfix from the
head branch, `--title "<PR title>"` (ship-it always passes it), or the first
commit subject; later `fix:` commits (CI repairs, review fixes) never count; pass `--bugfix` for a bug-label or vs-bugfix
handoff, and `--bugfix=false` only when a `fix` name is not a bug fix.
A repo template with no Change and proof heading: put the scenario and
Root cause in its description section. Preserve template headings and pass the
template to the gate; if the gate needs a semantic heading, append Change and
proof unless the template forbids extras. Never misclassify a real bugfix just
to bypass its root-cause check.

Examples (either perspective; pick one for the PR):

- System: Agent sends `POST /api/assistant/preview` → request fails → only a browser Firebase Auth session works.
- User/admin: Admin needs an agent to call Playground preview → agent has no browser session → call is blocked.

Make the description visual first. A reviewer should see matched
Before/After proof (Endpoint / Schema / UI) before reading mechanism prose, and
anything enumerable goes in bullets, a table, or a code block instead of a
paragraph — no prose walls anywhere in the body. Keep key-hunk `diff` short;
fold longer captures into details.

Every PR description must include **Before** and **After**:
compare the same actor, input, and precondition, then state the concrete result
on each side and why the difference matters. Choose the proof shape from what
actually changed:

| What changed | Proof to embed |
| --- | --- |
| Static UI state | Matched screenshots at the same viewport and data |
| Functional UI behavior, including clicks, timing, dragging, multi-step interaction | Matched Before/After screenshots plus short Before/After videos of each flow |
| CLI, API, log, or error output | Paired output blocks copied verbatim from the same input |
| A command, flags or args, config, or a small code snippet | One fenced `diff`, never separate Before and After blocks (see Text diffs) |
| Endpoint, handler, or RPC behavior | **Endpoint** label, then one request and both responses to that same request (see Endpoint and schema proof) |
| Schema, migration, or wire contract | **Schema** label, then a fenced `diff` of the resulting shape before and after |
| HTML prototype or interactive demo | A hosted link the reviewer can click (see Prototype links) |
| Numbers such as latency, size, count, rate | A table that shows both operands beside any derived figure (`240 ms → 90 ms`, not a bare `2.7× faster`) |
| Multi-hop control or data flow, ordering, topology | Optional: a fenced `mermaid` diagram of the changed path, only when it shows what bullets and the key hunk do not; never redraw one before/after decision |
| A decisive logic change | A fenced `diff` block of the key hunk, trimmed to the lines that carry the change |

**Text diffs.** When the change itself is text (a command, flags, config, a
short snippet), write `**Before** <old> **After** <new>` on one line (the gate
needs both labels), then one `diff`. Split long lines one flag, arg or key per
line, flag and value together (`\` continuations for commands), so `-`/`+` mark
only what changed and the rest stays context. When an edit moves a trailing
`\` or JSON comma, mark that neighbor line too. UI and user-visible output keep
the separate Before and After proof.

**Before** loads user and project settings. **After** loads user settings only.

```diff
 claude --print --output-format stream-json \
-  --setting-sources user,project \
+  --setting-sources user \
   --no-session-persistence
```

Put **Source-derived** after the diff, never inside the Before/After label.

Prefer a compact comparison table for several outcomes. Neither a table nor a
Mermaid diagram replaces evidence. Label source-derived comparisons
**Source-derived**, not observed or tested.

Borrow the discipline of the explaining skills and apply it inline; do not
spawn them as shipping phases. From `vs-before-after`: same setup on both
sides, each claim labeled observed, tested, or source-derived, and the relevant
behavior that intentionally stayed the same. From `vs-show-me`: conclusion
first, structure drawn as a diagram rather than described, and no metric or
status the evidence does not contain. From `vs-eli5`: when the mechanism is not
obvious, one familiar analogy mapped to the real parts, not a glossary.

Write the PR body prose in `vs-write` STE mode. The reviewer reads risk,
the problem, the proof, and remaining gaps once, under time pressure. Pointer
only: [../../vs-internal-shared/references/ste-writing.md](../../vs-internal-shared/references/ste-writing.md). Before
`gh pr create`, run `node skills/vs-write/scripts/check-ste.mjs "$BODY_FILE"`.
Exit 1: split or rewrite the reported sentences, then run it again. Code,
output blocks, tables, and technical names stay exactly as they are.

Keep the first screen short. Fold anything longer than about twenty lines — a
full output capture, a wider diff, a second video — into
`<details><summary>…</summary></details>` so the proof stays above the fold.
Never paste the whole diff; the Files tab already has it. The first screen
answers what was wrong, why this repair is appropriate, and what visibly
changed. Use this structure:

````markdown
<feature_area>: <Title> (80 chars max; this line is the `--title`, and the
body file starts at the TL;DR)

**TL;DR**
<what changes, for whom — one short plain line>
<the effect or result — one short plain line>

## Review map

<img alt="Two-way door: easy to revert" src="https://raw.githubusercontent.com/vltansky/vs/master/skills/vs-ship-it/assets/badge-two-way-door.svg"> <img alt="Narrow blast radius: contained" src="https://raw.githubusercontent.com/vltansky/vs/master/skills/vs-ship-it/assets/badge-narrow-blast.svg">
<img alt="Surface: Endpoint · 2 modules" src="https://raw.githubusercontent.com/vltansky/vs/master/skills/vs-ship-it/assets/badge-surface-endpoint-2.svg">

<!-- Pick matching risk badges. Omit Surfaces when paths prove no product surface
     (skill-only / docs-only); Infra only on infra-only PRs. -->
- **Risk:** <revert/recovery cost, who can break, adjacent surfaces untouched>
- **Scope:** <deployable modules; no file inventory>
- **Review:** <one or two paths and the human decision, omit for trivial changes>

## Change and proof

<Short STE100 scenario: actor → attempt → block; no How in the scenario.>

Refs #<N> · [Spec](https://github.com/<owner>/<repo>/blob/<HEAD_SHA>/<spec path>)

Root cause: <mechanism that made the bug happen>

<!-- Issue/spec only when found; root cause only for bugfixes. -->
**Before** <same-state setup and what to notice>

<img src="<hosted-before-screenshot>" alt="Before: <result>" width="<260 portrait | 800 landscape>" />

<hosted-before-video-URL on its own bare line for functional UI changes>

**After** <same-state setup and what changed>

<img src="<hosted-after-screenshot>" alt="After: <result>" width="<260 portrait | 800 landscape>" />

<hosted-after-video-URL on its own bare line for functional UI changes>

<!-- For API/CLI use paired captured output; Schema, commands, config and
     snippets use one fenced diff.
     Label source-derived evidence. Screenshots and videos are not substitutes. -->
- <one to three implementation facts the proof does not already explain>

## Verification

- **Automated:** `<command>` — <result; reuse fresh checks>
- **Coverage:** <changed tests grouped by behavior; deleted guards included>
- **Not covered:**
  - [ ] <action the reviewer runs> — <expected result>
- **Still unverified:** <exact blocker, only when one remains>

<!-- Red checks only: list each failed check once, using its evidence class.
  - New: `<check>` — <failure> ([base run](<base run URL>))
  - Already failing on base: `<check>` — <failure> ([base run](<base run URL>))
  - Environment: `<check>` — <allowlisted reason and log line>
  - Unknown: `<check>` — <why no baseline>
-->

<!-- From the diff only; no new runs. About 5 lines max for coverage and gaps.
     No manual gaps: **Not covered:** none. No tests changed: warn here.
     Fold long output, real alternatives, rollout and multi-area Walkthrough
     only when they add review value. -->
````

Drop any optional VS sample row or block the evidence does not fill; an empty
diagram or a table of one row is worse than prose. **Merge risk** is not
droppable: it is how the reviewer decides how much attention this PR deserves.

Classify merge risk from the scoped diff, never from the change's intent:

| Signal in the diff | Door | Reason |
| --- | --- | --- |
| Schema migration, data backfill, destructive write, deletion | One-way | Reverting the code does not revert the data |
| Published artifact, release, public API or wire-contract change | One-way | Consumers pin the old shape |
| Auth/permission changes, billing writes, or side effects on send | One-way | The effect escapes before a revert lands |
| Behavior behind a flag, internal refactor, copy, styling, tests | Two-way | `git revert` restores the previous behavior |

Meanings stay literal. **Two-way** = easy to revert. **One-way** = hard to
reverse — review carefully. Never map one-way to "safe to merge". Blast radius
is a separate axis from the door: a two-way change can still have a wide blast.

State the blast radius as who breaks and how widely, not as a severity word:
one route, one command, every caller of a shared helper, every tenant. Name the
adjacent surfaces the change does **not** touch — the bounded half is what lets
a reviewer skip the rest. When the diff is one-way or broad, say what makes it
recoverable (flag, staged rollout, backup, reversible migration) or state that
nothing does. Use compact Risk and Scope bullets beneath the badges. If the classification is
uncertain, write the uncertainty rather than the reassuring guess.

### Merge-risk badges

Under **Review map**, place the matching door and blast badges together on one
line, then the surface chips on one line. Supporting **Risk**, **Scope**, and
**Review** bullets explain the labels once. No separate Merge risk or Surfaces
section is emitted. Keep the existing catalog URLs and accessible alt text.

Door / Blast catalog (committed under `skills/vs-ship-it/assets/`, generated by
`scripts/generate-badges.mts`):

| Badge | When | File | Alt |
| --- | --- | --- | --- |
| Two-way door | Door is two-way | `badge-two-way-door.svg` | Two-way door: easy to revert |
| One-way door | Door is one-way | `badge-one-way-door.svg` | One-way door: hard to reverse — review carefully |
| Wide blast | Blast radius is wide / many consumers | `badge-wide-blast.svg` | Wide blast radius: many consumers |
| Narrow blast | Blast radius is narrow / contained | `badge-narrow-blast.svg` | Narrow blast radius: contained |

Each badge carries its own background, so one file reads in GitHub light and
dark mode; no `<picture>` pair is needed. Use stable `raw.githubusercontent.com`
URLs against the master path:

`https://raw.githubusercontent.com/vltansky/vs/master/skills/vs-ship-it/assets/<file>`

PR description bodies on github.com do not reliably resolve relative repo paths,
so prefer these absolute raw URLs. They render after the assets land on
`master`. Embed the door badge that matches the door classification; embed the wide-blast
badge only when blast is wide, and the narrow-blast badge otherwise. Door and
Blast badges classify risk and are not visual proof: `pr-media-gate.mjs` does not
count them (Surfaces chips are also excluded from media counts). Do not invent
other badges or hand-edit the SVGs; change the generator and rerun it.

### Surfaces

Surfaces are proof selectors **plus** a deployable-module inventory — not risk art. Door and Blast own merge risk; Surfaces never replace them. Omit Surfaces
when paths prove no product surface and the PR is not solely Infra (skill-only /
docs-only) — never invent a product stamp to fill the section. No separate
**Affected modules** section: chips + scope bullets live under `## Review map`.

Shape (locked):

1. Kind-colored SVG chips on **ONE line** (space-separated `<img>`s).
2. The **Scope** bullet names the **deployable modules**, grouped if useful.
   Optional `(Endpoint)` / `(Schema)` / `(UI)` / `(CLI)` / `(MCP)` / `(Infra)` tags.

**Count on chip** = number of distinct deployable modules for that kind (not
severity, files, or blast). Emit `badge-surface-{kind}-{n}.svg` for
`kind ∈ endpoint|schema|ui|cli|mcp|infra` and `n = 1..6` (black body, kind
accent strip, kind-colored count pill). Raw master URLs match door/blast:

`https://raw.githubusercontent.com/vltansky/vs/master/skills/vs-ship-it/assets/badge-surface-<kind>-<n>.svg`

Surfaces catalog (same generator):

| Kind | Color | File pattern | Alt |
| --- | --- | --- | --- |
| Endpoint | `#1a7f64` teal | `badge-surface-endpoint-{n}.svg` | Surface: Endpoint · n modules |
| Schema | `#8250df` purple | `badge-surface-schema-{n}.svg` | Surface: Schema · n modules |
| UI | `#0969da` blue | `badge-surface-ui-{n}.svg` | Surface: UI · n modules |
| CLI | `#57606a` slate | `badge-surface-cli-{n}.svg` | Surface: CLI · n modules |
| MCP | `#0e8a7d` teal-green | `badge-surface-mcp-{n}.svg` | Surface: MCP · n modules |
| Infra | `#c2530a` orange | `badge-surface-infra-{n}.svg` | Surface: Infra · n modules |

Vocabulary (locked): **UI · Endpoint · Schema · CLI · MCP**. Infra only when the PR is solely CI/deploy/flags/env — never stack with a product surface. Names
lock: Endpoint not backend; Schema = wire + persistence (no separate DB). Never invent backend/DB surface names or hand-edit chip SVGs — change
`scripts/generate-badges.mts` and regenerate.

Wrapper precedence: MCP wrap of unchanged route → MCP only; CLI shim of unchanged MCP → CLI only. Multi-select when paths match more than one class.
`pr-media-gate.mjs` asserts claim↔path from Surfaces chips and optional kind
tags: any stamped product surface without a matching path class fails
(skill-only + Schema included); migration-only ≠ UI; MCP-wrap-only ≠ Endpoint;
Infra+product fails; Infra without infra paths fails; stamping backend/DB fails;
>3 product surfaces without matching path classes fails.

CLI and MCP proof blocks are Later — this cut only selects those surfaces; do
not invent paired CLI/MCP contract blocks yet. Endpoint/Schema proof stays the
current fenced Before/After primary.

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
directly under **Before**/**After**. Response JSON written from source rather
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
  coverage bullets inside `## Verification`. Write one line per behavior:
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
  no boxes. Never tick a box yourself.
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

Only `vs-explain-pr` writes it, after the PR is open:

```markdown
<!-- vs:video -->
<details>
<summary>Video explainer (61 s)</summary>

Narrated walkthrough of this PR: problem, example, change, risk. made for `abc1234`; not reviewed by fresh eyes. The proof is in Change and proof above.

https://github.com/user-attachments/assets/<id>

</details>
<!-- /vs:video -->
```

It sits after Verification and before the Walkthrough. `pr-media-gate.mjs`
cuts it before every check: its video is not Before/After proof and never
counts toward the screenshot or video pairs. Do not write it by hand, and keep
it as it is when you refresh the body.

### Walkthrough

Only include a Walkthrough when the change crosses multiple architectural areas.
Supporting tests, docs, ADRs, lockfiles and release metadata do not create an
architectural area by themselves; count independent behavior/ownership boundaries.
Omit it for a single-area change; file count is not the trigger. There is no size gate and no child agent: ship-it writes it
from the scoped diff while it writes the rest of the body, with no extra runs.

- **Collapsed:** `<details><summary>Walkthrough: N areas, M files</summary>`
  … `</details>`, the last block of the body, after Verification. Nothing follows it.
  N counts groups; M counts changed files.
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
`none`, before updating. When that rerun reports the TL;DR missing or invalid
(breaking since 1.24.0), write two TL;DR lines from the existing body — the problem and result
from the existing description — prepend them
above everything else, rerun the gate, and update only when it passes. A body whose links pin an old head is a stale body.
