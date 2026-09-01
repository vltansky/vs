---
name: vs-show-me
description: "Use when the user wants a complex topic explained or shown visually — a system, flow, architecture, or tradeoff; a proposal, RFC, design doc, decision brief, comparison, timeline, report, or dashboard; or asks to create, render, or edit an HTMDX artifact. A page of diagrams, metrics, and structured components replaces a wall of chat text. Produces one portable HTML file with editable HTMDX source."
---

# Show me

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
- a browser-local review overlay for text and element comments;
- feature-detected WebMCP tools that operate on those same comments;
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

`--definitions` renders the catalog to read it, so it needs Node 22 or newer —
below that the call dies on `ReferenceError: navigator is not defined` before
printing anything. Rerun the same command through a newer runtime rather than
dropping the flag, since dropping it silently costs you the catalog:

```bash
fnm exec --using=24 -- npx -y @wix/htmdx@4 skill --definitions ./assets/definitions.mjs
# or: nvm exec 24 npx -y @wix/htmdx@4 skill --definitions ./assets/definitions.mjs
```

Whichever runtime answers, keep using it for every later `htmdx` call in the
task — the lint step takes `--definitions` too and fails the same way.

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
     `~/.vs/$PROJECT_ID/vs-show-me/YYYY-MM-DD-<slug>.html`.
2. Pick the template shell by document kind:
   - [assets/artifact.html](assets/artifact.html) (`layout: vs`) for reports,
     briefs, and analyses — the default;
   - [assets/proposal.html](assets/proposal.html) (`layout: vs-proposal`) for
     proposals, RFCs, and design docs that argue for a decision. Its hero
     renders `title`, `project`, `owner`, `phase`, and `updated` from
     frontmatter — keep the body h1-free — and `phase` takes one of Draft,
     Proposed, Accepted, Rejected, or Superseded. Rejected and Superseded also
     render a notice band under the hero, so a dead proposal warns its reader
     before the lede; name the successor in the History section. The skeleton's
     section order (Problem → Proposal → Design details → Alternatives →
     Drawbacks → Rollout → Unresolved questions → Future possibilities →
     History → References) is the reviewer's reading order; drop a section only
     when it truly has nothing to say.

   Both carry the `vs` artifact metadata the other `vs` report skills share.
   Copy the complete shell; replace the title, frontmatter, and primary source
   placeholders. Generate a new UUID for `vs-artifact-id`; it is the artifact's
   stable browser-review identity and must not be reused when an existing
   artifact is copied into a new one. The shell's inline script is the browser
   copy of the vs catalog that the named layout renders through, plus the local
   review overlay — keep both intact.
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
5. Before drafting, sketch a visual plan in working notes. Name the important
   information shapes — relationship, state, sequence, comparison, hierarchy,
   or spatial arrangement — and choose the clearest runtime primitive for each.
   Choose a visual thesis before component names: journey, fork, anatomy,
   stack, spectrum, or spatial map. An equal card grid is not a composition and
   is not the default. Establish one focal element and a clear hierarchy; use
   asymmetry, scale, overlap, or directional placement only when it explains
   importance, containment, progression, or choice.
   In explanation mode, give the core mental model two visual layers: a map of
   the mechanism and one purpose-built composition that makes its roles, state,
   or spatial logic recognizable at a glance. Build that composition from
   shadcn primitives for a familiar interface pattern, or Tailwind with
   allowlisted HTML for a bespoke mock, layered system, or state view. For a
   familiar UI explanation, combine at least two distinct shadcn primitives in
   one composition; Tailwind is not a substitute there. A lone `Badge`,
   decorative card, or second rendering of the same facts does not count. This
   is a quality bar, not a component quota: reports, proposals, and
   genuinely one-shape explanations should not gain extra chrome. Use spatial
   position only when it carries meaning, and let different information shapes
   use different visual languages within one artifact.
6. Draw structure as diagrams, not text. The runtime renders fenced
   ` ```mermaid ` blocks natively, so anything with branches, cycles, or
   topology — flowcharts, state machines, architecture graphs, ER diagrams —
   belongs in one; never ASCII-art a diagram or describe one in prose. The
   catalog's `Flow`, `Sequence`, and `Tree` cover only their strictly linear
   or hierarchical grammars; when the shape outgrows them, switch to mermaid
   rather than forcing the component.
7. Compress the prose. The artifact is a review surface, not a transcript:
   keep the lede to two sentences, one idea per paragraph and at most three
   sentences each, and route anything enumerable — options, risks, scope,
   metrics, steps — through a component instead of paragraphs. A paragraph
   that packs three or more `**Label:**` runs is not prose at all, it is a
   record with fields: put it in `Catalog` or another component. When the same
   labels repeat across many items, a section per item is the wall of text —
   one `Catalog` holds twenty records the reader can scan, twenty `###`
   sections hold none. Sections carry
   budgets too: a problem statement in two to five short paragraphs that links
   background instead of restating it, one sentence per non-goal, one short
   paragraph per alternative and per risk, one or two sentences per open
   question — and remove a question once it is answered. After drafting, make
   one pass that challenges every sentence: cut restated context, hedges, and
   narration. When a section still runs past one short screen, link the detail
   or drop it.
8. Populate components only from the sources. A metric, score, or status the
   sources do not contain is decoration, not evidence — leave a section lean
   rather than rounding it out with invented cards, filler grids, or secondary
   fact rows that restate the primary ones. Treat a gauge's maximum as a
   ceiling, not a target. Label the values that matter directly — on the
   point, the bar, the line end — and pair every color with a label or shape,
   so meaning never rides on color alone.
9. Remove every placeholder and unused section.

## Review comments

The rendered artifact supports human review without changing its canonical
HTMDX source. Select text and choose **Comment** to write feedback, **Remove**
to request its removal, or **What?** to request a clear, plain-language rewrite.
The shortcuts record anchored requests; they do not mutate the source. Open **Comments** and
choose **Add comment** to comment on an element. Mark comments resolved or
reopen them from the panel; numbered markers return to their anchors.

Comments persist in `localStorage`, scoped to the artifact ID. Moving the same
artifact to another URL on the same origin keeps its comments; separate IDs
cannot share them. Legacy artifacts without an ID fall back to their URL
without its fragment. Comments do not travel with the HTML or sync to
another browser. Use a shared review system when feedback must be shared or
durable. This boundary is intentional: the artifact remains one portable
authored file while local feedback stays outside its source.

In browsers with `document.modelContext`, agents use the same local review
state through three WebMCP tools:

- `list_review_comments` returns IDs, intents, statuses, and anchor summaries;
- `add_review_comment` anchors feedback to a CSS selector or unique text
  inside it;
- `resolve_review_comment` resolves or reopens a comment by ID.

Comments do not trigger an agent turn. After leaving feedback, the user must
send the agent a message asking it to read the comments; the agent then calls
`list_review_comments` and acts on the returned open items.

Treat `remove` and `simplify` intents as requested source changes: edit the
canonical HTMDX, render it again, and resolve the request only after the new
artifact reflects it. For `simplify`, apply
[vs-write](../vs-write/SKILL.md) in Direct mode: lead with the main point, use
familiar words and short sentences, explain necessary terms, and preserve the
source's meaning, facts, and important details.

## Authored WebMCP tools

Do not register a tool merely to read the artifact—the source and rendered page
already carry that value. Register one when an authored interaction can shorten
a real feedback loop: choosing X or Y, accepting a bounded proposal, or
returning structured input the agent will act on.

Use the shell's generic `window.vsArtifact.registerTool(tool)` registry from an
authored `<script data-vs-webmcp>` after the generated review script. Build the
human control first, then connect its event and the WebMCP tool's `execute` to
the same handler. The handler must validate input, update the visible UI, and
return the recorded result; never create a second agent-only state path.
Initialize controls on `htmdx:rendered` because the source renders
asynchronously; registering the tool itself does not need to wait.

```js
const choose = ({ choice }) => {
  if (!['X', 'Y'].includes(choice)) throw new Error(`Unknown choice: ${choice}`);
  renderChoice(choice); // The human buttons call this same handler.
  return { choice, status: 'recorded' };
};
const registration = window.vsArtifact.registerTool({
  name: 'choose_retry_policy',
  description: 'Choose the retry policy shown in the artifact.',
  inputSchema: {
    type: 'object',
    properties: { choice: { type: 'string', enum: ['X', 'Y'] } },
    required: ['choice'],
    additionalProperties: false,
  },
  execute: choose,
});
void registration.ready.catch(() => {}); // The human control still works.
```

The registry feature-detects `document.modelContext` and ties registration to
the artifact lifetime. Keep names stable and action-oriented. Do not use custom
artifact tools for secrets or destructive external actions; those still need
normal confirmation outside the artifact. Preserve any authored
`script[data-vs-webmcp]` when editing an existing artifact.

Do not add a polyfill or a second comment store: an agent-created review comment
must appear in the human panel and persist by the same rules.

## Expressive range

The catalog is the default voice, but the runtime gives an artifact more range
when a section needs it:

- **Compose the shadcn pack.** The runtime ships its component pack already;
  load the `components` topic and combine primitives when they make a concept
  immediately recognizable. A `Card` can frame one actor or state, a `Badge`
  can label status, and `Progress`, `Alert`, or `Tooltip` can express a real
  value, warning, or aside. A shadcn scene combines at least two distinct
  primitives; raw HTML styled like cards does not exercise the component pack.
  Start from the relationship the reader must see, then place the components
  inside that composition: for example, one dominant active state can lead to
  smaller outcomes instead of four equal state cards. Compose one explanatory
  scene rather than sprinkling isolated widgets through the page. Do not add
  controls that imply
  behavior the artifact does not provide, and keep sequential reading in
  ordinary sections instead of hiding it behind interactive chrome.
- **Tailwind is live.** Every artifact loads `@tailwindcss/browser@4`, so any
  utility class works on the `class` of components and allowlisted HTML —
  arbitrary values included (`grid-cols-[240px_1fr]`, `max-w-[52ch]`). Reach
  for the theme's own hierarchy first; utilities are for the layout or emphasis
  the catalog does not cover. When a mock or SVG needs categorical color, use
  the theme's series tokens (`var(--vs-series-1)` … `var(--vs-series-6)`) in
  order rather than hand-picking hexes — they are the palette every chart on
  the page already speaks.
- **Tooltips are declarative.** Put `data-tip="text"` on any allowlisted
  element for a hover-and-focus tooltip — add `tabindex="0"` so keyboard
  readers reach it too. It is for the aside a label has no room for (a
  definition, a source, an exact figure); content the reader must see stays
  in the visible body, never only in a tooltip.
- **Icons are inline lucide.** `<i data-vs-icon="chart-line"></i>` renders the
  named [lucide](https://lucide.dev) icon at text size in the current color —
  in prose, headings, table cells, and mocks. Icons are decorative by default
  (hidden from screen readers), so keep the adjacent text self-sufficient.
  This is the sanctioned pictogram: an icon, never an emoji.
- **Mock UIs are markup.** To explain a screen, a widget, or a layout idea,
  build a one-off mock from allowlisted HTML (`div`, `section`, `figure`,
  `span`) styled with Tailwind, directly in the body. No registration, no
  screenshot of a thing that does not exist — the mock lints, renders, and
  stays editable. When the mock depicts a real product, style it in that
  product's own colors, type, and chrome — the artifact theme is the report's
  voice, not the product's — and show one realistic state instead of an
  invented dashboard. Type is the one thing you must set yourself: a mock
  inherits Space Grotesk, the report's own display sans, so give it the
  product's face with `style="font-family: …"` or it reads as the report
  wearing a screenshot's layout. Promote a mock into `assets/definitions.mjs`
  only when a second artifact needs it.
- **Generated images embed.** When a picture explains better than markup — an
  illustration, a produced chart, a captured screenshot — generate it and embed
  it with `![alt](...)` or `<img>`: a file saved next to the artifact (relative
  path) or a `data:image/...` URI (png, jpeg, gif, webp, avif, svg+xml). Every
  image needs alt text. Keep embeds small — downsample screenshots and prefer
  webp or avif over png; a multi-megabyte data URI makes the one-file artifact
  sluggish to open, mail, and diff. Place each image with the claim it
  supports: a screenshot in `Figure` next to the paragraph it proves, or a
  thumbnail row inside the `Catalog` record it belongs to. A separate section
  of screenshots forces the reader to hold twenty claims in their head and
  scroll back — if the images really are one set to compare, that is `Gallery`,
  not a run of `Figure` blocks under their own headings.
- **Draw with SVG.** Author the SVG yourself for anything mermaid's grammars do
  not cover — an annotated sketch, a custom glyph, a spatial layout. Inline
  `<svg>` is not allowlisted and stays literal text, so embed the drawing as a
  `data:image/svg+xml` image or an `.svg` file beside the artifact. Note that
  an SVG inside `<img>` cannot load external fonts — inline the shapes or
  accept the fallback face.

## Edit

Treat the source block as the canonical document.

1. Confirm the file contains exactly one `script[type="text/htmdx"]`. A legacy
   `template[type="text/htmdx"]` artifact may be edited in place without
   migration.
2. Preserve the doctype, runtime pin, shell markup, review overlay,
   `vs-artifact-id`, source container, and its attributes. If a legacy artifact
   has no ID, add a new UUID once before editing it.
3. Edit only the source block. The text inside the existing `<title>` may also
   change when needed to keep the browser title accurate.
4. Preserve the artifact's current runtime and component contract. Do not
   silently upgrade an existing artifact.
5. Hold new or rewritten content to the Create compression bar — challenge
   verbosity instead of matching the length of what is already there.

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

3. Check the prose against the Create budgets. The checker reads only the
   source block's paragraphs — components, code, and lists are exempt — and
   reports each overrun with its line number:

```bash
node assets/check-verbosity.mjs "$ARTIFACT_PATH"
```

Exit `0` is within budget, `1` lists overruns, `2` means it never ran. An
overrun is a prompt to compress or link, not a hard failure — when a long
paragraph is genuinely irreducible, say so in the handoff instead of padding
around the checker.

4. Score the authored paragraph prose with `/vs-write` reject-slop.
   The runner extracts the same source-block paragraphs
   `check-verbosity.mjs` uses — frontmatter, headings, lists, tables,
   code, and component bodies are exempt — then execs
   `../vs-write/scripts/reject-slop.mjs`. This is the slop lock, not
   another length check. `layout: vs-proposal` /
   [assets/proposal.html](assets/proposal.html) is an HTMDX write, so
   the same runner covers proposal copy.

```bash
node scripts/run-write-slop.mjs "$ARTIFACT_PATH"
```

Exit `0` is clean. Exit `1` means rewrite the tells — do not handoff.
Exit `2` means it never ran; treat 2 as not checked, not a pass. Do
not claim `READY_FOR_REVIEW` if this runner did not run or exited 1.

Score the page pass with `skills/vs-show-me/scripts/run-write-slop.mjs`
(identity `76955fec80dace5a96afcc65d9c694ee044349c8646b62899496a53eb2061e08`;
exit 1 is a fail). Exclusive is the live `skills/vs-show-me/SKILL.md` path
or a published skill-bytes pair. Exclusive cases live under
`test/fixtures/write-slop`.

5. Render the saved file and confirm it compiled. An artifact is a thing the
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

6. Check the artifact's visual evidence. A report about something visible that
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
- `URL:` the rendered localhost or https URL when one is available; otherwise
  the openable `file://` fallback
- `Shot:` the attached first-screen image, or `Shot failed: <reason>`
- `Source:` the inputs used
- `Verified:` structural checks and, separately, rendered browser proof
- `Status: READY_FOR_REVIEW`

Do not echo the file body into chat. Do not commit unless the caller or user
requested a commit.

## First-screen shot

This skill owns capture. After the artifact is saved, the same user-facing
reply must include an openable URL **and** an attached first-screen shot.

1. When the host has a native browser panel, serve the artifact over localhost
   with an available static preview server and open the resulting HTTP URL as a
   Browser target. In Codex Desktop, pass the URL to `open_in_codex` with target
   type `browser`. Do not open the HTML as a file/editor tab; that shows its
   source instead of the rendered UI.
2. Keep the preview server alive for the user's review, then stop it when the
   review interaction ends. If the browser panel or a localhost preview is
   unavailable, say why and fall back to the openable `file://` URL; do not skip
   presentation silently.
3. Render the first screen and screenshot above the fold.
4. Attach that image in the same reply as the URL.

If the shot fails: still send the URL. Say `Shot failed:` plus the reason.
Do not block the handoff. Callers inherit this section; they do not restate
it. Score handoffs with `skills/vs-show-me/scripts/reject-htmdx-handoff.mjs`
(identity `785c48021f874e6ec5b61cbdd4919886a2c003c1ad14d12426c9f1080ca0a217`;
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
