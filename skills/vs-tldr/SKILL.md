---
name: vs-tldr
description: "User-invoked compression of the explanation the agent just gave. Use when the user types `/vs-tldr`, says `tldr`, `too long`, `simpler`, `in plain english`, `what do you mean?`, `wait, what?`, or `lost me`; re-pitch the relevant context shorter and simpler without dropping the premise, the decision, or the caveats."
disable-model-invocation: true
---

# TLDR

Compress and simplify the explanation the user just read.

## Flow Contract

- **Kind:** Building block
- **Inputs:** The current conversation and the explanation that was too long or too complex
- **Outputs:** A shorter, simpler re-pitch that keeps the missing premise and the load-bearing detail
- **Status:** `RE_PITCHED` or `BLOCKED_AMBIGUOUS_TARGET`
- **Consumers:** Any active workflow or direct user invocation
- **Skip conditions:** Skip when the user wants a new answer, a whole-task recap, or a prose rewrite rather than compression of the current explanation

## Repair the message

- Treat `/vs-tldr` as a length-and-complexity signal: the content was right, the delivery was too long or too dense.
- Re-pitch **that**: look back far enough to recover the missing premise, not just the last paragraph.
- Cut hard. Drop process narration, hedging, restated context, and any option you already rejected.
- Use plain English and short sentences. Reuse terms from the applicable `CLAUDE.md`, `CONTEXT.md`, current code, and conversation when they exist; do not invent replacement jargon.
- Keep the decision, caveats, technical accuracy, and action that matter. Do not start a new task, change code, or silently remove a condition. Shorter is the goal; wrong is not the price.
- Return the repair directly, without a preamble, process narration, or duplicate recap.
- If the target is genuinely ambiguous, ask one compact question. Otherwise infer it from the current turn and continue.

## Check the result

- It is materially shorter than what it replaces.
- It is simpler, not just blunter — a reader who missed the premise now has it.
- Project nouns replace invented ones.
- No caveat, condition, or action was lost in the cut.
- A second `/vs-tldr` compresses again rather than degrading into fragments.
- After the re-pitch, if a from-zero visual explainer would help, propose `/vs-eli5` in one short line. Do not run it.

## Boundary

Use `/vs-tldr` at any point, including inside another skill. It compresses one
explanation after the fact; it does not replace `/vs-recap` for the whole current
situation, `/vs-write` for editing supplied prose, `/vs-explain-diff` for a
deep code-change explainer, or `/vs-eli5` for a from-zero visual explainer.
This skill stays prose-only. It does not become HTMDX.

Apply the [shared output style](../vs-internal-shared/references/output-style.md)
to the re-pitch. This skill is intentionally small: the leading signal is that
this specific explanation was too long or too complex, not a general request to
make every response shorter.

## Workflow

Direct: emit **Next** only. Composed: return to caller.

**Prev:** explanation that was too long or too complex | any active skill
**Next:** done
**Relevant:** none
