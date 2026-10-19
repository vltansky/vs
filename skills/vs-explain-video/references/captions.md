# Word captions

Captions show the written words of the beat, at most 6 words a page and at
most 2 lines, and mark the word that the voice says now. `narrate.mjs` writes
the pages to `timeline.js` (`TL.caps`); `assets/captions.js` draws them inside
`seek(T)`, so every frame is exact and repeatable.

## Style

Set `captions` in `script.json`:

| Value | Look |
| --- | --- |
| `pill` (default) | The spoken word sits on an accent pill; the next words are dim. |
| `colour` | The spoken word is in the accent color; the next words are dim. |
| `pop` | No box, heavy outline; the spoken word is green and larger; past words are dim. Use it for short social clips only. |
| `line` | The plain caption line from before word captions. |

## Word times

`narrate.mjs` times each written word with the first source that matches the
written text:

1. kokoro, when the model reports durations: the torch `kokoro` pipeline, or a
   kokoro-onnx model exported with a duration output (`scripts/export.py` in
   kokoro-onnx). The stock `kokoro-v1.0.onnx` does not report them. After you
   change the model, delete `audio/` so the beats are spoken again.
2. `whisper-cli` on that one beat, with `-dtw` when the model has a preset
   (`VS_WHISPER_MODEL`, or the first `~/.cache/whisper/ggml-*.bin`).
3. estimated from word length, with a pause after punctuation.

The narrate summary (`captions.sources`, `captions.estimated`) names the
estimated beats. Report their word sync as not checked.

`pronounce` changes only the voice: the caption shows `CDN` while the voice
says "C D N".

## Pages

A page breaks at a sentence end, at a silence of 300 ms or more, or at a comma
after 3 words. A page never crosses a beat. Each word stays lit until the next
word starts, for at least 2 frames. The last page stays 0.15 s after the beat.
