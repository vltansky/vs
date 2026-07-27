# Route QA recording by capability, not by control surface

- Date: 2026-07-27

Supersedes the recording-routing half of
[record-qa-sequences-as-video-clips](record-qa-sequences-as-video-clips.md).
The clip format, the `clips/` invariant, and the redaction rule stand.

## Context

The earlier ADR made recording reachable and then watched runs not reach for it.
A `/vs-qa` run against a PR filed two issues — a logged-out preview that stays
blank instead of navigating to SSO, and a login redirect landing on a 404 — and
proved both with static frames. The before frame for the first issue is a blank
page. A blank frame does not show that a navigation failed to happen; it is
indistinguishable from a page that has not finished loading. That is precisely
the class the recording contract exists for, and the run captured no clip.

Two mechanisms produced that outcome, neither of them a judgment call.

The control-surface priority list ends with an instruction to perform every
action with the selected surface "instead of shelling out to `agent-browser`".
`agent-browser` is the only surface most harnesses expose that records. So
selecting any higher-priority surface — a native browser, Playwright, a harness
in-app browser — structurally removed recording from the whole run. The run had
already picked its surface before any issue existed to record.

The escape hatch was unenforced. The contract said a surface that cannot record
writes `recording unavailable on this control surface` into run metadata; the
report wrote nothing. Nothing distinguishes "considered recording, surface could
not" from "never considered it", and the evidence validator passed the report
because a clipless run is legitimate by design.

## Decision

Recording is a capability, not a property of the surface driving the run.

- When the selected surface cannot record, use `agent-browser record` for the
  clip alone and keep driving the rest of the run with the selected surface.
  `record start` carries cookies and localStorage across, so an authenticated
  run stays authenticated. Reach for it before concluding recording is blocked.
- The default widens from "record only when the sequence is the evidence" to
  name what qualifies: numbered repro steps, a navigation that does not happen,
  and a before frame that is blank or identical to its after frame. Two stills
  of a page that never moved do not show that it failed to move.
- Every report states its recording status in run metadata — a clip count, or
  the blocker with its reason. `validate-screenshot-evidence.mjs` fails a
  clipless report that states neither, reporting `clips.statusStated:false`.
  Both report templates ship the row, so the default is a filled field.

A run whose issues are all static remains complete with no clips. What is no
longer available is silence.

## Consequences

- Positive: the sequence defects most worth a clip are named, not left to a
  judgment the run makes before it has seen the bug
- Positive: surface selection stops silently deciding recording for the run
- Positive: a clipless run is auditable — the reader learns whether recording
  was unavailable or unnecessary
- Negative: one more mandatory metadata field, and a validator that fails on a
  missing sentence rather than on missing evidence
- Negative: mixing surfaces within a run means the clip may be captured by a
  different browser than the screenshots, so a clip and a frame of the same
  state can differ in chrome, viewport, and font rendering

## Alternatives considered

- Mandatory clip per issue: rejected again, for the reason the first ADR gave —
  a requirement runs cannot meet gets marked skipped
- Promoting `agent-browser` to the top of the surface priority list: rejected —
  it would trade a recording gap for worse interaction fidelity on every run to
  fix a problem that only touches sequence evidence
- Inferring the gap in the validator by flagging clipless runs with numbered
  repro steps: rejected as too fragile to gate on; the named default belongs in
  the contract the run reads, not in a heuristic over the report it wrote
