---
name: vs-recap
description: "Create a tiny out-of-context recap of recent changes. Use when the user says /vs-recap, recap, catch me up, or summarize where we are."
---

# Recap

Give the user a compact handoff for a reader who just arrived from another topic.

## Use When

- The user says `/vs-recap`, `vs-recap`, `catch me up`, `where are we`, or asks for recent changes.
- The user needs enough context to decide the next step, not a full history.

## Gather

Use the best current evidence available, in this order:

1. Current conversation state and tool results.
2. Git diff, recent commits, or changed files if the recap is about repo work.
3. Relevant local artifacts mentioned in the conversation.

Do not do broad archaeology unless the user asks. Prefer live repo evidence over memory.

## Write

Output at most a few sentences. Optimize for decision-making:

- What changed or was learned.
- Why it matters now.
- Any blocker, risk, or open decision that affects the next step.

Avoid implementation trivia, long file lists, praise, and process narration. If nothing material changed, say that plainly.

## End With Actions

End with `Possible actions:` followed by 2-4 concise options. Each option should be an action the user can choose immediately.

Example:

```markdown
We added the `vs-recap` skill as a standalone marketplace skill and wired the VS plugin to reuse it, so `/vs-recap` can travel with VS without duplicating instructions. Validation passes, and the only remaining decision is whether to ship this as-is or add behavior eval coverage.

Possible actions: create PR, add eval, adjust wording, stop here.
```
