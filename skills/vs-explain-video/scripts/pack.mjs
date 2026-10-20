#!/usr/bin/env node
// Builds the pack a fresh reviewer reads: what a viewer sees and hears, and
// nothing about how the video was made.
//
//   node pack.mjs <work-dir> <video.mp4>
//
// Writes <work-dir>/review/. There is one review per video: a second pack is
// refused. The folder appears only once the whole pack is written, so a failed
// pack can be rerun:
//   sheet-1fps-K.png  one frame per second of the whole video, 40 per sheet
//   beats-K.png       each beat once it is spoken, 9 per grid
//   strip-cut-<id>.png  12 frames in a row across each scene cut
//   phone-360.png     the beat frames at phone width (360 px)
//   WORDS.md          the question, the audience, every spoken line with its
//                     time, what is locked, and the sound measures
//   BRIEF.md          references/reviewer-brief.md filled in for this video
// Then give BRIEF.md to a new agent that has seen none of the work, and read
// its reply with verdict.mjs.
//
// Adapted from take-one's scripts/review-pack.sh (github.com/talsiach/take-one),
// Copyright (c) 2026 Tal Siach, MIT. See ../LICENSE.take-one and
// THIRD_PARTY_NOTICES.md. Modified by vs: beat grids and cut strips from the
// timeline, WORDS.md, and one review per video.
// Exit codes: 0 pack written; 1 the video already has a review; 2 blocked.
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { clock, packPlan, RULES } from './checks.mjs';
import { fail, probeDuration, which } from './media.mjs';

const [workArg, videoArg] = process.argv.slice(2).filter((arg) => !arg.startsWith('--'));
if (!workArg || !videoArg) fail('Usage: node pack.mjs <work-dir> <video.mp4>');
if (!which('ffmpeg') || !which('ffprobe')) fail('ffmpeg/ffprobe missing. Run: brew install ffmpeg. Then rerun pack.mjs.');
const work = path.resolve(workArg);
const video = path.resolve(videoArg);
if (!existsSync(video)) fail(`${video} is missing. Render it with render.mjs --out first.`);
const tlFile = path.join(work, 'timeline.js');
if (!existsSync(tlFile)) fail(`${tlFile} is missing. Run narrate.mjs first.`);
const TL = JSON.parse(readFileSync(tlFile, 'utf8').replace(/^window\.TL\s*=\s*/, '').replace(/;\s*$/, ''));
const script = existsSync(path.join(work, 'script.json')) ? JSON.parse(readFileSync(path.join(work, 'script.json'), 'utf8')) : {};

const dir = path.join(work, 'review');
if (existsSync(dir)) {
  process.stdout.write(`${JSON.stringify({
    error: `${dir} already has the review`,
    next: 'One review per video: it is never redone. Hand off with its scores (verdict.mjs) and the open problems. A fix made after it is not reviewed; say so.',
  }, null, 2)}\n`);
  process.exit(1);
}
// Build in a staging folder next to it; it becomes review/ only when every file is there.
const staging = mkdtempSync(path.join(work, '.review-'));
const scratch = mkdtempSync(path.join(tmpdir(), 'vs-pack-'));
process.on('exit', () => {
  rmSync(scratch, { recursive: true, force: true });
  rmSync(staging, { recursive: true, force: true });
});

const ff = (list) => {
  const out = spawnSync('ffmpeg', ['-y', '-v', 'error', ...list], { encoding: 'utf8' });
  if (out.status !== 0) fail(`ffmpeg failed: ${out.stderr.slice(-400)}. No review folder was written; fix that and rerun pack.mjs.`);
};
const plan = packPlan(TL);
const length = probeDuration(video) ?? TL.total;

// One frame a second, 8 x 5 per sheet.
ff(['-i', video, '-vf', 'fps=1,scale=320:-2,tile=8x5:padding=4:color=white', '-fps_mode', 'passthrough', path.join(staging, 'sheet-1fps-%d.png')]);
// Beat frames, then grids of 9 and the phone-width sheet.
plan.beats.forEach((beat, i) => {
  ff(['-ss', String(Math.min(beat.t, length - 0.05)), '-i', video, '-frames:v', '1', path.join(scratch, `b${String(i + 1).padStart(3, '0')}.png`)]);
});
ff(['-framerate', '1', '-i', path.join(scratch, 'b%03d.png'), '-vf', 'scale=640:-2,tile=3x3:padding=6:color=white', '-fps_mode', 'passthrough', path.join(staging, 'beats-%d.png')]);
const rows = Math.ceil(plan.beats.length / 3);
ff(['-framerate', '1', '-i', path.join(scratch, 'b%03d.png'), '-vf', `scale=360:-2,tile=3x${rows}:padding=6:color=white`, '-frames:v', '1', path.join(staging, 'phone-360.png')]);
// Twelve frames across every scene cut.
for (const cut of plan.cuts) {
  ff(['-ss', String(cut.from), '-i', video, '-vf', 'scale=240:-2,tile=12x1:padding=2:color=white', '-frames:v', '1', path.join(staging, `strip-${cut.label}.png`)]);
}

// The words, timed. The reviewer cannot hear, so it gets the words and the
// measures instead.
const checkFile = path.join(work, 'narration-check.json');
const sound = existsSync(checkFile) ? JSON.parse(readFileSync(checkFile, 'utf8')) : null;
const words = [
  `# Words and sound: ${TL.title || script.title || 'explain video'}`,
  '',
  `- Question the video answers: ${script.question ?? '(not given in script.json "question")'}`,
  `- Audience: ${script.audience ?? '(not given in script.json "audience")'}`,
  `- Length: ${clock(length)}, ${TL.scenes.length} scenes, ${plan.beats.length} spoken lines`,
  `- Locked (do not spend your three problems on these): ${script.locked ?? 'the stage look (dark stage, fixed colors, burned-in subtitles)'}`,
  '',
  '## Spoken lines, with the time each one starts',
  '',
  ...TL.scenes.flatMap((scene) => [
    `### ${clock(scene.start)} ${scene.title ?? scene.id}`,
    ...scene.beats.map((beat) => `- ${clock(scene.start + beat.t)} ${beat.text}`),
    '',
  ]),
  '## Sound',
  '',
  sound
    ? `\`\`\`json\n${JSON.stringify(sound, null, 2)}\n\`\`\``
    : 'Not measured. The narration is the only sound track; there is no music.',
  '',
];
writeFileSync(path.join(staging, 'WORDS.md'), words.join('\n'));

const template = readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'references', 'reviewer-brief.md'), 'utf8');
const brief = template.slice(template.indexOf('<!-- brief -->') + '<!-- brief -->'.length, template.indexOf('<!-- /brief -->'))
  .replaceAll('[pack folder]', dir)
  .replaceAll('[video]', video)
  .replaceAll('[bar]', String(RULES.bar))
  .trim();
writeFileSync(path.join(staging, 'BRIEF.md'), `${brief}\n`);
renameSync(staging, dir);

process.stdout.write(`${JSON.stringify({
  pack: dir,
  brief: path.join(dir, 'BRIEF.md'),
  beats: plan.beats.length,
  cuts: plan.cuts.length,
  bar: RULES.bar,
  next: `Give ${path.join(dir, 'BRIEF.md')} to a NEW agent that has seen none of this work, and nothing else. Save its reply as ${path.join(dir, 'REPLY.md')} and run verdict.mjs on it. The score goes in the handoff; there is no second round.`,
}, null, 2)}\n`);
