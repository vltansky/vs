# Rename Teach Back to Explain Back

- Date: 2026-10-02

## Context

`vs-teach-back` restates the user's messy explanation as a clean proposal so
the user can check that the agent understood. In teaching practice, "teach
back" usually means the learner explains the material back to the teacher. That
reading suggests the skill quizzes the user, which it does not do.

## Decision

Rename the skill and command to `vs-explain-back`. Update the skill directory,
plugin metadata, documentation, the skill-kind list, and tests. The skill
description keeps "teach back" as a trigger phrase so natural-language requests
still route to it.

## Consequences

- Users invoke `/vs-explain-back`.
- Existing `/vs-teach-back` invocations and pinned shortcuts must migrate to the
  new name. The plugin ships no alias.

## Alternatives considered

- Keep `vs-teach-back`: the name keeps suggesting a quiz.
- `vs-mirror`: accurate, but it does not say that the output is an explanation.
