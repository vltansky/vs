#!/usr/bin/env node
// Renders each HTML scene to a silent mp4 whose length equals that scene's
// narration plus the manifest pause. Frame-accurate: every animation is paused
// and seeked to frame time before each screenshot, so output never depends on
// how fast the machine captures.
//
//   node render-scenes.mjs <scenes.json> [--only <scene-id>]
//
// Scenes animate with CSS animations / Web Animations (seekable), or expose
// window.seek(seconds) for canvas/JS drawing. requestAnimationFrame loops and
// timers are not seekable and render frozen or jittery.
// The page also gets --scene-duration (CSS var) and data-duration on <html>.
//
// Scenes with `video` or `image` instead of `html` are skipped here; mux.mjs
// uses them directly (Manim/Remotion output, a /vs-show-me still).
//
// Exit codes: 0 rendered; 2 blocked (no Playwright/ffmpeg, missing audio, bad scene).
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

import {
  fail, probeDuration, readManifest, resolveIn, resolvePlaywright, sceneDuration, which, writeManifest,
} from './media.mjs';

const args = process.argv.slice(2);
const manifestPath = args.find((arg) => !arg.startsWith('--'));
const only = args.includes('--only') ? args[args.indexOf('--only') + 1] : null;
if (!manifestPath) fail('Usage: node render-scenes.mjs <scenes.json> [--only <scene-id>]');
if (!which('ffmpeg')) fail('ffmpeg is missing. Run: brew install ffmpeg. Then rerun render-scenes.mjs.');

const entry = resolvePlaywright();
if (!entry) {
  fail('Playwright is not resolvable. Run: npm i -D playwright && npx playwright install chromium, or set PLAYWRIGHT_MODULE=/abs/path/node_modules/playwright.');
}
const playwright = await import(pathToFileURL(entry).href);
const chromium = playwright.chromium ?? playwright.default?.chromium;

const manifest = readManifest(manifestPath);
const fps = manifest.fps ?? 30;
const width = manifest.width ?? 1280;
const height = manifest.height ?? 720;
const renderDir = path.join(manifest.dir, 'render');
mkdirSync(renderDir, { recursive: true });

const encode = (out) => {
  const ffmpeg = spawn('ffmpeg', [
    '-y', '-loglevel', 'error', '-f', 'image2pipe', '-c:v', 'png', '-framerate', String(fps), '-i', '-',
    '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '18', '-r', String(fps), out,
  ], { stdio: ['pipe', 'inherit', 'inherit'] });
  const done = new Promise((resolve, reject) => {
    ffmpeg.on('error', reject);
    ffmpeg.on('close', (code) => (code === 0 ? resolve() : reject(new Error(`ffmpeg exited ${code} for ${out}`))));
  });
  return { stdin: ffmpeg.stdin, done };
};

// Playwright's bundled browser can lag its package version; installed Chrome
// is an equivalent renderer for static scenes.
const launch = async () => {
  try {
    return await chromium.launch();
  } catch (bundled) {
    try {
      return await chromium.launch({ channel: 'chrome' });
    } catch {
      fail(`Chromium did not launch: ${bundled.message.split('\n')[0]}. Run: npx playwright install chromium. Then rerun render-scenes.mjs.`);
    }
  }
};
const browser = await launch();
const results = [];
try {
  const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 1 });
  for (const [index, scene] of manifest.scenes.entries()) {
    const id = scene.id ?? String(index + 1).padStart(2, '0');
    if (only && id !== only) continue;
    if (!scene.html) continue;
    const audio = resolveIn(manifest, scene.audio);
    const audioSeconds = audio ? probeDuration(audio) : null;
    if (audioSeconds === null) fail(`scene ${id}: no readable audio. Run narrate.mjs first.`);
    const seconds = sceneDuration(manifest, audioSeconds);
    const frames = Math.ceil(seconds * fps);

    const html = scene.html.startsWith('http') ? scene.html : pathToFileURL(resolveIn(manifest, scene.html)).href;
    await page.goto(html, { waitUntil: 'load' });
    await page.evaluate(async (duration) => {
      document.documentElement.style.setProperty('--scene-duration', `${duration}s`);
      document.documentElement.dataset.duration = String(duration);
      await document.fonts.ready;
    }, seconds);

    const out = path.join(renderDir, `${id}.mp4`);
    const { stdin, done } = encode(out);
    for (let frame = 0; frame < frames; frame += 1) {
      const t = frame / fps;
      await page.evaluate(async (time) => {
        for (const animation of document.getAnimations()) {
          animation.pause();
          animation.currentTime = time * 1000;
        }
        if (typeof window.seek === 'function') await window.seek(time);
      }, t);
      const png = await page.screenshot({ type: 'png' });
      if (!stdin.write(png)) await new Promise((resolve) => stdin.once('drain', resolve));
    }
    stdin.end();
    await done;
    scene.video = path.relative(manifest.dir, out);
    results.push({ id, video: scene.video, seconds: Number(seconds.toFixed(3)), frames });
  }
} finally {
  await browser.close();
}

writeManifest(manifestPath, manifest);
process.stdout.write(`${JSON.stringify({ fps, width, height, rendered: results }, null, 2)}\n`);
