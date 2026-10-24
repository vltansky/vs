#!/usr/bin/env node
// Speaks every beat of script.json and lays the beats out on one timeline.
//
//   node narrate.mjs <work-dir>/script.json [--dry-run] [--engine auto|elevenlabs|kokoro|piper|say]
//                 [--no-word-check | --require-word-check]
//
// Writes, next to script.json:
//   narration.md   one paragraph per scene, for check-ste.mjs (also on --dry-run)
//   narration.wav  the full voice track
//   timeline.js    window.TL = { total, scenes: [{ id, title, start, dur,
//                  beats: [{ t, d, text }] }], subs: [[from, to, text]],
//                  caps: [{ from, to, words: [[from, to, text]] }],
//                  captions: { style, sources, estimated } }
//   narration-check.json  what was checked without ears (below)
// Beat starts (`t`, seconds from scene start) are the cues scenes.js animates
// on; subtitles are the written text, split into lines of at most ~60 chars.
//
// script.json `pronounce` maps written words to spoken ones for the voice
// only ({ "AICM": "A I C M" }); subtitles and screen keep the written form.
// `timing` { lead, gap, tail } sets silence before the first beat, between
// beats, and after the last beat of each scene.
//
// script.json `captions` picks the caption style: pill (default), colour,
// pop, or line. captions.mjs times each written word: kokoro's own word
// times, else whisper-cli per beat, else estimated (named in the summary).
//
// Beat audio is cached in audio/ by engine, voice, speed, and spoken text, so
// a rerun after a wording fix only speaks the beats that changed.
//
// auto picks ElevenLabs when ELEVENLABS_API_KEY is set, else kokoro, piper,
// macOS say. The key is read from the environment only and sent only as the
// xi-api-key request header; it is never printed, logged, written to disk, or
// put on a command line.
//
// Ear substitutes (audio.mjs), because the agent cannot listen:
//   words     each beat is transcribed (whisper-cli with a ggml model, else
//             the whisper CLI) and compared with the words the voice was given.
//             A beat with missing or extra words is flagged; fix the text or
//             add a `pronounce` entry. No whisper: skipped, with a note. A
//             skipped or failed check prints a WARNING line and names itself
//             in `next`; --require-word-check makes it exit 2 instead.
//   loudness  ffmpeg's ebur128 meter on narration.wav. Outside -16 LUFS ±2 or
//             above -1 dBTP true peak, ffmpeg's loudnorm levels it to -16 with
//             a -1.5 dBTP ceiling, and the meter runs again.
//
// Exit codes: 0 narrated (or dry run written; flagged words are reported,
// not fatal); 2 blocked, or --require-word-check and the words were not checked.
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import path from 'node:path';

import { checkBeat, findWhisper, levelFilter, loudnessVerdict, measureLoudness, transcribe } from './audio.mjs';
import { buildCaptions, DEFAULT_STYLE, STYLES } from './captions.mjs';
import { animateStep } from './fframes.mjs';
import { fail, probeDuration, run, which } from './media.mjs';

const args = process.argv.slice(2);
const scriptPath = args.find((arg) => !arg.startsWith('--') && arg.endsWith('.json'));
const dryRun = args.includes('--dry-run');
const engineArg = args.includes('--engine') ? args[args.indexOf('--engine') + 1] : 'auto';
if (!scriptPath) fail('Usage: node narrate.mjs <work-dir>/script.json [--dry-run] [--engine auto|elevenlabs|kokoro|piper|say]');

let script;
try {
  script = JSON.parse(readFileSync(scriptPath, 'utf8'));
} catch (error) {
  fail(`${scriptPath}: ${error.message}`);
}
if (!Array.isArray(script.scenes) || script.scenes.length === 0) fail(`${scriptPath}: "scenes" must list at least one scene.`);
for (const scene of script.scenes) {
  if (!/^[\w-]+$/.test(scene.id ?? '')) fail(`Every scene needs an "id" of letters, digits, - or _. Got ${JSON.stringify(scene.id)}.`);
  if (!Array.isArray(scene.beats) || scene.beats.some((beat) => typeof beat !== 'string' || !beat.trim())) {
    fail(`scene ${scene.id}: "beats" must be a list of non-empty sentences.`);
  }
}
if (script.captions !== undefined && !STYLES.includes(script.captions)) fail(`"captions" must be one of ${STYLES.join(', ')}. Got ${JSON.stringify(script.captions)}.`);
const dir = path.dirname(path.resolve(scriptPath));

// ---------- narration.md and the length estimate (no TTS needed)
const words = script.scenes.flatMap((scene) => scene.beats).join(' ').split(/\s+/).length;
writeFileSync(path.join(dir, 'narration.md'), `${script.scenes.map((scene) => scene.beats.join(' ')).join('\n\n')}\n`);
if (dryRun) {
  process.stdout.write(`${JSON.stringify({
    scenes: script.scenes.length,
    beats: script.scenes.reduce((sum, scene) => sum + scene.beats.length, 0),
    words,
    estimatedSeconds: Math.round((words / 150) * 60 + script.scenes.length * 1.7),
    narration: path.join(dir, 'narration.md'),
    next: 'Run vs-write/scripts/check-ste.mjs on narration.md, then narrate.mjs without --dry-run.',
  }, null, 2)}\n`);
  process.exit(0);
}

// ---------- engine
if (!which('ffmpeg') || !which('ffprobe')) fail('ffmpeg/ffprobe missing. Run: brew install ffmpeg. Then rerun narrate.mjs.');
const kokoroDir = process.env.KOKORO_DIR ?? path.join(homedir(), '.cache', 'kokoro');
const kokoroOnnx = which('uv') && existsSync(path.join(kokoroDir, 'kokoro-v1.0.onnx')) && existsSync(path.join(kokoroDir, 'voices-v1.0.bin'));
const pickEngine = () => {
  if (engineArg !== 'auto') return engineArg;
  if (process.env.ELEVENLABS_API_KEY) return 'elevenlabs';
  if (kokoroOnnx || which('kokoro-tts') || run('python3', ['-c', 'import kokoro']).status === 0) return 'kokoro';
  if (which('piper')) return 'piper';
  if (process.platform === 'darwin' && which('say')) return 'say';
  return null;
};
const engine = pickEngine();
if (!engine) fail('No TTS engine found. Run preflight.mjs for the install hint, then rerun narrate.mjs.');
const extension = { elevenlabs: 'mp3', kokoro: 'wav', piper: 'wav', say: 'aiff' }[engine];
if (!extension) fail(`Unknown engine "${engine}". Use auto, elevenlabs, kokoro, piper, or say.`);
const voice = engine === 'elevenlabs'
  ? process.env.ELEVENLABS_VOICE_ID ?? 'JBFqnCBsd6RMkjVDRZzb'
  : engine === 'kokoro' ? process.env.KOKORO_VOICE ?? script.voice ?? 'af_heart'
    : engine === 'say' ? process.env.SAY_VOICE ?? '' : process.env.PIPER_MODEL ?? 'en_US-lessac-medium';
const speed = Number(script.speed ?? 1);

// ---------- spoken text
const escapeRegExp = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const pronunciations = Object.entries(script.pronounce ?? {}).map(
  ([written, said]) => [new RegExp(`(?<![\\w-])${escapeRegExp(written)}(?![\\w-])`, 'g'), said],
);
const spoken = (text) => pronunciations.reduce((out, [pattern, said]) => out.replace(pattern, said), text);

// ---------- synthesis
const elevenlabs = async (text, out) => {
  const key = process.env.ELEVENLABS_API_KEY;
  if (!key) throw new Error('ELEVENLABS_API_KEY is not set in this shell. Export it there; do not paste it into chat.');
  const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voice}?output_format=mp3_44100_128`, {
    method: 'POST',
    headers: { 'xi-api-key': key, 'content-type': 'application/json' },
    body: JSON.stringify({ text, model_id: process.env.ELEVENLABS_MODEL_ID ?? 'eleven_multilingual_v2' }),
  });
  // The error body is ElevenLabs' message; it does not echo the key.
  if (!response.ok) throw new Error(`ElevenLabs returned HTTP ${response.status}: ${(await response.text()).slice(0, 300)}`);
  writeFileSync(out, Buffer.from(await response.arrayBuffer()));
};

// Python kokoro loads its model once per process, so all beats go in one call.
// When the model reports durations it also writes <beat audio>.words.json,
// the word times captions.mjs prefers: the torch pipeline always does; an
// ONNX model only when it was exported with a duration output (kokoro-onnx
// scripts/export.py); the stock kokoro-v1.0.onnx does not.
const KOKORO_BATCH = `
import sys, json, numpy as np, soundfile as sf
jobs, voice, speed, mode, model_dir = json.load(sys.stdin), sys.argv[1], float(sys.argv[2]), sys.argv[3], sys.argv[4]
def save_words(job, words):
    if words:
        with open(job["out"] + ".words.json", "w") as f:
            json.dump(words, f)
if mode == "onnx":
    import os
    from kokoro_onnx import Kokoro
    k = Kokoro(os.path.join(model_dir, "kokoro-v1.0.onnx"), os.path.join(model_dir, "voices-v1.0.bin"))
    lang = "en-gb" if voice.startswith("b") else "en-us"
    timed = getattr(k, "has_timings", False)
    for job in jobs:
        if not timed:
            audio, rate = k.create(job["text"], voice=voice, speed=speed, lang=lang)
            sf.write(job["out"], audio, rate)
            continue
        audio, rate, timings = k.create_timed(job["text"], voice=voice, speed=speed, lang=lang)
        sf.write(job["out"], audio, rate)
        words, cur = [], None
        for t in [*timings, None]:
            if t is not None and t.phoneme != " ":
                cur = {"text": None, "start": t.start, "end": t.end, "ph": t.phoneme} if cur is None else {**cur, "end": t.end, "ph": cur["ph"] + t.phoneme}
                continue
            if cur and any(c.isalnum() for c in cur["ph"]):
                words.append(cur)
            cur = None
        save_words(job, words)
else:
    from kokoro import KPipeline
    pipe = KPipeline(lang_code=voice[0])
    for job in jobs:
        chunks, words, offset = [], [], 0.0
        for result in pipe(job["text"], voice=voice, speed=speed):
            audio = result.audio.numpy() if hasattr(result.audio, "numpy") else np.asarray(result.audio)
            for t in result.tokens or []:
                if t.start_ts is not None and t.end_ts is not None and any(c.isalnum() for c in t.text):
                    words.append({"text": t.text, "start": offset + t.start_ts, "end": offset + t.end_ts})
            chunks.append(audio)
            offset += len(audio) / 24000
        sf.write(job["out"], np.concatenate(chunks), 24000)
        save_words(job, words)
`;

const synthesize = async (jobs) => {
  if (jobs.length === 0) return;
  if (engine === 'elevenlabs') {
    for (const job of jobs) await elevenlabs(job.text, job.out);
    return;
  }
  if (engine === 'kokoro' && (kokoroOnnx || !which('kokoro-tts'))) {
    const [cmd, pre] = kokoroOnnx
      ? ['uv', ['run', '--quiet', '--python', '3.12', '--with', 'kokoro-onnx', '--with', 'soundfile', 'python']]
      : ['python3', []];
    const result = run(cmd, [...pre, '-c', KOKORO_BATCH, voice, String(speed), kokoroOnnx ? 'onnx' : 'torch', kokoroDir], {
      input: JSON.stringify(jobs),
    });
    if (result.status !== 0) throw new Error(`kokoro failed (exit ${result.status}): ${(result.stderr || result.error?.message || '').slice(-400)}`);
    return;
  }
  for (const job of jobs) {
    const scratch = path.join(tmpdir(), `vs-narration-${process.pid}.txt`);
    writeFileSync(scratch, job.text);
    const result = engine === 'kokoro'
      ? run('kokoro-tts', [scratch, job.out, '--voice', voice, '--speed', String(speed)], { cwd: kokoroDir })
      : engine === 'piper'
        ? run('piper', ['--model', voice, '--output_file', job.out], { input: job.text })
        : run('say', [...(voice ? ['-v', voice] : []), '-o', job.out, '-f', scratch]);
    if (result.status !== 0) throw new Error(`${engine} failed (exit ${result.status}): ${(result.stderr || result.error?.message || '').slice(0, 300)}`);
  }
};

const audioDir = path.join(dir, 'audio');
mkdirSync(audioDir, { recursive: true });
const beatFile = (text) => {
  const hash = createHash('sha1').update(`${engine}|${voice}|${speed}|${text}`).digest('hex').slice(0, 12);
  return path.join(audioDir, `${hash}.${extension}`);
};
const beats = script.scenes.flatMap((scene) => scene.beats.map((text) => ({ text, out: beatFile(spoken(text)), say: spoken(text) })));
const todo = [...new Map(beats.filter((beat) => !existsSync(beat.out)).map((beat) => [beat.out, { text: beat.say, out: beat.out }])).values()];
try {
  await synthesize(todo);
} catch (error) {
  fail(error.message);
}

// ---------- timeline
const { lead = 0.7, gap = 0.45, tail = 1.0 } = script.timing ?? {};
const round = (x) => Number(x.toFixed(3));
const subLines = (text) => text.split(/\s+/).reduce((lines, word) => {
  const last = lines.at(-1);
  if (last && last.length + word.length < 60) lines[lines.length - 1] = `${last} ${word}`;
  else lines.push(word);
  return lines;
}, []);

let clock = 0;
const placed = [];
const subs = [];
const scenes = script.scenes.map((scene) => {
  const start = clock;
  clock += lead;
  const sceneBeats = scene.beats.map((text, i) => {
    const file = beatFile(spoken(text));
    const seconds = probeDuration(file);
    if (seconds === null) fail(`scene ${scene.id}: ${engine} wrote ${file}, but ffprobe cannot read it.`);
    placed.push({ file, at: clock });
    const lines = subLines(text);
    const chars = lines.reduce((sum, line) => sum + line.length, 0);
    let at = clock;
    for (const line of lines) {
      const to = at + (seconds * line.length) / chars;
      subs.push([round(at), round(to), line]);
      at = to;
    }
    const beat = { t: round(clock - start), d: round(seconds), text };
    clock += seconds + (i < scene.beats.length - 1 ? gap : tail);
    return beat;
  });
  return { id: scene.id, title: scene.title ?? scene.id, start: round(start), dur: round(clock - start), beats: sceneBeats };
});
const total = round(clock);

// ---------- word captions (captions.mjs)
let captions;
try {
  captions = buildCaptions(scenes.flatMap((scene) => scene.beats.map((beat, index) => ({
    scene: scene.id, index, text: beat.text, at: scene.start + beat.t, seconds: beat.d, audio: beatFile(spoken(beat.text)),
  }))), { spokenOf: spoken, style: script.captions ?? DEFAULT_STYLE, fps: script.fps ?? 30 });
} catch (error) {
  fail(`captions: ${error.message}`);
}

// Every beat is delayed to its absolute start and mixed onto one silent bed.
const wav = path.join(dir, 'narration.wav');
const filters = placed.map(({ at }, i) =>
  `[${i}:a]aresample=48000,aformat=sample_fmts=fltp:channel_layouts=mono,adelay=${Math.round(at * 1000)}:all=1[b${i}]`);
const mixed = run('ffmpeg', [
  '-y', '-loglevel', 'error', ...placed.flatMap(({ file }) => ['-i', file]),
  '-filter_complex',
  `${filters.join(';')};${placed.map((_, i) => `[b${i}]`).join('')}amix=inputs=${placed.length}:normalize=0:dropout_transition=0,apad=whole_dur=${total},atrim=duration=${total}[a]`,
  '-map', '[a]', wav,
]);
if (mixed.status !== 0) fail(`ffmpeg could not build narration.wav: ${mixed.stderr.slice(-600)}`);

const TL = { title: script.title ?? '', brand: script.brand ?? '', fps: script.fps ?? 30, total, scenes, subs, caps: captions.caps, captions: captions.meta };
writeFileSync(path.join(dir, 'timeline.js'), `window.TL = ${JSON.stringify(TL, null, 1)};\n`);

// ---------- ear substitutes: words and loudness
const whisper = args.includes('--no-word-check') ? { engine: null, note: 'skipped with --no-word-check' } : findWhisper();
let wordCheck = { status: 'skipped', note: whisper.note };
if (whisper.engine) {
  try {
    const flagged = [];
    script.scenes.forEach((scene) => scene.beats.forEach((text, i) => {
      const heard = transcribe(whisper, beatFile(spoken(text)));
      const result = checkBeat(text, spoken(text), heard);
      if (!result.ok) flagged.push({ scene: scene.id, beat: i, text, heard, missing: result.missing, extra: result.extra });
    }));
    wordCheck = { status: 'checked', engine: whisper.engine, beats: beats.length, flagged };
  } catch (error) {
    wordCheck = { status: 'failed', engine: whisper.engine, note: `${error.message.slice(0, 300)}. The words were not checked.` };
  }
}
const measured = measureLoudness(wav);
const leveling = levelFilter(measured);
let final = measured;
if (leveling) {
  const leveled = path.join(dir, 'narration.level.wav');
  const result = run('ffmpeg', ['-y', '-loglevel', 'error', '-i', wav, '-af', leveling, '-ar', '48000', leveled]);
  if (result.status !== 0) fail(`ffmpeg could not level narration.wav: ${result.stderr.slice(-300)}`);
  renameSync(leveled, wav);
  final = measureLoudness(wav);
}
const loudness = { measured, leveled: Boolean(leveling), final, verdict: loudnessVerdict(final) };
writeFileSync(path.join(dir, 'narration-check.json'), `${JSON.stringify({ words: wordCheck, loudness }, null, 2)}\n`);
const unchecked = wordCheck.status !== 'checked';
const warning = unchecked
  ? `WARNING: the words were not checked (${wordCheck.status}: ${wordCheck.note}). Tell the user the narration was not word-checked.`
  : null;
if (warning) process.stderr.write(`${warning}\n`);

process.stdout.write(`${JSON.stringify({
  engine,
  voice: engine === 'elevenlabs' ? 'ELEVENLABS_VOICE_ID or default' : voice || 'system default',
  spokenNow: todo.length,
  cached: beats.length - todo.length,
  totalSeconds: total,
  captions: { ...captions.meta, note: captions.meta.estimated.length ? `${captions.meta.estimated.length} beat(s) use estimated word times: no kokoro word times and no whisper-cli. Install whisper.cpp and a ggml model (VS_WHISPER_MODEL) for measured times.` : 'every word is timed from the audio' },
  scenes: scenes.map(({ id, start, dur, beats: b }) => ({ id, start, dur, cues: b.map(({ t, text }, i) => `B[${i}] = ${t}s  ${text.slice(0, 50)}`) })),
  words: wordCheck,
  loudness,
  ...(warning ? { warning } : {}),
  next: wordCheck.flagged?.length
    ? `The voice did not say ${wordCheck.flagged.length} beat(s) as written (see words.flagged). Rewrite the beat or add a pronounce entry, then rerun narrate.mjs.`
    : unchecked
      ? `The word check was ${wordCheck.status}: report the narration as not word-checked. Then ${animateStep(dir).step}.`
      : `${animateStep(dir).step.replace(/^a/, 'A')}.`,
}, null, 2)}\n`);
if (unchecked && args.includes('--require-word-check')) process.exit(2);
