# Rich human-facing artifacts

Markdown is the default. Choose HTMDX only when visual structure materially
changes how a person reviews the result or makes a decision, such as:

- comparing several entities across several axes;
- reviewing multiple screenshots, before/after states, charts, or timelines;
- navigating dense, cross-linked evidence.

Length or complexity alone is not a reason to use HTMDX. Keep routine prose,
short reports, implementation plans, and machine-consumed state in Markdown.
Use bespoke HTML/JavaScript instead when the artifact needs custom behavior that
the HTMDX component catalog cannot express.

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
