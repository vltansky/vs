# fframes: the default renderer

The video is a small Rust crate in `<work>/ff/`, written by
`fframes.mjs init` from the template (`fframes/video/`). It depends on the kit
(`fframes/kit/`, the crate `vs_fframes_kit`) and on fframes 1.3.0, pinned by
`Cargo.lock`. The heavy build (fframes, ffmpeg, Skia) lives once per machine in
`~/.cache/vs/fframes` (`VS_FF_CACHE`), so a video crate compiles in about a
second. Skia renders on the CPU; no GPU is needed.

You write one file: `ff/src/main.rs`, one `match` arm per scene id in
`script.json`. Everything else (timeline, captions, header, progress bar,
background, transitions, audio) is the kit's.

## Setup

| Step | Command | Cost |
|---|---|---|
| Check | `node scripts/fframes.mjs doctor` | instant |
| First time on a machine | `node scripts/fframes.mjs doctor --warm` | ~5 min, ~4 GB |
| After a kit update | `doctor --warm` again (doctor says so) | ~15 s |
| New video | `node scripts/fframes.mjs init "$WORK"` | instant |

doctor needs Rust 1.88 or newer (rustup), ffmpeg and ffprobe, and on Linux the
freetype and fontconfig dev libraries and `pkg-config`. It never installs system
tools. When something is missing it prints `*** FALLBACK ... ***`: render
with the Playwright renderer (`render.mjs`, `scenes.js`) and say so in the
handoff.

macOS: `brew install rustup ffmpeg pkg-config` and `rustup default stable`
give everything; fonts come from the work dir, not the system. The kit asks
Skia for its Metal build on macOS and Vulkan on Linux only because those are the
prebuilt Skia binaries; frames still render on the CPU (`--renderer skia-cpu`).

## The scene function

```rust
use vs_fframes_kit::*;

const HOLDS: &[&str] = &["fix:1"]; // beats that hold still on purpose (NO-BUILD exempt)

fn scene<'a>(s: &mut S<'_, 'a, '_>) -> Svgr<'a> {
    let b = s.b; // beat starts, seconds into the scene
    match s.id {
        "intro" => {
            let title = s.words(160.0, 300.0, Type::H1, &["Why does search", "{mark:miss the cache?}"], 0.15);
            let card = s.info_card(160.0, 600.0, 760.0, "today", "840 ms, {bad:every time}", s.rise(b[0] + 0.4), Glow::None);
            svgr!(<g>{title}{card}</g>)
        }
        _ => Svgr::empty(),
    }
}

fn main() -> std::process::ExitCode {
    vs_fframes_kit::run(env!("CARGO_MANIFEST_DIR"), scene)
}
```

Every value comes from `s.t` (seconds into the scene) and `s.b`, so any frame
renders on its own: no state between frames. Coordinates are 1920x1080 stage
pixels, the same as `scenes.js`.

## From motion.js to the kit

| motion.js | kit |
|---|---|
| `box(R, x, y, w, 0, 'h1', html)` + `words(el, t, at)` | `s.words(x, top, Type::H1, &["line 1", "line 2"], at)` |
| `mark(hi, t, at)` | `{mark:words}` in the line, `s.words_with(.., Some(at))` |
| `box(.., 'card pad', lbl + h3)` | `s.info_card(x, y, w, "label", "markup", tf, glow)` |
| `box(.., 'card')` with children | `s.card(x, y, w, h, tf, glow, \|s\| vec![...])` |
| `box(.., 'row', glyph + text)` | `s.row(x, y, w, "1", "markup", Type::ROW, tf, glow)` |
| `box(.., 'chip ok', text)` | `s.chip(x, y, "text", Tone::Ok, tf)`, `s.chip_sized(.., 30.0, tf)` |
| `box(.., 'lbl', text)` | `s.label(x, top, "text", tf)` |
| plain text | `s.text(x, top, ty, "markup")`; a computed string: `s.text_string(..)` or `S::own(format!(..))` |
| `term(...)` | `s.terminal(x, y, w, h, "title", &[Line::cmd("$ ..."), Line::out("..", Tone::Ok).at(b[1])], at, tf)` |
| `path()` + `draw()` | `s.line(&Curve::new(x1, y1, x2, y2), Tone::Acc, dash, arrow, s.p(at, 0.7))` |
| a dot along a path | `s.dot_along(&curve, s.p_io(at, 0.9), 9.0, Tone::Acc)` |
| `rise(el, t, at, {dx, dy, from})` | `s.rise(at)`, `s.rise_with(at, Rise { dx: 40.0, dy: 0.0, ..Default::default() })` |
| `pop(el, t, at)` | `s.pop(at)` |
| `dim(el, t, at)` | `tf.dim(s.t, at)`; `tf.hide(s.t, at)`; `tf.opacity(o)` |
| `flash(el, t, at)` | glow `s.flash(at)`; the current beat's card: `s.focus(i)` |
| `count(...)` | `s.count(at, from, to, d)` (a `&str` you can draw and measure) |
| `spring(...)` | `spring(s.t, at, Spring::Snappy)`, `spring_to(s.t, &[(t0, v0), (t1, v1)], preset)` |
| a group that moves together | `s.group(tf, x, y, w, h, \|s\| vec![...])` |
| `dataset.overlapOk = '1'` | `s.allow_overlap();` just before the block (or inside its group) |

Markup in any text: `plain {acc:accent} {bad:cost} {ok:fix} {mute:quiet}
{mark:highlit}`. Runs glue to the word before when there is no space:
`/search?q=nile{bad:&t=…}` draws as one word.

Type: `Type::H1` (120), `H2` (72), `H3` (40), `BODY` (30), `ROW` (27), `LBL`
(20, upper case), `MONO`, `CHIP`; change one with `.size(36.0)`, `.weight(500)`,
`.mono()`, `.tone(Tone::Acc)`.

## Media (vs-explain-pr)

- `s.still("media/before.png", x, y, w, h, tf)`: a screenshot in a card with
  rounded corners, fitted inside (never cropped).
- `s.clip("media/apply.mp4", x, y, w, h, tf)` (or `s.clip_window(.., Window {
  from: 7.6, to: -0.45 }, tf)`): the recording plays in its slot. Window times
  are on the scene's clock and the kit moves them onto the video's; a clip
  shorter than its window plays slower (never below half speed) and then holds
  its last frame; before the window the slot shows `<name>.first.png`. `render`
  pre-slows the clip with ffmpeg, so the frames are already in the video and
  `finish.mjs` does not splice. Draw chips after the clip to put them on top.
  While a clip is in the scene the camera holds still.

Files in `<work>/media/`, `<work>/fonts/` and image or video files in `<work>/`
are copied into `ff/media/` on every check and render.

## Checks and render

```bash
node scripts/fframes.mjs check "$WORK"            # stills + audit; --scene intro, --at 12.5, --pr
node scripts/fframes.mjs render "$WORK" --out "$WORK/video.mp4"   # --size 720, --draft
```

`check` writes `<work>/stills/<scene>-b<i>.png` and `<scene>-end.png` (the same
names as `render.mjs --stills`) and reports what `check.mjs` and the stage audit
report: overlap, outside the safe area, under the chapter bar or the subtitles,
text past its card, SMALL, NO-BUILD, plus fframes' own text-clipping
diagnostics and CLIP-MISSING. A build error comes back as JSON with the
compiler's lines: fix `main.rs` and rerun.

`render` writes the MP4 (H.264, AAC 48 kHz, the narration level narrate.mjs
set) and `<out>.fframes.json`, and fails if the length is off the timeline by
more than 0.15 s.

## Trouble

| Symptom | Fix |
|---|---|
| doctor: kit changed, cache not warm | `doctor --warm` (about 15 s) |
| `cannot find value` / borrow errors | a computed string must be `&'a str`: `S::own(format!(..))` |
| a text overlaps on purpose | `s.allow_overlap();` before it |
| check: `sandboxed: true` (build lock not writable) | a sandbox blocks writes to the cache: rerun with write access to `~/.cache/vs/fframes` (approve it); not a reason to fall back |
| doctor: `--version gave no version` | rustup has no default toolchain for this HOME: `rustup default stable`, or set `RUSTUP_HOME`/`CARGO_HOME` |
| ffmpeg link errors on warm | warm retries with `FFMPEG_FORCE_BUILD=1` by itself; check `warm.log` in the cache |
| CLIP-MISSING | the clip did not decode; rerun `prep.mjs`, then `check` |
| anything else you cannot fix in 2 tries | FALLBACK to `render.mjs` + `scenes.js`, and say so |
