// Pure rules behind check.mjs, pack.mjs, and verdict.mjs: no browser, no
// ffmpeg, no I/O. check.mjs samples the page and hands the samples here; the
// static evals feed the same functions fixtures directly.
//
// Third-party code (see THIRD_PARTY_NOTICES.md at the repo root):
// - The contract scan, the sample times, and the determinism thresholds are
//   adapted from the render gate in take-one's scripts/gate.mjs, which is
//   adapted from anidoodle (github.com/alexgreensh/anidoodle), Copyright 2026
//   Alex Greenshpun, Apache License 2.0. See ../LICENSE.anidoodle and
//   ../NOTICE.anidoodle. Modified by vs: rules for scenes.js, a changed-area
//   test next to PSNR, a cold-twice diagnosis, and beat windows.
// - The text audit (FLASH, SMALL, LONG, OVERLAP and its thresholds) is adapted
//   from take-one's scripts/text-audit.mjs (github.com/talsiach/take-one),
//   Copyright (c) 2026 Tal Siach, MIT. See ../LICENSE.take-one.

// ---------- thresholds (seconds, stage pixels at 1920x1080)
export const RULES = {
  minPx: 20, // SMALL: the stage rule, nothing on screen below 20px...
  pxSlack: 0.5, // ...measured sizes carry sub-pixel layout error, so 19.5px still passes
  smallHold: 0.6, // SMALL counts text held at least this long
  flashBase: 0.4, // FLASH: text must stay up 0.4 s + 0.2 s a word
  flashPerWord: 0.2,
  flashFail: 0.6, // under 60% of the need is a FAIL, else a WARN
  longPx: 54, // LONG: a big line (5% of the height or more)...
  longHold: 6, // ...held unchanged longer than this may be a slide (WARN)
  overlapHold: 0.3, // OVERLAP: two texts on each other this long
  changePx: 4, // a pixel counts as changed above 4/255
  minChange: 0.005, // a beat whose window changes under 0.5% of the frame is a slide
  psnr: 45, // determinism: two draws count as the same frame above 45 dB PSNR...
  noisePx: 32, // ...and with fewer than 64 full-size pixels off by more than 32/255,
  noiseArea: 64, // so a small chip that changes per draw still fails
  samples: 12,
  bar: 8, // review: PASS needs this score or more on every axis
  rounds: 3, // review: at most this many rounds
};
// The review axes, in the order the brief asks for them.
export const AXES = ['answer', 'example', 'builds', 'readability', 'pacing', 'sync', 'overall'];

// ---------- contract scan of scenes.js
// Anything that makes a frame depend on wall-clock time or call order. The
// stage seeks; it does not play.
const FORBIDDEN = [
  [/\bMath\.random\s*\(/, 'Math.random() differs on every draw; derive variety from t or an index'],
  [/\bDate\.now\s*\(|\bnew\s+Date\s*\(/, 'wall-clock time does not move under seek; use t'],
  [/\bperformance\.now\s*\(/, 'wall-clock time does not move under seek; use t'],
  [/\b(setTimeout|setInterval|requestAnimationFrame)\s*\(/, 'timers and frames do not run under seek; drive it from t'],
  [/\b(animation|transition)(-[a-z-]+)?\s*:|\.(animation|transition)\w*\s*=|\.animate\s*\(/, 'CSS animations and transitions do not move under seek; use the motion.js helpers'],
];
const stripComments = (source) =>
  source
    .replace(/\/\*[\s\S]*?\*\//g, (block) => block.replace(/[^\n]/g, ' '))
    .replace(/(^|[^:'"`\\])\/\/.*$/gm, '$1');
export const scanScenes = (source) => {
  const issues = [];
  stripComments(source).split('\n').forEach((line, i) => {
    for (const [pattern, why] of FORBIDDEN) {
      if (pattern.test(line)) issues.push({ level: 'FAIL', kind: 'CONTRACT', line: i + 1, code: line.trim().slice(0, 80), detail: why });
    }
  });
  return issues;
};

// ---------- determinism
// Sample times: 0, the last frame, and evenly between.
export const sampleTimes = (total, n = RULES.samples, fps = 30) => {
  const last = Math.max(0, total - 1 / fps);
  return [...new Set(Array.from({ length: n }, (_, i) => Number(((last * i) / (n - 1)).toFixed(3))))];
};
// Where two grey frames of equal size differ by more than `threshold`: the
// pixel count and the bounding box, in pixels of the frame given.
export const diffRegion = (a, b, width, threshold = RULES.noisePx) => {
  if (a.length !== b.length || a.length === 0) throw new Error('frames differ in size');
  let count = 0;
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -1;
  let y1 = -1;
  for (let i = 0; i < a.length; i += 1) {
    if (Math.abs(a[i] - b[i]) <= threshold) continue;
    count += 1;
    const x = i % width;
    const y = Math.floor(i / width);
    x0 = Math.min(x0, x);
    y0 = Math.min(y0, y);
    x1 = Math.max(x1, x);
    y1 = Math.max(y1, y);
  }
  return { count, box: count ? { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 } : null };
};
// Two draws of one frame are the same when they hash the same, or when the
// difference is anti-aliasing noise: high PSNR AND no patch of real change.
export const sameDraw = ({ equal, psnr, region }) =>
  equal || (psnr > RULES.psnr && region.count < RULES.noiseArea);
// forward/reverse: { [t]: hash }; measure(t) -> { psnr, region } is asked only
// for a mismatch.
export const compareDraws = (forward, reverse, measure = () => ({ psnr: 0, region: { count: Infinity, box: null } })) =>
  Object.keys(forward)
    .filter((t) => forward[t] !== reverse[t])
    .map((t) => ({ t: Number(t), ...measure(Number(t)) }))
    .filter((m) => !sameDraw({ equal: false, ...m }));
// The finding for a frame that drew differently. coldSame: the frame drawn on
// two fresh pages came out the same. culprit: the sample whose draw, first on a
// fresh page, changed it (null if none did).
export const determinismIssue = ({ t, psnr, region }, { coldSame, culprit }) => {
  const where = region?.box ? ` in ${region.box.w}x${region.box.h} px at (${region.box.x}, ${region.box.y})` : '';
  const measured = `${Number.isFinite(psnr) ? psnr.toFixed(1) : 'inf'} dB, ${region?.count ?? 0} px changed${where}`;
  const detail = !coldSame
    ? `NONDETERMINISTIC: the frame at ${t}s differs between two fresh pages (${measured}). Something in scenes.js is random or reads a clock; derive it from t or an index.`
    : culprit !== null
      ? `ORDER-DEPENDENT: drawing ${culprit}s first changes the frame at ${t}s (${measured}). update() leaves state behind; set every property from t on every call.`
      : `the frame at ${t}s differs between a cold and a warm page (${measured}), but no single earlier draw explains it. Something in scenes.js does not come from t.`;
  return { level: 'FAIL', kind: 'DETERMINISM', at: t, detail };
};

// ---------- every beat builds
// Mean fraction of pixels that changed between two grey frames of equal size.
export const changedFraction = (a, b, threshold = RULES.changePx) => {
  if (a.length !== b.length || a.length === 0) throw new Error('frames differ in size');
  let changed = 0;
  for (let i = 0; i < a.length; i += 1) if (Math.abs(a[i] - b[i]) > threshold) changed += 1;
  return changed / a.length;
};
// One window per beat, in scene time, sampled one frame before each boundary:
// from just before the beat starts (beat 0: after the 0.45 s crossfade) to
// just before the next beat starts, or the scene's fade-out. A change made
// exactly at a beat start then counts for that beat, not the one before.
export const beatWindows = (TL, holds = [], fps = TL.fps ?? 30) =>
  TL.scenes.flatMap((scene) =>
    scene.beats.map((beat, i) => {
      const before = (x) => Math.max(0, x - 1 / fps);
      const from = i === 0 ? Math.min(0.45, before(beat.t)) : before(beat.t);
      const next = scene.beats[i + 1];
      const to = Math.min(next ? before(next.t) : scene.dur, scene.dur - 0.45);
      return {
        scene: scene.id,
        beat: i,
        text: beat.text,
        from: Number((scene.start + from).toFixed(3)),
        to: Number((scene.start + Math.max(from, to)).toFixed(3)),
        hold: holds.includes(`${scene.id}:${i}`),
      };
    }),
  );
export const beatIssues = (windows, fractions) =>
  windows.flatMap((w, i) =>
    w.hold || fractions[i] >= RULES.minChange
      ? []
      : [{
        level: 'FAIL',
        kind: 'NO-BUILD',
        scene: w.scene,
        at: w.from,
        text: w.text.slice(0, 60),
        detail: `beat ${w.beat} changes ${(fractions[i] * 100).toFixed(2)}% of the frame from ${w.from}s to ${w.to}s; a beat with no build is a slide`,
      }],
  );

// ---------- text read time
// samples: [{ t, items: [{ id, text, px, x, y, w, h, scene, ok? }] }], one per
// step, holding every text block visible at t (opacity 0.5 or more). `id` is
// the element that owns the text, so a line typed letter by letter or a
// counter that changes value stays one piece.
const wordsIn = (text) => text.split(/\s+/).filter((word) => /[\p{L}\p{N}]/u.test(word)).length;
export const textSpans = (samples, step) => {
  const open = new Map();
  const spans = [];
  for (const { t, items } of samples) {
    const seen = new Set();
    for (const item of items) {
      seen.add(item.id);
      const span = open.get(item.id);
      if (span && t - span.last <= step * 1.5 + 1e-9) {
        span.last = t;
        if (item.text !== span.now) span.changed = true;
        span.now = item.text;
        if (item.text.length > span.text.length) span.text = item.text;
        span.maxPx = Math.max(span.maxPx, item.px);
        span.rects.push({ t, x: item.x, y: item.y, w: item.w, h: item.h });
      } else {
        if (span) spans.push(span);
        open.set(item.id, { id: item.id, scene: item.scene, ok: item.ok, from: t, last: t, text: item.text, now: item.text, changed: false, maxPx: item.px, rects: [{ t, x: item.x, y: item.y, w: item.w, h: item.h }] });
      }
    }
    for (const [id, span] of open) {
      if (!seen.has(id) && t - span.last > step * 1.5 + 1e-9) {
        spans.push(span);
        open.delete(id);
      }
    }
  }
  spans.push(...open.values());
  return spans.map((span) => ({ ...span, to: Number((span.last + step).toFixed(3)), words: wordsIn(span.text) }));
};

const overlapOf = (a, b) => {
  const x = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
  const y = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
  return x >= 0.2 * Math.min(a.w, b.w) && y >= 0.25 * Math.min(a.h, b.h) && x > 0 && y > 0;
};
const f = (x) => Number(x.toFixed(2));

export const textIssues = (spans, { step, end }) => {
  const issues = [];
  const add = (level, kind, span, detail) =>
    issues.push({ level, kind, scene: span.scene, at: f(span.from), text: span.text.slice(0, 60), detail });
  for (const span of spans) {
    const held = span.to - span.from;
    const need = RULES.flashBase + RULES.flashPerWord * span.words;
    const atEnd = span.to >= end - step;
    if (span.words > 0 && held < need && !atEnd) {
      add(held < need * RULES.flashFail ? 'FAIL' : 'WARN', 'FLASH', span, `${span.words} word${span.words > 1 ? 's' : ''} up for ${f(held)} s, needs about ${f(need)} s`);
    }
    if (span.maxPx + RULES.pxSlack < RULES.minPx && held >= RULES.smallHold) add('FAIL', 'SMALL', span, `${f(span.maxPx)}px, the stage minimum is ${RULES.minPx}px`);
    if (span.maxPx >= RULES.longPx && held > RULES.longHold && !span.changed) add('WARN', 'LONG', span, `one ${f(span.maxPx)}px line held ${f(held)} s without changing; dim it once the next thing lands, or it reads as a slide`);
  }
  // OVERLAP: two different texts printed on each other.
  for (let i = 0; i < spans.length; i += 1) {
    for (let j = i + 1; j < spans.length; j += 1) {
      const a = spans[i];
      const b = spans[j];
      if (a.ok || b.ok || a.text === b.text || (a.text.trim().length <= 1 && b.text.trim().length <= 1)) continue;
      if (a.to <= b.from || b.to <= a.from) continue;
      const atB = new Map(b.rects.map((r) => [r.t, r]));
      const hits = a.rects.filter((r) => atB.has(r.t) && overlapOf(r, atB.get(r.t)));
      const held = hits.length * step;
      if (held + 1e-9 < RULES.overlapHold) continue;
      const still = (rects) => rects.every((r) => Math.abs(r.x - rects[0].x) < 2 && Math.abs(r.y - rects[0].y) < 2);
      const both = hits.map((r) => atB.get(r.t));
      issues.push({
        level: still(hits) && still(both) ? 'FAIL' : 'WARN',
        kind: 'OVERLAP',
        scene: a.scene,
        at: f(hits[0].t),
        text: `${a.text.slice(0, 30)} / ${b.text.slice(0, 30)}`,
        detail: `two texts on each other for ${f(held)} s; move one, or mark an intended overlap with data-overlap-ok`,
      });
    }
  }
  return issues.sort((a, b) => a.at - b.at);
};

// ---------- review pack plan
// Frame times a fresh reviewer needs: each beat once it is spoken (its build is
// on screen) and the scene cuts, for strips of 12 frames across each one.
export const packPlan = (TL) => {
  const beats = TL.scenes.flatMap((scene) =>
    scene.beats.map((beat, i) => ({
      label: `${scene.id}-b${i}`,
      t: Number((scene.start + Math.min(beat.t + beat.d, scene.dur - 0.5)).toFixed(2)),
      say: Number((scene.start + beat.t).toFixed(2)),
      text: beat.text,
    })),
  );
  const cuts = TL.scenes.slice(1).map((scene) => ({ label: `cut-${scene.id}`, from: Number(Math.max(0, scene.start - 0.2).toFixed(2)) }));
  return { beats, cuts, sheets: Math.ceil(TL.total / 40) };
};
export const clock = (seconds) => {
  const m = Math.floor(seconds / 60);
  return `${m}:${(seconds - m * 60).toFixed(1).padStart(4, '0')}`;
};

// ---------- review rounds and the verdict
// The round a new pack gets. existing: round numbers already in review/.
// arg: the --round value as typed, or null. Returns { round } or { error, code }:
// code 1 means the rounds are used up, code 2 a bad request.
export const nextRound = (existing, arg = null) => {
  const used = new Set(existing);
  if (arg !== null) {
    if (!/^[1-9]\d*$/.test(String(arg))) return { error: `--round takes a whole number from 1 to ${RULES.rounds}, not "${arg}"`, code: 2 };
    const round = Number(arg);
    if (round > RULES.rounds) return { error: `round ${round} is past the cap of ${RULES.rounds}`, code: 1 };
    if (used.has(round)) return { error: `round ${round} already has a pack; a review round is never redone. Build the next round`, code: 2 };
    return { round };
  }
  let round = 1;
  while (used.has(round)) round += 1;
  return round > RULES.rounds ? { error: `${RULES.rounds} review rounds are used up`, code: 1 } : { round };
};
// Reads a reviewer's reply: one "name: N" score per axis (a leading "- " is
// fine) and a "Verdict: PASS|RETURN" line. The verdict that counts is the one
// the scores earn: PASS only with every axis at the bar or above.
export const parseVerdict = (reply) => {
  const scores = {};
  for (const axis of AXES) {
    const m = new RegExp(`^[\\s>*-]*\\**${axis}\\**\\s*[:=]\\s*\\**(\\d{1,2}(?:\\.\\d)?)\\s*(?:/\\s*10)?\\**`, 'im').exec(reply);
    if (m) scores[axis] = Number(m[1]);
  }
  const missing = AXES.filter((axis) => !(axis in scores));
  const below = AXES.filter((axis) => axis in scores && scores[axis] < RULES.bar);
  const said = /verdict\W*\s*(PASS|RETURN)\b/i.exec(reply)?.[1]?.toUpperCase() ?? null;
  const verdict = missing.length === 0 && below.length === 0 ? 'PASS' : 'RETURN';
  return { scores, missing, below, said, verdict, overruled: said === 'PASS' && verdict !== 'PASS' };
};
