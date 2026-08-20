# Deliver complex explanations in two layers

- Date: 2026-08-21
- Supersedes in part: [`use-htmdx-for-rich-human-facing-artifacts.md`](./use-htmdx-for-rich-human-facing-artifacts.md)
- Related: [`skills/vs-internal-shared/references/output-style.md`](../skills/vs-internal-shared/references/output-style.md), [`skills/vs-internal-shared/references/rich-artifacts.md`](../skills/vs-internal-shared/references/rich-artifacts.md)

## Context

VS already asks agents to use short, plain English and provides `/vs-tldr` when
an explanation is too long. In practice, `/vs-tldr` repairs the message only
after the user has already received a dense answer. VS also supports HTMDX, but
the existing selection rule says that length or complexity alone does not
qualify. As a result, many complex explanations remain long Markdown messages
even when the user would understand them faster as a visual artifact.

The intended reader finds long messages and complex English costly to parse.
They want the chat response to remain a tiny decision summary while a visual
artifact carries the full explanation. They also want simple diagrams and
questions that check understanding, without turning autonomous execution into
repeated approval gates.

## Decision

Deliver every complex human-facing explanation in two synchronized layers:

1. Chat contains the TLDR: the answer, the main reason, and the next decision or
   action in short, plain English.
2. A visual HTMDX artifact contains the full explanation. It is the canonical
   human review surface and is opened for the user when the host supports that.

The chat TLDR is an index, not a Markdown twin. It must not duplicate the
artifact's detailed prose, tables, evidence, or history.

Machine-consumed source-of-truth documents such as specs, plans, issue drafts,
and `GOALS.md` may remain Markdown. Link them from the visual review surface;
do not paste their full bodies into chat or create a second human-facing report.

Treat an explanation as complex when understanding depends on at least one of
these structures: three or more interacting components or states; a comparison
across multiple choices and criteria; a multi-step causal or ownership flow; or
enough essential detail that the chat answer would otherwise exceed one short
screen. A long answer caused only by poor editing does not qualify; shorten it.

Choose the smallest factual visual that fits:

- use a simple Mermaid diagram in chat or Markdown for flows, ownership,
  dependencies, and state; use HTMDX components or inline SVG for the same
  relationships inside an HTMDX artifact;
- use HTMDX comparison, timeline, metric, evidence, and risk components for
  structured review;
- use screenshots for claims about visible product behavior;
- use generated images rarely, only to teach a mental model or metaphor, never
  as technical evidence.

For explanations and strategic decisions, finish with one useful understanding
or choice question when the answer can change what happens next. Do not ask for
ceremonial approval, repeat a question already settled by evidence, or interrupt
autonomous mechanical work.

If HTMDX cannot be created, validated, rendered, or opened, the chat TLDR still
delivers the decision. Report the artifact gap briefly and fall back to a small
Mermaid diagram or concise Markdown only when it materially helps.

## Consequences

- Positive: the user can make the immediate decision from chat without reading
  a long report.
- Positive: complex explanations consistently get a visual surface instead of
  depending on the agent to remember an optional format.
- Positive: one self-check or choice question makes understanding observable.
- Negative: complex answers require artifact authoring, validation, rendering,
  and opening, which adds work and can depend on the HTMDX runtime.
- Negative: an overly broad complexity test can create decorative artifacts or
  slow down simple answers; behavioral evals must enforce both sides of the gate.
- Negative: questions can become an interruption tax unless workflows preserve
  autonomous execution boundaries.

## Alternatives considered

- Keep `/vs-tldr` as an after-the-fact repair: rejected because the user must
  first receive and recognize the unreadable message.
- Put the full answer in both chat and HTMDX: rejected because duplication keeps
  chat long and creates two competing detailed outputs.
- Use Mermaid for every explanation: rejected because diagrams are weak for
  evidence tables, comparisons, timelines, and nuanced caveats.
- Generate illustrations frequently: rejected because they are slower and less
  trustworthy than diagrams, screenshots, and structured factual components.
- Ask for approval at every phase: rejected because it adds ceremony and turns
  autonomous work into a user-managed queue.
