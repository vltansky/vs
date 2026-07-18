# Invocation gates must not degrade workflows

- Date: 2026-07-18

## Context

Two independent incidents showed the same failure shape. In a Claude Code
session, the agent tried to run ship-it after building a feature, found the
installed skill carried `disable-model-invocation`, announced it could not
launch it, and then shipped a manual `gh pr create` — losing the entire
ship-it workflow (review gate, brief, verify, CI watch) without the user
realizing a degraded path ran. In this repo's own evals, pushback tests spent
weeks grading raw un-skilled behavior because the eval prompts could not
trigger the gated skill and nothing failed loudly.

`disable-model-invocation` exists for a good reason: heavyweight workflows
should not auto-trigger off incidental phrasing. The problem is what happens
after the gate fires mid-flow.

## Decision

Keep the invocation gates, and make degradation impossible to do silently:

- vs skills chain by loading the sibling `SKILL.md` file directly; the gate
  blocks only the host's skill command, not the file read.
- When a workflow's next step is a gated skill and the file cannot be
  resolved, the agent tells the user the exact slash command to type and
  stops. Improvising a manual replacement for the gated workflow is not
  allowed.
- Anything that must exercise a gated skill from a plain prompt (evals,
  harnesses) invokes it explicitly by name/path rather than relying on
  autonomous triggering.

## Consequences

- Positive: a gate can now cost one extra user action, never a silently
  missing workflow
- Positive: eval trials grade the skill, not the raw model
- Negative: fully autonomous chains pause at gated boundaries when file
  loading is unavailable — accepted, since that boundary is exactly what the
  flag requests
- Follow-up: audit which skills still need the flag now that chaining is
  file-based

## Alternatives considered

- Remove `disable-model-invocation` from workflow skills: rejected — the
  auto-trigger noise it prevents is real (heavyweight flows firing off
  incidental "ship"/"build" phrasing)
- Allow best-effort manual fallbacks: rejected — the analyzed session shows
  the fallback looks like success while dropping the workflow's guarantees
