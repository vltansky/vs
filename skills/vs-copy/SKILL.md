---
name: vs-copy
description: "Use when asked to write, rewrite, edit, tighten, simplify, or polish prose for clarity. Produces plain, direct, accessible copy without losing substance or precision."
---

# Copy

Write for the reader. Make the point easy to understand on the first read while
preserving the source's meaning, nuance, facts, and required terminology.

## Flow Contract

- **Kind:** Building block
- **Inputs:** A writing goal, audience, source text or facts, and any required tone, format, terminology, or English variant
- **Outputs:** Finished copy in the requested format; brief notes only when choices, ambiguity, or missing evidence need attention
- **Status:** `COPY_READY`, `BLOCKED_MISSING_FACTS`, or `BLOCKED_AMBIGUOUS_INTENT`
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

## Workflow

1. Identify the audience, their task, the central message, and constraints.
2. Extract the facts and claims that must survive the edit.
3. Draft or restructure with the conclusion first.
4. Replace vague, passive, inflated, or repetitive language.
5. Check meaning, tone, terminology, English variant, and requested format.
6. Return the finished copy first. Add notes only for unresolved choices,
   unsupported claims, or intentional departures from the request.

## Final check

- Can the intended reader understand the main point on the first read?
- Is the most useful information first?
- Does every claim remain faithful to the source?
- Can any word, sentence, or section be removed without losing meaning?
- Are headings, links, lists, dates, numbers, and interface labels consistent?
- Did the edit preserve important nuance and warnings?

## Output

Return the copy directly in the format the user requested. Do not preface it
with process commentary. When notes are necessary, place them after the copy
under `Notes` and keep them brief.

## Workflow position

**Prev:** source material, research, draft, or direct writing request
**Next:** human review, publication, or the workflow that requested the copy
