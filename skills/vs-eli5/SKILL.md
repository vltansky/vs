---
name: vs-eli5
description: "Explain a topic like I'm a 5 year old. Use when the user types /vs-eli5, /eli5, or asks for a dead-simple picture explainer of how something works."
---

# eli5

Explain like I'm someone who knows nothing about this topic, using an HTML artifact with big pictures and few words. Use `/vs-htmdx` for that artifact, not raw HTML. Start from `../vs-htmdx/assets/artifact.html`
`/vs-htmdx` owns capture: inherit its URL + first-screen shot handoff. Pointer only.

`/vs-htmdx` owns the page write-slop pass. Inherit only. Pointer:
[../vs-htmdx/SKILL.md](../vs-htmdx/SKILL.md). Run
`skills/vs-htmdx/scripts/run-write-slop.mjs` on the page. Do not paste
that write procedure here.

Also run `skills/vs-write/scripts/reject-slop.mjs` on the 2-4 line chat
TLDR. Exit 1: rewrite the tells. Do not claim `READY_FOR_REVIEW` if
the runner did not run or exited 1.

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
**Relevant:** `/vs-htmdx` | `/vs-shape-it`
