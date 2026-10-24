#!/usr/bin/env node
// Turns the explain-video render into the file a PR can carry:
//
//   node finish.mjs <work-dir> <rendered.mp4> --out <final.mp4> [--clips clips.json]
//
// 1. Splices each recording into its slot. The stage drew the slot (a card with
//    the clip's first and last frame, see clip() in motion.js) under the
//    narration and the Pill captions; ffmpeg plays the real recording on top of
//    it for the slot's time window. A clip shorter than its window plays slower
//    (never below half speed) and then holds its last frame; a longer one is
//    cut at the window end. Each clip's rate and cut are in the output.
// 2. Scales to 1280x720 and encodes H.264 + AAC, capped so the file stays under
//    10 MB (GitHub's video limit on Free plans). One more pass at a lower rate
//    when the first one is still too big.
//
// Clip slots come from --clips, else <work>/clips.json, else the page itself
// (window.VS.clips after boot, with absolute times from timeline.js). A render
// by fframes (the default renderer) already plays each clip in its slot and
// says so in <rendered>.fframes.json: then nothing is spliced, and the clip
// report (rates, holds, cuts) comes from that file.
// Each slot: { src, x, y, w, h, from, to } in stage pixels (1920x1080) and seconds.
//
// Exit codes: 0 done; 1 over 75 s, over 10 MB after the retry, or ffmpeg failed;
// 2 blocked (missing input, no ffmpeg, no Playwright when slots must be read).
import { existsSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

import { ensurePlaywright, fail, probeDuration, run, which } from '../../vs-explain-video/scripts/media.mjs';
import { AUDIO_KBPS, HEIGHT, MAX_BYTES, MAX_SECONDS, WIDTH, videoBitrate } from './pr-video.mjs';

const args = process.argv.slice(2);
const opt = (name) => (args.includes(name) ? args[args.indexOf(name) + 1] : null);
const positional = args.filter((arg, i) => !arg.startsWith('--') && !['--out', '--clips'].includes(args[i - 1]));
const [workArg, rawArg] = positional;
const outArg = opt('--out');
if (!workArg || !rawArg || !outArg) fail('Usage: node finish.mjs <work-dir> <rendered.mp4> --out <final.mp4> [--clips clips.json]');
if (!which('ffmpeg') || !which('ffprobe')) fail('ffmpeg/ffprobe missing. Run: brew install ffmpeg. Then rerun finish.mjs.');
const work = path.resolve(workArg);
const raw = path.resolve(rawArg);
const out = path.resolve(outArg);
if (!existsSync(raw)) fail(`${raw} is missing. Run ../vs-explain-video/scripts/render.mjs --out first.`);

const seconds = probeDuration(raw);
if (seconds === null) fail(`ffprobe cannot read ${raw}.`);
if (seconds > MAX_SECONDS + 0.5) {
  process.stdout.write(`${JSON.stringify({ output: null, seconds, next: `The video is ${seconds.toFixed(1)} s; the cap is ${MAX_SECONDS} s. Cut beats in script.json, narrate and render again.` }, null, 2)}\n`);
  process.exit(1);
}

const readSlotsFromPage = async () => {
  if (!existsSync(path.join(work, 'index.html'))) return [];
  const scenes = readFileSync(path.join(work, 'scenes.js'), 'utf8');
  if (!/\bclip\(/.test(scenes)) return [];
  const { entry, error } = ensurePlaywright([work]);
  if (!entry) fail(`Playwright is not available to read the clip slots: ${error}. Or pass --clips clips.json.`);
  const playwright = await import(pathToFileURL(entry).href);
  const chromium = playwright.chromium ?? playwright.default?.chromium;
  let browser;
  try { browser = await chromium.launch(); } catch { browser = await chromium.launch({ channel: 'chrome' }); }
  try {
    const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
    await page.goto(pathToFileURL(path.join(work, 'index.html')).href);
    await page.waitForFunction('window.READY === true', null, { timeout: 15000 });
    return await page.evaluate('VS.clipSlots()');
  } finally {
    await browser.close();
  }
};

const sidecarFile = `${raw.replace(/\.mp4$/i, '')}.fframes.json`;
const sidecar = !opt('--clips') && existsSync(sidecarFile) ? JSON.parse(readFileSync(sidecarFile, 'utf8')) : null;
const inFrame = sidecar?.engine === 'fframes';
const clipsFile = opt('--clips') ?? (existsSync(path.join(work, 'clips.json')) ? path.join(work, 'clips.json') : null);
const slots = inFrame ? [] : clipsFile ? JSON.parse(readFileSync(clipsFile, 'utf8')) : await readSlotsFromPage();

const inputs = ['-i', raw];
const filters = [];
const report = inFrame ? (sidecar.clipsInFrame ?? []).map(({ scene, ...clip }) => ({ ...clip, scene, inFrame: true })) : [];
let last = '0:v';
slots.forEach((slot, i) => {
  const src = path.resolve(work, slot.src);
  if (!existsSync(src)) fail(`clip ${src} is missing. Run prep.mjs again.`);
  const clipSeconds = probeDuration(src);
  if (clipSeconds === null) fail(`ffprobe cannot read ${src}. Transcode it with prep.mjs.`);
  const window = slot.to - slot.from;
  if (!(window > 0)) fail(`clip slot ${i} has no time window (from ${slot.from}, to ${slot.to}).`);
  const rate = Math.min(1, Math.max(0.5, clipSeconds / window));
  const played = clipSeconds / rate;
  report.push({ src: slot.src, window: Number(window.toFixed(2)), clipSeconds, rate: Number(rate.toFixed(3)), heldSeconds: Number(Math.max(0, window - played).toFixed(2)), trimmed: played > window + 0.05 });
  const [x, y, w, h] = [slot.x, slot.y, slot.w, slot.h].map((v) => Math.round(v));
  const [cw, ch] = run('ffprobe', ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width,height', '-of', 'csv=p=0', src]).stdout.trim().split(',').map(Number);
  // Fit inside the slot without cropping (object-fit: contain, as the stage draws the frames).
  const even = (v) => Math.max(2, Math.floor(v / 2) * 2);
  const fit = cw / ch > w / h ? [even(w), even((w * ch) / cw)] : [even((h * cw) / ch), even(h)];
  inputs.push('-i', src);
  filters.push(`[${i + 1}:v]setpts=(PTS-STARTPTS)/${rate.toFixed(4)},scale=${fit[0]}:${fit[1]},pad=${w}:${h}:(ow-iw)/2:(oh-ih)/2:color=0x0f1011,fps=30,tpad=stop_mode=clone:stop_duration=${window.toFixed(3)},trim=duration=${window.toFixed(3)},setpts=PTS-STARTPTS+${slot.from.toFixed(3)}/TB[c${i}]`);
  filters.push(`[${last}][c${i}]overlay=${x}:${y}:enable='between(t,${slot.from.toFixed(3)},${slot.to.toFixed(3)})':eof_action=pass[v${i}]`);
  last = `v${i}`;
});
filters.push(`[${last}]scale=${WIDTH}:${HEIGHT}:flags=lanczos,format=yuv420p[out]`);

const encode = (kbps, cap) => run('ffmpeg', [
  '-y', '-v', 'error', ...inputs, '-filter_complex', filters.join(';'), '-map', '[out]', '-map', '0:a?',
  '-c:v', 'libx264', '-preset', 'medium', ...(cap ? ['-crf', '23', '-maxrate', `${kbps}k`, '-bufsize', `${kbps * 2}k`] : ['-b:v', `${kbps}k`, '-maxrate', `${kbps}k`, '-bufsize', `${kbps}k`]),
  '-r', '30', '-c:a', 'aac', '-b:a', `${AUDIO_KBPS}k`, '-movflags', '+faststart', out,
]);

const started = Date.now();
const budget = videoBitrate(seconds);
let result = encode(budget, true);
if (result.status !== 0) fail(`ffmpeg failed: ${String(result.stderr).slice(0, 1200)}`);
let bytes = statSync(out).size;
let passes = 1;
if (bytes > MAX_BYTES) {
  result = encode(Math.floor(budget * 0.75), false);
  if (result.status !== 0) fail(`ffmpeg failed: ${String(result.stderr).slice(0, 1200)}`);
  bytes = statSync(out).size;
  passes = 2;
}
const probe = run('ffprobe', ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width,height', '-of', 'csv=p=0', out]).stdout.trim().split(',').map(Number);
const ok = bytes <= MAX_BYTES;
writeFileSync(path.join(work, 'finish.json'), JSON.stringify({ output: out, bytes, clips: report }, null, 2));
process.stdout.write(`${JSON.stringify({
  output: out,
  seconds: probeDuration(out),
  bytes,
  megabytes: Number((bytes / 1024 / 1024).toFixed(2)),
  width: probe[0],
  height: probe[1],
  passes,
  encodeSeconds: Math.round((Date.now() - started) / 1000),
  clips: report,
  next: ok
    ? 'Attach it with attach.mjs. Say in the handoff which clips play slower than real time.'
    : `Still ${(bytes / 1024 / 1024).toFixed(1)} MB after two passes; the cap is 10 MB. Cut beats to shorten the video.`,
}, null, 2)}\n`);
process.exit(ok ? 0 : 1);
