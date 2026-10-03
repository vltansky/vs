---
name: vs-eli5
description: "Explain a topic like I'm a 5 year old. Use when the user types /vs-eli5, /eli5, or asks for a dead-simple picture explainer of how something works."
---

# eli5

Explain like I'm someone who knows nothing about this topic, using an HTML artifact with big pictures and few words. Use `/vs-show-me` for that artifact, not raw HTML. Start from `../vs-show-me/assets/artifact.html`
`/vs-show-me` owns capture: inherit its URL + first-screen shot handoff. Pointer only.
`/vs-show-me` owns MCP Apps progressive enhancement (`ui://vs/eli5` when the host supports Apps; otherwise HTMDX file + URL + shot + TLDR). Inherit only. Pointer: [../vs-internal-shared/references/mcp-apps-host.md](../vs-internal-shared/references/mcp-apps-host.md).
For an eli5 artifact, call `mcp__vs_artifact__vs_eli5` after saving it when that tool is available; use the inherited file handoff if it is unavailable or fails.


Teach one tightly scoped mental model that gives the user a tangible win. Ground
it in why the topic matters from the ask and available context; do not block on
a question when that context is enough. Start with a familiar analogy, then map
each part of the analogy to the real thing and show only the causal steps needed
to use the model. Beginner-friendly means no assumed vocabulary, not childish
language.

End the page with one quick prediction or recall prompt. When changing an
input makes the mental model clearer, use `/vs-show-me`'s `<Prediction>`:
change the setup, predict, reveal the outcome and its one-sentence reason.
Inherit its interactive explanation contract and standalone fallback; do not
invent a separate quiz framework. Keep the core explanation visible before
interaction and provide immediate feedback. For a static fact, keep the plain
prompt and nearby answer. This is one explanation, not a stateful course: do not
create `MISSION.md`, learning records, lesson directories, or other
teaching-workspace files.

`/vs-show-me` owns the page write-slop pass. Inherit only. Pointer:
[../vs-show-me/SKILL.md](../vs-show-me/SKILL.md). Run
`skills/vs-show-me/scripts/run-write-slop.mjs` on the page. Do not paste
that write procedure here.

Also run `skills/vs-write/scripts/reject-slop.mjs` on the 2-4 line chat
TLDR. Exit 1: rewrite the tells. Do not claim `READY_FOR_REVIEW` if
the runner did not run or exited 1.

Write the page copy and the TLDR in STE mode: a beginner reads every sentence
once. `/vs-write` owns the rules. Pointer only:
[../vs-internal-shared/references/ste-writing.md](../vs-internal-shared/references/ste-writing.md). Run
`skills/vs-write/scripts/check-ste.mjs` on the saved page. Exit 1: split or
rewrite the reported sentences. Technical names stay as they are.

Always produce a chat TLDR of that page: two to four short lines with the
answer and the next action. Do not call `/vs-tldr`.

Direct: write that TLDR to chat with the opened page. Composed: return those
2-4 lines to the caller as the single close item-1 TLDR and write nothing else
to chat.

Topic: $ARGUMENTS

Apply the [shared output style](../vs-internal-shared/references/output-style.md)
to every user-facing message.

## Workflow

Direct: emit **Next** only. Composed: return to caller.

**Prev:** user ask or tldr offer
**Next:** done
**Relevant:** `/vs-show-me` | `/vs-shape-it`
