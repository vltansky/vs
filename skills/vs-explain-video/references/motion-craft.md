# Motion craft

How to make scenes that read as a motion explainer, not a slide deck. The
worked example in `assets/scenes.example.js` uses every pattern here.

## The stage

- 1920x1080. Safe area: 40px from each side. The chapter bar sits in the top
  right (top 84px, right 520px). The subtitle zone is the bottom 150px. Put
  content between y=150 and y=900.
- Two or three regions per scene, laid out on a left/right or top/bottom
  split. A typical split: left block at x=120, w=860; right block at x=1160,
  w=640.
- The stage already draws the brand, chapter, progress line, the animated
  dot field, scene handoffs (fade, spring up from 97%, lift away), a slow
  camera push on every scene, and subtitles. Do not redraw them, and do not
  add a background of your own.
- Keep it cheap to render: move things with transform, opacity, and
  clip-path. No CSS `filter: blur` or `backdrop-filter`; they slow every
  screenshot.

## Color has one meaning each

| Token | Means |
|---|---|
| `--acc` (lime) | the thing under discussion right now |
| `--bad` (red) | the problem, the cost, what gets removed |
| `--ok` (green) | the fix, success, what is kept |
| `--ink` / `--mute` | everything else |

Never use a color for decoration. If two things are lime, the viewer does
not know where to look.

## Building blocks (stage.html classes)

`.h1` 120px title, `.h2` 72px, `.h3` 40px, `.body` 30px, `.lbl` 20px
uppercase label, `.mono`. `.card` (add `.on` for the accent border), `.pad`,
`.head-row` (with `.glyph` and `.meta`), `.row`, `.chip` (`.acc` `.bad`
`.ok`), `.file`, `.pkg`, `.ver`, `.strike`. A terminal is
`terminal(root, x, y, w, h, title)`.

Nothing on screen is smaller than 20px. Size to content (`w`/`h` = 0) unless
the block must line up with another.

## Motion helpers (motion.js)

All take the scene time `t` and a start `s`, and are pure: the same `t`
gives the same frame.

| Helper | Use for |
|---|---|
| `rise(e, t, s, {dy, dx, d})` | default entrance: fade and slide in on a spring |
| `words(e, t, s, {gap})` | kinetic title: each word rises out of its own mask, `gap` s apart |
| `mark(e, t, s)` | highlighter sweep behind a `<span class="mark">` in the text |
| `stagger(list, t, s, gap, fn)` | run `fn(e, t, start)` on a list, starts `gap` s apart |
| `pop(e, t, s)` | chips, badges, a new state: scale with a playful spring |
| `dim(e, t, s, to)` | old state stays, quieter; call after its entrance |
| `hide(e, t, s)` | only when the old state is truly gone |
| `flash(e, t, s)` | one-shot accent glow: "this just changed" |
| `focus(e, t, B, i)` | accent border while beat i plays |
| `count(e, t, s, from, to, d)` | a number that changes |
| `swap(e, t, s, a, b)` | a label that flips |
| `path(svg, curve(...), 'ln acc arrow')` + `draw(p, k)` | an arrow that draws on |
| `dot(svg)` + `along(c, p, k)` | the example travelling along an arrow |
| `type(term.body, lines, t, s)` | a command typed into the terminal |
| `spring(t, s, preset)` | raw 0..1 spring progress for anything custom |
| `springTo(t, [[t0, v0], [t1, v1]], preset)` | a value that moves, then retargets mid-move |
| `settle(preset)`, `readTime(text)` | seconds a move needs to land; seconds text needs to be read |
| `P(t, s, d, ease)` | fixed-length eased progress (dims, fades, counters) |
| `still(root, src, x, y, w, h)` | a real screenshot in a card, fitted, never cropped (vs-explain-pr) |
| `clip(root, src, x, y, w, h)` | a slot for a real recording; `vs-explain-pr`'s `finish.mjs` plays it over the slot |

## Springs, never linear

Nothing that moves (position, scale, opacity) eases linearly: it reads as a
slide deck. `ease.linear` is for stepped progress only (typing, a progress
bar). Springs are closed form, so any `t` draws the same frame. Pick by what
moves:

| Preset | Stiffness/damping | For | Lands in |
|---|---|---|---|
| `snappy` | 320/30 | chips, badges, checkmarks | ~0.25 s, a hair of overshoot |
| `camera` | 170/26 | cards, panels, arrows (the `rise` default) | ~0.5 s, no bounce |
| `heavy` | 120/24 | titles, big numbers (`rise` with `d` 0.75+) | ~0.75 s, no overshoot |
| `playful` | 180/12 | a pop with personality (the `pop` default) | ~0.65 s, ~20% overshoot |

When something changes destination mid-move, add a key to `springTo` instead
of starting a new move: the sum keeps its momentum.

## Rules that make it read well

1. **One example moves.** The request, plugin, or value from the first scene
   is the thing that travels, changes color, and lands. Name it on screen.
2. **Every beat builds.** Start beat i's build at `B[i]`, or on the word
   that names it (up to a second later). Look at `cues` from `narrate.mjs`.
3. **Stagger.** Lists enter 0.3-0.5 s apart, never all at once
   (`stagger`). Titles enter word by word (`words`), and the key phrase
   gets a `mark` on the word that names it.
4. **Keep old state dimmed, not removed.** Before/after stays on screen so
   the viewer can compare.
5. **Show cause, then effect.** The arrow draws, the dot travels, then the
   target reacts (`flash`, `pop`, `count`).
6. **Fast moves, slow meanings.** One read at a time. A move may be quick;
   its meaning needs a hold: `settle(preset) + readTime(text)` before the
   next build. Two things that land together give the viewer one of them.
7. **Last beat lands.** End each scene on its conclusion fully built and
   still for at least a second; the scene end still checks it.
8. **No bullet slides.** If a scene is text while the voice talks, redraw
   it as the example moving through the system.

## Fixing audit issues

- `overlap`: move one block or shrink it. If the overlap is intended (a
  badge on a card), add `data-overlap-ok` to the badge.
- `outside-safe-area`, `under-chapter-bar`, `under-subtitle-zone`: move the
  block into y=150..900, away from the top right.
- `text-overflows-box`: the box has a fixed width or height smaller than its
  text. Grow it, shorten the text, or let it size to content.
