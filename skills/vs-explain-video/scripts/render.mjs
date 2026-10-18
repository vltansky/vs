#!/usr/bin/env node
// Renders the work directory's index.html by seeking it frame by frame.
//
//   node render.mjs <work-dir> --stills [--scene <id>] [--at 12.5,30]
//   node render.mjs <work-dir> --out <video.mp4> [--scene <id>] [--workers N]
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
// --workers N splits the frames into N contiguous pieces, each drawn by its
// own page into its own segment, then joins the segments without re-encoding
// (default: half the cores, at most 3; 1 renders serially). Every frame is a
// pure function of t, so the pieces join seamlessly. It counts the frames in
// each segment and in the joined video, and exits 1 when they differ from the
// plan.
//
// Exit codes: 0 done; 1 audit issues (--stills), duration or frame-count
// mismatch (--out);
// 2 blocked (missing input, no Playwright/ffmpeg, page error).
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { cpus, tmpdir } from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

import { ensurePlaywright, fail, probeDuration, run, which } from './media.mjs';
import { defaultWorkers, frameParity, planPieces } from './pieces.mjs';

const args = process.argv.slice(2);
const opt = (name) => (args.includes(name) ? args[args.indexOf(name) + 1] : null);
const workArg = args.find((arg, i) => !arg.startsWith('--') && !['--out', '--scene', '--at', '--workers'].includes(args[i - 1]));
const stillsMode = args.includes('--stills');
const outArg = opt('--out');
const only = opt('--scene');
const at = opt('--at')?.split(',').map(Number);
const workersArg = opt('--workers');
if (workersArg !== null && !(Number(workersArg) >= 1)) fail('--workers takes a whole number, 1 or more.');
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
const { entry, error: playwrightError } = ensurePlaywright([work]);
if (!entry) fail(`Playwright is not available: ${playwrightError}. Fix that and rerun render.mjs, or set PLAYWRIGHT_MODULE=/abs/path/node_modules/playwright-core.`);
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
  const openPage = async () => {
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
    return page;
  };
  const page = await openPage();
  const TL = await page.evaluate('window.TL');
  const scenes = only ? TL.scenes.filter((scene) => scene.id === only) : TL.scenes;
  if (only && scenes.length === 0) fail(`No scene "${only}" in timeline.js. Scenes: ${TL.scenes.map((s) => s.id).join(', ')}.`);
  const seekOn = (p, t) => p.evaluate((time) => window.seek(time), t);
  const seek = (t) => seekOn(page, t);

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
    const pieces = planPieces(frames, workersArg ? Number(workersArg) : defaultWorkers(cpus().length));
    const scratch = mkdtempSync(path.join(tmpdir(), 'vs-render-'));
    const encode = (args, input) => {
      const ffmpeg = spawn('ffmpeg', ['-y', '-loglevel', 'error', ...args], { stdio: [input ? 'pipe' : 'ignore', 'ignore', 'inherit'] });
      const done = new Promise((resolve, reject) => {
        ffmpeg.on('error', reject);
        ffmpeg.on('close', (code) => (code === 0 ? resolve() : reject(new Error(`ffmpeg exited ${code}`))));
      });
      return { ffmpeg, done };
    };
    const started = Date.now();
    let drawn = 0;
    // One page per piece; each pipes its frames into its own segment.
    const renderPiece = async (piece) => {
      const p = piece.index === 0 ? page : await openPage();
      const file = path.join(scratch, `piece-${piece.index}.mp4`);
      const { ffmpeg, done } = encode([
        '-f', 'image2pipe', '-framerate', String(fps), '-c:v', 'mjpeg', '-i', '-',
        '-c:v', 'libx264', '-preset', 'medium', '-crf', '18', '-pix_fmt', 'yuv420p', '-r', String(fps), file,
      ], true);
      for (let frame = piece.first; frame < piece.first + piece.count; frame += 1) {
        await seekOn(p, from + frame / fps);
        const jpeg = await p.screenshot({ type: 'jpeg', quality: 92 });
        if (!ffmpeg.stdin.write(jpeg)) await new Promise((resolve) => ffmpeg.stdin.once('drain', resolve));
        drawn += 1;
        if (drawn % 900 === 0) process.stderr.write(`frame ${drawn}/${frames} after ${Math.round((Date.now() - started) / 1000)}s\n`);
      }
      ffmpeg.stdin.end();
      await done;
      return file;
    };
    let files;
    try {
      files = await Promise.all(pieces.map(renderPiece));
    } catch (error) {
      fail(`${error.message} while encoding ${out}.`);
    }
    const countFrames = (file) => Number.parseInt(run('ffprobe', [
      '-v', 'error', '-count_packets', '-select_streams', 'v:0', '-show_entries', 'stream=nb_read_packets', '-of', 'csv=p=0', file,
    ]).stdout, 10);
    const list = path.join(scratch, 'pieces.txt');
    writeFileSync(list, files.map((file) => `file '${file}'`).join('\n'));
    const joined = path.join(scratch, 'joined.mp4');
    const join = encode(['-f', 'concat', '-safe', '0', '-i', list, '-c', 'copy', joined]);
    const mux = () => encode([
      '-i', joined, '-ss', String(from), '-t', String(seconds), '-i', path.join(work, 'narration.wav'),
      '-map', '0:v', '-map', '1:a', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k', '-shortest', '-movflags', '+faststart', out,
    ]);
    try {
      await join.done;
      await mux().done;
    } catch (error) {
      fail(`${error.message} while joining ${out}.`);
    }
    const parity = frameParity(pieces, files.map(countFrames), countFrames(joined));
    rmSync(scratch, { recursive: true, force: true });
    if (pageErrors.length) fail(`Page errors while rendering: ${pageErrors.join(' | ')}.`);
    const durationSeconds = probeDuration(out);
    const durationMatches = durationSeconds !== null && Math.abs(durationSeconds - seconds) <= 0.25;
    exitCode = durationMatches && parity.ok ? 0 : 1;
    process.stdout.write(`${JSON.stringify({
      output: out,
      durationSeconds,
      expectedSeconds: Number(seconds.toFixed(3)),
      frames,
      workers: pieces.length,
      seconds: Math.round((Date.now() - started) / 1000),
      framesMatch: parity.ok,
      frameProblems: parity.problems,
      durationMatches,
      next: !parity.ok
        ? 'Frame counts differ from the plan. Rerun with --workers 1 and report the problems if it repeats.'
        : durationMatches
          ? 'Give the user the mp4 as a file:// link. Say the audio was not listen-checked.'
          : 'Duration differs from the timeline. Rerun narrate.mjs, then render again.',
    }, null, 2)}\n`);
  }
} finally {
  await browser.close();
}
process.exit(exitCode);
