# Rich human-facing artifacts

Decision rationale:
[Use HTMDX for rich human-facing artifacts](../../../adr/use-htmdx-for-rich-human-facing-artifacts.md),
partly superseded by
[Deliver complex explanations in two layers](../../../adr/deliver-complex-explanations-in-two-layers.md).

Markdown remains the default for machine-consumed state and simple answers.
Choose HTMDX for a complex human-facing explanation when understanding depends
on any one of these structures:

- three or more interacting components, owners, states, or dependencies;
- a comparison across multiple choices and criteria;
- a causal, lifecycle, or ownership flow with at least three meaningful steps;
- reviewing multiple screenshots, before/after states, charts, or timelines;
- essential evidence or caveats that would push chat beyond one short screen.

Poor editing is not complexity: shorten repetition, narration, and loose prose
instead of creating an artifact to preserve them. Keep routine prose, short
reports, implementation plans, and machine-consumed state in Markdown.
Use bespoke HTML/JavaScript instead when the artifact needs custom behavior that
the HTMDX component catalog cannot express.

Follow
[`explanation-surfaces.md`](./explanation-surfaces.md) for the synchronized chat
TLDR, visual choice, useful-question gate, and artifact failure fallback.

## Mermaid in chat or Markdown

Use a small Mermaid diagram inside ordinary Markdown when relationships are the
main thing the user needs to understand: three or more interacting components,
parallel workstreams, a multi-step handoff, or meaningful state transitions.
Prefer a flowchart for ownership and dependencies, a sequence diagram for
runtime interactions, and a state diagram for lifecycle changes.

Keep the diagram evidence-backed and easy to scan: normally no more than eight
nodes, one idea per node, quoted labels when they contain punctuation, and prose
immediately before it stating the conclusion. Skip Mermaid for a single fact, a
simple file list, or a linear two-step change. Mermaid complements the Markdown
explanation; it does not trigger HTMDX or replace the source-of-truth artifact.

HTMDX renders fenced Mermaid blocks natively. When HTMDX is the review surface,
use a Mermaid fence for anything that branches, cycles, or fans out, and the
smallest fitting HTMDX component for linear or tabular relationships.

For claims about visible product behavior, use screenshots rather than a
diagram. Use generated images only for a mental model or metaphor that Mermaid
or factual components cannot teach cleanly; never use them as technical evidence
or proof that a product state exists.

When the deliverable is HTMDX, inherit the URL + first-screen shot handoff
from [`../../vs-htmdx/SKILL.md`](../../vs-htmdx/SKILL.md). Pointer only;
`/vs-qa` and other report skills follow this file rather than restating
that capture contract.

## Artifact contract

An HTMDX result is one `.html` file. It contains one editable
`<script type="text/htmdx">` source block and no Markdown twin. Downstream
agents read and edit only that source block. Use components only when they add
semantics; ordinary paragraphs and lists remain Markdown inside the block.

Use this shell and pin the runtime to the HTMDX major line:

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>[[TITLE]]</title>
    <script src="https://cdn.jsdelivr.net/npm/@wix/htmdx@4/dist/browser.js" defer></script>
  </head>
  <body>
    <!-- prettier-ignore -->
    <script type="text/htmdx" data-htmdx-edit-instruction="Edit only this script content. HTMDX format.">
---
title: [[TITLE]]
updated: [[YYYY-MM-DD]]
---

<ExecutiveSummary>
[[CONCLUSION]]
</ExecutiveSummary>
    </script>
  </body>
</html>
```

Prefer `MetricStrip`, `DataTable`, `Compare`, `Timeline`, `Evidence`, and
`RiskTable` for their named jobs. Do not add components merely for decoration.
Never use an unpinned runtime such as `@latest`: it can cross a major and change
the component set under a saved artifact. `@4` is a pin — `@wix/htmdx` promises
compatibility within a major and its publisher assigns a new minor on every
merge, so the major is the only version it can promise, and a saved artifact
picks up rendering fixes without being rewritten.

The guidance ships with the runtime, so read it from the version this shell
loads rather than inferring a component from its name:

```bash
npx -y @wix/htmdx@4 skill
npx -y @wix/htmdx@4 skill components
```

It owns component names, body modes, and the compound-component and
angle-bracket rules. The component set differs between runtime versions, so a
tag that exists in one pin is a compile error in another; keep every pin in this
repo on one major line.

## Visual evidence

A report about something visible that shows no picture of it is not evidence —
it is a claim about a screen the reader cannot see. When the work produced or
could produce a capture, the artifact embeds it: a UI change carries before and
after, a rendered output carries the render, a broken state carries the break.
Describing the pixels in prose and skipping the image is the failure this rule
exists to stop.

Capture the whole page, not the fold. A viewport-sized capture cuts the content
off wherever the window ended, so a screenshot proving a fixed layout can end
mid-row and prove nothing about the rest. Use an element crop only when the
judgment is about that one element, and say so in the alt text.

Reference each image by a relative path from the artifact, and keep the files
in `screenshots/`, `assets/`, or `evidence/` beside it. An absolute path such as
`/Users/you/...` resolves under `file://` on the machine that wrote it and
breaks the moment the artifact is moved, served, or shared. Give every image
`alt` text that states what it proves, not what it depicts.

Check the saved artifact before presenting it:

```bash
node <resolved-vs-internal-shared-skill-directory>/scripts/check-visual-evidence.mjs "$ARTIFACT_PATH"
```

It reports references that do not resolve, absolute paths, evidence saved
beside the artifact that the artifact never shows, and captures whose exact
dimensions match a standard viewport — the shape of a shot cut off at the fold.
Exit `0` is clean, `1` means the artifact fails the contract, and `2` means the
check never ran. Pass `--require-images` when the report's subject is visual, so
an artifact that shows nothing fails instead of passing quietly.

## Security boundary

The HTMDX source cannot execute JavaScript, but the browser runtime is external
code with DOM access. Apply the boundary to the actual artifact content, not
merely to the subject or origin of the report. Redact credentials, secrets, PII,
and sensitive values from text, tables, and images. A sanitized artifact may use
the pinned remote runtime. If sensitive data must remain, use a trusted local
mirror of the pinned runtime; if none is available, remain in Markdown.

When a trusted local mirror is selected, replace the template's runtime `src`
before inserting report content. Confirm the resolved runtime is local, then
freeze the HTML shell; the edit-only-source-block rule applies after this setup.
Never place sensitive content into a template that still loads the remote
runtime.

Treat a local mirror as available only when the user or repository provides an
approved local URL or absolute path for an exact runtime build on the pinned
major line — a mirror serves one build, not a range. Do not
guess a mirror location or install one during report generation. Without that
configuration, use Markdown whenever sensitive data must remain.
