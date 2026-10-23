---
name: vs-explain-video
description: "Make a short narrated motion explainer video about a topic, code path, or PR. Use when the user types /vs-explain-video or asks for an explainer video, animated walkthrough, or narrated video of how something works. Produces one mp4 outside the repo, with audited frame stills and a short TLDR."
---

# Explain video

Turn one question into a 60-120 second narrated motion video: one concrete
example moving through the system, each build landing on the sentence that
names it. The video is a disposable explainer artifact. Do not widen it into a
production pipeline, a reusable video framework, or a branded template.

One shot: the text checks run before the voice, then one narration, one
render, and one review whose score is reported. No step loops back.

## Flow Contract

- **Kind:** Building block
- **Inputs:** A topic, code path, or PR; for a branch or PR, its `base...head` diff
- **Outputs:** An mp4 with burned-in subtitles under
  `~/.vs/$PROJECT_ID/videos/<topic>/`, audited stills per beat, a fresh
  reviewer's score, and a 2-4 line chat TLDR
- **Status:** `VIDEO_READY` or `BLOCKED_TOOLING` (with the install step)
- **Consumers:** Direct user invocation; `/vs-show-me` or `/vs-eli5` pages
  whose visuals become scenes
- **Skip conditions:** A static page answers the question as well; use
  `/vs-show-me`. Motion must carry part of the explanation.

## How it works

```text
script.json (beats) --quiz (text, one fix)--> --narrate--> narration.wav + timeline.js
scenes.js (update(t, B)) + motion.js + index.html --render--> stills (audited) | mp4
stills + check.mjs (one fix) --> mp4 --pack.mjs--> new reviewer --> score in the handoff
```

One 1920x1080 page. Each scene is a function of time: `render.mjs` calls
`window.seek(t)` and screenshots, so every frame is exact and repeatable. The
stage draws the chrome, dot field, scene handoffs, camera push, and word captions
([references/captions.md](references/captions.md)). You write only `script.json` and `scenes.js`.

## 1. Check the tools

Run `node <skill-dir>/scripts/preflight.mjs [<work-dir>]`. The skill owns its
browser driver: when no Playwright resolves, preflight installs the pinned
`playwright-core` into `~/.vs/tooling/` once, outside any project, and drives
the installed Chrome. Do not ask before that install. It prints JSON:
`ttsEngine`, found tools, and an install hint for each missing one. Exit 2
means blocked: show the `next` text, offer the storyboard as a `/vs-show-me`
page meanwhile, and stop. Do not install system tools (ffmpeg, voices)
without the user's consent.

## 2. Read the diff, then state the question

Branch or PR: first run `node <skill-dir>/scripts/diff.mjs <work-dir>` and read
each listed file's diff; chat loses context, so it gives only the why (`covers`,
`skip`: [scenarist](references/scenarist.md)). Other topics: read the named code.
Put the question and viewer in `question` and `audience`; every scene serves it.

## 3. Scaffold

```bash
PROJECT_ID=$(git config --get remote.origin.url 2>/dev/null \
  | sed -E 's#\.git$##; s#.*[:/]([^/]+/[^/]+)$#\1#; s#/#-#g')
[ -z "$PROJECT_ID" ] && PROJECT_ID=$(basename "$PWD")
WORK="$HOME/.vs/$PROJECT_ID/videos/<topic>"
node <skill-dir>/scripts/init.mjs "$WORK"
```

It copies the stage, motion kit, fonts, and a worked example (`script.json`,
`scenes.js`); read it first. A rerun refreshes the kit, never your files.
Never commit videos, audio, or frames, or write them into the project tree.

## 4. Write the beats

Write `script.json` (beats, `pronounce`, `quiz`) with
[references/scenarist.md](references/scenarist.md); a subagent can take that
file alone. Beats are ASD-STE100-style plain English:
[../vs-internal-shared/references/ste-writing.md](../vs-internal-shared/references/ste-writing.md).
Pointer only; do not copy those rules here. Open slowly: scene one says how
this area works today, what is wrong, and the question, before any example
(motion-craft rule 0). Carry one concrete example through every scene.
Ground every claim in the code, PR, or source you read.

`pronounce` changes only what the voice says, not subtitles or the screen:
add each acronym said letter by letter (`"AICM": "A I C M"`) and each name the
voice gets wrong. Ask how the team says a name you do not know.

Run `node <skill-dir>/scripts/narrate.mjs "$WORK/script.json" --dry-run`. It
writes `narration.md` and estimates the length. Run
`node <skill-dir>/../vs-write/scripts/check-ste.mjs narration.md` on it. Exit
1: rewrite the flagged beats once; do not rerun it. Exit 2 means not
checked, not a pass.

Run `node <skill-dir>/scripts/quiz.mjs "$WORK"` and give the printed
`BRIEF.md`, and nothing else, to a new agent. It answers the script's three
`quiz` questions from the beats alone. A wrong answer or "not said" means a
beat is missing: add it once. The quiz never runs twice.

## 5. Narrate

Run `narrate.mjs` without `--dry-run`. It picks ElevenLabs when
`ELEVENLABS_API_KEY` is set in the environment, else a free local voice:
kokoro, then piper, then macOS `say`. It speaks each beat separately (cached,
so a rerun only speaks changed beats), then writes `narration.wav` and
`timeline.js`. It prints each scene's `cues`: `B[i] = <seconds>` per beat.
When the user cares about the voice, narrate one beat with 4-6 voices first
(`KOKORO_VOICE=am_michael`; default `af_heart`) and let them pick.

It then checks without ears (`narration-check.json`). With whisper installed,
it transcribes each beat; a flagged beat lost or gained words: report it in
the handoff and do not narrate again. Without whisper it says the words were not
checked; report that (`--require-word-check` exits 2). It levels the track to -16 LUFS.

The API key is a secret. Never print, log, echo, or write the key, and never
put it in a command line. Never ask the user to paste it into chat; ask them
to export it in their shell. Report only whether it is set.

## 6. Write the scenes

In `scenes.js`, one `scene(id, build)` per script scene. `build(root)` makes
the DOM once and returns `update(t, B, D)`; drive every change from `t` and the
beat starts `B`. Never use timers, `requestAnimationFrame`, or CSS animations;
they do not move under seek. Moves spring (`rise`, `pop`, `spring`,
`springTo`); never move anything linearly. Hold each build for its settle plus
`readTime(text)` before the next one lands.

Every sentence gets a visual change. Start the build for beat i at `B[i]` (or
up to a second after, on the word that names it). A beat with no build is a
slide; redraw it as the example moving through the system. Kit helpers,
layout grid, and the design rules: [references/motion-craft.md](references/motion-craft.md).

Short form: fixed colors (accent = under discussion, red = broken or removed,
green = fixed or kept), type 20px or larger, staggered entrances, keep old
state dimmed rather than removed, at most three regions, bottom 150px clear.

## 7. Check, then render

```bash
node <skill-dir>/scripts/render.mjs "$WORK" --stills [--scene <id>]
node <skill-dir>/scripts/check.mjs "$WORK"
```

`--stills` screenshots each beat end and scene end, and audits the layout.
`check.mjs` measures over time: seek drift or randomness (`DETERMINISM`), a
beat that changes under 0.5% of the frame (`NO-BUILD`), and text that
flashes, is under 20px, holds too long, or overlaps (`FLASH`, `SMALL`,
`LONG`, `OVERLAP`). Exit 1: fix each FAIL in `scenes.js` once
([references/checks.md](references/checks.md)) and rerun once; what still
fails goes in the handoff. Then open each still and look at it: the checks
catch geometry and timing, not meaning. A frame you did not look at is not
verified.

```bash
node <skill-dir>/scripts/render.mjs "$WORK" --out "$WORK/<topic>.mp4"
```

Use `--scene <id>` with `--out` for a quick preview of one scene. The full
render checks the ffprobe duration against the timeline and exits 1 when they
differ by more than 0.25 s; report that, do not narrate again.

Subtitles are burned in only, drawn by the stage. Do not add a soft subtitle
track or a sidecar `.srt`: players show every line twice. Do not add
HyperFrames, Remotion, or Manim to a project for this video.

## 8. Fresh review

```bash
node <skill-dir>/scripts/pack.mjs "$WORK" "$WORK/<topic>.mp4"
```

Give the printed `BRIEF.md`, and nothing else, to a new agent that has seen
none of the work. Save its reply as `review/REPLY.md` and run
`verdict.mjs "$WORK"`: PASS needs 8 or more on every axis, by the scores;
anything less is BELOW. One review: its score and three problems go in the
handoff. Do not re-render or review again. Never report a pass that did not
happen. Rules: [references/reviewer-brief.md](references/reviewer-brief.md).

## 9. Handoff

Give the mp4 path as a `file://` link, the stills folder, and a 2-4 line
TLDR: the question, the answer, the voice, the length, the review verdict
with its scores (or "not reviewed by fresh eyes"), and any open quiz gap,
word flag, or check failure. Listen-check is not possible for the agent; say
so. Mark anything not checked as unverified.

Topic: $ARGUMENTS

Apply the [shared output style](../vs-internal-shared/references/output-style.md)
to every user-facing message.

## Workflow

Direct: emit **Next** only. Composed: return to caller.

**Prev:** user ask, or a `/vs-show-me` page that needs motion
**Next:** done
**Relevant:** `/vs-explain-pr`
