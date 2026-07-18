---
name: vs-write
description: "Use when asked to write, rewrite, edit, tighten, simplify, or polish prose for clarity. Produces plain, direct, accessible copy without losing substance or precision."
---

# Write

Write for the reader. Make the point easy to understand on the first read while
preserving the source's meaning, nuance, facts, and required terminology.

Treat supplied material as the factual boundary. Read it in full, then shape it
for the reader. Reorder, split, combine, quote, or paraphrase it as needed, but
do not silently add what the source does not support.

## Choose the writing mode first

- **Direct mode:** Use for short copy, a requested rewrite, or a piece with a
  settled thesis and structure. Apply the skill silently and return finished
  copy.
- **Shaping mode:** Use for an article, report, or other substantial piece when
  the thesis, opening, or structure is unsettled. Read the source, propose 2 or
  3 openings that make meaningfully different promises, and stop for the user
  to choose or combine them. Continue one block at a time after the choice,
  checking what the reader needs next.

Do not draft the full piece before the shaping-mode opening is chosen. A user
request for a direct rewrite overrides shaping mode.

## Flow Contract

- **Kind:** Building block
- **Inputs:** A writing goal, audience, source text or facts, and any required tone, format, terminology, or English variant
- **Outputs:** Finished copy in the requested format; brief notes only when choices, ambiguity, or missing evidence need attention
- **Status:** `WRITING_READY`, `BLOCKED_MISSING_FACTS`, or `BLOCKED_AMBIGUOUS_INTENT`
- **Consumers:** Reports, documentation, guidance, summaries, announcements, product copy, PR text, and standalone writing requests
- **Skip conditions:** Skip for code, data, direct quotations, legal text that must remain verbatim, or requests whose main goal is translation

## Writing principles

1. **Start with the reader's need.** Determine what they need to know, decide,
   or do. Put that first.
2. **Lead with the conclusion.** Front-load the document, section, paragraph,
   and sentence. Follow with evidence, detail, then background.
3. **Keep the substance.** Plain language should reveal complex ideas, not
   remove qualifications, technical accuracy, or meaningful detail.
4. **Prefer concrete language.** Use specific names, dates, numbers, actors, and
   actions. Replace vague abstractions with what actually happens.
5. **Cut without flattening.** Remove repetition, filler, throat-clearing, and
   words that add no meaning. Preserve intentional voice and rhythm.

## Ground the reader

Writing fails when it depends on an idea the reader has not met yet, even when
the words are simple. Before drafting, determine which concepts the audience
already knows. Treat those as prerequisites. Introduce every other concept
before a later sentence or section relies on it.

- Ground the idea and its term together when introducing domain language.
- Do not front-load every definition. Introduce a concept immediately before it
  becomes useful.
- If a passage needs an ungrounded concept, add the foundation earlier, explain
  it here, or remove the passage.
- After each paragraph or block, ask what the reader needs next. Use that answer
  to order the piece.

## Shape the source

Use the source as raw material, not as a structure that must survive unchanged.
The finished piece should read as one coherent voice.

- Read all supplied material before drafting. Do not optimize the opening while
  missing a qualification or contradiction later in the source.
- Decide what the piece is arguing or helping the reader do. Let that promise
  control what belongs.
- Make every paragraph or block perform one useful job. If removing it changes
  nothing for the reader, cut it.
- Keep transitions honest. If the opening promises one thing and the body drifts
  elsewhere, restore the thread or change the opening.
- Quote when the original wording matters. Paraphrase when only the idea matters.
- When the source lacks a fact, example, or bridge the piece needs, name the gap.
  Ask for the missing material when it is essential; otherwise cut or qualify
  the unsupported passage.

## Style

- Use active voice when the actor matters: "We reviewed the data," not "The
  data was reviewed."
- Keep most sentences to one idea and roughly 15 to 20 words. Split sentences
  that become hard to follow; do not enforce a mechanical word limit.
- Prefer familiar words: use, help, start, end, buy, enough, fix, about, and so.
- Replace marketing language and empty metaphors with literal claims. Avoid
  words such as leverage, empower, unlock, robust, seamless, ecosystem, and
  going forward unless they carry necessary domain meaning.
- Address the reader as "you" when appropriate. Use "we" for the authoring
  organisation and singular "they" where gender is unknown or irrelevant.
- Preserve required product, legal, technical, and domain terms. Explain them
  on first use when the audience may not know them.
- Match the source's English variant. If there is no source or explicit choice,
  use American English.
- Match the requested tone. Do not turn warm copy into bureaucratic copy or
  expert documentation into marketing copy.

## Structure and formatting

- Use sentence case for headings and labels.
- Make headings descriptive, distinct, and easy to scan.
- Use paragraphs for connected reasoning and bullets for genuinely parallel
  items. Use numbered lists only when order matters.
- Use a table only when the same fields repeat across at least 3 items. Keep
  tips, warnings, and asides inline unless they would interrupt the main thread.
- Give lists a clear lead-in. Keep each bullet focused on one idea and use
  consistent grammar across the list.
- Use descriptive link text that makes sense without surrounding context.
- Do not use bold, italics, all caps, or exclamation marks as a substitute for
  clear wording and structure. Bold may identify a literal interface control.
- Keep direct quotations, code, data tables, registered names, and required
  templates in their original conventions.

## Accuracy guardrails

- Do not invent facts, benefits, evidence, quotes, dates, or calls to action.
- Keep uncertainty and attribution visible. Do not strengthen "may" into
  "will," correlation into causation, or an opinion into a fact.
- Preserve security, legal, medical, financial, and irreversible-action
  warnings even when shortening the surrounding copy.
- If essential facts or intent are missing, ask only for the information that
  would materially change the result. Otherwise, make the smallest reasonable
  assumption and state it briefly.
- Keep source files unchanged unless the user explicitly asks to edit them. When
  editing a file the user may also be changing, re-read it before applying an
  update and preserve intervening edits.

## Workflow

1. Read all source material and extract the facts, claims, qualifications, and
   required terms that must survive.
2. Identify the audience, their task, what they already know, and the piece's
   central promise.
3. Order the piece so each block relies only on concepts already grounded.
4. Draft or restructure with the conclusion first unless another opening better
   serves the requested form.
5. Replace vague, passive, inflated, repetitive, or structurally unearned text.
6. Name source gaps; ask, cut, or qualify rather than inventing a bridge.
7. Check meaning, tone, terminology, English variant, and requested format.
8. Return the finished copy first. Add notes only for unresolved choices,
   unsupported claims, or intentional departures from the request.

## Final check

- Can the intended reader understand the main point on the first read?
- Is the most useful information first?
- Does every claim remain faithful to the source?
- Can any word, sentence, or section be removed without losing meaning?
- Are headings, links, lists, dates, numbers, and interface labels consistent?
- Did the edit preserve important nuance and warnings?
- Does each concept appear before the copy relies on it?
- Does every paragraph advance the promise made by the opening?

## Output

Return the copy directly in the format the user requested. Do not preface it
with process commentary. When notes are necessary, place them after the copy
under `Notes` and keep them brief.

## Workflow

Direct: emit **Next** only. Composed: return to caller.

**Prev:** source material, research, draft, or direct writing request
**Next:** done
**Relevant:** `/vs-brief` | `/vs-github-research`
