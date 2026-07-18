# Use HTMDX for rich human-facing artifacts

- Date: 2026-07-18
- Related: [`skills/vs-internal-shared/references/rich-artifacts.md`](../skills/vs-internal-shared/references/rich-artifacts.md)

## Context

VS skills primarily communicate through Markdown. That remains the simplest and
most token-efficient format for routine prose, plans, and machine-consumed
state. Some outputs, however, are easier for a person to review as a structured
page: multi-project comparison matrices, screenshot-heavy regression reports,
and long-running progress dashboards.

Hand-written HTML gives those artifacts useful visual structure but costs more
tokens, mixes content with presentation code, and is harder for a later agent to
edit safely. HTMDX keeps Markdown-like source in one HTML file while providing a
constrained component catalog for tables, metrics, evidence, comparisons, and
timelines.

HTMDX also introduces two risks: agents may select it merely because a document
is long, and browser rendering depends on runtime code with DOM access.

## Decision

Markdown remains the default output format for VS skills.

Use HTMDX only when visual structure materially changes how a person reviews the
result or makes a decision. Qualifying cases include comparisons across several
entities and axes, multiple screenshots or before/after states, charts or
timelines, and dense cross-linked evidence. Length or complexity alone does not
qualify.

An HTMDX output is one canonical `.html` file containing one editable
`<script type="text/htmdx">` source block. Do not create a Markdown twin.
Downstream agents read and edit the source block rather than generated markup.

Pin the browser runtime to an exact version. Never use a floating alias such as
`@latest`. Reports containing credentials, secrets, PII, or sensitive internal
data use a trusted local runtime mirror; when none is available, they remain in
Markdown.

Use bespoke HTML and JavaScript instead when an artifact needs custom behavior
outside the HTMDX component catalog.

## Consequences

- Positive: complex reports gain a consistent, scannable visual surface without
  making agents author presentation code.
- Positive: the editable source stays compact and legible to downstream agents.
- Positive: one canonical artifact avoids drift between Markdown and HTML copies.
- Negative: rich artifacts depend on a pinned runtime or trusted mirror to render.
- Negative: each producing skill must make an explicit format-selection decision.
- Negative: sensitive reports may lose the rich rendering when no trusted local
  runtime is available.

## Alternatives considered

- Use Markdown for every output: rejected because dense visual evidence and
  multi-axis comparisons are materially harder for people to scan.
- Use HTMDX for every complex or long output: rejected because Markdown is
  cheaper and clearer when visual structure does not change the decision.
- Generate hand-written HTML: rejected because it spends more tokens and makes
  later edits operate on presentation markup.
- Produce both Markdown and HTML: rejected because two canonical copies drift.

## Implementation Notes

- The shared selection and security contract lives in
  [`rich-artifacts.md`](../skills/vs-internal-shared/references/rich-artifacts.md).
- `vs-github-research` uses HTMDX for landscape reports.
- `vs-qa` uses it for screenshot-heavy regression or exhaustive reports.
- `vs-orchestrate` may derive an optional HTMDX progress dashboard while keeping
  `GOALS.md` as the source of truth.
