---
name: vs-recap
description: "Create a tiny out-of-context recap of the current situation and recent changes. Use when the user says /vs-recap, recap, catch me up, where are we, out of context, I have no context, or explain what is going on."
---

# Recap

Give the user a compact handoff for a reader who just arrived from another topic.

## Use When

- The user says `/vs-recap`, `vs-recap`, `catch me up`, `where are we`, `out of
  context`, `I have no context`, `explain what is going on`, or asks for recent
  changes.
- The user needs enough context to decide the next step, not a full history —
  whether they followed the session so far or are arriving cold.

## Inherit the trail

If `GOALS.md` / `decisions.tsv` / a baby-sit resume file / prior recap exists,
READ it first. Recap must not invent a history that contradicts the trail.
Missing trail is ok (say unknown); inventing one is not.

Recap consumes the trail; it never owns or mutates `decisions.tsv`. Do not
append rows, and do not invent a new skill.

## Do not re-derive

Do not re-run research, re-score sessions, or rebuild a roadmap to write the
recap. Cite inherited decisions. If a claim is not on the trail or in a named
artifact, mark it inferred or drop it. A recap that rebuilds a new milestone
list while `GOALS.md` exists has failed this contract.

## Re-prove claims on the artifact

Every status/done/blocked/active claim must point at a concrete artifact
(file + row, SHA, or PR). A bare filename such as `GOALS.md` is not a
pointer. A recap that asserts done or active with no artifact pointer has
failed this contract.

## Gather

Use the best current evidence available, in this order:

1. The inherited trail above, when present.
2. Current conversation state and tool results.
3. Git diff, recent commits, or changed files if the recap is about repo work.
4. Relevant local artifacts mentioned in the conversation.

Do not do broad archaeology unless the user asks. Prefer live repo evidence over memory.

## Write

Output at most a few sentences. Optimize for decision-making:

- What changed or was learned (inherited, then re-proved).
- Why it matters now.
- Any blocker, risk, or open decision that affects the next step.

Avoid implementation trivia, long file lists, praise, and process narration. If nothing material changed, say that plainly.

## End With Actions

End with `Possible actions:` followed by 2-4 concise options. Each option should be an action the user can choose immediately.

Example:

```markdown
M1 auth is complete (PR #12, SHA abcdef1 on GOALS.md). M2 billing is active;
blocked on the webhook secret (GOALS.md M2 Blockers). Trail unknown beyond
that file.

Possible actions: add the secret, keep M2 scoped, stop here.
```

## Output style

Apply the [shared output style](../vs-internal-shared/references/output-style.md)
to every user-facing message.

## Workflow

Direct: emit **Next** only. Composed: return to caller.

**Prev:** context switch | interrupted task
**Next:** done
**Relevant:** `/vs-search-threads` | `/vs-before-after`
