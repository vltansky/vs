#!/usr/bin/env node
// Renders the work directory's index.html by seeking it frame by frame.
//
//   node render.mjs <work-dir> --stills [--scene <id>] [--at 12.5,30]
//   node render.mjs <work-dir> --out <video.mp4> [--scene <id>]
//
// --stills: screenshots each beat when it finishes speaking (every build for
// that beat is on screen) plus each scene's last frame, and runs the stage's
// layout audit on every one. Exit 1 when the audit finds overlap, overflow,
// or blocks under the subtitle or chapter bar. This is the fast loop: fix
// scenes.js and rerun until it passes, before spending a full render.
//
// --out: renders every frame with the narration muxed in, then checks the
// ffprobe duration against the timeline. --scene renders one scene only, for
// a quick preview. Subtitles are already drawn into the frames; no subtitle
// stream is added, because players would show every line twice.
//
// Exit codes: 0 done; 1 audit issues (--stills) or duration mismatch (--out);
// 2 blocked (missing input, no Playwright/ffmpeg, page error).
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

import { fail, probeDuration, resolvePlaywright, which } from './media.mjs';

const args = process.argv.slice(2);
const opt = (name) => (args.includes(name) ? args[args.indexOf(name) + 1] : null);
const workArg = args.find((arg, i) => !arg.startsWith('--') && !args[i - 1]?.startsWith('--'));
const stillsMode = args.includes('--stills');
const outArg = opt('--out');
const only = opt('--scene');
const at = opt('--at')?.split(',').map(Number);
if (!workArg || (!stillsMode && !outArg)) {
  fail('Usage: node render.mjs <work-dir> --stills [--scene <id>] [--at 1,2]  |  node render.mjs <work-dir> --out <video.mp4> [--scene <id>]');
}
const work = path.resolve(workArg);
for (const file of ['index.html', 'timeline.js', 'scenes.js', 'motion.js']) {
  if (!existsSync(path.join(work, file))) {
    fail(`${path.join(work, file)} is missing. ${file === 'timeline.js' ? 'Run narrate.mjs first.' : 'Run init.mjs first.'}`);
  }
}
if (!which('ffmpeg') || !which('ffprobe')) fail('ffmpeg/ffprobe missing. Run: brew install ffmpeg. Then rerun render.mjs.');
const entry = resolvePlaywright([work]);
if (!entry) fail(`Playwright is not resolvable. Run: npm i --prefix ${work} playwright-core (uses installed Chrome; keeps the project untouched), then rerun render.mjs.`);
const playwright = await import(pathToFileURL(entry).href);
const chromium = playwright.chromium ?? playwright.default?.chromium;

// Playwright's bundled browser can lag its package version; installed Chrome
// renders the same page.
const launch = async () => {
  const flags = { args: ['--force-color-profile=srgb', '--disable-gpu-vsync'] };
  try {
    return await chromium.launch(flags);
  } catch (bundled) {
    try {
      return await chromium.launch({ ...flags, channel: 'chrome' });
    } catch {
      fail(`Chromium did not launch: ${bundled.message.split('\n')[0]}. Run: npx playwright install chromium. Then rerun render.mjs.`);
    }
  }
};

const browser = await launch();
const pageErrors = [];
let exitCode = 0;
try {
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
  page.on('pageerror', (error) => pageErrors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error' && !/favicon/.test(message.text())) pageErrors.push(message.text());
  });
  await page.goto(pathToFileURL(path.join(work, 'index.html')).href);
  try {
    await page.waitForFunction('window.READY === true', null, { timeout: 15000 });
  } catch {
    fail(`The stage never became ready. Page errors: ${pageErrors.join(' | ') || 'none'}. Fix scenes.js and rerun.`);
  }
  if (pageErrors.length) fail(`Page errors: ${pageErrors.join(' | ')}. Fix scenes.js and rerun.`);
  const TL = await page.evaluate('window.TL');
  const scenes = only ? TL.scenes.filter((scene) => scene.id === only) : TL.scenes;
  if (only && scenes.length === 0) fail(`No scene "${only}" in timeline.js. Scenes: ${TL.scenes.map((s) => s.id).join(', ')}.`);
  const seek = (t) => page.evaluate((time) => window.seek(time), t);

  if (stillsMode) {
    const stillsDir = path.join(work, 'stills');
    mkdirSync(stillsDir, { recursive: true });
    const moments = at
      ? at.map((t) => ({ t, name: `t${t.toFixed(2)}` }))
      : scenes.flatMap((scene) => [
        ...scene.beats.map((beat, i) => ({ t: scene.start + Math.min(beat.t + beat.d, scene.dur - 0.5), name: `${scene.id}-b${i}` })),
        { t: scene.start + scene.dur - 0.5, name: `${scene.id}-end` },
      ]);
    const stills = [];
    const issues = [];
    for (const { t, name } of moments) {
      await seek(t);
      const file = path.join(stillsDir, `${name}.png`);
      await page.screenshot({ path: file });
      const found = await page.evaluate('VS.audit()');
      stills.push(file);
      for (const issue of found) issues.push({ still: name, atSeconds: Number(t.toFixed(2)), ...issue });
    }
    if (pageErrors.length) fail(`Page errors while seeking: ${pageErrors.join(' | ')}.`);
    exitCode = issues.length ? 1 : 0;
    process.stdout.write(`${JSON.stringify({
      stills,
      issues,
      next: issues.length
        ? 'Fix each issue in scenes.js (move or resize the block, or mark an intended overlap with data-overlap-ok), then rerun --stills.'
        : 'Layout audit passed. Open the stills and look at them, then render with --out.',
    }, null, 2)}\n`);
  } else {
    const fps = TL.fps ?? 30;
    const from = scenes[0].start;
    const to = scenes.at(-1).start + scenes.at(-1).dur;
    const seconds = to - from;
    const frames = Math.ceil(seconds * fps);
    const out = path.resolve(outArg);
    mkdirSync(path.dirname(out), { recursive: true });
    const ffmpeg = spawn('ffmpeg', [
      '-y', '-loglevel', 'error',
      '-f', 'image2pipe', '-framerate', String(fps), '-c:v', 'mjpeg', '-i', '-',
      '-ss', String(from), '-t', String(seconds), '-i', path.join(work, 'narration.wav'),
      '-map', '0:v', '-map', '1:a',
      '-c:v', 'libx264', '-preset', 'medium', '-crf', '18', '-pix_fmt', 'yuv420p', '-r', String(fps),
      '-c:a', 'aac', '-b:a', '192k', '-shortest', '-movflags', '+faststart', out,
    ], { stdio: ['pipe', 'ignore', 'inherit'] });
    const done = new Promise((resolve, reject) => {
      ffmpeg.on('error', reject);
      ffmpeg.on('close', (code) => (code === 0 ? resolve() : reject(new Error(`ffmpeg exited ${code}`))));
    });
    const started = Date.now();
    for (let frame = 0; frame < frames; frame += 1) {
      await seek(from + frame / fps);
      const jpeg = await page.screenshot({ type: 'jpeg', quality: 92 });
      if (!ffmpeg.stdin.write(jpeg)) await new Promise((resolve) => ffmpeg.stdin.once('drain', resolve));
      if (frame % 900 === 0) process.stderr.write(`frame ${frame}/${frames} after ${Math.round((Date.now() - started) / 1000)}s\n`);
    }
    ffmpeg.stdin.end();
    try {
      await done;
    } catch (error) {
      fail(`${error.message} while encoding ${out}.`);
    }
    if (pageErrors.length) fail(`Page errors while rendering: ${pageErrors.join(' | ')}.`);
    const durationSeconds = probeDuration(out);
    const durationMatches = durationSeconds !== null && Math.abs(durationSeconds - seconds) <= 0.25;
    exitCode = durationMatches ? 0 : 1;
    process.stdout.write(`${JSON.stringify({
      output: out,
      durationSeconds,
      expectedSeconds: Number(seconds.toFixed(3)),
      frames,
      durationMatches,
      next: durationMatches
        ? 'Give the user the mp4 as a file:// link. Say the audio was not listen-checked.'
        : 'Duration differs from the timeline. Rerun narrate.mjs, then render again.',
    }, null, 2)}\n`);
  }
} finally {
  await browser.close();
}
process.exit(exitCode);
