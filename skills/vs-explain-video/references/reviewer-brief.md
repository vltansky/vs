# The fresh reviewer

The maker knows what each scene means, so the maker cannot see what a
stranger misses. The reviewer is a new agent that has seen none of the work.
It stands in for a viewer who sees the video once, at full speed, with no
context. Its score is the score.

Idea from take-one (github.com/talsiach/take-one, MIT); the rubric here is
for code explainers.

## Rules

- **A new agent every round.** A reviewer that saw the last cut is anchored
  to it. Never reuse one, and never review the video yourself instead.
- **It reads the pack and the video, nothing else.** No conversation, no
  `script.json`, no `scenes.js`, no code, no earlier score.
- **It cannot hear.** `WORDS.md` gives it every spoken line with its time and
  the sound measures.
- **The bar is 8.** PASS needs 8 or more on every axis. Anything less is
  RETURN.
- **RETURN goes back to the scenes.** Fix what it names in `scenes.js` (or
  the beats in `script.json`, then narrate again). Rerun `render.mjs --stills`
  and `check.mjs`, render again, build a new pack, and give it to a new
  reviewer.
- **Three rounds at most.** `pack.mjs` refuses a fourth. Still under the bar
  after round 3: stop, deliver the video with the last score and the open
  problems, and let the user decide. Never report a pass that did not
  happen.
- **A fix after the last review is not reviewed.** Say so in the handoff.
- **No subagent available:** say "not reviewed by fresh eyes" in the
  handoff. That is unverified, not a pass.

## Build the pack

```bash
node <skill-dir>/scripts/pack.mjs "$WORK" "$WORK/<topic>.mp4"
```

It writes `review/round-N/` with one-frame-a-second sheets, beat grids,
12-frame strips across each scene cut, a 360 px phone-width sheet,
`WORDS.md`, and `BRIEF.md`. Put `question`, `audience`, and `locked` in
`script.json` so `WORDS.md` carries them.

## The brief

`pack.mjs` copies this block into `BRIEF.md` with the paths filled in. Give
the new agent that file as its whole task.

<!-- brief -->
You are the reviewer for a short narrated explainer video about code. You
have seen none of the work behind it, and that is the point: you stand in for
a viewer who sees it once, at full speed, with no context. Be honest and
specific. A kind score is useless, and so is a harsh one that is not tied to
something visible.

This is review round [round]. Everything you may look at is in one folder:
[pack folder]. Start with WORDS.md there. Then look at every image: the
one-frame-a-second sheets, the beat grids, every strip, and the phone-width
sheet. The video is [video]; you may pull a few more frames from it with
ffmpeg for a closer look. Do not open any other file. Judge only what a
viewer sees and hears.

Report, in this order, in under 400 words:

1. The video retold in one sentence, as a viewer would tell a friend. If you
   could not follow something, say what.
2. Scores from 1 to 10, one line of reason each:
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
4. Verdict: PASS if every score is 8 or more, otherwise RETURN.
<!-- /brief -->
