// Ear substitutes for narrate.mjs: a word check (each beat's audio is
// transcribed and compared with the words the voice was given) and a loudness
// meter (ffmpeg's own ebur128). The agent cannot listen; these say what it can
// check without ears. Pure helpers are exported for the static evals.
//
// Ideas from take-one (github.com/talsiach/take-one, MIT): transcribe every
// line and compare it with its text; measure loudness instead of guessing.
// This code is our own.
import { createHash } from 'node:crypto';
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import path from 'node:path';

import { run, which } from './media.mjs';

// ---------- words
const ONES = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen'];
const TENS = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];
const BIG = { thousand: 1000, million: 1e6 };
const onesAt = (words, i, min = 0) => {
  const v = ONES.indexOf(words[i]);
  return v >= min ? v : -1;
};
// 0-99 at i: "seven", "seventeen", "forty", "forty two". Returns { v, n } or null.
const below100 = (words, i) => {
  const one = onesAt(words, i);
  if (one >= 0) return { v: one, n: i + 1 };
  const ten = words[i] ? TENS.indexOf(words[i]) : -1;
  if (ten < 2) return null;
  const unit = i + 1 < words.length ? onesAt(words, i + 1, 1) : -1;
  return unit >= 1 && unit <= 9 ? { v: ten * 10 + unit, n: i + 2 } : { v: ten * 10, n: i + 1 };
};
// 0-999: "three hundred", "one hundred five", "one hundred and five".
const below1000 = (words, i) => {
  const head = below100(words, i);
  if (!head || words[head.n] !== 'hundred' || head.v < 1 || head.v > 9) return head;
  const after = words[head.n + 1] === 'and' ? head.n + 2 : head.n + 1;
  const rest = below100(words, after);
  return rest && rest.v > 0 ? { v: head.v * 100 + rest.v, n: rest.n } : { v: head.v * 100, n: head.n + 1 };
};
// One compound number at i: "two thousand and twenty six". Returns { v, n } or
// null. A number never joins the number word after it unless the two form one
// number ("twenty three", "one hundred five"): "two three four" stays three
// numbers, and an "and" stays a word unless it sits inside a number.
const compound = (words, i) => {
  let part = below1000(words, i);
  if (!part) return null;
  let total = 0;
  let n = part.n;
  let v = part.v;
  let last = Infinity;
  while (BIG[words[n]] && BIG[words[n]] < last && v >= 1) {
    last = BIG[words[n]];
    total += v * last;
    const after = words[n + 1] === 'and' ? n + 2 : n + 1;
    part = below1000(words, after);
    if (part && part.v > 0) {
      v = part.v;
      n = part.n;
    } else {
      v = 0;
      n += 1;
    }
  }
  return { v: total + v, n };
};
// "eight hundred forty" -> "840", so a transcript that writes digits matches.
const joinNumbers = (words) => {
  const out = [];
  for (let i = 0; i < words.length;) {
    const number = compound(words, i);
    if (number) {
      out.push(String(number.v));
      i = number.n;
    } else {
      out.push(words[i]);
      i += 1;
    }
  }
  return out;
};
// Lower case, no punctuation, numbers as digits, letters said one by one
// ("a i c m") joined ("aicm"), hyphens and slashes split.
export const normalizeWords = (text) => {
  const raw = text
    .toLowerCase()
    .replace(/[’']/g, '')
    .replace(/(\d),(\d)/g, '$1$2')
    .split(/[^\p{L}\p{N}.]+/u)
    .map((w) => w.replace(/^\.+|\.+$/g, ''))
    .flatMap((w) => (/^(\p{L}\.)+\p{L}?$/u.test(w) ? [w.replace(/\./g, '')] : w.split('.')))
    .filter(Boolean);
  const letters = [];
  for (const w of joinNumbers(raw)) {
    const last = letters.at(-1);
    if (w.length === 1 && /\p{L}/u.test(w) && last?.spelled) last.text += w;
    else letters.push({ text: w, spelled: w.length === 1 && /\p{L}/u.test(w) });
  }
  return letters.map((w) => w.text);
};
// Words the voice should have said but the transcript lacks, and words it
// added. Longest common subsequence on normalized words.
export const wordDiff = (expected, heard) => {
  const a = normalizeWords(expected);
  const b = normalizeWords(heard);
  const dp = Array.from({ length: a.length + 1 }, () => new Array(b.length + 1).fill(0));
  for (let i = a.length - 1; i >= 0; i -= 1) {
    for (let j = b.length - 1; j >= 0; j -= 1) {
      dp[i][j] = a[i] === b[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }
  const missing = [];
  const extra = [];
  let i = 0;
  let j = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) {
      i += 1;
      j += 1;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) missing.push(a[i++]);
    else extra.push(b[j++]);
  }
  missing.push(...a.slice(i));
  extra.push(...b.slice(j));
  return { missing, extra };
};
// A beat passes when the spoken or the written form matches the transcript.
export const checkBeat = (written, said, heard) => {
  const forms = [wordDiff(said, heard), wordDiff(written, heard)];
  const best = forms.reduce((x, y) => (y.missing.length + y.extra.length < x.missing.length + x.extra.length ? y : x));
  return { ok: best.missing.length === 0 && best.extra.length === 0, ...best };
};

// ---------- the transcriber: whisper.cpp, else openai-whisper, else none
// The ggml model to use when VS_WHISPER_MODEL is not set: English models
// first, then the larger one (more accurate), by a fixed size order.
const SIZES = ['large', 'medium', 'small', 'base', 'tiny'];
export const pickModel = (files) =>
  files
    .filter((f) => /^ggml-.*\.bin$/.test(f))
    .map((f) => ({ f, en: /\.en\b/.test(f) ? 0 : 1, size: SIZES.findIndex((s) => f.includes(`-${s}`)) }))
    .sort((a, b) => a.en - b.en || (a.size < 0 ? 99 : a.size) - (b.size < 0 ? 99 : b.size) || a.f.localeCompare(b.f))
    .map(({ f }) => f);
export const findWhisper = () => {
  const cli = which('whisper-cli');
  if (cli) {
    const cache = path.join(homedir(), '.cache', 'whisper');
    const model = process.env.VS_WHISPER_MODEL
      ?? (existsSync(cache) ? pickModel(readdirSync(cache)).map((f) => path.join(cache, f))[0] : undefined);
    if (model && existsSync(model)) return { engine: 'whisper-cli', cli, model };
    if (!which('whisper')) return { engine: null, note: 'whisper-cli is on PATH but has no model: set VS_WHISPER_MODEL to a ggml model file (for example ~/.cache/whisper/ggml-base.en.bin).' };
  }
  if (which('whisper')) return { engine: 'whisper', cli: which('whisper') };
  return { engine: null, note: 'no whisper-cli or whisper on PATH, so the words were not checked. Install whisper.cpp (brew install whisper-cpp) and a ggml model to check them.' };
};
// The cache file for one transcript: named by the audio's bytes and by
// everything that changes what whisper hears (engine, model, language), so a
// new model or language never reuses an old transcript.
export const transcriptKey = (audio, { engine, model, lang }) =>
  createHash('sha256').update(audio).update(`\0${engine}\0${model}\0${lang}`).digest('hex').slice(0, 16);
// Transcript of one audio file, cached next to it.
export const transcribe = (whisper, file) => {
  const lang = process.env.VS_WHISPER_LANG ?? 'en';
  const model = whisper.engine === 'whisper-cli' ? whisper.model : (process.env.VS_WHISPER_PY_MODEL ?? 'base.en');
  const cached = file.replace(/\.[^.]+$/, `.heard-${transcriptKey(readFileSync(file), { engine: whisper.engine, model, lang })}.txt`);
  if (existsSync(cached)) return readFileSync(cached, 'utf8');
  const scratch = mkdtempSync(path.join(tmpdir(), 'vs-heard-'));
  try {
    const wav = path.join(scratch, 'beat.wav');
    const conv = run('ffmpeg', ['-y', '-v', 'error', '-i', file, '-ar', '16000', '-ac', '1', wav]);
    if (conv.status !== 0) throw new Error(`ffmpeg could not convert ${file} for whisper`);
    const result = whisper.engine === 'whisper-cli'
      ? run(whisper.cli, ['-m', model, '-f', wav, '-l', lang, '-nt', '-np', '-otxt', '-of', path.join(scratch, 'beat')])
      : run(whisper.cli, [wav, '--model', model, '--language', lang, '--output_format', 'txt', '--output_dir', scratch, '--fp16', 'False']);
    const out = path.join(scratch, 'beat.txt');
    if (result.status !== 0 || !existsSync(out)) throw new Error(`${whisper.engine} failed (exit ${result.status}): ${(result.stderr || '').slice(-300)}`);
    const text = readFileSync(out, 'utf8').replace(/\s+/g, ' ').trim();
    writeFileSync(cached, text);
    return text;
  } finally {
    rmSync(scratch, { recursive: true, force: true });
  }
};

// ---------- loudness
// Speech for a laptop or phone: -16 LUFS integrated, true peak at most -1 dBTP.
export const LOUDNESS = { target: -16, tolerance: 2, maxPeak: -1 };
// The summary ffmpeg's ebur128 filter prints at the end of a run.
export const parseEbur128 = (stderr) => {
  const summary = stderr.slice(stderr.lastIndexOf('Summary:'));
  const lufs = /I:\s+(-?[\d.]+|-inf) LUFS/.exec(summary);
  const peak = /True peak:\s+Peak:\s+(-?[\d.]+|-inf) dBFS/.exec(summary);
  const num = (m) => (m ? (m[1] === '-inf' ? -Infinity : Number(m[1])) : null);
  return { lufs: num(lufs), truePeak: num(peak) };
};
export const measureLoudness = (file) => {
  const result = run('ffmpeg', ['-nostats', '-hide_banner', '-i', file, '-af', 'ebur128=peak=true', '-f', 'null', '-']);
  return parseEbur128(result.stderr ?? '');
};
// The ffmpeg filter that brings speech into range, or null when it already is.
// loudnorm's true-peak limiter lets a peaky voice reach -16 LUFS without
// clipping; a static gain alone cannot.
export const levelFilter = ({ lufs, truePeak }) => {
  if (lufs === null || !Number.isFinite(lufs) || truePeak === null) return null;
  const inRange = Math.abs(lufs - LOUDNESS.target) <= LOUDNESS.tolerance && truePeak <= LOUDNESS.maxPeak;
  return inRange ? null : `loudnorm=I=${LOUDNESS.target}:TP=${LOUDNESS.maxPeak - 0.5}:LRA=11`;
};
export const loudnessVerdict = ({ lufs, truePeak }) => {
  if (lufs === null || truePeak === null) return 'not measured: ffmpeg printed no ebur128 summary';
  const issues = [];
  if (Math.abs(lufs - LOUDNESS.target) > LOUDNESS.tolerance) issues.push(`${lufs} LUFS is outside ${LOUDNESS.target} ±${LOUDNESS.tolerance}`);
  if (truePeak > LOUDNESS.maxPeak) issues.push(`true peak ${truePeak} dBTP is above ${LOUDNESS.maxPeak}`);
  return issues.length ? issues.join('; ') : 'ok';
};
