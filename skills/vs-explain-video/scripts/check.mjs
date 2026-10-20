#!/usr/bin/env node
// Measures the video over time, before a full render. Run it after
// render.mjs --stills passes.
//
//   node check.mjs <work-dir> [--gate] [--text] [--step 0.1] [--samples 12]
//
// With neither flag it runs both.
//
// --gate
//   CONTRACT  scenes.js has no Math.random, clock time, timers, frames, or CSS
//             animations: anything that does not move under seek.
//   DETERMINISM  12 frames (0, the last, evenly between) drawn forward on a
//             fresh page, then in reverse on the same, now warm, page. They
//             must hash the same, or differ only by anti-aliasing noise: above
//             45 dB PSNR with under 64 pixels off by more than 32/255. On a
//             mismatch it draws the bad frame on two fresh pages: if those
//             differ, NONDETERMINISTIC (random or a clock). Else it redraws the
//             frame on fresh pages after each other sample and names the one
//             that changes it: ORDER-DEPENDENT, state one seek leaves behind.
//   NO-BUILD  every beat must change the picture: the frame one frame before
//             the beat starts against the frame one frame before the next
//             beat (subtitles, chapter, progress line and dot field hidden, camera
//             push off). Under
//             0.5% changed pixels is a slide. An intended still beat is
//             declared in scenes.js: window.HOLDS = ['scene-id:2'].
// --text   samples every --step seconds and joins what is on screen into "this
//          text was up from A to B" per element, so a typed line or a counter
//          is one piece:
//   FLASH    up shorter than 0.4 s + 0.2 s a word (FAIL under 60% of that).
//   SMALL    held 0.6 s or more and never reaches 20px (19.5px measured passes:
//            layout rounding). The size counts every CSS transform scale.
//   LONG     one 54px+ line held unchanged over 6 s (WARN: may be a slide).
//   OVERLAP  two different texts on each other for 0.3 s or more (FAIL when
//            both sit still, WARN when one moves). data-overlap-ok exempts.
//          Subtitles, chapter and brand are the stage's own and are skipped;
//          data-audit-skip skips any other block.
//
// Third-party code (see THIRD_PARTY_NOTICES.md at the repo root):
// - The gate (forward cold and reverse warm draws, the PSNR tolerance, the
//   culprit search on fresh pages, window.HOLDS) is adapted from the render
//   gate in take-one's scripts/gate.mjs, which is adapted from anidoodle
//   (github.com/alexgreensh/anidoodle), Copyright 2026 Alex Greenshpun,
//   Apache License 2.0. See ../LICENSE.anidoodle and ../NOTICE.anidoodle.
//   Modified by vs: a seeked HTML stage instead of a canvas, a changed-area
//   test, and the every-beat-builds measure.
// - The text audit is adapted from take-one's scripts/text-audit.mjs
//   (github.com/talsiach/take-one), Copyright (c) 2026 Tal Siach, MIT. See
//   ../LICENSE.take-one. Modified by vs: DOM spans per owner element.
// Exit codes: 0 no FAIL (WARN lines are leads: fix or say why they stay);
// 1 at least one FAIL; 2 blocked.
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { beatIssues, beatWindows, changedFraction, compareDraws, determinismIssue, diffRegion, RULES, sameDraw, sampleTimes, scanScenes, textIssues, textSpans } from './checks.mjs';
import { fail } from './media.mjs';
import { openStage } from './stage.mjs';

const args = process.argv.slice(2);
const opt = (name, fallback) => (args.includes(name) ? args[args.indexOf(name) + 1] : fallback);
const VALUED = ['--step', '--samples'];
const workArg = args.find((arg, i) => !arg.startsWith('--') && !VALUED.includes(args[i - 1]));
if (!workArg) fail('Usage: node check.mjs <work-dir> [--gate] [--text] [--step 0.1] [--samples 12]');
const work = path.resolve(workArg);
const both = !args.includes('--gate') && !args.includes('--text');
const runGate = both || args.includes('--gate');
const runText = both || args.includes('--text');
const step = Number(opt('--step', '0.1'));
const samples = Number(opt('--samples', String(RULES.samples)));

const { browser, newPage, errors } = await openStage(work, 'check.mjs');
const scratch = mkdtempSync(path.join(tmpdir(), 'vs-check-'));
process.on('exit', () => rmSync(scratch, { recursive: true, force: true }));
const report = { gate: null, text: null };
const issues = [];
const sha = (buffer) => createHash('sha1').update(buffer).digest('hex');
const seek = (page, t) => page.evaluate((time) => window.seek(time), t);
const shot = async (page, t) => {
  await seek(page, t);
  return page.screenshot({ type: 'png' });
};
// Grey pixels decoded by ffmpeg: 480x270 for the beat measure, full size for
// the determinism patch test.
const grey = (png, scale = 'scale=480:270,') => {
  const out = spawnSync('ffmpeg', ['-v', 'error', '-f', 'png_pipe', '-i', '-', '-vf', `${scale}format=gray`, '-f', 'rawvideo', '-'], { input: png, maxBuffer: 1 << 24 });
  if (out.status !== 0) fail(`ffmpeg could not decode a frame: ${out.stderr.toString().slice(-300)}`);
  return out.stdout;
};
const measure = (a, b) => ({ psnr: psnr(a, b), region: diffRegion(grey(a, ''), grey(b, ''), 1920) });
const same = (a, b) => sha(a) === sha(b) || sameDraw({ equal: false, ...measure(a, b) });
const psnr = (a, b) => {
  const fa = path.join(scratch, 'a.png');
  const fb = path.join(scratch, 'b.png');
  writeFileSync(fa, a);
  writeFileSync(fb, b);
  const out = spawnSync('ffmpeg', ['-v', 'info', '-i', fa, '-i', fb, '-lavfi', 'psnr', '-f', 'null', '-'], { encoding: 'utf8' });
  const m = /average:(inf|[\d.]+)/.exec(out.stderr ?? '');
  return m ? (m[1] === 'inf' ? Infinity : Number(m[1])) : 0;
};

try {
  const page = await newPage();
  const TL = await page.evaluate('window.TL');
  const end = TL.total;

  if (runGate) {
    const contract = scanScenes(readFileSync(path.join(work, 'scenes.js'), 'utf8'));
    // Forward on a fresh page, then reverse on the same warm page.
    const times = sampleTimes(end, samples, TL.fps ?? 30);
    const forward = {};
    const reverse = {};
    const pngs = {};
    for (const t of times) {
      pngs[t] = await shot(page, t);
      forward[t] = sha(pngs[t]);
    }
    const reversePngs = {};
    for (const t of [...times].reverse()) {
      reversePngs[t] = await shot(page, t);
      reverse[t] = sha(reversePngs[t]);
    }
    const mismatches = compareDraws(forward, reverse, (t) => measure(pngs[t], reversePngs[t]));
    const determinism = [];
    const coldShot = async (t, first = null) => {
      const p = await newPage();
      if (first !== null) await seek(p, first);
      const png = await shot(p, t);
      await p.close();
      return png;
    };
    for (const mismatch of mismatches.slice(0, 2)) {
      const { t } = mismatch;
      // Cold twice first: two fresh pages that disagree mean randomness, not order.
      const cold = await coldShot(t);
      const coldSame = same(cold, await coldShot(t));
      let culprit = null;
      if (coldSame) {
        for (const other of times.filter((x) => x !== t)) {
          if (!same(cold, await coldShot(t, other))) {
            culprit = other;
            break;
          }
        }
      }
      determinism.push(determinismIssue(mismatch, { coldSame, culprit }));
    }
    // Every beat builds: chrome hidden and the camera still, scene pixels only.
    await page.addStyleTag({ content: '#progress,#sub,#chap,#brand,#bg{visibility:hidden!important}' });
    await page.evaluate('window.VS_CALM = true');
    const holds = (await page.evaluate('window.HOLDS')) ?? [];
    const windows = beatWindows(TL, holds);
    const fractions = [];
    for (const w of windows) fractions.push(changedFraction(grey(await shot(page, w.from)), grey(await shot(page, w.to))));
    const builds = beatIssues(windows, fractions);
    report.gate = {
      samples: times.length,
      mismatched: mismatches.map(({ t }) => t),
      beats: windows.map((w, i) => ({ beat: `${w.scene}:${w.beat}`, changedPercent: Number((fractions[i] * 100).toFixed(2)), hold: w.hold })),
    };
    issues.push(...contract, ...determinism, ...builds);
  }

  if (runText) {
    const text = await newPage();
    // The camera push moves every block a little; OVERLAP would read still text as moving.
    await text.evaluate(() => {
      window.VS_CALM = true;
      let n = 0;
      for (const e of document.querySelectorAll('#scenes *')) e.dataset.vsTid = String(n++);
    });
    const series = [];
    for (let t = 0; t < end; t = Number((t + step).toFixed(3))) {
      await seek(text, t);
      series.push({ t, items: await text.evaluate(collectText) });
    }
    await text.close();
    const spans = textSpans(series, step);
    report.text = { step, samples: series.length, spans: spans.length };
    issues.push(...textIssues(spans, { step, end }));
  }
  if (errors.length) fail(`Page errors while checking: ${errors.join(' | ')}. Fix scenes.js and rerun.`);
} finally {
  await browser.close();
}

const fails = issues.filter((i) => i.level === 'FAIL').length;
const warns = issues.length - fails;
process.stdout.write(`${JSON.stringify({
  ...report,
  fails,
  warns,
  issues,
  next: fails
    ? 'Fix each FAIL in scenes.js (see references/checks.md), then rerun check.mjs.'
    : warns
      ? 'No FAIL. Look at each WARN: fix it or say why it stays. Then render with --out.'
      : 'Checks passed. Render with --out.',
}, null, 2)}\n`);
process.exit(fails ? 1 : 0);

// Runs in the page: every visible text block in the scenes, grouped by the
// element that owns it (the nearest element tagged at boot).
function collectText() {
  const groups = new Map();
  const opacity = new Map();
  const opacityOf = (e) => {
    if (!e || e === document.documentElement) return 1;
    if (opacity.has(e)) return opacity.get(e);
    const cs = getComputedStyle(e);
    const o = cs.display === 'none' || cs.visibility === 'hidden' ? 0 : Number(cs.opacity) * opacityOf(e.parentElement);
    opacity.set(e, o);
    return o;
  };
  const walker = document.createTreeWalker(document.getElementById('scenes'), NodeFilter.SHOW_TEXT);
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    const parent = node.parentElement;
    if (!node.textContent.trim() || !parent || parent.closest('[data-audit-skip]')) continue;
    const owner = parent.closest('[data-vs-tid]');
    if (!owner || opacityOf(parent) < 0.5) continue;
    const range = document.createRange();
    range.selectNodeContents(node);
    const r = range.getBoundingClientRect();
    if (r.width < 1 || r.height < 1 || r.right < 0 || r.left > 1920 || r.bottom < 0 || r.top > 1080) continue;
    // The size on screen: the computed font size times every transform scale
    // above it. (A box width over the layout width carries the layout width's
    // whole-pixel rounding into the size: a 20px label read as 19.97px.)
    let scale = 1;
    for (let e = parent; e && e !== document.documentElement; e = e.parentElement) {
      const transform = getComputedStyle(e).transform;
      if (transform && transform !== 'none') {
        const m = new DOMMatrixReadOnly(transform);
        scale *= Math.hypot(m.a, m.b);
      }
    }
    const px = Number.parseFloat(getComputedStyle(parent).fontSize) * scale;
    const id = owner.dataset.vsTid;
    const g = groups.get(id);
    if (g) {
      g.text += ` ${node.textContent.trim()}`;
      g.px = Math.max(g.px, px);
      const x2 = Math.max(g.x + g.w, r.right);
      const y2 = Math.max(g.y + g.h, r.bottom);
      g.x = Math.min(g.x, r.left);
      g.y = Math.min(g.y, r.top);
      g.w = x2 - g.x;
      g.h = y2 - g.y;
    } else {
      groups.set(id, {
        id,
        text: node.textContent.trim(),
        px,
        x: r.left,
        y: r.top,
        w: r.width,
        h: r.height,
        scene: owner.closest('.scene')?.dataset.scene ?? '',
        ok: Boolean(parent.closest('[data-overlap-ok]')),
      });
    }
  }
  return [...groups.values()];
}
