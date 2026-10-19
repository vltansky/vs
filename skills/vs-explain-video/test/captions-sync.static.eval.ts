// Frame-loop sync for word captions, in the real stage with Chrome: seek every
// frame the renderer would, read the lit word from the DOM, and compare it
// with the word timestamps in timeline.js.
import * as fs from 'node:fs';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import * as path from 'node:path';
import { pathToFileURL } from 'node:url';
import puppeteer, { type Browser, type Page } from 'puppeteer-core';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const DIR = path.resolve(__dirname, '..');
const CHROME = [process.env.CHROME_PATH, '/usr/bin/google-chrome-stable', '/usr/bin/google-chrome',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'].find((p) => p && fs.existsSync(p));
const FPS = 30;

type Cap = { from: number; to: number; words: [number, number, string][] };

async function fixture(style: string): Promise<{ work: string; caps: Cap[]; total: number }> {
  const { buildCaptions } = await import(pathToFileURL(path.join(DIR, 'scripts', 'captions.mjs')).href);
  const work = mkdtempSync(path.join(tmpdir(), `vs-captions-sync-${style}-`));
  for (const f of ['captions.js', 'motion.js']) fs.copyFileSync(path.join(DIR, 'assets', f), path.join(work, f));
  fs.copyFileSync(path.join(DIR, 'assets', 'stage.html'), path.join(work, 'index.html'));
  writeFileSync(path.join(work, 'scenes.js'), "scene('one', () => () => {});\n");
  // Kokoro-style word times: a 40 ms word, a short gap (held), a 0.5 s gap
  // (new page), a seven-word sentence, and a pronounce word (AICM).
  const kokoro = path.join(work, 'b0.wav');
  writeFileSync(kokoro, '');
  const t0 = [['AICM', 0, 0.42], ['ships', 0.46, 0.8], ['a', 0.8, 0.84], ['fix', 0.84, 1.1], ['today.', 1.3, 1.7],
    ['Then', 2.2, 2.4], ['the', 2.4, 2.5], ['cache', 2.5, 2.8], ['serves', 2.8, 3.1], ['every', 3.1, 3.35],
    ['second', 3.35, 3.7], ['request.', 3.7, 4.2]] as const;
  writeFileSync(`${kokoro}.words.json`, JSON.stringify(t0.flatMap(([text, start, end]) => (text === 'AICM'
    ? ['A', 'I', 'C', 'M'].map((l, i) => ({ text: l, start: start + i * 0.1, end: start + (i + 1) * 0.1 }))
    : [{ text, start, end }]))));
  const est = path.join(work, 'b1.wav');
  writeFileSync(est, '');
  const beats = [
    { scene: 'one', index: 0, text: 'AICM ships a fix today. Then the cache serves every second request.', at: 0.7, seconds: 4.3, audio: kokoro },
    { scene: 'one', index: 1, text: 'Internationalization configuration documentation regenerates automatically overnight.', at: 5.45, seconds: 4, audio: est },
  ];
  const spokenOf = (w: string) => w.replace(/AICM/g, 'A I C M');
  const { caps, meta } = buildCaptions(beats, { spokenOf, style, fps: FPS, whisper: null });
  const total = 10.6;
  const TL = { title: 't', brand: 'b', fps: FPS, total, subs: [[0.7, 5, 'legacy line']],
    scenes: [{ id: 'one', title: 'one', start: 0, dur: total, beats: [{ t: 0.7, d: 4.3, text: beats[0].text }, { t: 5.45, d: 4, text: beats[1].text }] }],
    caps, captions: meta };
  writeFileSync(path.join(work, 'timeline.js'), `window.TL = ${JSON.stringify(TL)};\n`);
  return { work, caps, total };
}

async function open(browser: Browser, work: string): Promise<Page> {
  const page = await browser.newPage();
  await page.setViewport({ width: 1920, height: 1080, deviceScaleFactor: 1 });
  await page.goto(pathToFileURL(path.join(work, 'index.html')).href);
  await page.waitForFunction('window.READY === true');
  return page;
}

// What the DOM shows at T: words, the lit index, the class string, and the
// number of lines the page wraps to.
const read = (page: Page, T: number) => page.evaluate((t) => {
  (window as unknown as { seek: (x: number) => void }).seek(t);
  const ws = [...document.querySelectorAll('#sub .w')] as HTMLElement[];
  const lit = ws.map((w, i) => (w.classList.contains('on') ? i : -1)).filter((i) => i >= 0);
  const tops = new Set(ws.map((w) => Math.round(w.getBoundingClientRect().top)));
  return { text: ws.map((w) => w.textContent).join(' '), lit, classes: ws.map((w) => w.className).join('|'), lines: tops.size,
    box: document.getElementById('sub')!.className, legacy: document.querySelector('#sub > span')!.textContent };
}, T);

// The oracle, straight from the timestamps: the page whose span holds T, and
// on it the last word that has started.
const expected = (caps: Cap[], T: number) => {
  let page = -1;
  caps.forEach((c, i) => { if (c.from <= T && T < c.to) page = i; });
  if (page < 0) return { page, word: -1 };
  let word = -1;
  caps[page].words.forEach((w, i) => { if (w[0] <= T) word = i; });
  return { page, word };
};
const nearBoundary = (caps: Cap[], T: number) =>
  caps.some((c) => [c.from, c.to, ...c.words.map((w) => w[0])].some((b) => Math.abs(b - T) <= 1 / FPS + 1e-6));

describe.skipIf(!CHROME)('vs-explain-video word captions in the frame loop', () => {
  let browser: Browser;
  beforeAll(async () => {
    // Two pages share one browser; keep the one behind the other painting, or a
    // seek, waitForFunction, or screenshot on it can stall on a busy CI runner.
    browser = await puppeteer.launch({
      executablePath: CHROME,
      args: ['--no-sandbox', '--force-color-profile=srgb', '--disable-background-timer-throttling',
        '--disable-backgrounding-occluded-windows', '--disable-renderer-backgrounding'],
    });
  }, 60_000);
  afterAll(async () => { await browser?.close(); });

  it('lights the word the timestamps say, one at a time, each for 2+ frames, within page limits', async () => {
    const { work, caps, total } = await fixture('pill');
    const page = await open(browser, work);
    const litFrames = new Map<string, number>();
    const firstLit = new Map<string, number>();
    const frames = Math.ceil(total * FPS);
    for (let f = 0; f < frames; f += 1) {
      const T = f / FPS;
      const dom = await read(page, T);
      const want = expected(caps, T);
      expect(dom.box).toBe('cap cap-pill');
      if (want.page < 0) {
        expect(dom.lit, `frame ${f}`).toEqual([]);
        continue;
      }
      expect(dom.text, `frame ${f}`).toBe(caps[want.page].words.map((w) => w[2]).join(' '));
      expect(dom.lit.length, `exactly one lit word at frame ${f}`).toBe(1);
      if (dom.lit[0] !== want.word) expect(nearBoundary(caps, T), `frame ${f}: lit ${dom.lit[0]}, timestamps say ${want.word}`).toBe(true);
      expect(dom.lines, `frame ${f}: ${dom.text}`).toBeLessThanOrEqual(2);
      const key = `${want.page}:${dom.lit[0]}`;
      litFrames.set(key, (litFrames.get(key) ?? 0) + 1);
      if (!firstLit.has(key)) firstLit.set(key, f);
    }
    caps.forEach((c, p) => c.words.forEach((w, i) => {
      const key = `${p}:${i}`;
      expect(litFrames.get(key) ?? 0, `"${w[2]}" lit frames`).toBeGreaterThanOrEqual(2);
      expect(Math.abs(firstLit.get(key)! - Math.ceil(w[0] * FPS - 1e-9)), `"${w[2]}" first lit frame`).toBeLessThanOrEqual(1);
    }));
    for (const c of caps) expect(c.words.length).toBeLessThanOrEqual(6);
    const shown = caps.flatMap((c) => c.words.map((w) => w[2])).join(' ');
    expect(shown).toContain('AICM ships');
    expect(shown).not.toMatch(/\bA I C M\b/);
  }, 120_000);

  it('draws the same frame whatever order and whichever page seeks it', async () => {
    const { work, total } = await fixture('pill');
    const [a, b] = [await open(browser, work), await open(browser, work)];
    const times = Array.from({ length: Math.ceil(total * FPS) }, (_, f) => f / FPS);
    const forward: string[] = [];
    for (const T of times) forward.push((await read(a, T)).classes);
    // Two "workers", each taking every other frame in reverse, as a parallel
    // render would split them.
    const split: string[] = Array.from({ length: times.length }, () => '');
    for (let i = times.length - 1; i >= 0; i -= 1) split[i] = (await read(i % 2 ? a : b, times[i])).classes;
    expect(split).toEqual(forward);
    const T = 1.0;
    await read(a, T);
    await read(b, 7.3);
    await read(b, T);
    expect(Buffer.compare(await a.screenshot(), await b.screenshot())).toBe(0);
  }, 120_000);

  it('applies each style and keeps the legacy line', async () => {
    for (const style of ['colour', 'pop']) {
      const { work } = await fixture(style);
      const dom = await read(await open(browser, work), 1.0);
      expect(dom.box).toBe(`cap cap-${style}`);
      expect(dom.lit.length).toBe(1);
    }
    const { work } = await fixture('line');
    const dom = await read(await open(browser, work), 1.0);
    expect(dom.box).toBe('');
    expect(dom.legacy).toBe('legacy line');
  }, 60_000);
});
