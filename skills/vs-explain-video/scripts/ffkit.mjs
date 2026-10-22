// Pure helpers for fframes.mjs: timeline conversion, clip rates, the layout
// findings and version checks. No I/O, so the static evals test them directly.

// The Rust toolchain fframes 1.3 needs (edition 2024 and its MSRV).
export const MIN_RUST = [1, 88, 0];
export const FFRAMES_VERSION = '1.3.0';

// "rustc 1.99.1 (abc 2026-01-01)" -> [1, 99, 1]; null when unreadable.
export const parseRustVersion = (text) => {
  const m = /rustc\s+(\d+)\.(\d+)\.(\d+)/.exec(String(text ?? ''));
  return m ? m.slice(1, 4).map(Number) : null;
};
export const versionAtLeast = (v, min = MIN_RUST) => {
  if (!v) return false;
  for (let i = 0; i < 3; i += 1) {
    if (v[i] !== min[i]) return v[i] > min[i];
  }
  return true;
};

// timeline.js is `window.TL = {...};`. Returns the TL object.
export const readTimelineJs = (src) => {
  const window = {};
  new Function('window', String(src))(window);
  if (!window.TL || !Array.isArray(window.TL.scenes)) throw new Error('timeline.js does not set window.TL with scenes');
  return window.TL;
};
// What the kit reads (ff/timeline.json): the TL fields it draws from, nothing else.
export const toKitTimeline = (TL) => ({
  title: TL.title ?? '',
  brand: TL.brand ?? '',
  fps: TL.fps ?? 30,
  total: TL.total,
  scenes: TL.scenes.map((s) => ({
    id: s.id,
    title: s.title ?? s.id,
    start: s.start,
    dur: s.dur,
    beats: (s.beats ?? []).map((b) => (typeof b === 'number' ? b : b.t)),
  })),
  subs: TL.subs ?? [],
  ...(Array.isArray(TL.caps) ? { caps: TL.caps } : {}),
  captions: { style: TL.captions?.style ?? 'pill' },
});

// The same rate finish.mjs picks: play slower (never below half speed) so the
// clip fills its window, then hold the last frame; a longer clip is cut.
export const clipRate = (clipSeconds, window) => Math.min(1, Math.max(0.5, clipSeconds / window));
// File name of the pre-slowed copy of `file` at `rate`: apply.mp4 at 0.5 -> apply.r0500.mp4
export const slowName = (file, rate) => `${file.replace(/\.[a-z0-9]+$/i, '')}.r${String(Math.round(rate * 1000)).padStart(4, '0')}.mp4`;

// The moments check renders: each beat when it finishes speaking, and each
// scene's last half second (render.mjs --stills uses the same).
export const stillMoments = (TL, only) =>
  TL.scenes.filter((s) => !only || s.id === only).flatMap((scene) => [
    ...scene.beats.map((beat, i) => ({ t: scene.start + Math.min(beat.t + beat.d, scene.dur - 0.5), name: `${scene.id}-b${i}`, scene: scene.id })),
    { t: scene.start + scene.dur - 0.5, name: `${scene.id}-end`, scene: scene.id },
  ]);
// HOLDS in main.rs: `const HOLDS: &[&str] = &["intro:1"];` (an intended still beat).
export const readHolds = (rust) => {
  const m = /const\s+HOLDS\s*:[^=]*=\s*&?\[([^\]]*)\]/.exec(String(rust ?? ''));
  return m ? [...m[1].matchAll(/"([^"]+)"/g)].map((x) => x[1]) : [];
};

const W = 1920;
const H = 1080;
export const LIMITS = { minPx: 19.5, phonePx: 24, phoneWords: 4, maxWords: 40, minMediaW: 900, subtitleTop: H - 150, shown: 0.15 };

const union = (rs) => {
  const x = Math.min(...rs.map((r) => r.x));
  const y = Math.min(...rs.map((r) => r.y));
  return { x, y, w: Math.max(...rs.map((r) => r.x + r.w)) - x, h: Math.max(...rs.map((r) => r.y + r.h)) - y };
};
const wordsIn = (text) => String(text).split(/\s+/).filter(Boolean).length;
const name = (b) => (b.texts[0]?.text ?? b.kind ?? 'block').slice(0, 40);

// The layout audit of one still from the kit's lint records (VS.audit and
// check.mjs --text SMALL, ported): top-level blocks outside the safe area, under
// the chapter bar or in the subtitle zone, blocks that overlap, text past its
// card, text under 20 px. With pr, also lint.mjs's phone checks.
export const auditFrame = (records, { pr = false } = {}) => {
  const shown = records.filter((r) => (r.o ?? 1) >= LIMITS.shown);
  const issues = [];
  const okBlocks = new Set(records.filter((r) => r.kind === 'overlap-ok').map((r) => r.block));
  const blocks = new Map();
  let loose = 0;
  for (const r of shown) {
    if (!['text', 'card', 'media', 'clip'].includes(r.kind)) continue;
    const key = r.block ? `b${r.block}` : `t${(loose += 1)}`;
    if (!blocks.has(key)) blocks.set(key, { key, block: r.block, items: [], texts: [], cards: [], kind: r.kind });
    const b = blocks.get(key);
    b.items.push(r);
    if (r.kind === 'text') b.texts.push(r);
    if (r.kind === 'card' || r.kind === 'media' || r.kind === 'clip') b.cards.push(r);
  }
  const list = [...blocks.values()].map((b) => ({ ...b, r: union(b.items) }));
  for (const b of list) {
    const { r } = b;
    if (r.x < 40 || r.x + r.w > W - 40 || r.y < 0 || r.y + r.h > H) issues.push({ kind: 'outside-safe-area', block: name(b) });
    if (r.y < 84 && r.x + r.w > W - 520) issues.push({ kind: 'under-chapter-bar', block: name(b) });
    if (r.y + r.h > LIMITS.subtitleTop) issues.push({ kind: 'under-subtitle-zone', block: name(b) });
    for (const t of b.texts) {
      const card = b.cards.find((c) => t.x >= c.x - 1 && t.x < c.x + c.w && t.y >= c.y - 1 && t.y < c.y + c.h);
      if (card && (t.x + t.w > card.x + card.w + 2 || t.y + t.h > card.y + card.h + 10)) issues.push({ kind: 'text-overflows-box', block: t.text.slice(0, 40) });
      if (t.size < LIMITS.minPx) issues.push({ kind: 'SMALL', block: t.text.slice(0, 40), px: t.size });
    }
  }
  for (let i = 0; i < list.length; i += 1) {
    for (let j = i + 1; j < list.length; j += 1) {
      const [a, b] = [list[i], list[j]];
      if (okBlocks.has(a.block) || okBlocks.has(b.block)) continue;
      const x = Math.min(a.r.x + a.r.w, b.r.x + b.r.w) - Math.max(a.r.x, b.r.x);
      const y = Math.min(a.r.y + a.r.h, b.r.y + b.r.h) - Math.max(a.r.y, b.r.y);
      if (x > 4 && y > 4) issues.push({ kind: 'overlap', block: name(a), with: name(b) });
    }
  }
  if (pr) {
    const texts = shown.filter((r) => r.kind === 'text');
    const small = texts.filter((t) => wordsIn(t.text) >= LIMITS.phoneWords && t.size < LIMITS.phonePx).map((t) => t.text.slice(0, 40));
    if (small.length) issues.push({ kind: 'PHONE', detail: `text of 4+ words under ${LIMITS.phonePx}px: ${small.join(', ')}` });
    const n = texts.reduce((sum, t) => sum + wordsIn(t.text), 0);
    if (n > LIMITS.maxWords) issues.push({ kind: 'DENSE', detail: `${n} words on screen (max ${LIMITS.maxWords}); cut text, the voice carries it.` });
    for (const m of shown.filter((r) => r.kind === 'media' || r.kind === 'clip')) {
      if (m.w < LIMITS.minMediaW) issues.push({ kind: 'PHONE', detail: `a still or clip is ${Math.round(m.w)}px wide (min ${LIMITS.minMediaW}); show it larger.` });
    }
  }
  for (const r of records) {
    if (r.kind === 'missing-media') issues.push({ kind: 'missing-media', block: `still at ${Math.round(r.x)},${Math.round(r.y)}: file not in media/` });
    if (r.kind === 'clip-missing') issues.push({ kind: 'CLIP-MISSING', block: `${r.file} decoded no frame inside its window` });
  }
  const seen = new Set();
  return issues.filter((i) => {
    const k = JSON.stringify(i);
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
};

// fframes `frame --json` diagnostics worth a fix: text the renderer clipped.
// text_off_canvas is info only (the chapter line reads as "off canvas" at 720p).
export const frameDiagnostics = (frames) =>
  frames.flatMap((f) => (f.diagnostics ?? []).filter((d) => d.severity === 'warning' || d.severity === 'error').map((d) => ({ kind: d.kind, block: d.text ?? d.key, detail: d.message, seconds: f.seconds })));
