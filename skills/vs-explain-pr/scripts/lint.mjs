#!/usr/bin/env node
// Cheap checks before any render:
//
//   node lint.mjs <work-dir> [--no-page]
//
// Script: the five roles in order (problem, before, change, after, risk), the
// problem in 1-2 beats, beats of 24 words or fewer, an estimated length within
// 75 s, and the PR's media on the before/after scenes (pr-video.mjs).
// Page (when scenes.js and timeline.js exist, unless --no-page): at the end of
// each scene, every visible text of more than 3 words is at least 24 px (it
// must read on a phone at 720p; short labels keep the stage's 20 px floor), at most 40 words are on screen besides the caption, and every still
// or clip is at least 900 px wide.
// The renderer comes from <work>/renderer.json (fframes.mjs init, check and
// fallback write it), never from leftover files: a fallback work dir still has
// ff/src/main.rs. With fframes the page is Rust, not scenes.js: the same three
// checks run in `fframes.mjs check <work> --pr`, so lint.mjs checks the script
// only; `pending` (fframes once doctor --warm is done) counts as fframes. With no
// marker, fframes needs ff/src/main.rs and a ready shared build.
//
// Exit codes: 0 pass; 1 problems (fix script.json or scenes.js); 2 blocked.
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

import { readJson, rendererFor } from '../../vs-explain-video/scripts/fframes.mjs';
import { ensurePlaywright, fail } from '../../vs-explain-video/scripts/media.mjs';
import { lintScript } from './pr-video.mjs';

const args = process.argv.slice(2);
const workArg = args.find((arg) => !arg.startsWith('--'));
if (!workArg) fail('Usage: node lint.mjs <work-dir> [--no-page]');
const work = path.resolve(workArg);
const scriptPath = path.join(work, 'script.json');
if (!existsSync(scriptPath)) fail(`${scriptPath} is missing. Run init.mjs and write it.`);
const script = JSON.parse(readFileSync(scriptPath, 'utf8'));
const mediaPath = path.join(work, 'media.json');
const media = existsSync(mediaPath) ? JSON.parse(readFileSync(mediaPath, 'utf8')).map((m) => m.file) : [];
const { seconds, problems } = lintScript(script, { media });

const MIN_PX = 24;
const MAX_WORDS = 40;
const MIN_MEDIA_W = 900;
const pageIssues = [];
// pending: fframes once doctor --warm is done, so its page checks are fframes' too.
const pending = readJson(path.join(work, 'renderer.json'))?.renderer === 'pending';
const fframes = pending || rendererFor(work) === 'fframes';
const canPage = !fframes && !args.includes('--no-page') && ['index.html', 'timeline.js', 'scenes.js'].every((f) => existsSync(path.join(work, f)));
if (canPage) {
  const { entry, error } = ensurePlaywright([work]);
  if (!entry) fail(`Playwright is not available: ${error}. Rerun with --no-page to check the script only.`);
  const playwright = await import(pathToFileURL(entry).href);
  const chromium = playwright.chromium ?? playwright.default?.chromium;
  let browser;
  try { browser = await chromium.launch(); } catch { browser = await chromium.launch({ channel: 'chrome' }); }
  try {
    const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
    await page.goto(pathToFileURL(path.join(work, 'index.html')).href);
    await page.waitForFunction('window.READY === true', null, { timeout: 15000 }).catch(() => fail(`The stage never became ready: ${errors.join(' | ')}`));
    if (errors.length) fail(`Page errors: ${errors.join(' | ')}`);
    const TL = await page.evaluate('window.TL');
    for (const scene of TL.scenes) {
      const t = scene.start + scene.dur - 0.5;
      await page.evaluate((x) => window.seek(x), t);
      const found = await page.evaluate(({ id, minPx, minW }) => {
        const root = document.querySelector(`.scene[data-scene="${CSS.escape(id)}"]`);
        const shown = (e) => {
          let n = e;
          while (n && n !== document.body) {
            const cs = getComputedStyle(n);
            if (cs.display === 'none' || cs.visibility === 'hidden' || Number(cs.opacity) < 0.15) return false;
            n = n.parentElement;
          }
          const r = e.getBoundingClientRect();
          return r.width > 0 && r.height > 0;
        };
        const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
        let words = 0;
        const small = [];
        while (walker.nextNode()) {
          const text = walker.currentNode.textContent.trim();
          const host = walker.currentNode.parentElement;
          if (!text || !host || !shown(host)) continue;
          words += text.split(/\s+/).length;
          const px = parseFloat(getComputedStyle(host).fontSize);
          if (px < minPx && text.split(/\s+/).length > 3) small.push(`${px}px "${text.slice(0, 30)}"`);
        }
        const narrow = [...root.querySelectorAll('.shot')].filter(shown).map((e) => e.getBoundingClientRect().width).filter((w) => w < minW);
        return { words, small: [...new Set(small)].slice(0, 5), narrow };
      }, { id: scene.id, minPx: MIN_PX, minW: MIN_MEDIA_W });
      if (found.small.length) pageIssues.push(`PHONE ${scene.id}: text of 4+ words under ${MIN_PX}px: ${found.small.join(', ')}`);
      if (found.words > MAX_WORDS) pageIssues.push(`DENSE ${scene.id}: ${found.words} words on screen (max ${MAX_WORDS}); cut text, the voice carries it.`);
      for (const w of found.narrow) pageIssues.push(`PHONE ${scene.id}: a still or clip is ${Math.round(w)}px wide (min ${MIN_MEDIA_W}); show it larger.`);
    }
  } finally {
    await browser.close();
  }
}

const all = [...problems, ...pageIssues];
process.stdout.write(`${JSON.stringify({
  estimatedSeconds: seconds,
  pageChecked: canPage,
  renderer: pending ? 'pending' : fframes ? 'fframes' : 'playwright',
  problems: all,
  next: all.length ? 'Fix each problem in script.json or scenes.js, then rerun lint.mjs.' : fframes ? `Script passed. The page checks (PHONE, DENSE, media width) run in fframes.mjs check <work-dir> --pr${pending ? ' (after fframes.mjs doctor --warm finishes; if fframes cannot run, fframes.mjs fallback <work-dir> --reason "<why>", then render.mjs --stills)' : ''}.` : canPage ? 'Lint passed. Run render.mjs --stills and check.mjs.' : 'Script passed. Narrate, write scenes.js, then rerun lint.mjs for the page checks.',
}, null, 2)}\n`);
process.exit(all.length ? 1 : 0);
