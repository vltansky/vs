# Record QA sequences as video clips

- Date: 2026-07-26

## Context

QA reports prove state with screenshots. A class of defect is not a state:
hover behavior, focus order, animation, and multi-step flows fail *between*
two frames that both look correct. The existing contract has no way to carry
that evidence, so runs either described the sequence in prose — which is an
unproven claim wearing evidence clothing — or filed the issue without proof.

Video was not reachable. The HTMDX runtime escaped raw HTML to literal text, so
`<video>` could not be embedded, and probes confirmed only Markdown constructs
survived. The workaround was an animated GIF: it rendered, but it cost roughly
an order of magnitude more bytes per second than WebM, needed `ffmpeg` for the
conversion, and forced clips short enough that they often missed the moment.

[wix-incubator/htmdx#56](https://github.com/wix-incubator/htmdx/pull/56) adds a
shared allowlist for raw HTML covering `video`, `source`, `a`, `details`, and
layout elements, with per-element attribute filtering and scheme-checked URLs.
Relative paths resolve against the document, so a report opened from `file://`
reaches its own sibling directories. Playwright emits WebM directly, so with
the allowlist in place the conversion step disappears entirely.

## Decision

QA runs may record `.webm` clips into `$RUN_DIR/clips/` and embed them in the
report with `<video controls muted playsinline poster=...>`.

- Recording is never mandatory. It is for sequence evidence only; a static
  rendering issue is fully proven by a screenshot and a clip of it is noise.
- `clips/` carries the same one-to-one invariant as `screenshots/`: every
  retained clip is referenced, every reference resolves to a valid WebM. The
  evidence validator enforces both directories and both reference forms.
- Bytes stay tool-side exactly as screenshots do — path, size, and duration
  reach the model, never the media.
- Redaction does not soften: redact in the DOM before capture, never after. A
  recording passes through intermediate states a screenshot never sees, so a
  flow that touches credentials or PII at any point is not recorded.
- `controls muted` without `autoplay`, and a `poster` frame, so a report still
  communicates before anything is played.
- `iframe` is allowlisted by the runtime but stays out of QA reports. These
  artifacts render values gathered from a system under test; those values do
  not also get a frame.

Every HTMDX pin in this repo moves to `4.6.0` together. A pin older than the
markup degrades silently into visible tag text rather than failing, so the
render check now fails on escaped raw tags and on a blank page from a runtime
that never loaded.

## Consequences

- Positive: interaction defects become provable instead of narrated
- Positive: no `ffmpeg` dependency and no GIF size ceiling; clips can be long
  enough to contain the moment they exist to show
- Negative: recording requires the control surface to create the browser
  context, since `recordVideo` is a context-construction option. Surfaces
  exposing only page-level operations record the blocker and continue with
  screenshots
- Negative: redaction is materially harder for a moving capture, and the
  relaxed size budget invites longer recordings that widen the exposure
- Follow-up: the QuickJS harness needs a context-creation path before any run
  can actually record

## Alternatives considered

- Animated GIF: rejected once #56 landed — an order of magnitude larger per
  second, an `ffmpeg` dependency, and no seek or pause for the reader
- Mandatory recording per issue: rejected — a requirement runs cannot meet gets
  marked skipped, which is how the screenshot gate rotted before it was fixed
- Whole-run recording instead of per-issue clips: rejected for now — it maximizes
  redaction exposure and buries the proving moment in unrelated footage
