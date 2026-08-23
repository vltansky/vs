# Make Ponytail a composed building block

Date: 2026-08-23

## Context

VS adapted Ponytail's minimum-solution guidance into a shared reference, linked
that reference from solution-shaping skills, and attempted to inject it through
one plugin hook. The arrangement made Ponytail effectively invisible: users
could not invoke it, workflows had no observable Ponytail decision, and the hook
command assumed Claude's plugin-root variable even when the Codex manifest used
the same hook file.

The guidance also had no single user-facing owner. The reference, hook, workflow
links, and comparison evals could evolve independently without one flow contract
defining standalone and composed behavior.

## Decision

`vs-ponytail` is the user-facing building block that owns minimum-solution
behavior. Its contract is the single source used by:

- direct invocations and implicit trigger phrases such as "ponytail", "YAGNI",
  "do less", and complaints about over-engineering;
- session and subagent hooks;
- workflows and building blocks that choose or review solution machinery,
  including shape-it, build-it, and roast-code.

Standalone use reports the chosen solution rung, machinery avoided,
completeness evidence, and any deferral. Composed use returns the same decision
to its caller without adding a second user-facing workflow.

The hook remains one manifest and one script. Its command resolves the plugin
root from the host-neutral `PLUGIN_ROOT` first and Claude's
`CLAUDE_PLUGIN_ROOT` second. The script reads Ponytail's canonical contract and
supports `VS_PONYTAIL=off`; the former `VS_MINIMUM_SOLUTION=off` remains a
compatibility alias.

Behavior evals must assert observable outcomes such as the resulting files,
diff size, dependencies, or review findings. Transcript-only wording checks do
not establish that Ponytail changed the solution.

## Consequences

- Ponytail becomes discoverable and directly invocable as a third-layer VS
  building block.
- Hook and workflow behavior share one contract and one disable boundary.
- Shape, build, and review workflows surface meaningful Ponytail decisions
  without announcing the always-on hook on every turn.
- Installed hosts still own hook trust and enablement. VS can prove its hook
  command and context, but an untrusted or disabled user hook remains an
  installation-state gap.
- Adding a public skill and changing workflow behavior requires a plugin version
  bump and focused behavior evals before release.

## Alternatives considered

- **Keep the shared reference and only fix the hook.** Rejected because it
  remains invisible, has no direct invocation contract, and leaves composition
  semantics distributed across callers.
- **Copy Ponytail instructions into every workflow.** Rejected because the
  copies would drift and would increase the instruction load Ponytail is meant
  to reduce.
- **Add lite, full, and ultra modes immediately.** Rejected for the first slice.
  Reliable default delivery and measurable lift come before mode complexity.
- **Install separate Claude and Codex hook manifests.** Rejected after inspecting
  the Codex hook runtime: the host-neutral plugin-root variable lets one command
  serve both hosts without duplicated manifests.
