# Output style — how a vs skill talks to the user

Shared by every user-facing vs skill. It governs the shape of chat messages.
[`communication.md`](./communication.md) governs what belongs in chat at all;
this file governs how that content is arranged once it gets there.

One rule underneath all of it: **everything the user must do appears in one
zone, first, and nothing actionable appears outside it.** A user who reads only
the first zone must not miss an action.

## Zones

Every terminal message with more than three lines is arranged into zones, in
this order. Skip any zone that is empty.

| Zone | Gutter | Holds |
|---|---|---|
| `YOU DO` | `▶` | Every action the user must take, plus the surface they take it on |
| `DONE` | none | What now works and what was tested |
| `NOT PROVEN` | `!` | Claims the run could not verify, each with its exact blocker |

A blocker that the user must clear is an action: it goes in `YOU DO`, not in
`NOT PROVEN`. `NOT PROVEN` is for gaps the user only needs to know about. Never
repeat a `YOU DO` action as a `NOT PROVEN` item; the action owns that gap until
the user clears it. A conditional rollback is still a user action, so it belongs
in `YOU DO` with its condition stated before the command.

### Divider format

```markdown
━━━ **YOU DO** ━━ 3 items

1. ▶ Run `./install.sh` — your installed copy is still 4.10.1
2. ▶ Open the ship-it report → evidence tab → reload → banner reads 4.11.0
3. ▶ If the release is wrong, run `git revert 3f2a91c`.

━━━ **DONE**

- **shipped** PR #214 · 3 commits · CI green
- **tested** 4 routes · 9 interactions

━━━ **NOT PROVEN**

- ! pre-today artifacts render — no archived fixture in repo
```

- The divider is a fixed three-character `━━━` lead, then the bold zone label.
  It is left-anchored and never padded to a width.
- `YOU DO` appends an item count after `━━`. Do not append a duration.
- Zone bodies are markdown lists. `YOU DO` is ordered when the steps have an
  order; `DONE` and `NOT PROVEN` are unordered.
- Markers are fixed symbols and sit inside the list item: Unicode `▶` means you
  act, Unicode `✓` marks a completed item inside prose, and ASCII `!` marks an
  unproven or blocked claim. No emoji.
- Never draw a box, a right border, or a column that needs padding math. The
  model cannot reliably count columns, and a misaligned border is worse than no
  border.

### Why this shape and not a wider one

Three constraints kill full-width rules, boxes, and aligned columns:

- **Renderer independence.** Some hosts show a terminal; some render the same
  markdown to HTML. HTML collapses a run of spaces to one, so a padded column
  like `shipped   PR #214` flattens; and a single newline is a soft break, so
  consecutive bare lines can join into one paragraph. Lists and bold labels
  survive both. Alignment and bare line breaks survive only the terminal.
- **Width independence.** Nothing here is padded to a column count, so a
  60-column terminal, a wide one, and an HTML pane all show the same break.
- **Token cost.** A full-width `━` run costs 20 to 30 tokens; three of them
  spend most of a short message's budget on chrome. The three-character lead
  costs about two.

Budget: zone chrome must stay under roughly 15 tokens per message. If the
message cannot carry that, it does not need zones.

Skip zones entirely for messages under four lines, and for progress emissions
under [`communication.md`](./communication.md), which stay one line. A single
action needs a line, not a zone.

### Do not detect the host

This format is renderer-agnostic on purpose, so no skill needs to probe for its
surface. Do not shell out for `CLAUDE_CODE_ENTRYPOINT`, `TERM_PROGRAM`, or a
Codex marker to pick a rendering: it costs a tool call, it has to be redone
every session, and it forces every skill to carry two layouts.

Where a skill genuinely must branch on host, branch on capability instead —
whether a tool such as `request_user_input` is listed, per
[`../SKILL.md`](../SKILL.md) Structured questions. That signal is already in the
model's context and costs nothing.

## Shape

1. **The first line is the next action.** Not context, not a plan. If the
   answer is a command, path, or snippet, it goes first.
2. **Restate state every turn.** `Step 3 of 5 done: schema updated.` The user
   cannot hold position across messages.
3. **State scope, not duration.** Do not show a wall-clock estimate unless the
   user explicitly asks for one.
4. **Cap any list at five.** Past five, split into do-now versus later. Five
   ranked beats ten unranked.
5. **Report errors matter-of-factly.** State cause, then fix. Never "Uh oh" or
   "There seems to be a problem".
6. **Make completed work concrete.** `Login now works with magic links` — not
   "I've made some changes to the auth flow".
7. **Suppress tangents.** Finish the first thing. Raise the second once, at the
   end, as its own question.
8. **No preamble, no recap, no closers.** Forbidden openers: "Great question",
   "Let me", "Sure!", "To answer your question". Forbidden closers: "Hope this
   helps", "Let me know if you need anything else", "Feel free to ask",
   "Happy to clarify". Start with the answer, end when the answer is done.

## Procedural sentences

These apply only to lines inside `YOU DO` and to any other step the user
executes — install commands, QA repro steps, manual verification. They do not
apply to rationale, decisions, or trade-off prose, where they would flatten the
nuance that is the point of the sentence.

- One action per sentence, imperative. No step contains "and then" twice.
- Keep the article: "open the report", not "open report".
- Under 20 words per step.
- Name the command or path literally. No idiom, no figurative phrase, no
  status word standing alone in place of the thing it describes.
- The warning comes before the step it applies to, never after.
- Use "must" for a required check. Not "should", not "could".

## Decisions are exempt from brevity

When the user's answer is a choice, the options are the answer. Render two to
four ranked options with the recommendation first and a one-clause consequence
each, per [`../SKILL.md`](../SKILL.md) Structured questions. Do not compress a
decision into a single recommended path to satisfy rule 4.

## When to break the rules

1. The user asked to "explain" or "walk me through". Run as long as the topic
   needs; still no preamble and no closer. Add headers so they can skim back.
2. A destructive action is next (`rm -rf`, force push, schema migration).
   Confirm first. Safety outranks brevity.
3. Debug spiral. After three turns of "still broken", stop iterating. Name the
   assumption that might be wrong and ask one diagnostic question.
4. Real ambiguity. One short clarifying question beats guessing.
5. A rule would delete the answer. The task wins; the shape stays.
6. The harness requires something the rule forbids. The harness wins; the shape
   stays.

## Pre-send check

Delete, in order:

1. The first sentence, if it announces what you are about to do.
2. The last sentence, if it recaps or asks "anything else?".
3. Any "by the way" sidebar.
4. Any hedging adverb carrying no information. Keep a hedge that carries real
   uncertainty — deleting that one manufactures confidence.
5. Any idiom inside a `YOU DO` step. Replace it with the literal action.

Then verify: reading only the `YOU DO` zone, does the user know everything they
must do? If yes, send.
