# Ship proposals as a vs layout and template

Date: 2026-08-25

## Context

The `vs` HTMDX skill had one template (`assets/artifact.html`, `layout: vs`)
tuned for reports and briefs. Proposal-shaped documents — RFCs, design docs,
package-boundary proposals — read differently: a reviewer needs the pitch,
status, and ownership before the argument, a table of contents to jump between
sections, and a section order that surfaces alternatives and open questions. A
reference document the user liked (the Stash package-boundary proposal page)
leads with a dark hero (eyebrow, title, status pills) and a sticky left TOC
rail. A survey of RFC templates (Rust, React, Kubernetes KEP, PEP, TC39, Oxide
RFD, Go, Uber/HashiCorp/Squarespace) converged on a canonical section order —
Summary, Problem, Proposal, Design details, Alternatives (the most universally
mandated section), Drawbacks, Rollout, Unresolved questions, References — and
a lifecycle vocabulary (Draft/Proposed/Accepted/Rejected/Superseded) that
matches the existing `Verdict` component's status tones exactly.

The question was where proposal support should live: a new skill, new
components, a fork of the artifact shell, or a second layout in the existing
single catalog.

## Decision

Proposals ship as a second layout in the existing vs catalog plus a second
template shell:

- `vs-proposal` layout in `skills/vs-htmdx/assets/definitions.mjs` — a React
  layout component rendering a hero (eyebrow, title, phase/owner/updated
  pills) from frontmatter slots and a sticky TOC built by scanning the
  rendered `h2` headings post-mount. Slots map only lint-known frontmatter
  fields (`title`, `project`, `owner`, `phase`, `updated`); `phase` carries
  the lifecycle status so `--strict` lint stays clean. Without React hooks the
  layout degrades to pass-through children, keeping the CLI registry load
  working.
- `assets/proposal.html` template shell carrying the canonical RFC section
  skeleton, with the existing components (Verdict for the decision snapshot,
  Tradeoff for alternatives, Flow for rollout) placed where the survey says
  they belong.

CSS is shared, not duplicated: tokens and component rules match both layouts
via the `[data-htmdx-layout^='vs']` prefix selector, and content typography
reaches both content roots via `:is(.htmdx-app[data-htmdx-layout='vs'],
.vs-p-main)`. The sync script regenerates the inline catalog copy in every
template shell, and the drift test compares all shells against the one source.

## Consequences

- One catalog remains the single source: components, both layouts, and the
  theme register together in the CLI and in every saved artifact.
- Adding a template is now a known move — a shell file plus a layouts entry —
  and the sync script and drift test already loop over shells.
- Layout-specific CSS grows in one stylesheet; the `^='vs'` prefix convention
  means a future third layout inherits tokens and component styling for free,
  but also means a layout that should *not* share them needs a new prefix.
- The TOC depends on client-side React; environments that render the source
  without the runtime see the plain document, which is the intended
  degradation.

## Alternatives considered

- **A separate proposal skill** — rejected: the deliverable contract
  (one portable `.html`, lint, render-check, handoff) is identical; only the
  shell differs. A second skill would duplicate the entire verification
  pipeline for a template choice.
- **Frontmatter-only variation on the `vs` layout** — rejected: the hero and
  sticky TOC need a layout component and layout-scoped CSS; overloading the
  report layout with conditional chrome would complicate both documents.
- **New status/summary frontmatter fields** — rejected: the linter's known
  field set is fixed upstream (`title`, `project`, `owner`, `phase`,
  `updated`, `theme`, `layout`); unknown fields fail `--strict`. `phase`
  already expresses lifecycle, and the pitch belongs in the body's lede.
- **Fork the artifact shell without a shared catalog** — rejected: two
  diverging inline catalogs is exactly the drift the sync script and static
  eval exist to prevent.
