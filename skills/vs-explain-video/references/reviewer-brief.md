# The fresh reviewer

The maker knows what each scene means, so the maker cannot see what a
stranger misses. The reviewer is a new agent that has seen none of the work.
It stands in for a viewer who sees the video once, at full speed, with no
context. Its score is the score.

Adapted from take-one's `references/reviewer-brief.md`
(github.com/talsiach/take-one), Copyright (c) 2026 Tal Siach, MIT. See
[LICENSE.take-one](../LICENSE.take-one) and `THIRD_PARTY_NOTICES.md`. Modified
by vs: the rubric is for code explainers.

## Rules

- **A new agent.** One that saw any of the work is anchored to it. Never
  reuse one, and never review the video yourself instead.
- **It reads the pack and the video, nothing else.** No conversation, no
  `script.json`, no `scenes.js`, no code, no earlier score.
- **It cannot hear.** `WORDS.md` gives it every spoken line with its time and
  the sound measures.
- **The bar is 8.** PASS needs 8 or more on every axis. Anything less is
  BELOW. `verdict.mjs` decides by the scores, so a PASS with a 7 is BELOW.
- **One review, reported.** The video is made once. The review is a score
  for the handoff, not a gate: BELOW is delivered with the scores and the
  three problems, and the user decides. `pack.mjs` refuses a second pack; a
  pack that fails can be rerun. Never report a pass that did not happen.
- **A fix after the review is not reviewed.** Say so in the handoff.
- **No subagent available:** say "not reviewed by fresh eyes" in the
  handoff. That is unverified, not a pass.

## Build the pack

```bash
node <skill-dir>/scripts/pack.mjs "$WORK" "$WORK/<topic>.mp4"
```

It writes `review/` with one-frame-a-second sheets, beat grids,
12-frame strips across each scene cut, a 360 px phone-width sheet,
`WORDS.md`, and `BRIEF.md`. Put `question`, `audience`, and `locked` in
`script.json` so `WORDS.md` carries them.

## Read the reply

Save the reviewer's whole reply as `review/REPLY.md`, then run:

```bash
node <skill-dir>/scripts/verdict.mjs "$WORK"
```

Exit 0 means the reply was scored, PASS or BELOW. Exit 2 means the reply has
no score for every axis: it is not a review, so give `BRIEF.md` to a new
reviewer.

## The brief

`pack.mjs` copies this block into `BRIEF.md` with the paths filled in. Give
the new agent that file as its whole task.

<!-- brief -->
You are the reviewer for a short narrated explainer video about code. You
have seen none of the work behind it, and that is the point: you stand in for
a viewer who sees it once, at full speed, with no context. Be honest and
specific. A kind score is useless, and so is a harsh one that is not tied to
something visible.

Everything you may look at is in one folder:
[pack folder]. Start with WORDS.md there. Then look at every image: the
one-frame-a-second sheets, the beat grids, every strip, and the phone-width
sheet. The video is [video]; you may pull a few more frames from it with
ffmpeg for a closer look. Do not open any other file. Judge only what a
viewer sees and hears.

Report, in this order, in under 400 words:

1. The video retold in one sentence, as a viewer would tell a friend. If you
   could not follow something, say what.
2. Scores from 1 to 10, one line each, written as `- axis: N` and then the
   reason:
   - setup: from the first 15 seconds alone, can you say what the system
     is, what is wrong or missing today, and which question the video
     answers? A video that starts inside the example scores 5 or less.
   - answer: does it answer the question in WORDS.md?
   - example: can you follow one concrete example from start to end?
   - builds: does every spoken line change the picture, or are some slides?
   - readability: can you read every word on the phone-width sheet?
   - pacing: is each thing on screen long enough to read, and nothing
     piled up?
   - sync: does each picture land on the line that names it (use the times
     in WORDS.md)?
   - overall: against the best explainer videos you know.
3. The three worst problems, each with a timestamp and what exactly is wrong.
4. Verdict: PASS if every score is [bar] or more, otherwise BELOW.
<!-- /brief -->
