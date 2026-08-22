---
name: vs-eli5
description: "Explain a topic like I'm a 5 year old. Use when the user types /vs-eli5, /eli5, or asks for a dead-simple picture explainer of how something works."
---

# eli5

Explain like I'm someone who knows nothing about this topic, using an HTML artifact with big pictures and few words. Use `/vs-htmdx` for that artifact, not raw HTML. Start from `../vs-htmdx/assets/artifact.html`

Topic: $ARGUMENTS

Apply the [shared output style](../vs-internal-shared/references/output-style.md)
to every user-facing message.

## Workflow

Direct: emit **Next** only. Composed: return to caller.

**Prev:** user ask or tldr offer
**Next:** done
**Relevant:** `/vs-htmdx` | `/vs-shape-it`
