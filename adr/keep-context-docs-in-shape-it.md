# Keep context documents in shape-it

Date: 2026-08-05

## Context

VS already has separate workflows for shaping an idea and stress-testing a
formed proposal. The prior grill/domain-model split correctly rejected putting
a full DDD interview and ADR loop inside `vs-shape-it`, but VS still needs a
small, shared contract for reading and maintaining project vocabulary in
`CONTEXT.md`.

## Decision

Keep context-document support as an internal reference used by `vs-shape-it`,
`vs-build-it`, and `vs-pushback`; do not package a standalone domain-model
skill. During Explore, `vs-shape-it` reads the applicable context documents and
owns resolved glossary updates. Build-it and pushback consume the vocabulary
read-only and route terminology conflicts back to shape-it.

Context documents remain lazy, glossary-only, support `CONTEXT-MAP.md` for
multiple bounded contexts, and honor existing in-repo or per-user storage
preferences. ADRs remain reserved for hard-to-reverse, surprising decisions
with real trade-offs.

## Consequences

- Users get context-aware shaping without another command or interview mode.
- The glossary is available to later build and review sessions without making
  those workflows responsible for changing it.
- The existing full domain-model split remains available as historical context,
  while the packaged behavior stays proportional to VS's current workflows.

## Alternatives considered

- **Package a standalone `vs-domain-model` skill.** Rejected because shape-it
  already owns the alignment/design conversation and the extra surface adds
  routing and maintenance cost.
- **Put a full DDD+ADR loop into `vs-shape-it`.** Rejected because the prior
  split ADR identified that as too much responsibility for one workflow.
- **Skip context support entirely.** Rejected because shared vocabulary is
  useful to shape-it, build-it, pushback, and issue handoffs.
