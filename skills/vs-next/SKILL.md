---
name: vs-next
description: "Use at the end of a piece of work or workflow phase, before selecting or starting another workflow, to decide whether to continue in the current session, use a subagent, hand off, compact, clear, or stop. Trigger whenever the user asks what should happen now or next, whether to start fresh, or how to continue. This routing decision wins over a skill for future work when the user is asking how to proceed rather than asking to perform that future work."
---

# Next

Choose how work should cross the current phase boundary. The agent makes the
decision; the user should not need to remember the context-management model.

## Flow Contract

- **Kind:** Building block
- **Inputs:** Current objective, phase status, durable artifacts, expected next
  work, ownership, dependencies, and available host primitives
- **Outputs:** Exactly one recommendation, one reason, and one semantic next step
- **Status:** CONTINUE | SUBAGENT | HANDOFF | COMPACT | CLEAR | STOP
- **Consumers:** Any VS workflow at handoff, or a direct "what next?" request
- **Skip conditions:** None at an explicit phase boundary; callers may keep the
  default continue/stop decision internal when the user need not act

## Decide

Read and apply
[`../vs-internal-shared/references/phase-boundaries.md`](../vs-internal-shared/references/phase-boundaries.md).

Use evidence from the current conversation and durable artifacts. Determine:

1. whether the current objective and phase are actually complete
2. whether the next work is authorized and semantically related
3. whether current reasoning is still useful or already replaced by artifacts
4. whether a bounded independent lane can run while the parent continues
5. whether the next work changes owner, workspace, session, or context needs

Do not offer a menu. Choose exactly one recommendation. Do not use a subagent
merely because the parent context is crowded, and do not clear or compact an
unfinished phase whose reasoning has not been preserved.

## Act proportionally

When composed inside a workflow, return the decision to the caller. The caller
may continue or delegate work already authorized by its objective.

When invoked directly, do not begin a new scope merely because it is the
semantic next step. Create a handoff artifact only when the current request
authorizes it; otherwise recommend the exact command, artifact, or fresh-task
action the user should take.

## Output

```text
Recommendation: <continue | use a subagent | hand off | /compact | /clear | stop>
Why: <one evidence-based sentence>
Next: <one semantic workflow, artifact, command, or concrete action>
```

## Workflow

Direct: emit **Next** only. Composed: return to caller.

**Prev:** phase boundary | workflow handoff
**Next:** done
**Relevant:** none
