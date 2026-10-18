// Ear substitutes for narrate.mjs: a word check (each beat's audio is
// transcribed and compared with the words the voice was given) and a loudness
// meter (ffmpeg's own ebur128). The agent cannot listen; these say what it can
// check without ears. Pure helpers are exported for the static evals.
//
// Ideas from take-one (github.com/talsiach/take-one, MIT): transcribe every
// line and compare it with its text; measure loudness instead of guessing.
// This code is our own.
import { existsSync, mkdtempSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import path from 'node:path';

import { run, which } from './media.mjs';

// ---------- words
const ONES = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen'];
const TENS = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];
const SCALE = { hundred: 100, thousand: 1000, million: 1e6 };
const numberValue = (word) => {
  if (ONES.includes(word)) return ONES.indexOf(word);
  if (TENS.includes(word) && word) return TENS.indexOf(word) * 10;
  return null;
};
// "eight hundred forty" -> "840", so a transcript that writes digits matches.
const joinNumbers = (words) => {
  const out = [];
  let total = null;
  let current = 0;
  const flush = () => {
    if (total !== null) out.push(String(total + current));
    total = null;
    current = 0;
  };
  for (const word of words) {
    const value = numberValue(word);
    if (value !== null) {
      total ??= 0;
      current += value;
    } else if (SCALE[word] && total !== null) {
      if (SCALE[word] === 100) current *= 100;
      else {
        total += current * SCALE[word];
        current = 0;
      }
    } else if (word === 'and' && total !== null) {
      continue;
    } else {
      flush();
      out.push(word);
    }
  }
  flush();
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
export const findWhisper = () => {
  const cli = which('whisper-cli');
  if (cli) {
    const cache = path.join(homedir(), '.cache', 'whisper');
    const model = process.env.VS_WHISPER_MODEL
      ?? (existsSync(cache) ? readdirSync(cache).filter((f) => /^ggml-.*\.bin$/.test(f)).sort().map((f) => path.join(cache, f))[0] : undefined);
    if (model && existsSync(model)) return { engine: 'whisper-cli', cli, model };
    if (!which('whisper')) return { engine: null, note: 'whisper-cli is on PATH but has no model: set VS_WHISPER_MODEL to a ggml model file (for example ~/.cache/whisper/ggml-base.en.bin).' };
  }
  if (which('whisper')) return { engine: 'whisper', cli: which('whisper') };
  return { engine: null, note: 'no whisper-cli or whisper on PATH, so the words were not checked. Install whisper.cpp (brew install whisper-cpp) and a ggml model to check them.' };
};
// Transcript of one audio file, cached next to it until the audio changes.
export const transcribe = (whisper, file) => {
  const cached = file.replace(/\.[^.]+$/, '.heard.txt');
  if (existsSync(cached) && statSync(cached).mtimeMs >= statSync(file).mtimeMs) return readFileSync(cached, 'utf8');
  const scratch = mkdtempSync(path.join(tmpdir(), 'vs-heard-'));
  const wav = path.join(scratch, 'beat.wav');
  const conv = run('ffmpeg', ['-y', '-v', 'error', '-i', file, '-ar', '16000', '-ac', '1', wav]);
  if (conv.status !== 0) throw new Error(`ffmpeg could not convert ${file} for whisper`);
  const lang = process.env.VS_WHISPER_LANG ?? 'en';
  const result = whisper.engine === 'whisper-cli'
    ? run(whisper.cli, ['-m', whisper.model, '-f', wav, '-l', lang, '-nt', '-np', '-otxt', '-of', path.join(scratch, 'beat')])
    : run(whisper.cli, [wav, '--model', process.env.VS_WHISPER_PY_MODEL ?? 'base.en', '--language', lang, '--output_format', 'txt', '--output_dir', scratch, '--fp16', 'False']);
  const out = path.join(scratch, 'beat.txt');
  if (result.status !== 0 || !existsSync(out)) throw new Error(`${whisper.engine} failed (exit ${result.status}): ${(result.stderr || '').slice(-300)}`);
  const text = readFileSync(out, 'utf8').replace(/\s+/g, ' ').trim();
  writeFileSync(cached, text);
  return text;
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
