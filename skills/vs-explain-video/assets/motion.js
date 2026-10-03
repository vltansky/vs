// Explain-video motion kit. Every frame is a pure function of time: render.mjs
// calls window.seek(seconds) and screenshots, so nothing here may depend on
// wall-clock time, requestAnimationFrame, timers, or CSS animations. A scene
// that animates any other way renders frozen or jittery.
//
// Scenes register with scene(id, build). build(root) creates the DOM once and
// returns update(t, B, D): t is seconds since the scene started, B[i] is the
// start of narration beat i (from timeline.js), D is the scene duration.
/* eslint-disable no-unused-vars */
const NS = 'http://www.w3.org/2000/svg';
const W = 1920;
const H = 1080;

// ---------- time and easing
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const lerp = (a, b, k) => a + (b - a) * k;
const ease = {
  linear: (x) => x,
  out: (x) => 1 - Math.pow(1 - x, 3),
  inOut: (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2),
  back: (x) => 1 + 2.5 * Math.pow(x - 1, 3) + 1.5 * Math.pow(x - 1, 2),
};
// Eased progress 0..1 of a motion that starts at s and lasts d seconds.
const P = (t, s, d = 0.6, e = ease.out) => e(clamp((t - s) / d));
// Index of the beat playing at t (-1 before the first beat).
const beatAt = (t, B) => B.reduce((found, start, i) => (t >= start ? i : found), -1);

// ---------- DOM
function el(parent, cls = '', html = '', style = {}) {
  const e = document.createElement('div');
  e.className = cls;
  e.innerHTML = html;
  Object.assign(e.style, style);
  parent.appendChild(e);
  return e;
}
// Absolutely positioned block in stage pixels. w/h 0 = size to content.
function box(parent, x, y, w, h, cls = 'card', html = '') {
  return el(parent, `abs ${cls}`, html, {
    left: `${x}px`, top: `${y}px`, width: w ? `${w}px` : 'auto', height: h ? `${h}px` : 'auto',
  });
}
function tf(e, { o = 1, x = 0, y = 0, s = 1, r = 0 } = {}) {
  e._o = o;
  e.style.opacity = o;
  e.style.transform = `translate(${x}px,${y}px) scale(${s}) rotate(${r}deg)`;
}

// ---------- entrances and emphasis (all return eased progress)
// Fade in while sliding dy/dx pixels into place.
function rise(e, t, s, { d = 0.6, dy = 26, dx = 0, from = 1, ease: ez = ease.out } = {}) {
  const k = ez(clamp((t - s) / d));
  tf(e, { o: clamp(k * 1.4), y: dy * (1 - k), x: dx * (1 - k), s: from + (1 - from) * k });
  return k;
}
// Scale in with a small overshoot: chips, badges, a new state.
function pop(e, t, s, d = 0.55) {
  const k = P(t, s, d, ease.back);
  tf(e, { o: clamp((t - s) / (d * 0.5)), s: 0.6 + 0.4 * k });
  return k;
}
// Fade to `to` opacity: keep old state visible but quiet instead of removing it.
// Call after the element's rise/pop in the same update; it scales that opacity.
function dim(e, t, s, to = 0.35, d = 0.4) {
  const k = P(t, s, d);
  e.style.opacity = (e._o ?? 1) * lerp(1, to, k);
  return k;
}
function hide(e, t, s, d = 0.35) {
  const k = P(t, s, d, ease.linear);
  e.style.opacity = (e._o ?? 1) * (1 - k);
  return k;
}
// Accent glow that fades out: "this just changed".
function flash(e, t, s, d = 1.2) {
  const k = clamp((t - s) / d);
  const on = k > 0 && k < 1;
  e.style.borderColor = on ? `rgba(255,181,71,${1 - k})` : '';
  e.style.boxShadow = on ? `0 0 ${40 * (1 - k)}px rgba(255,181,71,${0.35 * (1 - k)})` : '';
}
// Persistent highlight while beat i plays.
function focus(e, t, B, i) {
  const on = t >= B[i] && (B[i + 1] === undefined || t < B[i + 1]);
  e.classList.toggle('on', on);
  return on;
}
function count(e, t, s, from, to, d = 1, fmt = (v) => Math.round(v).toLocaleString('en-US')) {
  e.textContent = fmt(lerp(from, to, P(t, s, d, ease.inOut)));
}
// Swap text at s with a quick vertical roll.
function swap(e, t, s, before, after, d = 0.4) {
  const k = P(t, s, d, ease.inOut);
  e.textContent = k < 0.5 ? before : after;
  e.style.transform = `translateY(${(k < 0.5 ? -k : 1 - k) * 24}px)`;
  e.style.opacity = 1 - Math.sin(k * Math.PI) * 0.8;
}

// ---------- SVG: arrows that draw on, dots that travel
function svgLayer(root) {
  const s = document.createElementNS(NS, 'svg');
  s.setAttribute('class', 'ov');
  root.appendChild(s);
  return s;
}
// cls: 'ln' plus optional 'acc' | 'bad' | 'ok' | 'dash' | 'arrow'.
function path(svg, d, cls = 'ln') {
  const e = document.createElementNS(NS, 'path');
  e.setAttribute('d', d);
  e.setAttribute('class', cls);
  svg.appendChild(e);
  e._len = e.getTotalLength();
  if (cls.split(' ').includes('dash')) {
    // A dashed line cannot use dashoffset to draw on; reveal it through a mask.
    const id = `m${svg.childNodes.length}${Math.round(e._len)}`;
    const m = document.createElementNS(NS, 'mask');
    m.setAttribute('id', id);
    m.setAttribute('maskUnits', 'userSpaceOnUse');
    const mp = document.createElementNS(NS, 'path');
    mp.setAttribute('d', d);
    Object.assign(mp.style, { fill: 'none', stroke: '#fff', strokeWidth: 16, strokeDasharray: e._len, strokeDashoffset: e._len });
    m.appendChild(mp);
    svg.appendChild(m);
    e.setAttribute('mask', `url(#${id})`);
    e._mask = mp;
  } else {
    e.style.strokeDasharray = e._len;
    e.style.strokeDashoffset = e._len;
  }
  if (cls.split(' ').includes('arrow')) e.setAttribute('marker-end', `url(#vs-head-${cls.match(/\b(acc|bad|ok)\b/)?.[1] ?? 'ln'})`);
  return e;
}
function draw(e, k) {
  (e._mask ?? e).style.strokeDashoffset = e._len * (1 - k);
  e.style.opacity = k > 0 ? 1 : 0;
}
function dot(svg, r = 9, fill = 'var(--acc)') {
  const c = document.createElementNS(NS, 'circle');
  c.setAttribute('r', r);
  c.style.fill = fill;
  c.style.opacity = 0;
  svg.appendChild(c);
  return c;
}
// Place c at fraction k along a path; hidden before the start and after arrival.
function along(c, p, k) {
  const pt = p.getPointAtLength(p._len * clamp(k));
  c.setAttribute('cx', pt.x);
  c.setAttribute('cy', pt.y);
  c.style.opacity = k > 0 && k < 1 ? 1 : 0;
}
// Smooth horizontal connector between two points.
const curve = (x1, y1, x2, y2) => `M ${x1} ${y1} C ${(x1 + x2) / 2} ${y1}, ${(x1 + x2) / 2} ${y2}, ${x2} ${y2}`;

// ---------- typed terminal
const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');
function terminal(root, x, y, w, h, title = '~ zsh') {
  const c = box(root, x, y, w, h, 'card term', `<div class="bar"><i></i><i></i><i></i><span>${esc(title)}</span></div><div class="body"></div>`);
  return { el: c, body: c.querySelector('.body') };
}
// lines: [{ text, cls?, at?, instant? }]. Types line by line at cps chars/s
// from s; an `at` pins a line's start, `instant` prints it whole (output).
function type(body, lines, t, s, cps = 28) {
  let html = '';
  let cursor = s;
  let typing = false;
  for (const line of lines) {
    const start = line.at ?? cursor;
    if (t < start) break;
    const n = line.instant ? line.text.length : Math.floor(clamp((t - start) * cps, 0, line.text.length));
    html += `<span class="${line.cls ?? ''}">${esc(line.text.slice(0, n))}</span>`;
    cursor = start + (line.instant ? 0 : line.text.length / cps) + 0.25;
    if (n < line.text.length) { typing = true; break; }
    html += '\n';
  }
  const blink = Math.floor(t * 2.2) % 2 === 0;
  if (t >= s) html += `<span class="caret" style="opacity:${typing || blink ? 1 : 0}"></span>`;
  body.innerHTML = html;
}

// ---------- registry, chrome, and the seek driver
const SCENES = {};
function scene(id, build) {
  SCENES[id] = build;
}

const VS = {
  boot() {
    const TL = window.TL;
    if (!TL) throw new Error('timeline.js is missing. Run narrate.mjs first.');
    document.getElementById('brand').textContent = TL.brand ?? '';
    const holder = document.getElementById('scenes');
    const defs = document.createElementNS(NS, 'svg');
    defs.setAttribute('class', 'defs');
    defs.innerHTML = ['ln', 'acc', 'bad', 'ok'].map((k) =>
      `<marker id="vs-head-${k}" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0 L10 5 L0 10 z" class="head ${k}"/></marker>`).join('');
    holder.appendChild(defs);
    this.scenes = TL.scenes.map((s, i) => {
      const build = SCENES[s.id];
      if (!build) throw new Error(`scenes.js has no scene("${s.id}"). Add it or remove it from script.json.`);
      const root = el(holder, 'scene');
      root.dataset.scene = s.id;
      const update = build(root);
      if (typeof update !== 'function') throw new Error(`scene("${s.id}") must return update(t, B, D).`);
      return { ...s, i, root, update, B: s.beats.map((b) => b.t) };
    });
    window.TOTAL = TL.total;
    window.seek = (T) => this.seek(T);
    document.fonts.ready.then(() => {
      const q = new URLSearchParams(location.search).get('t');
      this.seek(q ? Number(q) : 0);
      window.READY = true;
    });
  },

  seek(T) {
    const TL = window.TL;
    const chap = document.getElementById('chap');
    for (const s of this.scenes) {
      const t = T - s.start;
      const visible = t >= -0.001 && t <= s.dur;
      s.root.style.display = visible ? 'block' : 'none';
      if (!visible) continue;
      // Crossfade: each scene fades in over 0.45 s and out over its last 0.4 s.
      const fadeIn = s.i === 0 ? 1 : P(t, 0, 0.45);
      const fadeOut = s.i === this.scenes.length - 1 ? 1 : 1 - P(t, s.dur - 0.4, 0.4, ease.linear);
      s.root.style.opacity = Math.min(fadeIn, fadeOut);
      s.update(t, s.B, s.dur);
      chap.innerHTML = `${String(s.i + 1).padStart(2, '0')} / ${String(this.scenes.length).padStart(2, '0')} &nbsp;<b>${esc(s.title ?? s.id)}</b>`;
    }
    document.getElementById('progress').style.width = `${(W * T) / TL.total}px`;
    document.getElementById('glow').style.transform =
      `translate(${300 + Math.sin(T * 0.11) * 500}px,${-300 + Math.cos(T * 0.07) * 260}px)`;
    const cue = TL.subs.find(([from, to]) => T >= from && T < to + 0.15);
    const sub = document.querySelector('#sub span');
    sub.textContent = cue ? cue[2] : '';
  },

  // Layout audit of the frame on screen, run by render.mjs --stills. Flags the
  // bugs that otherwise need a human eye: blocks that overlap, leave the safe
  // area, enter the subtitle zone or chapter bar, or overflow their own box.
  // Mark an intended overlap with data-overlap-ok on either element.
  audit() {
    const issues = [];
    const active = this.scenes.find((s) => s.root.style.display === 'block');
    if (!active) return issues;
    const name = (e) => e.dataset.name ?? (e.textContent.trim().slice(0, 40) || e.className);
    const shown = (e) => {
      for (let n = e; n && n !== document.body; n = n.parentElement) {
        const cs = getComputedStyle(n);
        if (cs.display === 'none' || cs.visibility === 'hidden' || Number(cs.opacity) < 0.15) return false;
      }
      return true;
    };
    const blocks = [...active.root.children].filter((e) => e.classList.contains('abs') && shown(e));
    const rects = blocks.map((e) => ({ e, r: e.getBoundingClientRect() }));
    const subBottom = H - 150;
    for (const { e, r } of rects) {
      if (r.left < 40 || r.right > W - 40 || r.top < 0 || r.bottom > H) issues.push({ kind: 'outside-safe-area', block: name(e) });
      if (r.top < 84 && r.right > W - 520) issues.push({ kind: 'under-chapter-bar', block: name(e) });
      // Subtitles come and go within a scene, so keep their zone clear always.
      if (r.bottom > subBottom) issues.push({ kind: 'under-subtitle-zone', block: name(e) });
    }
    for (let i = 0; i < rects.length; i += 1) {
      for (let j = i + 1; j < rects.length; j += 1) {
        const a = rects[i];
        const b = rects[j];
        if (a.e.dataset.overlapOk !== undefined || b.e.dataset.overlapOk !== undefined) continue;
        const x = Math.min(a.r.right, b.r.right) - Math.max(a.r.left, b.r.left);
        const y = Math.min(a.r.bottom, b.r.bottom) - Math.max(a.r.top, b.r.top);
        if (x > 4 && y > 4) issues.push({ kind: 'overlap', block: name(a.e), with: name(b.e) });
      }
    }
    for (const e of active.root.querySelectorAll('.abs, .card, .chip, .row')) {
      if (!shown(e)) continue;
      // Only a fixed size can clip: an auto-sized block grows with its text, and
      // its scroll size then only reports glyph overhang from tight tracking.
      // A few px of vertical spill is descenders at tight line-height.
      const fixedW = e.style.width && e.style.width !== 'auto';
      const fixedH = e.style.height && e.style.height !== 'auto';
      if ((fixedW && e.scrollWidth > e.clientWidth + 2) || (fixedH && e.scrollHeight > e.clientHeight + 10)) {
        issues.push({ kind: 'text-overflows-box', block: name(e) });
      }
    }
    return issues;
  },
};
