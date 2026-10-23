// Pure helpers for the PR video explainer: caps, the scene contract, the marked
// body block, and the size budget. The block parsing itself is shared with
// pr-media-gate and ship-it (vs-internal-shared/scripts/video-block.mjs).

export const MAX_SECONDS = 75;
export const MAX_BYTES = 10 * 1024 * 1024;
export const WIDTH = 1280;
export const HEIGHT = 720;
export const AUDIO_KBPS = 128;
export const ROLES = ['problem', 'before', 'change', 'after', 'risk'];
import { VIDEO_END, VIDEO_START } from '../../vs-internal-shared/scripts/video-block.mjs';
import { coverageIssues } from '../../vs-explain-video/scripts/diff.mjs';

export { VIDEO_END, VIDEO_START, findVideoBlocks, keepVideoBlock, upsertVideoBlock } from '../../vs-internal-shared/scripts/video-block.mjs';
// Spoken rate of the shared narrator at speed 1.0, in words a second (150 a minute).
const WORDS_PER_SECOND = 2.5;
// Each beat also holds a short pause, and each scene a handoff.
const BEAT_PAUSE = 0.35;
const SCENE_PAD = 0.6;

const wordCount = (text) => String(text).split(/\s+/).filter(Boolean).length;

export function estimateSeconds(script) {
  const speed = Number(script.speed) > 0 ? Number(script.speed) : 1;
  let seconds = 0;
  for (const scene of script.scenes ?? []) {
    for (const beat of scene.beats ?? []) seconds += wordCount(beat) / (WORDS_PER_SECOND * speed) + BEAT_PAUSE;
    seconds += SCENE_PAD;
  }
  return Number(seconds.toFixed(1));
}

// Every problem in script.json that breaks the PR video contract. media is the
// list of files prep.mjs copied in; when it is not empty, the before or after
// scene must show one of them. diff is diff.json (diff.mjs): every changed file
// that is not minor must be covered or skipped; requireDiff fails without it.
export function lintScript(script, { media = [], diff, requireDiff = false } = {}) {
  const problems = [];
  const scenes = script.scenes ?? [];
  const roles = scenes.map((scene) => scene.role ?? '(none)');
  if (roles.join(',') !== ROLES.join(',')) {
    problems.push(`scene order is ${roles.join(' → ')}; it must be ${ROLES.join(' → ')} (one scene each, "role" on every scene).`);
  }
  const problem = scenes.find((scene) => scene.role === 'problem');
  if (problem && !(problem.beats?.length >= 1 && problem.beats.length <= 2)) {
    problems.push(`problem has ${problem.beats?.length ?? 0} beats; state it in 1-2 beats, then let the example carry it.`);
  }
  for (const scene of scenes) {
    if (!scene.beats?.length) problems.push(`scene "${scene.id}" has no beats.`);
    for (const [i, beat] of (scene.beats ?? []).entries()) {
      if (wordCount(beat) > 24) problems.push(`scene "${scene.id}" beat ${i} has ${wordCount(beat)} words; keep a beat at 24 words or fewer.`);
    }
  }
  const seconds = estimateSeconds(script);
  if (seconds > MAX_SECONDS) problems.push(`estimated length is ${seconds} s; the cap is ${MAX_SECONDS} s. Cut beats.`);
  if (media.length) {
    const shown = scenes.filter((scene) => ['before', 'after'].includes(scene.role)).flatMap((scene) => [scene.still, scene.clip].filter(Boolean));
    if (!shown.length) problems.push('the PR has screenshots or recordings, but no before/after scene shows that media: set "still" or "clip" on those scenes.');
    for (const file of shown) if (!media.includes(file)) problems.push(`"${file}" is not in media.json; run prep.mjs with it.`);
  }
  if (diff) problems.push(...coverageIssues(script, diff));
  else if (requireDiff) problems.push('diff.json is missing: run ../vs-explain-video/scripts/diff.mjs <work-dir> --base origin/<base> --head <sha> first, and write the beats from the diff.');
  return { seconds, problems };
}

// Video kbit/s that keeps `seconds` of video plus AAC audio under 95% of MAX_BYTES.
export function videoBitrate(seconds, maxBytes = MAX_BYTES) {
  const budgetBits = maxBytes * 0.95 * 8;
  const audioBits = AUDIO_KBPS * 1000 * seconds;
  return Math.floor((budgetBits - audioBits) / seconds / 1000);
}

const fmtSeconds = (s) => `${Math.round(s)} s`;

export function videoBlock({ url, sha, seconds, reviewed = false, wordsChecked = true }) {
  const notes = [`made for \`${String(sha).slice(0, 7)}\``];
  notes.push(reviewed ? 'reviewed by fresh eyes' : 'not reviewed by fresh eyes');
  if (!wordsChecked) notes.push('words not checked (no whisper)');
  return [
    VIDEO_START,
    '<details>',
    `<summary>Video explainer (${fmtSeconds(seconds)})</summary>`,
    '',
    `Narrated walkthrough of this PR: problem, example, change, risk. ${notes.join('; ')}. The proof is in Change and proof above.`,
    '',
    url,
    '',
    '</details>',
    VIDEO_END,
  ].join('\n');
}

