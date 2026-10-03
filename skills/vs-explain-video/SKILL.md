---
name: vs-explain-video
description: "Make a short narrated explainer video in 3Blue1Brown style about a topic, code path, or PR. Use when the user types /vs-explain-video or asks for an explainer video, animated walkthrough, or narrated video of how something works. Produces one mp4 outside the repo, with frame stills and a short TLDR."
---

# Explain video

Turn one question into a 60-120 second narrated video. Use clean animated
diagrams, one idea per scene, each build timed to the sentence that names it. The
video is a disposable explainer artifact. Do not widen it into a production
pipeline, a reusable video framework, or a branded template.

## Flow Contract

- **Kind:** Building block
- **Inputs:** A topic, code path, or PR, plus enough context to answer one
  question about it
- **Outputs:** An mp4 with burned-in subtitles under
  `~/.vs/$PROJECT_ID/videos/<topic>/`, one frame still per scene, and a 2-4
  line chat TLDR
- **Status:** `VIDEO_READY` or `BLOCKED_TOOLING` (with the install step)
- **Consumers:** Direct user invocation; `/vs-show-me` or `/vs-eli5` pages
  whose visuals become scenes
- **Skip conditions:** A static page answers the question as well; use
  `/vs-show-me`. Motion must carry part of the explanation.

## 1. Check the tools first

Run `node <skill-dir>/scripts/preflight.mjs` (add `--math` for math-heavy
topics). It prints JSON: `backend`, `ttsEngine`, found tools, and an install
hint for each missing one. Exit 2 means blocked: show the `next` text, offer
the storyboard as a `/vs-show-me` page meanwhile, and stop. Do not install
tools without the user's consent.

## 2. State the question and audience

Write one sentence: the single question this video answers, and who watches
it. Every scene must move toward that answer. Cut any scene that does not.

## 3. Write the narration

One scene per narration beat, 4-8 scenes, about 150 spoken words a minute.
Write the narration in ASD-STE100-style plain English: short sentences, one
instruction or fact per sentence, active voice, one word for one meaning. Rules
and examples:
[../vs-internal-shared/references/ste-writing.md](../vs-internal-shared/references/ste-writing.md).
Pointer only; do not copy those rules here. Ground every claim in the code,
PR, or source you read. A sentence that needs a second breath is two
sentences.

Carry one concrete example through every scene: a named plugin, request, or
value the viewer can follow from start to end. Abstract boxes with generic
labels read as slides. If no real example exists, invent a small one and say
so in the first scene.

Write the narration to `narration.md`, one paragraph per scene, and run
`node <skill-dir>/../vs-write/scripts/check-ste.mjs narration.md`. Exit 1:
rewrite the flagged sentences. Exit 2 means not checked, not a pass.

## 4. Storyboard

For each beat, name the one visual that shows it: a box-and-arrow flow, a
value that changes, a before/after, a highlighted line of code. Builds appear
when the narration says them, not before. Visual grammar, 3Blue1Brown style:
dark background, few colors with fixed meaning, strokes that draw on, no
bullet slides, no stock imagery, no logo intros. Every sentence gets a visual
change. A scene that only shows text while the voice talks is a slide; redraw
it as the example moving through the system.

Write `scenes.json` in the work directory:

```json
{ "fps": 30, "width": 1280, "height": 720, "pause": 0.4,
  "pronounce": { "AICM": "A I C M" },
  "scenes": [{ "id": "01-question", "narration": "...", "html": "scenes/01-question.html" }] }
```

`pronounce` changes only what the voice says; subtitles and the screen keep
the written form. Add every acronym said letter by letter and every name the
voice gets wrong. When you do not know how the team says a name, ask.

A scene's picture is one of `html` (rendered here), `video` (Manim or
Remotion output), or `image` (a still, such as a `/vs-show-me` first-screen
shot). An existing `/vs-show-me` page can be a scene `html` as is.

## 5. Narrate

Run `node <skill-dir>/scripts/narrate.mjs scenes.json`. It picks ElevenLabs
when `ELEVENLABS_API_KEY` is set in the environment, else a free local voice:
kokoro, then piper, then macOS `say`. It speaks one sentence at a time and
writes each scene's `audio`, `audioSeconds`, and `sentences` (text, start,
seconds) back into the manifest. It prints the sentence starts as `cues`.

When the user cares about the voice, narrate one sentence with 4-6 voices
first (`KOKORO_VOICE=am_michael` and so on; default `af_heart`) and let them
pick before the full run.

The API key is a secret. Never print, log, echo, or write the key, and never
put it in a command line. Never ask the user to paste it into chat; ask them
to export it in their shell. Report only whether it is set.

## 6. Render scenes to the audio

Backend, in order of preference:

1. **HTML/SVG + Playwright (default).** Copy `assets/scene.html` per scene. Set
   each build's `--at` to its sentence start from the `cues`. Run
   `node <skill-dir>/scripts/render-scenes.mjs scenes.json`. Each scene lasts
   its audio plus `pause`. It burns subtitles into each html scene from
   `sentences`; keep the bottom 15% of the frame clear for them. Set
   `"subtitles": false` only when the user asks. To subtitle a still, wrap it
   in an html scene; `video` scenes get no subtitles.
2. **Manim** when `manim` is installed and the topic is math-heavy (equations,
   geometry, transforms). Render one clip per scene; set `video` per scene.
3. **Remotion** only when the project already depends on it. Set `video`.

Why HTML is the default: agents write HTML and SVG well, and it reuses the
`/vs-show-me` look. Its only dependency is Playwright, which most web projects
already have. Frame accuracy comes from seeking. The renderer pauses every
CSS/Web Animation and sets its time before each screenshot. HyperFrames and
Remotion use the same model. So `requestAnimationFrame` loops and timers
do not move; expose `window.seek(seconds)` for canvas drawing instead. Do not
add HyperFrames, Remotion, or Manim to a project for this video.

## 7. Mux

Run `node <skill-dir>/scripts/mux.mjs scenes.json --out <topic>.mp4`. It holds
or trims each picture to its scene length, pads audio, concatenates with
ffmpeg, then extracts one still per scene. Ship subtitles burned in only. Do
not add a soft subtitle track or a sidecar `.srt`: players turn it on and show
every line twice.

## 8. Save outside the repo

Put the work directory and mp4 under `~/.vs/$PROJECT_ID/videos/<topic>/`:

```bash
PROJECT_ID=$(git config --get remote.origin.url 2>/dev/null \
  | sed -E 's#\.git$##; s#.*[:/]([^/]+/[^/]+)$#\1#; s#/#-#g')
[ -z "$PROJECT_ID" ] && PROJECT_ID=$(basename "$PWD")
VIDEO_DIR="$HOME/.vs/$PROJECT_ID/videos/<topic>"
```

Never commit videos, audio, or frames, and never write them into the project
tree.

## 9. Verify before claiming done

- `mux.mjs` compares the ffprobe duration with the sum of narration plus
  pauses and exits 1 when they differ by more than 0.25 s. Exit 1 is a failed
  render; fix the scene inputs and rerun.
- Open each extracted still and look at it. Each still is the scene fully
  built, where layout bugs show. Check the scene shows its intended visual,
  text is readable, nothing overlaps, overflows, or is clipped, and the
  subtitle covers nothing. A frame you did not look at is not verified. Fix
  the scene, rerender it with `--only <scene-id>`, and mux again.
- Listen-check is not possible for the agent; say so in the handoff.

## 10. Handoff

Give the mp4 path as a `file://` link, the still paths, and a 2-4 line TLDR: the question, the
answer the video gives, the voice used, and the length. Mark anything not
checked as unverified.

Topic: $ARGUMENTS

Apply the [shared output style](../vs-internal-shared/references/output-style.md)
to every user-facing message.

## Workflow

Direct: emit **Next** only. Composed: return to caller.

**Prev:** user ask, or a `/vs-show-me` page that needs motion
**Next:** done
**Relevant:** none
