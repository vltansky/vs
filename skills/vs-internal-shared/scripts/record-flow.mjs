#!/usr/bin/env node
// Records a captioned frontend flow to disk and prints a manifest, never the pixels.
//
//   node record-flow.mjs <flow.json> --out <dir> [--no-video] [--headed]
//
// flow.json:
//   {
//     "url": "http://localhost:5173/",
//     "viewport": { "width": 1280, "height": 720 },
//     "steps": [
//       { "caption": "Initial state", "still": "01-initial" },
//       { "caption": "Open the theme menu", "click": "#theme", "still": "02-menu" },
//       { "caption": "Type a name", "type": { "selector": "#name", "text": "Ada" } },
//       { "caption": "Submit", "press": "Enter", "wait": 400, "still": "03-done" }
//     ]
//   }
//
// Step keys: caption, still, click, hover, type, press, goto, scroll, waitFor, wait.
// Captions are data: they are drawn into the page (so every still and video frame carries
// its own annotation), written to captions.vtt, and listed in manifest.json. The model
// reads the manifest to write the PR body; it never has to open an image.
//
// Playwright is resolved from PLAYWRIGHT_MODULE, then from the working directory. The vs
// plugin ships no browser dependency on purpose: the project under test already has one.
//
// Exit codes: 0 recorded; 2 not recorded (bad flow, no Playwright, page unreachable).
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { cursorOverlayScript } from './cursor-overlay.mjs';

const ACTION_KEYS = ['click', 'hover', 'type', 'press', 'goto', 'scroll', 'waitFor', 'wait'];
const STEP_KEYS = new Set(['caption', 'still', ...ACTION_KEYS]);

const fail = (message) => {
  process.stderr.write(`record-flow: ${message}\n`);
  process.exit(2);
};

const args = process.argv.slice(2);
const flowPath = args.find((arg) => !arg.startsWith('--'));
const outIndex = args.indexOf('--out');
const outDir = outIndex === -1 ? null : path.resolve(args[outIndex + 1] ?? '');
const wantVideo = !args.includes('--no-video');
const headed = args.includes('--headed');

if (!flowPath || !fs.existsSync(flowPath)) fail('Usage: record-flow.mjs <flow.json> --out <dir>');
if (!outDir) fail('Pass --out <dir> for the stills, video, captions, and manifest.');

let flow;
try {
  flow = JSON.parse(fs.readFileSync(flowPath, 'utf8'));
} catch (error) {
  fail(`${flowPath} is not valid JSON: ${error.message}`);
}
if (typeof flow.url !== 'string') fail('flow.url must be the page to open, for example http://localhost:5173/.');
if (!Array.isArray(flow.steps) || flow.steps.length === 0) fail('flow.steps must list at least one step.');

flow.steps.forEach((step, index) => {
  const keys = Object.keys(step ?? {});
  const known = keys.filter((key) => STEP_KEYS.has(key));
  if (known.length === 0) {
    fail(
      `step ${index + 1} has none of ${[...STEP_KEYS].join(', ')}. ` +
        'Give it a caption plus a still name or an action, for example {"caption":"Open menu","click":"#menu","still":"02-menu"}.',
    );
  }
  const unknown = keys.filter((key) => !STEP_KEYS.has(key));
  if (unknown.length > 0) fail(`step ${index + 1} has unknown key(s) ${unknown.join(', ')}.`);
});

const resolvePlaywright = () => {
  const spec = process.env.PLAYWRIGHT_MODULE || 'playwright';
  const from = createRequire(path.join(process.cwd(), 'record-flow-resolver.js'));
  for (const candidate of [spec, 'playwright-core']) {
    try {
      return from.resolve(candidate);
    } catch {
      // Try the next name; the failure message below covers both.
    }
  }
  return null;
};

const playwrightEntry = resolvePlaywright();
if (!playwrightEntry) {
  fail(
    'Playwright is not resolvable from this directory. Run from the project that depends on it, ' +
      'or set PLAYWRIGHT_MODULE=/abs/path/node_modules/playwright. Browsers install with: npx playwright install chromium.',
  );
}

const playwright = await import(pathToFileURL(playwrightEntry).href);
const chromium = playwright.chromium ?? playwright.default?.chromium;
if (!chromium) fail(`${playwrightEntry} exports no chromium launcher.`);

// Drawn inside the page so it lands in every still and video frame without any post-processing.
// Same top-layer trick as the cursor: popover=manual survives app dialogs and popovers.
const captionOverlayScript = () => {
  const install = () => {
    const bar = document.createElement('div');
    bar.dataset.demoCaption = 'true';
    bar.style.cssText = [
      'position:fixed',
      'left:50%',
      'bottom:24px',
      'top:auto',
      'right:auto',
      'transform:translateX(-50%)',
      'max-width:min(80vw,900px)',
      'margin:0',
      'padding:10px 18px',
      'border:0',
      'border-radius:10px',
      'background:rgba(17,17,17,.88)',
      'color:#fff',
      'font:600 20px/1.3 ui-sans-serif,system-ui,sans-serif',
      'letter-spacing:.01em',
      'text-align:center',
      'box-shadow:0 6px 24px rgba(0,0,0,.35)',
      'pointer-events:none',
      'z-index:2147483645',
      'display:none',
    ].join(';');
    document.body.appendChild(bar);
    bar.popover = 'manual';
    window.__vsCaption = (text) => {
      bar.textContent = text;
      bar.style.display = text ? 'block' : 'none';
      try {
        if (bar.matches(':popover-open')) bar.hidePopover();
        if (text) bar.showPopover();
      } catch {
        // No top-layer support: the bar still paints below same-z-index app UI.
      }
    };
    if (window.__vsCaptionPending) window.__vsCaption(window.__vsCaptionPending);
  };
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', install, { once: true });
  } else {
    install();
  }
};

fs.mkdirSync(outDir, { recursive: true });
const viewport = flow.viewport ?? { width: 1280, height: 720 };
const browser = await chromium.launch({ headless: !headed });
const context = await browser.newContext({
  viewport,
  deviceScaleFactor: 1,
  ...(wantVideo ? { recordVideo: { dir: outDir, size: viewport } } : {}),
});
const page = await context.newPage();
await page.addInitScript(cursorOverlayScript);
await page.addInitScript(captionOverlayScript);

const startedAt = Date.now();
const elapsed = () => Date.now() - startedAt;
const sha256 = (file) => createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const stills = [];
const cues = [];
let currentCaption = '';

const setCaption = async (text) => {
  currentCaption = text;
  await page.evaluate((value) => {
    window.__vsCaptionPending = value;
    if (window.__vsCaption) window.__vsCaption(value);
  }, text);
};

// Real pointer coordinates: element.click() fires no pointer events, so the cursor overlay
// would draw nothing and the video would show effects without a cause.
const moveTo = async (selector) => {
  const locator = page.locator(selector).first();
  await locator.waitFor({ state: 'visible' });
  await locator.scrollIntoViewIfNeeded();
  const box = await locator.boundingBox();
  if (!box) throw new Error(`${selector} has no bounding box`);
  const x = box.x + box.width / 2;
  const y = box.y + box.height / 2;
  await page.mouse.move(x, y, { steps: 12 });
  return { x, y };
};

const runAction = async (step) => {
  if (step.goto) await page.goto(step.goto, { waitUntil: 'load' });
  if (step.hover) await moveTo(step.hover);
  if (step.click) {
    await moveTo(step.click);
    await page.mouse.down();
    await page.waitForTimeout(90);
    await page.mouse.up();
  }
  if (step.type) {
    await moveTo(step.type.selector);
    await page.mouse.down();
    await page.mouse.up();
    await page.keyboard.type(step.type.text, { delay: 45 });
  }
  if (step.press) await page.keyboard.press(step.press);
  if (step.scroll) await page.mouse.wheel(0, step.scroll);
  if (step.waitFor) await page.locator(step.waitFor).first().waitFor({ state: 'visible' });
  if (step.wait) await page.waitForTimeout(step.wait);
};

const steps = [];
try {
  await page.goto(flow.url, { waitUntil: 'load' });
  await page.mouse.move(viewport.width / 2, viewport.height / 2);
  for (const [index, step] of flow.steps.entries()) {
    const atMs = elapsed();
    if (typeof step.caption === 'string') await setCaption(step.caption);
    if (cues.length > 0) cues[cues.length - 1].endMs = atMs;
    if (typeof step.caption === 'string') cues.push({ text: step.caption, startMs: atMs, endMs: null });
    await runAction(step);
    // Let the ripple and any transition settle so the still shows the result, not the press.
    await page.waitForTimeout(step.still ? 350 : 250);
    const action = ACTION_KEYS.filter((key) => key in step).map((key) => `${key}=${JSON.stringify(step[key])}`).join(' ');
    const record = { index: index + 1, caption: currentCaption, action: action || null, atMs };
    if (step.still) {
      const file = path.join(outDir, `${step.still}.png`);
      await page.screenshot({ path: file });
      stills.push({ path: file, caption: currentCaption, mediaType: 'image/png', bytes: fs.statSync(file).size, sha256: sha256(file) });
      record.still = file;
    }
    steps.push(record);
  }
  await page.waitForTimeout(600);
} catch (error) {
  await browser.close().catch(() => {});
  fail(`${error.message}\n  Is ${flow.url} serving? Check the selector in the failing step and re-run.`);
}
if (cues.length > 0) cues[cues.length - 1].endMs = elapsed();
const durationMs = elapsed();

const video = page.video();
await context.close();
await browser.close();

let videoRecord = null;
if (video) {
  const webm = path.join(outDir, 'flow.webm');
  fs.renameSync(await video.path(), webm);
  videoRecord = { path: webm, mediaType: 'video/webm', bytes: fs.statSync(webm).size, sha256: sha256(webm), durationMs };
  // GitHub's uploader accepts webm but plays mp4 far more reliably in the PR view.
  if (spawnSync('ffmpeg', ['-version'], { stdio: 'ignore' }).status === 0) {
    const mp4 = path.join(outDir, 'flow.mp4');
    const ffmpeg = spawnSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', webm, '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', mp4], { encoding: 'utf8' });
    if (ffmpeg.status === 0) videoRecord = { ...videoRecord, path: mp4, mediaType: 'video/mp4', bytes: fs.statSync(mp4).size, sha256: sha256(mp4), webm };
    else process.stderr.write(`record-flow: ffmpeg transcode failed, keeping webm: ${ffmpeg.stderr.trim()}\n`);
  }
}

const vttTime = (ms) => new Date(ms).toISOString().slice(11, 23);
const vtt = ['WEBVTT', '', ...cues.map((cue, index) => `${index + 1}\n${vttTime(cue.startMs)} --> ${vttTime(cue.endMs ?? durationMs)}\n${cue.text}\n`)].join('\n');
const captionsPath = path.join(outDir, 'captions.vtt');
fs.writeFileSync(captionsPath, vtt);

const manifest = { url: flow.url, viewport, durationMs, steps, stills, video: videoRecord, captions: captionsPath };
const manifestPath = path.join(outDir, 'manifest.json');
fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
process.stdout.write(`${JSON.stringify({ manifest: manifestPath, ...manifest }, null, 2)}\n`);
process.stderr.write(
  `record-flow: ${stills.length} still(s)${videoRecord ? ' and 1 video' : ''} in ${outDir}. ` +
    'Captions above are the annotations; upload the files and embed the returned URLs. Reading the images is not needed.\n',
);
