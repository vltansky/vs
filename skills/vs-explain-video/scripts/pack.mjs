#!/usr/bin/env node
// Builds the pack a fresh reviewer reads: what a viewer sees and hears, and
// nothing about how the video was made.
//
//   node pack.mjs <work-dir> <video.mp4> [--round N]
//
// Writes <work-dir>/review/round-N/ (N defaults to the next free round, at
// most 3):
//   sheet-1fps-K.png  one frame per second of the whole video, 40 per sheet
//   beats-K.png       each beat once it is spoken, 9 per grid
//   strip-cut-<id>.png  12 frames in a row across each scene cut
//   phone-360.png     the beat frames at phone width (360 px)
//   WORDS.md          the question, the audience, every spoken line with its
//                     time, what is locked, and the sound measures
//   BRIEF.md          references/reviewer-brief.md filled in for this round
// Then give BRIEF.md to a new agent that has seen none of the work.
//
// Idea from take-one's review-pack.sh (github.com/talsiach/take-one, MIT);
// this code is our own.
// Exit codes: 0 pack written; 1 round 3 is used up; 2 blocked.
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { clock, packPlan } from './checks.mjs';
import { fail, probeDuration, which } from './media.mjs';

export const MAX_ROUNDS = 3;
const args = process.argv.slice(2);
const positional = args.filter((arg, i) => !arg.startsWith('--') && args[i - 1] !== '--round');
const [workArg, videoArg] = positional;
if (!workArg || !videoArg) fail('Usage: node pack.mjs <work-dir> <video.mp4> [--round N]');
if (!which('ffmpeg') || !which('ffprobe')) fail('ffmpeg/ffprobe missing. Run: brew install ffmpeg. Then rerun pack.mjs.');
const work = path.resolve(workArg);
const video = path.resolve(videoArg);
if (!existsSync(video)) fail(`${video} is missing. Render it with render.mjs --out first.`);
const tlFile = path.join(work, 'timeline.js');
if (!existsSync(tlFile)) fail(`${tlFile} is missing. Run narrate.mjs first.`);
const TL = JSON.parse(readFileSync(tlFile, 'utf8').replace(/^window\.TL\s*=\s*/, '').replace(/;\s*$/, ''));
const script = existsSync(path.join(work, 'script.json')) ? JSON.parse(readFileSync(path.join(work, 'script.json'), 'utf8')) : {};

const reviewDir = path.join(work, 'review');
const roundArg = args.includes('--round') ? Number(args[args.indexOf('--round') + 1]) : null;
let round = roundArg ?? 1;
while (roundArg === null && existsSync(path.join(reviewDir, `round-${round}`))) round += 1;
if (round > MAX_ROUNDS) {
  process.stdout.write(`${JSON.stringify({
    round,
    next: `Three review rounds are used up. Stop. Deliver the video with the last score and its open problems, and say it did not pass. Never report a pass that did not happen.`,
  }, null, 2)}\n`);
  process.exit(1);
}
const dir = path.join(reviewDir, `round-${round}`);
mkdirSync(dir, { recursive: true });

const ff = (list) => {
  const out = spawnSync('ffmpeg', ['-y', '-v', 'error', ...list], { encoding: 'utf8' });
  if (out.status !== 0) fail(`ffmpeg failed: ${out.stderr.slice(-400)}`);
};
const plan = packPlan(TL);
const length = probeDuration(video) ?? TL.total;

// One frame a second, 8 x 5 per sheet.
ff(['-i', video, '-vf', 'fps=1,scale=320:-2,tile=8x5:padding=4:color=white', '-fps_mode', 'passthrough', path.join(dir, 'sheet-1fps-%d.png')]);
// Beat frames, then grids of 9 and the phone-width sheet.
const scratch = mkdtempSync(path.join(tmpdir(), 'vs-pack-'));
plan.beats.forEach((beat, i) => {
  ff(['-ss', String(Math.min(beat.t, length - 0.05)), '-i', video, '-frames:v', '1', path.join(scratch, `b${String(i + 1).padStart(3, '0')}.png`)]);
});
ff(['-framerate', '1', '-i', path.join(scratch, 'b%03d.png'), '-vf', 'scale=640:-2,tile=3x3:padding=6:color=white', '-fps_mode', 'passthrough', path.join(dir, 'beats-%d.png')]);
const rows = Math.ceil(plan.beats.length / 3);
ff(['-framerate', '1', '-i', path.join(scratch, 'b%03d.png'), '-vf', `scale=360:-2,tile=3x${rows}:padding=6:color=white`, '-frames:v', '1', path.join(dir, 'phone-360.png')]);
// Twelve frames across every scene cut.
for (const cut of plan.cuts) {
  ff(['-ss', String(cut.from), '-i', video, '-vf', 'scale=240:-2,tile=12x1:padding=2:color=white', '-frames:v', '1', path.join(dir, `strip-${cut.label}.png`)]);
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
writeFileSync(path.join(dir, 'WORDS.md'), words.join('\n'));

const template = readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'references', 'reviewer-brief.md'), 'utf8');
const brief = template.slice(template.indexOf('<!-- brief -->') + '<!-- brief -->'.length, template.indexOf('<!-- /brief -->'))
  .replaceAll('[pack folder]', dir)
  .replaceAll('[video]', video)
  .replaceAll('[round]', `${round} of ${MAX_ROUNDS}`)
  .trim();
writeFileSync(path.join(dir, 'BRIEF.md'), `${brief}\n`);

process.stdout.write(`${JSON.stringify({
  round,
  pack: dir,
  brief: path.join(dir, 'BRIEF.md'),
  beats: plan.beats.length,
  cuts: plan.cuts.length,
  next: `Give ${path.join(dir, 'BRIEF.md')} to a NEW agent that has seen none of this work, and nothing else. PASS needs 8 or more on every axis.`,
}, null, 2)}\n`);
