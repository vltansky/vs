---
name: vs-htmdx
description: "Use when the user asks to create, visualize, render, or edit an HTMDX artifact; asks for a proposal, RFC, design doc, decision brief, comparison, timeline, report, or dashboard; or asks to explain something complex, where a page of diagrams, metrics, and structured components beats a wall of chat text. Produces one portable HTML file with editable HTMDX source."
---

# HTMDX

Turn source material into one visual artifact that a human can review in a
browser and an agent can edit without touching generated markup.

This is a **building block**, not a research workflow. Preserve the supplied
facts and conclusions. If the content is still unknown, gather it with the
appropriate workflow first.

## Boundary

Use this skill when the user explicitly requests HTMDX, when HTMDX is the
requested delivery format, or when the deliverable is a proposal or a complex
explanation for a human — the two-layer contract in
[explanation-surfaces](../vs-internal-shared/references/explanation-surfaces.md)
makes an HTMDX page the review surface and keeps chat to a short TLDR. For
routine prose, plans, and machine-consumed state, use Markdown.

An HTMDX deliverable is:

- one portable `.html` file;
- one editable `<script type="text/htmdx">` source block;
- a pinned browser runtime;
- no generated HTML body and no Markdown twin.

## Load the guidance

The component catalog, body grammar, and diagnostics are versioned with the
runtime, so read them from the runtime rather than from memory. Run this before
authoring, editing, or reviewing any HTMDX, from this skill's directory:

```bash
npx -y @wix/htmdx@4 skill --definitions ./assets/definitions.mjs
```

`assets/definitions.mjs` is the vs catalog: the `vs` layout the artifact
template names, which lives here rather than in the runtime. `--definitions`
makes the CLI answer against it — without the flag the linter reports
`unknown-layout` on a working artifact, and the skill output omits the
catalog's `external` topic. The template inlines a browser copy of the same
catalog, so a saved artifact renders it with no extra file.

When editing a file that already pins a runtime, read the guidance from *that*
version instead, so it matches what the artifact actually loads:

```bash
npx -y @wix/htmdx@<pinned-version> skill --definitions ./assets/definitions.mjs
```

`--definitions` exists from 4.15.0. A pinned CLI that rejects the flag also
predates the vs layout — drop the flag there; those artifacts name
`layout: default` and lint without the catalog.

Follow that output as the source of truth for the artifact contract, component
choice, body grammar, attributes, and the CLI. Load a companion topic when the
task calls for it, at the same version that answered the first call:

```bash
npx -y @wix/htmdx@4 skill --list          # available topics
npx -y @wix/htmdx@4 skill components      # body grammar per component
npx -y @wix/htmdx@4 skill integration     # React host, registration, testing
```

A pin that exits `2` with `unknown command "skill"` predates the command.
Rerun with `@latest`, and say in the handoff that the guidance is newer than
the runtime the artifact pins. If neither call loads, report the exact failure
and stop — do not reconstruct the component catalog from memory.

## Start

State the artifact's review question in one sentence:

```text
Review question: <what should become easier to understand or decide?>
```

Then determine the mode:

- **Create:** turn supplied files, notes, or results into a new artifact.
- **Edit:** update an existing file containing `type="text/htmdx"`.

Read every source the user identifies before choosing a layout. Separate
verified facts from inference and preserve links, labels, units, dates, and
uncertainty.

## Create

1. Resolve the destination:
   - use the exact path when the user supplies one;
   - otherwise resolve `$PROJECT_ID` with
     [../vs-internal-shared/SKILL.md](../vs-internal-shared/SKILL.md) and write
     `~/.vs/$PROJECT_ID/vs-htmdx/YYYY-MM-DD-<slug>.html`.
2. Pick the template shell by document kind:
   - [assets/artifact.html](assets/artifact.html) (`layout: vs`) for reports,
     briefs, and analyses — the default;
   - [assets/proposal.html](assets/proposal.html) (`layout: vs-proposal`) for
     proposals, RFCs, and design docs that argue for a decision. Its hero
     renders `title`, `project`, `owner`, `phase`, and `updated` from
     frontmatter — keep the body h1-free — and `phase` takes one of Draft,
     Proposed, Accepted, Rejected, or Superseded. The skeleton's section order
     (Problem → Proposal → Design details → Alternatives → Drawbacks → Rollout →
     Unresolved questions → References) is the reviewer's reading order; drop a
     section only when it truly has nothing to say.

   Both carry the `vs` artifact metadata the other `vs` report skills share.
   Copy the complete shell; replace the title, frontmatter, and primary source
   placeholders. The shell's inline script is the browser copy of the vs
   catalog that the named layout renders through — keep it intact.
3. Keep `@wix/htmdx@4` pinned in both the renderer metadata and script URL.
   Every `vs` template pins one major line — do not diverge from it for a single
   artifact. The major is the pin: `@wix/htmdx` promises compatibility within a
   major and publishes a new minor on every merge, so a saved artifact picks up
   rendering fixes without being rewritten, while a major bump stays a decision.
4. Build a reading sequence:
   - conclusion first;
   - decisive metrics, comparison, or timeline second;
   - evidence and caveats next;
   - detailed reference material last.
5. Draw structure as diagrams, not text. The runtime renders fenced
   ` ```mermaid ` blocks natively, so anything with branches, cycles, or
   topology — flowcharts, state machines, architecture graphs, ER diagrams —
   belongs in one; never ASCII-art a diagram or describe one in prose. The
   catalog's `Flow`, `Sequence`, and `Tree` cover only their strictly linear
   or hierarchical grammars; when the shape outgrows them, switch to mermaid
   rather than forcing the component.
6. Remove every placeholder and unused section.

## Edit

Treat the source block as the canonical document.

1. Confirm the file contains exactly one `script[type="text/htmdx"]`. A legacy
   `template[type="text/htmdx"]` artifact may be edited in place without
   migration.
2. Preserve the doctype, runtime pin, shell markup, source container, and its
   attributes.
3. Edit only the source block. The text inside the existing `<title>` may also
   change when needed to keep the browser title accurate.
4. Preserve the artifact's current runtime and component contract. Do not
   silently upgrade an existing artifact.

If an `.html` file has no HTMDX source block, it is ordinary HTML. Stop and say
that converting it requires a new HTMDX artifact rather than an in-place edit.

## Verify

Before presenting the artifact:

1. Read back the saved file and confirm it answers the review question without
   inventing facts, and that no placeholder survived.
2. Lint the saved file at the version it pins. The linter reports every
   diagnostic in one pass with line and column, so it catches unknown
   components and props, invalid bodies, missing required props, disallowed
   HTML, and an unpinned runtime faster than reading for them:

```bash
npx -y @wix/htmdx@4 lint "$ARTIFACT_PATH" --strict --definitions ./assets/definitions.mjs
```

Exit `0` is clean, `1` means problems were found, and `2` means the check never
ran — do not read a `2` as a pass. Fix the first error and re-run; one
malformed body can mask the diagnostics after it, so a clean run is the only
evidence that the file is clean. The `skill` output explains the flags and each
diagnostic code.

A `runtime-version-mismatch` finding means the linted runtime and the pinned
major disagree, so the results describe a runtime the artifact does not load.
Change the `npx` version to match the pin rather than ignoring it.

3. Render the saved file and confirm it compiled. An artifact is a thing the
   user looks at, so a structural check alone does not establish that it
   renders. Linting is not rendering either: it reads the source without
   loading the runtime, so it cannot see a CDN that never responds, a pin whose
   raw tags degrade to visible text, or a referenced screenshot that is not on
   disk.

```bash
node assets/render-check.mjs "$ARTIFACT_PATH"
```

The runtime replaces the document with its own diagnostic page on failure, so
`Failed step: compile` or `Failed step: render` in the output names the exact
component and reason. Fix and re-run until it passes; each pass reveals one
error, so expect to iterate rather than assume the first fix was the last.

Exit `2` means the check could not run, not that the artifact is fine. Fall back
to the host's browser tooling, or open the `file://` path — no server is needed.
When nothing can render it, report structural validation as such and do not
claim rendered proof.

4. Check the artifact's visual evidence. A report about something visible that
   shows none of it renders and lints perfectly, so nothing above catches it:

```bash
node ../vs-internal-shared/scripts/check-visual-evidence.mjs "$ARTIFACT_PATH"
```

Add `--require-images` when the subject is visual. See the
[shared rich-artifact contract](../vs-internal-shared/references/rich-artifacts.md#visual-evidence)
for the embedding, capture, and path rules it enforces.

## Handoff

Return:

- `Review question:` the question the artifact helps answer
- `Saved:` a clickable absolute path to the `.html`
- `URL:` the openable `file://` or https URL
- `Shot:` the attached first-screen image, or `Shot failed: <reason>`
- `Source:` the inputs used
- `Verified:` structural checks and, separately, rendered browser proof
- `Status: READY_FOR_REVIEW`

Do not echo the file body into chat. Do not commit unless the caller or user
requested a commit.

## First-screen shot

This skill owns capture. After the artifact is saved, the same user-facing
reply must include an openable URL **and** an attached first-screen shot.

1. Build an openable URL: `file://` of the absolute `.html` path, or a
   host URL if one already exists.
2. Render the first screen and screenshot above the fold.
3. Attach that image in the same reply as the URL.

If the shot fails: still send the URL. Say `Shot failed:` plus the reason.
Do not block the handoff. Callers inherit this section; they do not restate
it. Score handoffs with `skills/vs-htmdx/scripts/reject-htmdx-handoff.mjs`
(identity `7f0d132a5da87497d26b5f7fa4b821422b7964472f2d28f4787bc0f260a56648`;
exit 1 is a fail). Exclusive cases live under `test/fixtures/handoff`.
`Shot:` is a real image path, or `Shot failed: <reason>`. `Shot: n/a` is not a shot.

## Flow Contract

- **Kind:** Building block
- **Inputs:** source material or an existing HTMDX artifact
- **Outputs:** one portable `.html` artifact
- **Status:** `READY_FOR_REVIEW | BLOCKED`
- **Consumers:** direct human invocation and workflows that need a rich deliverable
- **Skip conditions:** Markdown or a native visualization answers the question
  more directly

## Output style

Apply the [shared output style](../vs-internal-shared/references/output-style.md)
to every user-facing message.

## Workflow

Direct: emit **Next** only. Composed: return to caller.

**Prev:** research, analysis, or supplied source material
**Next:** done
**Relevant:** `/vs-eli5`
