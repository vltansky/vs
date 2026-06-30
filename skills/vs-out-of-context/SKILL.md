---
name: vs-out-of-context
description: "Explain the current situation from zero prior context. Use when the user says /vs-out-of-context, out of context, I have no context, or explain what is going on."
disable-model-invocation: true
---

# Out Of Context

Explain the current situation to a smart reader who did not read anything before.

## Use When

- The user says `/vs-out-of-context`, `out of context`, `I have no context`, or asks what is going on from scratch.
- The user needs a short orientation before deciding what to do next.

## Gather

Use only the context that is already relevant:

1. Current conversation state and tool results.
2. Git diff, recent commits, or changed files if the user is asking about repo work.
3. Relevant local artifacts explicitly mentioned in the conversation.

Do not do broad archaeology unless the user asks. Prefer current repo evidence over memory.

## Write

Output a few sentences max. Write like the user just walked in:

- Name the actual subject or task.
- Explain what happened or what is being decided.
- Mention the one blocker, risk, or next decision that matters.

Avoid implementation trivia, long file lists, process narration, and assumptions about what the user remembers. If there is not enough context to orient them, say what is missing plainly.

## End With Actions

End with `Possible actions:` followed by 2-4 concise options the user can choose immediately.

Example:

```markdown
We are adding a new `/vs-out-of-context` skill to the VS workflow so you can ask for a tiny explanation of the current situation when you have not followed the previous discussion. It is separate from `/vs-recap`: this one explains the problem from scratch, while recap focuses on recent changes. The only real decision is whether the wording is short enough or needs an eval.

Possible actions: ship it, tighten wording, add eval, stop here.
```
