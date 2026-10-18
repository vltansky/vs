# Fixing check.mjs issues

`check.mjs` measures the video over time; `render.mjs --stills` checks one
frame at a time. Fix every FAIL. For each WARN, fix it or say why it stays.

| Issue | What it means | Fix |
|---|---|---|
| `CONTRACT` | `scenes.js` uses `Math.random`, clock time, a timer, a frame callback, or a CSS animation or transition | Drive it from `t`. For variety, derive it from an index |
| `DETERMINISM` | The same time draws two different frames. `ORDER-DEPENDENT` names the frame whose draw changes another | Set every property from `t` on every `update` call. Do not keep state between calls |
| `NO-BUILD` | A beat changes under 0.5% of the frame: a slide | Add a build on `B[i]`: the example moves, a block rises, a value changes. For a beat that must hold still, add `window.HOLDS = ['scene-id:i']` in `scenes.js` and say why |
| `FLASH` | Text is not on screen long enough to read: 0.4 s + 0.2 s a word | Start it earlier, keep it longer, or cut words |
| `SMALL` | Text never reaches 20px | Use the stage classes (`.lbl` is the smallest, 20px). A `pop` or `rise` that ends below scale 1 also counts |
| `LONG` (WARN) | One big line stays unchanged over 6 s | Dim it (`dim`) once the next thing lands, so the eye moves on. A counter or a typed line that changes does not count |
| `OVERLAP` | Two texts on each other for 0.3 s or more. WARN when one moves across the other | Move one block. `data-overlap-ok` marks an intended overlap |

Subtitles, the chapter bar, and the brand are the stage's own and are not
checked. `data-audit-skip` skips a block that is texture, not text to read.
