---
name: vs-htmdx
description: "Use when the user asks to create, visualize, render, or edit an HTMDX artifact, or wants a decision brief, comparison, timeline, report, or dashboard delivered as HTMDX. Produces one portable HTML file with editable HTMDX source."
---

# HTMDX

Turn source material into one visual artifact that a human can review in a
browser and an agent can edit without touching generated markup.

This is a **building block**, not a research workflow. Preserve the supplied
facts and conclusions. If the content is still unknown, gather it with the
appropriate workflow first.

## Boundary

Use this skill when the user explicitly requests HTMDX or when HTMDX is the
requested delivery format. For an unqualified request to "visualize" a complex
relationship, use the host's visualization capability instead. For routine
prose, plans, and machine-consumed state, use Markdown.

An HTMDX deliverable is:

- one portable `.html` file;
- one editable `<script type="text/htmdx">` source block;
- a pinned browser runtime;
- no generated HTML body and no Markdown twin.

## Load the guidance

The component catalog, body grammar, and diagnostics are versioned with the
runtime, so read them from the runtime rather than from memory. Run this before
authoring, editing, or reviewing any HTMDX:

```bash
npx -y @wix/htmdx@4.11.0 skill
```

When editing a file that already pins a runtime, read the guidance from *that*
version instead, so it matches what the artifact actually loads:

```bash
npx -y @wix/htmdx@<pinned-version> skill
```

Follow that output as the source of truth for the artifact contract, component
choice, body grammar, attributes, and the CLI. Load a companion topic when the
task calls for it, at the same version that answered the first call:

```bash
npx -y @wix/htmdx@4.11.0 skill --list          # available topics
npx -y @wix/htmdx@4.11.0 skill components      # body grammar per component
npx -y @wix/htmdx@4.11.0 skill integration     # React host, registration, testing
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
2. Start from [assets/artifact.html](assets/artifact.html), which carries the
   `vs` artifact metadata the other `vs` report skills share. Copy the complete
   shell; replace the title, frontmatter, and primary source placeholders.
3. Keep `@wix/htmdx@4.11.0` pinned in both the renderer metadata and script URL.
   Every `vs` template pins one version — do not diverge from it for a single
   artifact.
4. Build a reading sequence:
   - conclusion first;
   - decisive metrics, comparison, or timeline second;
   - evidence and caveats next;
   - detailed reference material last.
5. Remove every placeholder and unused section.

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
npx -y @wix/htmdx@4.11.0 lint "$ARTIFACT_PATH" --strict
```

Exit `0` is clean, `1` means problems were found, and `2` means the check never
ran — do not read a `2` as a pass. Fix the first error and re-run; one
malformed body can mask the diagnostics after it, so a clean run is the only
evidence that the file is clean. The `skill` output explains the flags and each
diagnostic code.

A `runtime-version-mismatch` finding means the linted version and the pinned
version disagree, so the results describe a runtime the artifact does not load.
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

## Handoff

Return:

- `Review question:` the question the artifact helps answer
- `Saved:` a clickable absolute path to the `.html`
- `Source:` the inputs used
- `Verified:` structural checks and, separately, rendered browser proof
- `Status: READY_FOR_REVIEW`

Do not echo the file body into chat. Do not commit unless the caller or user
requested a commit.

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
**Relevant:** `/vs-explain-diff`
