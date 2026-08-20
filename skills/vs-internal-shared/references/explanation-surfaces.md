# Explanation surfaces

Use this contract when a VS skill explains, compares, teaches, reports, or asks
the user to review a complex result. It implements
[`deliver-complex-explanations-in-two-layers`](../../../adr/deliver-complex-explanations-in-two-layers.md).

## Choose before writing

A simple answer stays in chat. It has one conclusion, no relationship the user
must reconstruct, and fits in a few short lines after proper editing.

An explanation is complex when understanding depends on any one of these:

- three or more interacting components, owners, states, or dependencies;
- a comparison across multiple choices and criteria;
- a causal, lifecycle, or handoff flow with at least three meaningful steps;
- essential evidence, caveats, or decisions that would push chat beyond one
  short screen.

Complexity is not permission to preserve poor writing. If repetition, process
narration, or loose editing caused the length, shorten it and keep the answer in
chat.

## Deliver two synchronized layers

For a complex human-facing explanation:

1. **Chat TLDR:** two to four short lines containing the answer, the strongest
   reason, and the next action or decision. Link the artifact. Do not duplicate
   its detailed prose, tables, evidence, or history.
2. **Visual artifact:** create one HTMDX artifact through
   [`../../vs-htmdx/SKILL.md`](../../vs-htmdx/SKILL.md). It is the canonical
   human review surface. Validate, render, and open it when the host can.

Machine-consumed specs, plans, issue drafts, and `GOALS.md` may remain Markdown.
Link them from the visual artifact; do not turn them into a second human-facing
report or paste them into chat.

If HTMDX cannot be created, validated, rendered, or opened, keep the chat TLDR
usable. Name the exact artifact gap in one line. Fall back to a small Mermaid
diagram or concise Markdown only when it materially improves understanding.

## Choose the smallest trustworthy visual

- **Mermaid in chat or Markdown:** flows, ownership, dependencies, sequences,
  and state changes. Keep it simple, normally no more than eight nodes and one
  relationship per edge.
- **HTMDX components or inline SVG:** express those same relationships inside
  an HTMDX artifact. HTMDX does not render Mermaid source directly, so do not
  paste an unrendered Mermaid fence into it. Use components for comparisons,
  timelines, metrics, evidence, risks, and structured decision briefs.
- **Screenshots:** claims about visible product behavior. A diagram cannot
  replace observed UI evidence.
- **Generated images:** use rarely, only for a mental model or metaphor that a
  factual diagram cannot teach cleanly. Never use generated images as technical
  evidence or as proof that a product state exists.

Do not add a visual merely to decorate a short answer.

## Ask only a useful question

After an explanation or at a strategic boundary, ask one understanding or
decision question only when the answer changes what happens next. Prefer the
host's structured question tool and put the recommended choice first.

Do not ask for ceremonial approval, quiz the user on facts that do not affect a
decision, repeat a settled question, or interrupt autonomous mechanical work.
When no answer is needed, end with the TLDR and artifact link.
