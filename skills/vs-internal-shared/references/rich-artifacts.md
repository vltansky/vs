# Rich human-facing artifacts

Decision rationale:
[Use HTMDX for rich human-facing artifacts](../../../adr/use-htmdx-for-rich-human-facing-artifacts.md).

Markdown is the default. Choose HTMDX only when visual structure materially
changes how a person reviews the result or makes a decision, such as:

- comparing several entities across several axes;
- reviewing multiple screenshots, before/after states, charts, or timelines;
- navigating dense, cross-linked evidence.

Length or complexity alone is not a reason to use HTMDX. Keep routine prose,
short reports, implementation plans, and machine-consumed state in Markdown.
Use bespoke HTML/JavaScript instead when the artifact needs custom behavior that
the HTMDX component catalog cannot express.

## Mermaid in Markdown

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

## Artifact contract

An HTMDX result is one `.html` file. It contains one editable
`<script type="text/htmdx">` source block and no Markdown twin. Downstream
agents read and edit only that source block. Use components only when they add
semantics; ordinary paragraphs and lists remain Markdown inside the block.

Use this shell and pin the runtime to an exact version:

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>[[TITLE]]</title>
    <script src="https://cdn.jsdelivr.net/npm/@wix/htmdx@2.2.1/dist/browser.js" defer></script>
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
Never use a floating runtime version such as `@latest`.

## Security boundary

The HTMDX source cannot execute JavaScript, but the browser runtime is external
code with DOM access. Do not put credentials, secrets, or PII in an artifact.
For a sensitive or internal report, use a trusted local mirror of the pinned
runtime; if none is available, remain in Markdown.
