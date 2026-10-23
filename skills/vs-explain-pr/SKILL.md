---
name: vs-explain-pr
description: "Make a short narrated video explainer of an open PR from its base...head diff, finished body, and evidence media, then add it to the PR body. Composed by /vs-ship-it after the PR is open (a background agent); also direct when the user types /vs-explain-pr or asks for a video of a PR. Reuses the vs-explain-video kit; produces one 1280x720 mp4 under 10 MB in a marked body block."
---

# Explain a PR in a video

A 45-75 second narrated video of one PR: the problem in a sentence or two, then
the real example (the PR's own screenshots and recordings), what changed, the
result, and where to look in review. It runs after the PR is open, so CI and
reviewers never wait for it. The video adds to the PR body; it never replaces
the written proof.

## Flow Contract

- **Kind:** Building block
- **Inputs:** PR number and repo, head SHA, base ref (the diff is
  `<base>...<head>`), the final PR body file, and the record-flow manifest(s)
  or media files ship-it used. Nothing else: no conversation.
- **Outputs:** `final.mp4` (1280x720, 75 seconds or less, under 10 MB) under
  `~/.vs/$PROJECT_ID/videos/pr-<N>/`, and one `<!-- vs:video -->` block in the
  PR body
- **Status:** `VIDEO_ATTACHED`, `VIDEO_READY` (direct use, not attached),
  `GATE_FAILED`, or `BLOCKED_TOOLING` (with the install step)
- **Consumers:** `/vs-ship-it` Step 4b (one fresh-context background agent);
  direct user invocation
- **Skip conditions:** No open PR. A PR the ship-it rubric marks too small.

Run every step yourself in this agent. Do not start more agents.

## 1. Check the tools

`node <skill-dir>/../vs-explain-video/scripts/preflight.mjs "$WORK"`. Exit 2:
report `BLOCKED_TOOLING` with its `next` text and stop. The PR stays as it is.

## 2. Scaffold and bring the media in

```bash
WORK="$HOME/.vs/$PROJECT_ID/videos/pr-<N>"
node <skill-dir>/../vs-explain-video/scripts/init.mjs "$WORK"
node <skill-dir>/scripts/prep.mjs "$WORK" --manifest before=<before manifest.json> --manifest after=<after manifest.json>
```

Use `--still <name>=<file>#<caption>` and `--clip <name>=<file>#<caption>` for
media that did not come from record-flow. `prep.mjs` copies stills, transcodes
every recording to H.264 mp4 (webm seeks badly), cuts each clip's first and
last frame, and writes `media.json`. Do not open the media files. The captions
in `media.json` say what each one shows. A PR without media gets a
motion-only video; say so in the handoff.

## 3. Write the beats from the diff, then the PR body

The diff says what changed. The body says why, and holds the proof and the
media. Ship-it writes the body from a chat that can lose context, so the body
can miss a change. Do not read the conversation. Start from the diff:

```bash
node <skill-dir>/../vs-explain-video/scripts/diff.mjs "$WORK" --base origin/<base> --head <head SHA>
```

It writes `diff.json`: each changed file, with tests, lockfiles, version
bumps, and generated files marked minor. With no checkout, save
`gh pr diff <N> --repo <owner/name>` to a file and pass `--patch <file>`.
Read the diff of each file that is not minor and write one line per change:
what it does. Then read the body file and `media.json` for the why, the
proof, and the media. The body must not contradict the diff. Write
`script.json` (format: the explain-video example) with one scene per role, in
this order, and set `"role"` on each:

`problem` → `before` → `change` → `after` → `risk`

| Role | Source | Beats |
| --- | --- | --- |
| `problem` | Body: TL;DR line 1, What problem / scenario | 1-2 beats: who is blocked and the cost |
| `before` | Body: **Before** proof | The real example: `"still"` or `"clip"` from `media.json` |
| `change` | The diff's change list; body: What was done | One mechanism, as pseudocode or a short flow |
| `after` | Body: **After** proof | Same example, same framing: `"still"` or `"clip"` |
| `risk` | Body: Review map Risk/Review, Review focus, Still unverified | Where to look first and what is not proven |

A change the diff shows and the body does not name gets a beat in `change`,
or in `risk` as "also changes" when it is small. Set `"covers"` on each scene
to the files it explains (a path, or a directory that ends in `/`). Put each
file you leave out in the top-level `"skip"`, with a reason.

Start with the problem, then lead with the example: from `before` on, the same
user, report, or request moves through every scene. 75 seconds or less in
total (about 150 words a minute); a beat has 24 words or fewer. Write in STE
([../vs-internal-shared/references/ste-writing.md](../vs-internal-shared/references/ste-writing.md)).
Never claim more than the diff and the body prove: cut a beat the diff does
not show. Carry `Still unverified` into `risk`.

Run `node <skill-dir>/scripts/lint.mjs "$WORK" --no-page`. It also checks
`diff.json`: a changed file that no scene covers or skips, or a `covers` entry
the diff does not change. Exit 1: fix the named problems first.

## 4. Narrate

`node <skill-dir>/../vs-explain-video/scripts/narrate.mjs "$WORK/script.json" --dry-run`,
then `check-ste.mjs` on `narration.md`, then run narrate without `--dry-run`.
Use the voice and engine it picks; no voice audition. When its summary says
the words were not checked (no whisper), you must say "words not checked" in
the handoff and pass `--words-unchecked` to `attach.mjs`. Never drop it.

## 5. Write the scenes

`scenes.js` follows the explain-video rules
([../vs-explain-video/references/motion-craft.md](../vs-explain-video/references/motion-craft.md)).
Two kit helpers show the PR's media:

- `still(root, 'media/<name>.png', x, y, w, h)` returns a card with the
  screenshot fitted inside. Animate it like any block (`rise`, `pop`, `dim`).
- `clip(root, 'media/<name>.mp4', x, y, w, h)` returns `{ el, update }`; call
  `slot.update(t, D)` in your `update`. The stage shows the clip's first frame,
  then its last; `finish.mjs` plays the real recording over the slot from 0.7 s
  into the scene to 0.45 s before its end. Size the slot to the clip's aspect
  ratio (`media.json` has width and height). Keep the slot static. Change the
  label or chips next to it on each beat, so each beat still builds.

Show media at least 900 px wide, above the bottom 150 px (captions live there).

## 6. Check, then render

```bash
node <skill-dir>/scripts/lint.mjs "$WORK"
node <skill-dir>/../vs-explain-video/scripts/render.mjs "$WORK" --stills
node <skill-dir>/../vs-explain-video/scripts/check.mjs "$WORK"
```

`lint.mjs` now also loads the page: text of 4 or more words under 24 px
(`PHONE`), more than 40 words on screen (`DENSE`), or media under 900 px wide.
Exit 1 on any of the three: fix and rerun. Open one still per scene (its `-end`
still), not every still.

```bash
node <skill-dir>/../vs-explain-video/scripts/render.mjs "$WORK" --out "$WORK/raw.mp4"
node <skill-dir>/scripts/finish.mjs "$WORK" "$WORK/raw.mp4" --out "$WORK/final.mp4"
```

`finish.mjs` splices the clips in, scales to 1280x720, and keeps the file
under 10 MB. A clip shorter than its slot plays slower, never under half
speed. Say "slowed" in that scene's on-screen label. Exit 1 over 75 seconds:
cut beats.

## 7. Review: none by default

The default is no fresh review. The block then says "not reviewed by fresh
eyes". Run the explain-video review (`pack.mjs`, a new agent, `verdict.mjs`)
only when the user asked for it. It runs once: pass `--reviewed` only on a
PASS; on BELOW, report the scores and do not re-render or review again. The
explain-video quiz is skipped here: the beats come from the diff and the PR
body, which was already reviewed.

## 8. Attach to the PR

```bash
node <skill-dir>/scripts/attach.mjs --repo <owner/name> --pr <N> --sha <head SHA> \
  --video "$WORK/final.mp4" --base origin/<base> [--gate "<the ship-it gate flags>"] [--words-unchecked]
```

It uploads the mp4 to user-attachments, reads the current body over REST,
replaces only the `<!-- vs:video -->` block (or adds it before the
Walkthrough), reruns `pr-media-gate.mjs`, and PATCHes over REST when the gate
passes. The block is a collapsed `Video explainer` section that says "made for
`<sha>`". Never use `gh pr edit`, and never write the whole body from your own
copy. `GATE_FAILED`: do not patch; report the gate's text.

## 9. Handoff

Return to the caller: status, the PR URL, the `file://` path of
`final.mp4`, length, size, which clips play slowed, "not reviewed by fresh
eyes" (or the verdict), and "words not checked" when whisper was missing.
Listen-check is not possible for the agent; say so.

Topic: $ARGUMENTS

Apply the [shared output style](../vs-internal-shared/references/output-style.md)
to every user-facing message.

## Workflow

Direct: emit **Next** only. Composed: return to caller.

**Prev:** `/vs-ship-it` (Step 4b)
**Next:** done
**Relevant:** `/vs-explain-video`
