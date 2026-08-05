---
name: vs-bro
description: "User-invoked repair for when the agent's explanation did not land. Use when the user types `/vs-bro`, says `bro`, `wait, what?`, `lost me`, or asks for the previous point to be explained again; re-pitch the relevant context in plain English, shorter and clearer without dropping the premise."
disable-model-invocation: true
---

# Bro

Re-pitch the explanation when the user signals that they stopped following.

## Flow Contract

- **Kind:** Building block
- **Inputs:** The current conversation and the explanation the user did not follow
- **Outputs:** A shorter, clearer re-pitch that restores the missing premise and preserves necessary detail
- **Status:** `RE_PITCHED` or `BLOCKED_AMBIGUOUS_TARGET`
- **Consumers:** Any active workflow or direct user invocation
- **Skip conditions:** Skip when the user wants a new answer, a whole-task recap, or a prose rewrite rather than repair of the current explanation

## Repair the message

- Treat `/vs-bro` as a comprehension signal, not a request for a terse summary.
- Re-pitch **that**: look back far enough to recover the missing premise, not just the last paragraph.
- Use plain English and short sentences. Reuse terms from the applicable `CLAUDE.md`, `CONTEXT.md`, current code, and conversation when they exist; do not invent replacement jargon.
- Preserve the decision, caveats, technical accuracy, and action that matter. Do not start a new task, change code, or silently remove a condition.
- Return the repair directly, without a preamble, process narration, or duplicate recap.
- If the target is genuinely ambiguous, ask one compact question. Otherwise infer it from the current turn and continue.

## Check the result

- It is shorter and clearer, not merely shorter or blunter.
- The missing premise is explicit.
- Project nouns replace invented ones.
- A second `/vs-bro` works as another repair rather than degrading into fragments.

## Boundary

Use `/vs-bro` at any point, including inside another skill. It repairs one
explanation after the fact; it does not replace `/vs-recap` for the whole current
situation, `/vs-write` for editing supplied prose, or `/vs-explain-diff` for a
deep code-change explainer.

Apply the [shared output style](../vs-internal-shared/references/output-style.md)
to the re-pitch. This skill is intentionally small: the leading signal is the
user's loss of comprehension, not a general request to make every response
shorter.

## Workflow

Direct: emit **Next** only. Composed: return to caller.

**Prev:** explanation that did not land | any active skill
**Next:** done
**Relevant:** none
