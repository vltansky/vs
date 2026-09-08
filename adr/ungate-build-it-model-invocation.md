# Ungate build-it for model invocation

Status: accepted
Date: 2026-09-08
Supersedes in part: `invocation-gates-do-not-degrade-workflows.md`

## Context

`vs-build-it` carried `disable-model-invocation: true`, so the agent could not
launch it through the host skill tool; only a user-typed slash command could.
In practice the user asks for build-it inside a longer message ("ok so
/vs-build-it and ..."), the host reads the command as prose, the Skill call is
refused, and the turn ends with a "type this yourself" instruction. The gate
cost a round-trip on every such request without preventing any real
mis-trigger: build-it's description already requires explicit plan-execution
intent, and `vs-shape-it` hands off to it by name.

## Decision

Remove `disable-model-invocation` from `vs-build-it` and set the Codex mirror
`allow_implicit_invocation: true` so both hosts agree. The agent may now start
build-it when the user names it or asks for autonomous plan-to-code execution.

The rest of the earlier ADR stands: other gated skills keep their flags, chained
skills still load sibling `SKILL.md` files directly, and a gated skill that
cannot be resolved is still reported with its exact slash command rather than
replaced by an improvised workflow.

## Consequences

- Positive: "/vs-build-it ..." works whether typed as a command or inside a sentence
- Negative: build-it can fire off phrasing like "implement this plan" without a
  slash command; its scope guard (stop on strategic blockers, intent changes,
  unrelated refactors) is the remaining protection
- Follow-up: if incidental triggering shows up, tighten the description before
  reinstating the flag
