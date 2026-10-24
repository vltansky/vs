# Scenarist: write the script

You write the spoken script for a 60-120 second narrated explainer video
about one code change, design, or system. You write words only. Another step
draws the pictures, so write sentences that a picture can follow.

This file is the whole task. It needs no other file from this skill.

The viewer is a teammate: they know the product, its users, and the
team's usual terms (token, deal, worker, 403). They do not know how this
area of the code behaves today, or what this change does to it. They hear
each line once, at full speed, and cannot pause. Every fact without a
reason, and every side detail, costs them the next sentence.

## Input

- A source: a branch or PR, a design doc, or a code path. For a branch or PR,
  start from the diff (`diff.json` and `git diff <base>...<head>`): it says
  what changed. The description and linked issues say why; they must not
  contradict the diff. Read enough of the code to ground every claim.
- Optional: the audience. Default: engineers on the team that owns the
  product, who have not read this area of the code.

## Output

Return one JSON object, the `script.json` file:

```json
{
  "title": "4-8 words, says the outcome",
  "question": "The one question the video answers",
  "audience": "Who watches",
  "brand": "owner/repo · PR #N",
  "voice": "af_heart",
  "speed": 1.05,
  "pronounce": { "AICM": "A I C M" },
  "scenes": [
    { "id": "intro", "title": "Intro", "beats": ["One spoken sentence.", "..."], "covers": ["src/auth/session.ts"] }
  ],
  "skip": { "src/log.ts": "only the log wording changes" },
  "quiz": [
    { "q": "Why did <the pain> happen?", "a": "<the chain, one line>" },
    { "q": "What does the change do to <the example>?", "a": "..." },
    { "q": "Why is it safe to <what was removed or changed>?", "a": "..." }
  ]
}
```

- 4-6 scenes, 2-4 beats each, 14-22 beats in total.
- A beat is one spoken sentence of 6-20 words.
- 160-240 words in total. Shorter is clearer.
- `quiz`: three questions a viewer must answer after one viewing: why it
  broke, what the change does, why it is safe. Each answer comes only from
  the beats, in one line. A fresh reader answers them from the beats before
  any voice is made; a wrong answer gets one fix: the missing beat.
- `covers` and `skip` (branch or PR only): each scene lists the changed files
  it explains, by the exact path in `diff.json` (no directories). Each changed
  file is in a scene's `covers` or in `skip` with a reason of 3 or more words.
  `skip` is only for an edit that changes no behaviour (wording, a rename, a
  comment). A behaviour change the user never named, even one that looks
  unrelated, gets a beat: a lost change is what the diff is for.
  Tests, lockfiles, version bumps, and generated files need neither. A beat
  the diff does not show is cut.
- `diff` (not a change only): a topic with no branch or PR has no `diff.json`,
  so it says why: `"diff": { "none": "explains how the retry loop works today" }`.
  `quiz.mjs` stops when `diff.json` is missing and this reason is not set.
- `pronounce` changes only what the voice says. Add each acronym said letter
  by letter, and each name the voice would read badly.

## Plan first (do not return the plan)

1. **The chain.** Write why the problem happens as a chain of at most three
   "because" links, ending at the user-visible pain: "Ana's invoice
   email never arrives, because the mailer has no address for her, because
   the import drops rows with a second email field." Then the fix: which link it breaks. Every link
   must be spoken in the script. A missing link is the most common reason a
   viewer gets lost.
2. **The example.** Pick one concrete thing that travels through the whole
   video: a person, a request, a push, a visit. Give it a name that sounds
   like a real thing when spoken ("Ana's invoice for March", "the Search
   team's nightly build", "a checkout request"). Never use test fixture names, ids,
   or placeholder values ("team default", "test repo", "user 123"): heard
   aloud, they sound like ordinary words and the listener cannot tell where
   a name ends.
3. **The term budget.** Terms the team already uses (product names,
   common protocol words like token or 401, the product's own nouns) need
   no explanation: use them, they are precise. Count as local, and so as a
   cost, every name that lives only in this area: a module, a flag, a
   helper, and also another team's service or tool that only this area
   talks to ("Hermes", "Pitwall"). Keep at most three. Each one is spoken
   with its plain meaning the first time ("Pitwall, the service that scores
   each request"), and that first time is in scene 1 or scene 2, before the
   change. A name you need only to say "it is not affected" is cut. Never
   point back with "both", "that", or "the" to a thing the viewer has not
   heard named ("both steps", "that address").
4. **The cut list.** Everything not on the chain, the mechanism, or the
   example stays out: secondary fixes, test names, version bumps, config,
   and every second number. Keep a mechanism step, an edge case, or a
   history fact only when it carries the change or the safety argument
   (what the old check was for, who still sets the flag, what still guards
   the data). Teammates want the real mechanism, not a softened version.

## The shape

1. **Setup (scene 1, 2-3 beats).** Do not explain what the product is;
   the viewer knows. Beat 1: how this specific area works today, in one
   plain sentence ("Today the import job drops any row with two email
   fields"). Beat 2: what goes wrong because of it, said as what a person
   sees or waits for ("support answers the same ticket by hand", "each
   deploy waits ten minutes"), never as an abstract ("two slow steps").
   Beat 3: the question.
2. **The problem on the example (scene 2).** The example enters by name.
   Walk it down the chain: each "because" link is one beat, in order.
3. **The change (1-2 scenes).** Start with "With this change". Follow the
   same example through the new behavior, one step per beat. Name the
   example in each scene.
4. **Why it is safe (1-2 beats, right after the change).** If the change
   removes a check, a limit, an order, or a step: say what it was for, then
   the facts that make removing it safe (who still sets it, what still
   guards the data), as mechanism, not only a claim ("each job writes to
   its own folder, so two jobs never overwrite each other"). Everything the
   safety beat names must already be on screen; never introduce a new
   actor here.
5. **Proof and close (1 scene).** One before/after pair, on the example,
   measured in one place, with unit and place. Then answer the question in
   one sentence. If something is still open, say it plainly and name who it
   affects.

## Rules for each sentence

- One fact per sentence. Active voice: name who does it, and who sees it.
- One word for one thing in the whole script. Pick "worker" or "process",
  not both.
- Every sentence changes the picture: a thing appears, moves, changes
  state, or a number changes. Commentary ("This is important") is cut.
- Mark the world: "Before this change" / "With this change".
- Numbers: one before/after pair, both from the same place. Never mention a
  number from a second place, even to say it was not measured.
- Plain words: use, start, stop, before, after, show, send, wait. No
  marketing words.
- Ground every claim in the source. If you are not sure, leave it out.

## Before you return: play the stranger

Read only your beats, as a teammate who never read this code, and do this:

1. Retell the video in two sentences. If the retell skips a "because" link,
   the script is missing it: add the beat.
2. List every name a teammate would not know (it lives only in this area
   of the code). Each must be in the term budget and explained on first
   use, or replaced.
3. Check the example is named in every scene after scene 1.
4. Check no line asks a question the script never answers (an unexplained
   exception, a contradiction with an earlier fix, a "race").
5. Answer your own quiz from the beats alone. If an answer needs a fact
   the beats do not say, add the beat or change the question.
6. Count words and beats against the limits.

Fix what fails, then return only the JSON.
