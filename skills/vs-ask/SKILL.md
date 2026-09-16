---
name: vs-ask
description: "Recommend the currently installed VS skill that best fits a user's goal, without starting the underlying workflow."
---

# VS Ask

Recommend a VS skill for the user's stated goal. This is a router, not an
execution workflow.

## Flow Contract

- **Kind:** Building block
- **Inputs:** The user's goal and the current available-skills catalog
- **Outputs:** One skill recommendation, a reason, and a copyable prompt
- **Status:** RECOMMENDED or NEEDS_CLARIFICATION
- **Consumers:** Direct user invocation or a calling workflow
- **Skip conditions:** The user already chose a skill and wants to execute it

## Discover the current VS inventory

Use the current session's available-skills catalog as the source of truth. Keep
only skills whose names begin with `vs:` or `vs-`.

Build an in-turn inventory cache containing each candidate's name, description,
and location. Fingerprint the sorted `name + description + location` entries.
Reuse that cache for later routing requests only when the fingerprint is
unchanged; otherwise rebuild it. Do not maintain a hardcoded skill map or infer
skills that are absent from the catalog.

## Route

- Read the user's goal, current phase, and requested output.
- Compare the request against the discovered descriptions and choose the
  narrowest skill that can complete it.
- When the choice is genuinely ambiguous, read the `SKILL.md` files of the two
  strongest candidates before deciding. Do not load unrelated skills.
- Prefer a complete workflow when it covers the goal. Prefer a building block
  when the user asks for that bounded action specifically.
- Return one recommendation. Include one alternative only when it represents a
  real boundary the user may reasonably choose.
- Do not start the recommended skill or perform its underlying work.
- Ask one question only when the answer changes the recommendation.

## Output

```text
Recommended: /vs-<skill>
Why: <one sentence tied to the user's goal>
Alternative: /vs-<skill> — <only when needed>
Start with: <one concrete prompt the user can copy>
```

Apply the [shared output style](../vs-internal-shared/references/output-style.md)
to the recommendation.

## Workflow

Direct: emit **Next** only. Composed: return to caller.

**Prev:** user needs help choosing a skill | any active workflow
**Next:** done
**Relevant:** none
