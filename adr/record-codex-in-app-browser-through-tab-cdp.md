# Record Codex in-app Browser through tab-scoped CDP

- Date: 2026-07-27

Supersedes the Codex in-app Browser routing in
[route-qa-recording-by-capability](route-qa-recording-by-capability.md).
Other surface routes and the recording evidence contract stand.

## Context

The earlier routing decision treated CDP as an attachable endpoint. A live
Codex in-app Browser probe showed a third shape:

- the tab advertises a raw `cdp` capability
- `Browser.getVersion` and `Target.getTargets` are rejected because
  browser-level raw CDP is not exposed
- `Page.startScreencast` succeeds, emits `Page.screencastFrame`, and accepts
  `Page.screencastFrameAck`
- draining and acknowledging after interactions captured eight frames from the
  live tab

There is no debugger URL for `agent-browser connect`, but the surface is not
unable to record. Treating "no endpoint" as "no recording" loses sequence
evidence unnecessarily.

## Decision

Route tab-scoped raw CDP separately from an attachable CDP endpoint.

- A tab exposing raw CDP records itself with `Page.startScreencast`.
- The run drains `Page.screencastFrame` events, writes the frame bytes directly
  to temporary numbered JPEGs, and acknowledges every frame with
  `Page.screencastFrameAck`.
- The run stops with `Page.stopScreencast` and encodes the retained frames to
  the report's WebM clip. If the harness has no WebM encoder, it records that
  exact blocker instead of claiming the browser lacks recording support.
- The frame bytes stay tool-side. Only the final clip path, size, and duration
  reach the model.
- Because screencast records the existing tab, cookies and localStorage stay in
  place. The session-transfer warning still applies to routes that create a new
  recording context.

## Consequences

- Positive: Codex in-app Browser can prove sequence defects without switching
  browsers or losing authenticated localStorage.
- Positive: the route reflects the capability the harness actually exposes
  instead of requiring a debugger URL it intentionally hides.
- Negative: raw screencast frames need local WebM encoding, unlike Playwright
  and `agent-browser`, which emit a clip directly.
- Negative: the run must drain and acknowledge frames during capture; waiting
  until the end can stall the stream after its first unacknowledged frame.
- Negative: page screencast does not show the pointer or an input that leaves
  the pixels unchanged. It cannot prove a failed no-change action unless the
  page exposes a visible focus, pressed, or navigation state.
- Negative: the fixed-rate WebM proves visible order, not real elapsed time.
  Timing claims still require a recorder that preserves frame timing.

## Alternatives considered

- Treat Codex in-app Browser as unavailable: rejected because the live tab
  emitted and acknowledged screencast frames.
- Attach `agent-browser`: rejected because the in-app surface exposes
  tab-scoped commands, not an attachable endpoint.
- Switch to another browser only for clips: rejected because it changes the
  session and can invalidate the evidence, especially for localStorage auth.
