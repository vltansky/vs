# Rename Roast UI to UI

- Date: 2026-09-24

## Context

`vs-roast-ui` builds, critiques, and improves frontend UI through 24
sub-commands. "Roast" describes only the critique path, so the name undersells
the skill and steers users toward review when they want to build or improve.

The same change adds Emil Kowalski's design-engineering motion rules
(frequency gate, strong ease-out curves, sub-300ms UI motion, press feedback,
origin-aware popovers, hover media gating) and surface rules (concentric radius,
shadow vs border depth, optical alignment, tabular numbers). Three blind A/B
rounds preferred the skill with these rules over the vendored Impeccable
baseline.

## Decision

Rename the skill and command to `vs-ui`. Update the skill directory, plugin
metadata, documentation, cross-skill links, hook install paths, and tests.
`ROAST_UI_SKILL_DIR` becomes `VS_UI_SKILL_DIR`.

This ADR supersedes only the `vs-roast-ui` naming references in
`vendor-impeccable-as-roast-ui.md`; that ADR's vendoring decision stands.

## Consequences

- Users invoke `/vs-ui` (for example `/vs-ui polish`, `/vs-ui critique`).
- Existing `/vs-roast-ui` invocations and pinned `vs-roast-ui` shortcuts must
  migrate to the new name.
- Projects that ran `/vs-roast-ui hooks on` have hook commands pointing at
  `skills/vs-roast-ui/scripts/`; those fail visibly until the user removes the old hook entry and runs
  `/vs-ui hooks on` again.

## Alternatives considered

- `vs-improve-ui`: collides conceptually with `vs-improve`, the read-only code
  planner.
- `vs-craft-ui`: reads awkwardly with the existing `craft` sub-command.
- `vs-design`: could be read as product or system design rather than frontend
  code.
