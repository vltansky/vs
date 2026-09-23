# Lead vs artifacts summary-first on a paper theme

Date: 2026-09-23

## Context

The vs catalog shipped one look: a dark One Dark palette with a sketch pass
(Space Grotesk, Excalifont, wobbly radii, mermaid `handDrawn`). It reads as a
demo rather than a document. Long reports tired readers, and a skimmer had no
reliable way to get the argument without reading every section.

Several design directions were prototyped against the same real report. The
summary-first direction won: a light warm paper theme, a serif display face
over a highly legible sans, and a page that states its answer up front and
opens each section with its claims before the proof. Reading research backs
the type choices: size dominates reading speed, a ~66ch measure with loose
leading helps, and open counters aid legibility.

## Decision

- The vs theme is light paper by default: Atkinson Hyperlegible Next for body
  text, Newsreader for headings, oxblood primary. A dark variant follows
  `prefers-color-scheme` under `@media screen` only, so print always lands on
  paper. The sketch pass and mermaid `handDrawn` are gone.
- The catalog gains summary-first components: `Brief` (answer, why, main
  constraint, open question cards), `Tldr` (per-section claims), and two
  visual explainers, `Zones` (what lives on each side of a boundary) and
  `Crossing` (what may and may not pass between two sides).
- The built-in `Foldout` is restyled as a quiet "Deep dive" disclosure. Print
  opens every closed disclosure so nothing is lost on paper.
- SKILL.md tells authors to lead with `Brief`, open long sections with `Tldr`,
  and park proof in a `Foldout`.

## Consequences

- Every newly generated vs artifact changes look. Saved artifacts keep the
  catalog copy they were written with, so old files do not change.
- Mermaid colors are baked for paper at render time; the dark scheme is a CSS
  repaint over them. Mermaid's directive sanitizer drops a `fontFamily` list
  that contains a hyphen, so the list must stay hyphen-free (a static eval
  guards this).
- Not carried over from the prototype: a sticky section rail with seen state,
  expand/collapse-all, and a reader font/size control. Add them only if
  readers ask.
