---
name: vs-explain-video
description: "Make a short narrated motion explainer video about a topic, code path, or PR. Use when the user types /vs-explain-video or asks for an explainer video, animated walkthrough, or narrated video of how something works. Produces one mp4 outside the repo, with audited frame stills and a short TLDR."
---

# Explain video

Turn one question into a 60-120 second narrated motion video: one concrete
example moving through the system, each build landing on the sentence that
names it. The video is a disposable explainer artifact. Do not widen it into a
production pipeline, a reusable video framework, or a branded template.

## Flow Contract

- **Kind:** Building block
- **Inputs:** A topic, code path, or PR, plus enough context to answer one
  question about it
- **Outputs:** An mp4 with burned-in subtitles under
  `~/.vs/$PROJECT_ID/videos/<topic>/`, audited stills per beat, and a 2-4
  line chat TLDR
- **Status:** `VIDEO_READY` or `BLOCKED_TOOLING` (with the install step)
- **Consumers:** Direct user invocation; `/vs-show-me` or `/vs-eli5` pages
  whose visuals become scenes
- **Skip conditions:** A static page answers the question as well; use
  `/vs-show-me`. Motion must carry part of the explanation.

## How it works

```text
script.json (beats) --narrate--> narration.wav + timeline.js (beat starts, subtitles)
scenes.js (update(t, B)) + motion.js + index.html --render--> stills (audited) | mp4
```

One 1920x1080 page. Each scene is a function of time: `render.mjs` calls
`window.seek(t)` and screenshots, so every frame is exact and repeatable. The
stage draws the chapter bar, progress line, scene crossfades, and subtitles.
You write only `script.json` and `scenes.js`.

## 1. Check the tools

Run `node <skill-dir>/scripts/preflight.mjs [<work-dir>]` (pass the work dir
once it exists, so Playwright installed there counts). It prints JSON: `ttsEngine`,
found tools, and an install hint for each missing one. Exit 2 means blocked:
show the `next` text, offer the storyboard as a `/vs-show-me` page meanwhile,
and stop. Do not install tools without the user's consent.

## 2. State the question and audience

Write one sentence: the single question this video answers, and who watches
it. Every scene must move toward that answer. Cut any scene that does not.

## 3. Scaffold

```bash
PROJECT_ID=$(git config --get remote.origin.url 2>/dev/null \
  | sed -E 's#\.git$##; s#.*[:/]([^/]+/[^/]+)$#\1#; s#/#-#g')
[ -z "$PROJECT_ID" ] && PROJECT_ID=$(basename "$PWD")
WORK="$HOME/.vs/$PROJECT_ID/videos/<topic>"
node <skill-dir>/scripts/init.mjs "$WORK"
```

It copies the stage, the motion kit, fonts, and a worked example
(`script.json`, `scenes.js`). Read the example before writing your own; it
shows every pattern below. Rerunning `init.mjs` refreshes the kit and never
overwrites your script or scenes. Never commit videos, audio, or frames, and
never write them into the project tree.

## 4. Write the beats

`script.json` holds `title`, `brand` (top-left label), `voice`, `speed`,
`pronounce`, and 4-7 scenes of 2-4 beats. A beat is one spoken sentence, at
about 150 words a minute. Write the beats in ASD-STE100-style plain English:
short sentences, one fact per sentence, active voice, one word for one
meaning. Rules and examples:
[../vs-internal-shared/references/ste-writing.md](../vs-internal-shared/references/ste-writing.md).
Pointer only; do not copy those rules here. Ground every claim in the code,
PR, or source you read.

Carry one concrete example through every scene: a named plugin, request, or
value the viewer can follow from start to end. Abstract boxes with generic
labels read as slides. If no real example exists, invent a small one and say
so in the first scene.

`pronounce` changes only what the voice says; subtitles and the screen keep
the written form. Add every acronym said letter by letter (`"AICM": "A I C M"`)
and every name the voice gets wrong. When you do not know how the team says a
name, ask.

Run `node <skill-dir>/scripts/narrate.mjs "$WORK/script.json" --dry-run`. It
writes `narration.md` and estimates the length. Run
`node <skill-dir>/../vs-write/scripts/check-ste.mjs narration.md` on it. Exit
1: rewrite the flagged beats. Exit 2 means not checked, not a pass.

## 5. Narrate

Run `narrate.mjs` without `--dry-run`. It picks ElevenLabs when
`ELEVENLABS_API_KEY` is set in the environment, else a free local voice:
kokoro, then piper, then macOS `say`. It speaks each beat separately (cached,
so a rerun only speaks changed beats), then writes `narration.wav` and
`timeline.js`. It prints each scene's `cues`: `B[i] = <seconds>` per beat.

When the user cares about the voice, narrate one beat with 4-6 voices first
(`KOKORO_VOICE=am_michael` and so on; default `af_heart`) and let them pick
before the full run.

The API key is a secret. Never print, log, echo, or write the key, and never
put it in a command line. Never ask the user to paste it into chat; ask them
to export it in their shell. Report only whether it is set.

## 6. Write the scenes

In `scenes.js`, one `scene(id, build)` per script scene. `build(root)` makes
the DOM once and returns `update(t, B, D)`; drive every change from `t` and the
beat starts `B`. Never use timers, `requestAnimationFrame`, or CSS animations;
they do not move under seek.

Every sentence gets a visual change. Start the build for beat i at `B[i]` (or
up to a second after, on the word that names it). A beat with no build is a
slide; redraw it as the example moving through the system. Kit helpers,
layout grid, and the design rules: [references/motion-craft.md](references/motion-craft.md).

Design rules, short form: dark stage, colors with fixed meaning (accent =
the thing under discussion, red = broken or removed, green = fixed or kept),
type 20px or larger, staggered entrances, keep old state dimmed rather than
removed, at most three regions on screen. Keep the bottom 150px and the
chapter bar clear; the subtitle and chapter live there.

## 7. Audit stills, then render

```bash
node <skill-dir>/scripts/render.mjs "$WORK" --stills [--scene <id>]
```

It screenshots each beat when it finishes speaking plus each scene end, and
runs the layout audit: overlap, outside the safe area, under the subtitle zone
or chapter bar, text overflowing a fixed-size box. Exit 1: fix `scenes.js`
(move or resize; `data-overlap-ok` marks an intended overlap) and rerun.
Then open each still and look at it. The audit catches geometry, not meaning:
check the intended visual is there, text is readable, and nothing is clipped.
A frame you did not look at is not verified.

```bash
node <skill-dir>/scripts/render.mjs "$WORK" --out "$WORK/<topic>.mp4"
```

Use `--scene <id>` with `--out` for a quick preview of one scene. The full
render checks the ffprobe duration against the timeline and exits 1 when they
differ by more than 0.25 s; rerun `narrate.mjs`, then render again.

Subtitles are burned in only, drawn by the stage from the beats. Do not add a
soft subtitle track or a sidecar `.srt`: players turn it on and show every
line twice.

Why HTML: agents write HTML and SVG well, Playwright is the only dependency,
and seeking makes every frame exact. Do not add HyperFrames, Remotion, or
Manim to a project for this video.

## 8. Handoff

Give the mp4 path as a `file://` link, the stills folder, and a 2-4 line
TLDR: the question, the answer the video gives, the voice used, and the
length. Listen-check is not possible for the agent; say so. Mark anything not
checked as unverified.

Topic: $ARGUMENTS

Apply the [shared output style](../vs-internal-shared/references/output-style.md)
to every user-facing message.

## Workflow

Direct: emit **Next** only. Composed: return to caller.

**Prev:** user ask, or a `/vs-show-me` page that needs motion
**Next:** done
**Relevant:** none
