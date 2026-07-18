# Design: offline-first notes sync

Frozen spec (approved). Orchestrate seeds a roadmap from this; it does not
rewrite this file.

## Goal Contract
- Implementation objective: notes created offline sync to the server and
  reconcile without data loss when the device reconnects
- Scope: local store, sync engine, conflict reconciliation, server API
- Success criteria: an offline note appears on a second device after reconnect;
  concurrent edits reconcile with no lost characters
- Verification: integration test that edits offline on two clients and asserts
  merged output; a real two-device manual pass
- Constraints and approvals: no schema migration without approval

## Execution Strategy

Execution: orchestrated — three milestones, expected to surface reconciliation
edge cases during implementation.

| ID | Outcome | Effort | Depends on | Write scope | Verification |
|---|---|---|---|---|---|
| M1 | Local offline store persists notes and a change log | medium | — | src/store/ | store unit tests |
| M2 | Sync engine pushes/pulls the change log against the server | medium | M1 | src/sync/ | sync integration test |
| M3 | Conflict reconciliation merges concurrent edits with no loss | high | M2 | src/merge/ | two-client merge test + manual two-device pass |
