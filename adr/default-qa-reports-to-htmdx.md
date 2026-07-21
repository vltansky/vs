# Default QA reports to HTMDX

- Date: 2026-07-20
- Supersedes the `vs-qa` format-selection note in [`use-htmdx-for-rich-human-facing-artifacts.md`](use-htmdx-for-rich-human-facing-artifacts.md)

## Context

The shared rich-artifact policy defaults routine skill output to Markdown and
originally limited HTMDX QA reports to regression or exhaustive runs. In
practice, standard QA reports also collect screenshots, issue evidence,
verification states, metrics, and ship-readiness conclusions. The Markdown
default therefore hid the report format best suited to the review task behind a
tier distinction that did not reflect the artifact's content.

## Decision

`vs-qa` produces one HTMDX `.html` report by default for every tier and mode.
The report remains one canonical artifact with one editable
`<script type="text/htmdx">` source block.

Markdown remains available when the user explicitly requests it or when
sensitive data must remain in the report and no trusted local runtime mirror is
available. The shared Markdown default for other VS skills is unchanged.

## Consequences

- Quick, standard, exhaustive, diff-aware, and regression QA use the same
  scannable evidence surface.
- Format selection no longer depends on an agent's interpretation of whether a
  run has enough screenshots or visual states.
- Even small QA runs depend on the pinned HTMDX runtime unless they use the
  explicit Markdown fallback.
