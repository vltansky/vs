#!/usr/bin/env node
// Copies the PR's real screenshots and recordings into the work directory,
// ready for still() and clip() scenes:
//
//   node prep.mjs <work-dir> [--manifest <label>=<record-flow manifest.json>]...
//                            [--still <name>=<file>[#caption]]... [--clip <name>=<file>[#caption]]...
//
// A record-flow manifest adds its stills as <label>-<n>.png and its video as
// the clip <label>. Stills are scaled to at most 1920 px wide (PNG). Clips are
// transcoded to H.264 mp4 (webm seeks badly), and each gets <name>.first.png
// and <name>.last.png, the frames the stage shows around the clip window.
// Writes media.json: [{ name, kind, file, caption, seconds?, width, height }].
// It reads no pixels into the model; open at most one still per scene.
//
// Exit codes: 0 done; 2 blocked (missing file, no ffmpeg, a file ffmpeg cannot read).
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

import { fail, probeDuration, run, which } from '../../vs-explain-video/scripts/media.mjs';

const args = process.argv.slice(2);
const work = args[0] && !args[0].startsWith('--') ? path.resolve(args[0]) : null;
if (!work) fail('Usage: node prep.mjs <work-dir> [--manifest label=manifest.json] [--still name=file#caption] [--clip name=file#caption]');
if (!which('ffmpeg') || !which('ffprobe')) fail('ffmpeg/ffprobe missing. Run: brew install ffmpeg. Then rerun prep.mjs.');
const mediaDir = path.join(work, 'media');
mkdirSync(mediaDir, { recursive: true });

const pairs = (flag) => args.flatMap((arg, i) => (args[i - 1] === flag ? [arg] : []));
const split = (spec, flag) => {
  const eq = spec.indexOf('=');
  if (eq < 1) fail(`${flag} takes name=file, got "${spec}".`);
  const [file, ...caption] = spec.slice(eq + 1).split('#');
  return { name: spec.slice(0, eq).replace(/[^a-z0-9-]+/gi, '-').toLowerCase(), file: path.resolve(file), caption: caption.join('#') };
};

const items = [];
for (const spec of pairs('--manifest')) {
  const { name, file } = split(spec, '--manifest');
  if (!existsSync(file)) fail(`manifest ${file} is missing.`);
  const manifest = JSON.parse(readFileSync(file, 'utf8'));
  const base = path.dirname(file);
  (manifest.stills ?? []).forEach((still, i) => items.push({ kind: 'still', name: `${name}-${i + 1}`, file: path.resolve(base, still.path), caption: still.caption ?? '' }));
  if (manifest.video?.path) items.push({ kind: 'clip', name, file: path.resolve(base, manifest.video.path), caption: manifest.steps?.map((s) => s.caption).filter(Boolean).join(' → ') ?? '' });
}
for (const spec of pairs('--still')) items.push({ kind: 'still', ...split(spec, '--still') });
for (const spec of pairs('--clip')) items.push({ kind: 'clip', ...split(spec, '--clip') });
if (!items.length) fail('Nothing to prepare. Pass --manifest, --still, or --clip. A PR without media gets a motion-only video.');

const size = (file) => {
  const out = run('ffprobe', ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width,height', '-of', 'csv=p=0', file]).stdout.trim();
  const [width, height] = out.split(',').map(Number);
  return { width, height };
};
const ffmpeg = (list, what) => {
  const result = run('ffmpeg', ['-y', '-v', 'error', ...list]);
  if (result.status !== 0) fail(`ffmpeg could not ${what}: ${String(result.stderr).slice(-300)}`);
};

const media = [];
for (const item of items) {
  if (!existsSync(item.file)) fail(`${item.file} is missing.`);
  if (item.kind === 'still') {
    const out = path.join(mediaDir, `${item.name}.png`);
    ffmpeg(['-i', item.file, '-vf', "scale='min(1920,iw)':-2", '-frames:v', '1', out], `read the still ${item.file}`);
    media.push({ name: item.name, kind: 'still', file: `media/${item.name}.png`, caption: item.caption, ...size(out) });
  } else {
    const out = path.join(mediaDir, `${item.name}.mp4`);
    ffmpeg(['-i', item.file, '-an', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-vf', 'scale=trunc(iw/2)*2:trunc(ih/2)*2', '-movflags', '+faststart', out], `transcode ${item.file}`);
    const seconds = probeDuration(out);
    ffmpeg(['-i', out, '-frames:v', '1', path.join(mediaDir, `${item.name}.first.png`)], 'take the first frame');
    ffmpeg(['-sseof', '-0.3', '-i', out, '-update', '1', '-frames:v', '1', path.join(mediaDir, `${item.name}.last.png`)], 'take the last frame');
    media.push({ name: item.name, kind: 'clip', file: `media/${item.name}.mp4`, caption: item.caption, seconds, ...size(out) });
  }
}
writeFileSync(path.join(work, 'media.json'), `${JSON.stringify(media, null, 2)}\n`);
process.stdout.write(`${JSON.stringify({
  media,
  next: 'Write script.json with "role" on each scene and "still"/"clip" on the before and after scenes, then run lint.mjs.',
}, null, 2)}\n`);
