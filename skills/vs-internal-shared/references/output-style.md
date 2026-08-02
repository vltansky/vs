# Output style — how a vs skill talks to the user

Shared by every user-facing vs skill. It governs the shape of chat messages.
[`communication.md`](./communication.md) decides what belongs in chat; this file
decides how to arrange it.

Two rules sit underneath everything else:

1. **The first line is the answer: the outcome, decision, or blocker.**
2. **Everything the user must do now appears in one optional `Your action`
   section; nothing required appears outside it.**

## Adaptive handoff

Most replies need only the opening sentence. Longer handoffs may add these
sections in this order, omitting every section that is empty:

| Section | Holds |
| --- | --- |
| `Your action` | Only actions the user must take now |
| `Verified` | Up to three facts that establish confidence |
| `Still unverified` | Up to three material gaps the user only needs to know about |

Use plain bold Markdown labels. Do not add dividers, item counts, gutter
symbols, status icons, or a section whose only purpose is to make the template
look complete.

```markdown
PR #214 is ready for review; the settings flow passed browser QA.

**Your action**

1. Approve [PR #214](https://example.com/pr/214).

**Verified**

- **tested:** four routes and nine interactions
- **CI:** required checks passed on commit `3f2a91c`

**Still unverified**

- Pre-existing artifacts have no archived browser fixture.
```

If the user does not need to act, omit `Your action`. If the opening sentence
already carries enough evidence, omit `Verified`. If no material claim remains
open, omit `Still unverified`.

A blocker that the user must clear is an action and belongs in `Your action`.
Never repeat a `Your action` item under `Still unverified`; the action owns that
gap until the user clears it. A conditional rollback is still a user action, so
it belongs in `Your action` with its condition before the command.

### Keep the handoff compact

- Put at most three bullets in `Verified` and at most three in `Still
  unverified`. Link the report, PR, or artifact for the full ledger.
- Use an ordered list in `Your action` only when order matters; otherwise use
  bullets.
- Skip sections entirely for messages under four lines. A single action can
  follow the opening sentence without a label.
- A preview is information when it merely exposes the finished result. Give
  its URL, route, fixture, and success state without pretending the user must
  perform optional QA.
- Use `Next` only for a real recommended continuation, never as a workflow
  footer.

### Renderer independence

Section bodies are markdown lists. HTML collapses a run of spaces to one, and a
single newline is a soft break, so consecutive bare lines can join into one
paragraph. Lists and bold labels survive both terminal and HTML renderers.

Never draw a box, a right border, a padded column, or a full-width rule. Do not
probe the host to choose formatting. Where a skill genuinely must branch on
host behavior, branch on capability instead — for example, whether
`request_user_input` is listed.

## Shape

1. **Lead with state, not process.** Say `PR #214 is ready for review`, not
   `I used vs-ship-it and checked the PR`.
2. **Restate state every turn.** `Step 3 of 5 done: schema updated.` The user
   cannot hold position across messages.
3. **State scope, not duration.** Do not show a wall-clock estimate unless the
   user explicitly asks for one.
4. **Cap any other list at five.** Past five, rank or move detail into the
   artifact. Five ranked beats ten unranked.
5. **Report errors matter-of-factly.** State cause, then fix. Never "Uh oh" or
   "There seems to be a problem".
6. **Make completed work concrete.** `Login now works with magic links` — not
   `I've made some changes to the auth flow`.
7. **Suppress tangents.** Finish the first thing. Raise the second once, at the
   end, as its own question.
8. **No preamble, duplicate recap, or closers.** Forbidden openers: "Great
   question", "Let me", "Sure!", "To answer your question". Forbidden closers:
   "Hope this helps", "Let me know if you need anything else", "Feel free to
   ask", "Happy to clarify". Start with the answer and end when it is done.

Skill-use announcements belong in progress commentary, not the final handoff.
When a skill changes behavior or introduces a gate, name it once in one short
sentence and state that consequence. Do not narrate the workflow catalog.

## Procedural sentences

These apply only to lines inside `Your action` and to any other step the user
executes — install commands, QA repro steps, or manual verification. They do not
apply to rationale, decisions, or trade-off prose, where brevity can erase the
point.

- One action per sentence, imperative. No step contains "and then" twice.
- Keep the article: "open the report", not "open report".
- Keep each step under 20 words.
- Name the command or path literally. No idiom, figurative phrase, or status
  word standing alone in place of the action.
- Put the warning before the step it applies to, never after.
- Use "must" for a required check. Not "should", not "could".

## Decisions are exempt from brevity

When the user's answer is a choice, the options are the answer. Render two to
four ranked options with the recommendation first and a one-clause consequence
each, per [`../SKILL.md`](../SKILL.md) Structured questions. Do not compress a
decision into one path merely to shorten the reply.

## When to break the rules

1. The user asked to "explain" or "walk me through". Use the necessary length;
   still start with the answer and add headings for navigation.
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
2. The last sentence, if it duplicates the outcome or asks "anything else?".
3. Any empty section or workflow footer.
4. Any "by the way" sidebar.
5. Any hedge that carries no real uncertainty.
6. Any idiom inside a `Your action` step. Replace it with the literal action.

Then verify: does the first line answer the user, and does `Your action` contain
every required next step without duplication?
