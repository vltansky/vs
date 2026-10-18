// Pure rules behind check.mjs and pack.mjs: no browser, no ffmpeg, no I/O.
// check.mjs samples the page and hands the samples here; the static evals feed
// the same functions fixtures directly.

// ---------- thresholds (seconds, stage pixels at 1920x1080)
export const RULES = {
  minPx: 20, // SMALL: the stage rule, nothing on screen below 20px
  smallHold: 0.6, // SMALL counts text held at least this long
  flashBase: 0.4, // FLASH: text must stay up 0.4 s + 0.2 s a word
  flashPerWord: 0.2,
  flashFail: 0.6, // under 60% of the need is a FAIL, else a WARN
  longPx: 54, // LONG: a big line (5% of the height or more)...
  longHold: 6, // ...held unchanged longer than this may be a slide (WARN)
  overlapHold: 0.3, // OVERLAP: two texts on each other this long
  changePx: 4, // a pixel counts as changed above 4/255
  minChange: 0.005, // a beat whose window changes under 0.5% of the frame is a slide
  psnr: 45, // determinism: two draws above 45 dB PSNR count as the same frame
  samples: 12,
};

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
// forward/reverse: { [t]: hash }; psnr(t) is asked only for a mismatch.
export const compareDraws = (forward, reverse, psnr = () => 0) =>
  Object.keys(forward)
    .filter((t) => forward[t] !== reverse[t])
    .map((t) => ({ t: Number(t), psnr: psnr(Number(t)) }))
    .filter(({ psnr: db }) => !(db > RULES.psnr));

// ---------- every beat builds
// Mean fraction of pixels that changed between two grey frames of equal size.
export const changedFraction = (a, b, threshold = RULES.changePx) => {
  if (a.length !== b.length || a.length === 0) throw new Error('frames differ in size');
  let changed = 0;
  for (let i = 0; i < a.length; i += 1) if (Math.abs(a[i] - b[i]) > threshold) changed += 1;
  return changed / a.length;
};
// One window per beat, in scene time: from the beat start (beat 0: after the
// 0.45 s crossfade) to the next beat start, or the scene's fade-out.
export const beatWindows = (TL, holds = []) =>
  TL.scenes.flatMap((scene) =>
    scene.beats.map((beat, i) => {
      const from = i === 0 ? Math.min(0.45, beat.t) : beat.t;
      const to = Math.min(scene.beats[i + 1]?.t ?? scene.dur, scene.dur - 0.45);
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
    if (span.maxPx < RULES.minPx && held >= RULES.smallHold) add('FAIL', 'SMALL', span, `${f(span.maxPx)}px, the stage minimum is ${RULES.minPx}px`);
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
