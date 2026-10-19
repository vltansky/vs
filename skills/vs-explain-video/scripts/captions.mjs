// Word captions: when each written word of a beat is spoken, and the caption
// pages the stage shows (assets/captions.js draws them).
//
// Word times come from the best source each beat has, in this order:
//   kokoro     the voice's own durations: a <beat audio>.words.json sidecar,
//              written by narrate.mjs when the kokoro model reports them
//              (the torch pipeline, or an ONNX export with a duration output)
//   whisper    whisper-cli word times for that one beat's audio (-ml 1 -sow
//              -ojf, plus -dtw when the model has a preset), cached next to
//              it as <beat audio>.wtimes.json
//   estimated  the beat's length shared out by each word's spoken length,
//              with a pause after punctuation. Off by about 0.15-0.3 s a word;
//              the narrate summary says which beats use it.
// A timed source is used only when align() matches it to the written words.
//
// align() maps the written words to the timed spoken words through the
// `pronounce` form ("AICM" is spoken as "A I C M"). It aligns the two as
// letter strings (edit distance), so one written word may take several spoken
// words, or share one. Idea credit: HyperFrames' align-captions (Apache-2.0,
// github.com/heygen-com/hyperframes); this is a separate implementation.
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import path from 'node:path';

import { run, which } from './media.mjs';

export const STYLES = ['pill', 'colour', 'pop', 'line'];
export const DEFAULT_STYLE = 'pill';
export const LIMITS = { words: 6, chars: 60, gap: 0.3, minFrames: 2, hold: 0.15, minMatch: 0.6 };

const round = (x) => Number(x.toFixed(3));
export const norm = (text) => (text ?? '').toLowerCase().normalize('NFKD').replace(/[^\p{L}\p{N}]/gu, '');
export const splitWords = (text) => text.trim().split(/\s+/).filter(Boolean);
const sentenceEnd = (word) => /[.!?]["'”’)\]]*$/.test(word);
const pauseAfter = (word) => (sentenceEnd(word) ? 5 : /[,;:—–]["'”’)\]]*$/.test(word) ? 3 : 0);

// ---------- estimated: share the beat by spoken length
export const estimateWords = (written, spokenOf, seconds) => {
  const weights = written.map((word, i) => ({
    word,
    len: Math.max(1, norm(spokenOf(word)).length),
    pause: i < written.length - 1 ? pauseAfter(word) : 0,
  }));
  const total = weights.reduce((sum, w) => sum + w.len + w.pause, 0) || 1;
  let at = 0;
  return weights.map(({ word, len, pause }) => {
    const from = (at * seconds) / total;
    at += len;
    const to = (at * seconds) / total;
    at += pause;
    return { text: word, from, to };
  });
};

// ---------- align: written words onto timed spoken words
// heard: [{ text, start, end }] in seconds from the beat start. A heard word
// with no text (kokoro-onnx reports phonemes only) is matched by position:
// it works only when the counts agree.
export const align = (written, spokenOf, heard, opts = {}) => {
  const minMatch = opts.minMatch ?? LIMITS.minMatch;
  const timed = heard.filter((h) => Number.isFinite(h.start) && Number.isFinite(h.end) && h.end >= h.start);
  if (written.length === 0 || timed.length === 0) return { ok: false, reason: 'no timed words' };
  if (timed.every((h) => h.text === null || h.text === undefined)) return alignByPosition(written, spokenOf, timed);

  const exp = [];
  written.forEach((word, i) => { for (const ch of norm(spokenOf(word))) exp.push([ch, i]); });
  const got = [];
  timed.forEach((h, j) => { for (const ch of norm(h.text)) got.push([ch, j]); });
  if (exp.length === 0 || got.length === 0) return { ok: false, reason: 'nothing to compare' };

  // Edit distance on letters, then walk back to collect the matched pairs.
  const n = exp.length;
  const m = got.length;
  const cost = Array.from({ length: n + 1 }, () => new Uint16Array(m + 1));
  for (let i = 0; i <= n; i += 1) cost[i][0] = i;
  for (let j = 0; j <= m; j += 1) cost[0][j] = j;
  for (let i = 1; i <= n; i += 1) {
    for (let j = 1; j <= m; j += 1) {
      const same = exp[i - 1][0] === got[j - 1][0] ? 0 : 1;
      cost[i][j] = Math.min(cost[i - 1][j] + 1, cost[i][j - 1] + 1, cost[i - 1][j - 1] + same);
    }
  }
  const hits = written.map(() => new Set());
  let matched = 0;
  for (let i = n, j = m; i > 0 && j > 0;) {
    const same = exp[i - 1][0] === got[j - 1][0];
    if (same && cost[i][j] === cost[i - 1][j - 1]) {
      hits[exp[i - 1][1]].add(got[j - 1][1]);
      matched += 1;
      i -= 1;
      j -= 1;
    } else if (cost[i][j] === cost[i - 1][j - 1] + 1) { i -= 1; j -= 1; }
    else if (cost[i][j] === cost[i - 1][j] + 1) i -= 1;
    else j -= 1;
  }
  const quality = matched / n;
  if (quality < minMatch) return { ok: false, reason: `only ${Math.round(quality * 100)}% of the letters matched`, quality };

  const words = written.map((text, i) => {
    const js = [...hits[i]];
    return js.length
      ? { text, from: Math.min(...js.map((j) => timed[j].start)), to: Math.max(...js.map((j) => timed[j].end)) }
      : { text, from: null, to: null };
  });
  const unmatched = words.filter((w) => w.from === null).map((w) => w.text);
  fillGaps(words, timed[0].start, timed.at(-1).end);
  splitShared(words, spokenOf);
  return { ok: true, words, quality: round(quality), unmatched };
};

const alignByPosition = (written, spokenOf, timed) => {
  const counts = written.map((word) => Math.max(1, splitWords(spokenOf(word)).filter((w) => norm(w)).length));
  const need = counts.reduce((a, b) => a + b, 0);
  if (need !== timed.length) return { ok: false, reason: `${timed.length} timed words for ${need} spoken words` };
  let k = 0;
  const words = written.map((text, i) => {
    const first = timed[k];
    k += counts[i];
    return { text, from: first.start, to: timed[k - 1].end };
  });
  return { ok: true, words, quality: 1, unmatched: [] };
};

// Words the timed source missed get the time between their neighbours.
const fillGaps = (words, start, end) => {
  for (let i = 0; i < words.length;) {
    if (words[i].from !== null) { i += 1; continue; }
    let k = i;
    while (k < words.length && words[k].from === null) k += 1;
    const from = i > 0 ? words[i - 1].to : start;
    const to = k < words.length ? words[k].from : end;
    const step = Math.max(0, to - from) / (k - i);
    for (let x = i; x < k; x += 1) words[x] = { ...words[x], from: from + step * (x - i), to: from + step * (x - i + 1) };
    i = k;
  }
};

// Written words that got the same timed span ("non blocking" heard as
// "nonblocking") share it by spoken length, in order.
const splitShared = (words, spokenOf) => {
  for (let i = 0; i < words.length;) {
    let k = i + 1;
    while (k < words.length && words[k].from === words[i].from && words[k].to === words[i].to) k += 1;
    if (k - i > 1) {
      const lens = words.slice(i, k).map((w) => Math.max(1, norm(spokenOf(w.text)).length));
      const total = lens.reduce((a, b) => a + b, 0);
      let at = words[i].from;
      const span = words[i].to - words[i].from;
      for (let x = i; x < k; x += 1) {
        const to = at + (span * lens[x - i]) / total;
        words[x] = { ...words[x], from: at, to };
        at = to;
      }
    }
    i = k;
  }
};

// ---------- pages
// words: [{ text, from, to }] in absolute seconds, for one beat. Each word is
// lit from its start until the next word starts (so it holds through short
// gaps), and every word gets at least minFrames frames.
export const paginate = (words, { beatEnd, fps = 30, limits = LIMITS } = {}) => {
  if (words.length === 0) return [];
  const minLit = limits.minFrames / fps + 0.001;
  const timed = [];
  for (const w of words) {
    const prev = timed.at(-1);
    const from = prev ? Math.max(w.from, prev.from + minLit) : w.from;
    timed.push({ text: w.text, from, to: Math.max(from, w.to) });
  }
  const end = Math.max(beatEnd ?? timed.at(-1).to, timed.at(-1).from + minLit);

  // Breaks: a sentence end, a silence of limits.gap or more, or a comma once
  // the page has 3 words.
  const runs = [[]];
  timed.forEach((w, i) => {
    runs.at(-1).push(w);
    const next = timed[i + 1];
    const comma = /[,;:]["'”’)\]]*$/.test(w.text) && runs.at(-1).length >= 3;
    if (next && (sentenceEnd(w.text) || next.from - w.to >= limits.gap || comma)) runs.push([]);
  });
  const pages = [];
  for (const group of runs) {
    let parts = Math.ceil(group.length / limits.words);
    let chunks;
    for (;;) {
      chunks = evenChunks(group, parts);
      if (parts >= group.length || chunks.every((c) => c.map((w) => w.text).join(' ').length <= limits.chars)) break;
      parts += 1;
    }
    pages.push(...chunks);
  }
  return pages.map((page, i) => ({
    from: round(page[0].from),
    to: round(i < pages.length - 1 ? pages[i + 1][0].from : end + limits.hold),
    words: page.map((w) => [round(w.from), round(w.to), w.text]),
  }));
};

const evenChunks = (list, parts) => {
  const out = [];
  let at = 0;
  for (let p = 0; p < parts; p += 1) {
    const size = Math.floor(list.length / parts) + (p < list.length % parts ? 1 : 0);
    out.push(list.slice(at, at + size));
    at += size;
  }
  return out.filter((c) => c.length);
};

// ---------- timed sources
export const readKokoroWords = (audioFile) => {
  const file = `${audioFile}.words.json`;
  if (!existsSync(file) || statSync(file).mtimeMs < statSync(audioFile).mtimeMs) return null;
  try {
    const words = JSON.parse(readFileSync(file, 'utf8'));
    return Array.isArray(words) && words.length ? words : null;
  } catch {
    return null;
  }
};

export const findWhisperCli = () => {
  const cli = which('whisper-cli');
  if (!cli) return null;
  const cache = path.join(homedir(), '.cache', 'whisper');
  const model = process.env.VS_WHISPER_MODEL
    ?? (existsSync(cache) ? readdirSync(cache).filter((f) => /^ggml-.*\.bin$/.test(f)).sort().map((f) => path.join(cache, f))[0] : undefined);
  return model && existsSync(model) ? { cli, model } : null;
};

// whisper.cpp's full JSON: transcription[] entries with offsets in ms. With
// -ml 1 -sow each entry is one word. Segment offsets drift by up to a second
// on short clips; with -dtw each token also carries t_dtw (centiseconds),
// which lands within a few frames, so a word starts at its first token's
// t_dtw when there is one and ends where the next word starts.
export const parseWhisperJson = (json) => {
  const words = (json.transcription ?? [])
    .map((seg) => {
      const dtw = (seg.tokens ?? []).find((tok) => !/^\s*\[_/.test(tok.text ?? '') && norm(tok.text) && tok.t_dtw >= 0);
      return { text: (seg.text ?? '').trim(), start: (dtw ? dtw.t_dtw * 10 : seg.offsets.from) / 1000, end: seg.offsets.to / 1000, dtw: Boolean(dtw) };
    })
    .filter((w) => norm(w.text));
  return words.map(({ dtw, ...w }, i) => {
    const next = words[i + 1];
    if (!dtw) return w;
    return { ...w, end: next ? Math.max(w.start, next.start) : Math.max(w.start, w.end) };
  });
};

// The -dtw preset whisper.cpp needs for a model file, or null.
const DTW = ['tiny', 'tiny.en', 'base', 'base.en', 'small', 'small.en', 'medium', 'medium.en', 'large.v1', 'large.v2', 'large.v3', 'large.v3.turbo'];
export const dtwPreset = (model) => {
  const name = path.basename(model).replace(/^ggml-/, '').replace(/\.bin$/, '').replace(/-q\d.*$/, '').replace(/-/g, '.');
  return DTW.includes(name) ? name : null;
};

export const whisperWords = (whisper, audioFile) => {
  const cached = `${audioFile}.wtimes.json`;
  if (existsSync(cached) && statSync(cached).mtimeMs >= statSync(audioFile).mtimeMs) return JSON.parse(readFileSync(cached, 'utf8'));
  const scratch = mkdtempSync(path.join(tmpdir(), 'vs-wtimes-'));
  try {
    const wav = path.join(scratch, 'beat.wav');
    if (run('ffmpeg', ['-y', '-v', 'error', '-i', audioFile, '-ar', '16000', '-ac', '1', wav]).status !== 0) return null;
    const lang = process.env.VS_WHISPER_LANG ?? 'en';
    const base = ['-m', whisper.model, '-f', wav, '-l', lang, '-ml', '1', '-sow', '-ojf', '-np', '-of', path.join(scratch, 'beat')];
    const preset = dtwPreset(whisper.model);
    const out = path.join(scratch, 'beat.json');
    // DTW needs flash attention off (-nfa); an older whisper-cli without
    // those flags gets a second run with segment times only.
    let result = preset ? run(whisper.cli, [...base, '-dtw', preset, '-nfa']) : { status: 1 };
    if (result.status !== 0 || !existsSync(out)) result = run(whisper.cli, base);
    if (result.status !== 0 || !existsSync(out)) return null;
    const words = parseWhisperJson(JSON.parse(readFileSync(out, 'utf8')));
    writeFileSync(cached, JSON.stringify(words));
    return words;
  } finally {
    rmSync(scratch, { recursive: true, force: true });
  }
};

// ---------- the whole video
// beats: [{ scene, index, text, at, seconds, audio }] with `at` absolute.
export const buildCaptions = (beats, { spokenOf, style = DEFAULT_STYLE, fps = 30, whisper = findWhisperCli() } = {}) => {
  if (!STYLES.includes(style)) throw new Error(`Unknown captions style "${style}". Use ${STYLES.join(', ')}.`);
  const sources = { kokoro: 0, whisper: 0, estimated: 0 };
  const estimated = [];
  const caps = [];
  for (const beat of beats) {
    const written = splitWords(beat.text);
    let words = null;
    let source = 'estimated';
    const tries = [['kokoro', () => readKokoroWords(beat.audio)], ['whisper', () => (whisper ? whisperWords(whisper, beat.audio) : null)]];
    for (const [name, load] of tries) {
      const heard = load();
      if (!heard) continue;
      const result = align(written, spokenOf, heard);
      if (result.ok) { words = result.words; source = name; break; }
    }
    if (!words) {
      words = estimateWords(written, spokenOf, beat.seconds);
      estimated.push(`${beat.scene}#${beat.index}`);
    }
    sources[source] += 1;
    const clamp = (t) => Math.min(Math.max(t, 0), beat.seconds);
    const absolute = words.map((w) => ({ text: w.text, from: beat.at + clamp(w.from), to: beat.at + clamp(w.to) }));
    caps.push(...paginate(absolute, { beatEnd: beat.at + beat.seconds, fps }));
  }
  return { caps, meta: { style, sources, estimated } };
};
