#!/usr/bin/env node
// Joins scenes into one mp4: each scene's picture is held or trimmed to its
// narration length plus the manifest pause, audio is padded with silence to
// match, then all scenes are concatenated. Verifies the result with ffprobe and
// extracts verification stills.
//
//   node mux.mjs <scenes.json> --out <video.mp4>
//
// scenes.json (paths relative to the file):
//   {
//     "fps": 30, "width": 1280, "height": 720, "pause": 0.4,
//     "scenes": [
//       { "id": "01-question", "narration": "...", "audio": "audio/01-question.aiff",
//         "video": "render/01-question.mp4" },
//       { "id": "02-idea", "narration": "...", "audio": "audio/02-idea.wav",
//         "image": "stills/show-me.png" }
//     ]
//   }
// Each scene needs `audio` and one picture: `video` (any length; the last frame
// holds) or `image` (held for the whole scene).
//
// Prints { output, durationSeconds, expectedSeconds, narrationSeconds, stills }.
// Exit codes: 0 muxed and duration matches; 1 muxed but duration is off by more
// than 0.25 s; 2 blocked (bad manifest, missing input, ffmpeg error).
import { mkdirSync } from 'node:fs';
import path from 'node:path';

import { fail, probeDuration, readManifest, resolveIn, run, sceneDuration, which } from './media.mjs';

const args = process.argv.slice(2);
const manifestPath = args.find((arg) => !arg.startsWith('--'));
const outArg = args.includes('--out') ? args[args.indexOf('--out') + 1] : null;
if (!manifestPath || !outArg) fail('Usage: node mux.mjs <scenes.json> --out <video.mp4>');
if (!which('ffmpeg') || !which('ffprobe')) fail('ffmpeg/ffprobe missing. Run: brew install ffmpeg. Then rerun mux.mjs.');

let manifest;
try {
  manifest = readManifest(manifestPath);
} catch (error) {
  fail(error.message);
}
const fps = manifest.fps ?? 30;
const width = manifest.width ?? 1280;
const height = manifest.height ?? 720;
const out = path.resolve(outArg);
mkdirSync(path.dirname(out), { recursive: true });

const inputs = [];
const filters = [];
const timeline = [];
let start = 0;
let narrationSeconds = 0;

for (const [index, scene] of manifest.scenes.entries()) {
  const id = scene.id ?? String(index + 1).padStart(2, '0');
  const audio = resolveIn(manifest, scene.audio);
  const audioSeconds = audio ? probeDuration(audio) : null;
  if (audioSeconds === null) fail(`scene ${id}: "audio" is missing or unreadable. Run narrate.mjs first.`);
  const seconds = sceneDuration(manifest, audioSeconds);
  narrationSeconds += audioSeconds;

  const picture = resolveIn(manifest, scene.video ?? scene.image);
  if (!picture) fail(`scene ${id}: needs "video" or "image". Run render-scenes.mjs for html scenes.`);
  if (scene.image && !scene.video) inputs.push('-loop', '1', '-framerate', String(fps), '-t', String(seconds), '-i', picture);
  else inputs.push('-i', picture);
  inputs.push('-i', audio);

  const v = index * 2;
  const a = v + 1;
  filters.push(
    `[${v}:v]fps=${fps},scale=${width}:${height}:force_original_aspect_ratio=decrease,` +
      `pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2,setsar=1,format=yuv420p,` +
      `tpad=stop_mode=clone:stop_duration=${seconds},trim=duration=${seconds},setpts=PTS-STARTPTS[v${index}]`,
    `[${a}:a]aresample=48000,aformat=sample_fmts=fltp:channel_layouts=stereo,` +
      `apad=whole_dur=${seconds},atrim=duration=${seconds},asetpts=PTS-STARTPTS[a${index}]`,
  );
  timeline.push({ id, start, seconds });
  start += seconds;
}

const n = manifest.scenes.length;
const pairs = manifest.scenes.map((_, index) => `[v${index}][a${index}]`).join('');
filters.push(`${pairs}concat=n=${n}:v=1:a=1[v][a]`);

const muxed = run('ffmpeg', [
  '-y', '-loglevel', 'error', ...inputs,
  '-filter_complex', filters.join(';'), '-map', '[v]', '-map', '[a]',
  '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '20', '-r', String(fps),
  '-c:a', 'aac', '-b:a', '160k', '-movflags', '+faststart', out,
]);
if (muxed.status !== 0) fail(`ffmpeg failed: ${muxed.stderr.slice(-800)}`);

const durationSeconds = probeDuration(out);
const expectedSeconds = start;

// Stills from the middle of the first, middle, and last scene: the frames a
// reviewer must look at before the video is called done.
const stillsDir = path.join(path.dirname(out), 'stills');
mkdirSync(stillsDir, { recursive: true });
const picks = [...new Set([0, Math.floor((n - 1) / 2), n - 1])];
const stills = [];
for (const index of picks) {
  const { id, start: sceneStart, seconds } = timeline[index];
  const at = sceneStart + seconds / 2;
  const file = path.join(stillsDir, `${id}.png`);
  const grab = run('ffmpeg', ['-y', '-loglevel', 'error', '-ss', at.toFixed(3), '-i', out, '-frames:v', '1', file]);
  if (grab.status === 0) stills.push({ scene: id, atSeconds: Number(at.toFixed(2)), file });
}

const drift = durationSeconds === null ? Infinity : Math.abs(durationSeconds - expectedSeconds);
const report = {
  output: out,
  durationSeconds,
  expectedSeconds: Number(expectedSeconds.toFixed(3)),
  narrationSeconds: Number(narrationSeconds.toFixed(3)),
  pauseSeconds: manifest.pause ?? 0.4,
  stills,
  durationMatches: drift <= 0.25,
  next: 'Open every still and check it shows the intended scene before you call the video done.',
};
process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
if (!report.durationMatches) {
  process.stderr.write(`Duration ${durationSeconds}s differs from expected ${expectedSeconds.toFixed(3)}s. Check each scene's audio and picture inputs.\n`);
  process.exit(1);
}
