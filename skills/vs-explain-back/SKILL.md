---
name: vs-explain-back
description: "Use when the user types /vs-explain-back, or asks you to explain back, teach back, mirror, or restate their messy multi-message explanation as a clean proposal so they can check understanding. Rewrites the user's explanation in the agent's voice as if proposing it; always ends with clarifying questions. Does not edit code."
---

# Explain Back

The user explained something messily — across messages, mixed formats, partial
notes, or half-formed constraints. Rewrite **that** explanation back as a clean
proposal in the agent's voice, as if you were proposing it, so the user can
check whether you understood.

## Flow Contract

- **Kind:** Building block
- **Inputs:** The user's recent explanation (possibly multi-message, mixed
  formats) and enough conversation context to recover the premise
- **Outputs:** One clean proposal in the agent's voice, then clarifying
  questions
- **Status:** `TAUGHT_BACK` or `BLOCKED_AMBIGUOUS_TARGET`
- **Consumers:** Direct user invocation or a calling workflow that needs a
  shared understanding check before acting
- **Skip conditions:** Skip when the user wants code changes, a compression of
  the agent's last message (`/vs-tldr`), or a from-zero explainer (`/vs-eli5`)

## Rewrite the user's explanation

- Treat `/vs-explain-back` as an understanding check: the user owns the idea; you
  restate it cleanly so they can correct you.
- Look back across the relevant turns. Recover constraints, examples, rejected
  options, and open forks — not only the last paragraph.
- Write the restatement as a **proposal in the agent's voice** ("I propose…",
  "Here's the cut…"), as if you were pitching the same idea. Do not quote the
  user back verbatim or narrate "you said…".
- Structure it: goal, proposed cut, constraints / non-goals, and any load-bearing
  detail that was easy to miss in the mess. Use plain English and project nouns.
- Do not invent requirements the user did not imply. Prefer a labeled uncertainty
  over a confident guess.
- Do not edit code, open a PR, create files, or start another workflow.
- If the target explanation is genuinely ambiguous, ask one compact question
  first. Otherwise infer the target and continue.

## Always end with clarifying questions

After the proposal, always end with possible clarifying questions — even when
confidence is high. Offer the forks that would change the proposal if answered
differently. Keep the list short and concrete; do not pad with rhetorical
questions.

## Boundary

`/vs-explain-back` is the inverse of comprehension repair: the **user** explained
something messy and you mirror it back. It does not replace `/vs-wdym` or
`/vs-tldr` — those are for when the **user did not follow the agent**. It does
not replace `/vs-recap` for the whole situation, `/vs-shape-it` for shaping a
new idea into a plan, `/vs-write` for editing supplied prose, or `/vs-eli5` for
a from-zero visual explainer. This skill stays prose-only and never edits code.

Apply the [shared output style](../vs-internal-shared/references/output-style.md)
to the proposal and the clarifying questions.

## Workflow

Direct: emit **Next** only. Composed: return to caller.

**Prev:** messy user explanation | any active skill
**Next:** done
**Relevant:** none
