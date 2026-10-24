import * as fs from 'node:fs';
import * as path from 'node:path';
import { check, evaluate } from '@wix/pathgrade';
import { describe, expect, it } from 'vitest';
import { createAgent } from '../../vs-internal-shared/test/pathgrade-agent';
import { promptOnce } from '../../vs-internal-shared/test/pathgrade-v1';
import { buildRepo } from './diff-repo';

// Diff first, live, for a branch topic: the user names one change (coupons work
// on their last day); the branch also adds a login lockout the user never
// mentions. The skill must run diff.mjs (diff.json lists src/login.js), cover
// the lockout in the beats, and pass the quiz.mjs gate, which now refuses a
// missing diff.json. Opt-in (each run is a full agent session):
//   EXPLAIN_VIDEO_DIFF_LIVE=1 [EXPLAIN_VIDEO_DIFF_RUNS=3] [EXPLAIN_VIDEO_SKILLS_ROOT=<master checkout>/skills]
//   npx vitest run skills/vs-explain-video/test/diff-first.eval.ts

const EVAL_AGENT = (process.env.PATHGRADE_AGENT ?? 'codex') as 'claude' | 'codex';
const ROOT = path.resolve(process.env.EXPLAIN_VIDEO_SKILLS_ROOT ?? path.resolve(__dirname, '..', '..'));
const RUNS = Number(process.env.EXPLAIN_VIDEO_DIFF_RUNS ?? 3);

function stageSiblings(ws: string) {
  for (const dir of ['.agents/skills', '.claude/skills']) {
    if (!fs.existsSync(path.join(ws, dir, 'vs-explain-video'))) continue;
    for (const sib of ['vs-internal-shared', 'vs-write']) {
      fs.cpSync(path.join(ROOT, sib), path.join(ws, dir, sib), { recursive: true, filter: (src) => !/\/(test|node_modules)(\/|$)/.test(src) });
    }
  }
}

const readJson = (file: string) => {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return null;
  }
};

describe.skipIf(!process.env.EXPLAIN_VIDEO_DIFF_LIVE)(`vs-explain-video starts a branch topic from the diff (${EVAL_AGENT}, ${ROOT})`, () => {
  for (let run = 1; run <= RUNS; run += 1) {
    it(`reads the diff and covers a change the chat never named #${run}`, async () => {
      const agent = await createAgent({ agent: EVAL_AGENT, timeout: 900, skillDir: path.join(ROOT, 'vs-explain-video') });
      try {
        const ws = agent.workspace;
        buildRepo(ws);
        stageSiblings(ws);
        fs.mkdirSync(path.join(ws, 'video-work'), { recursive: true });
        await promptOnce(agent, 'Use $vs-explain-video to explain my branch fix/coupon-last-day (this repo, base main) to the support team. I fixed coupons so they work on their last day. Use ./video-work as the work dir. This machine has no voice, ffmpeg, or browser, so make only the story: write video-work/script.json, run the skill\'s quiz.mjs until it writes the brief, then stop and list the scenes. Do not scaffold, narrate, or render.');
        const work = path.join(ws, 'video-work');
        const beats = () => {
          const script = readJson(path.join(work, 'script.json'));
          return (script?.scenes ?? []).flatMap((s: { beats?: string[]; title?: string }) => [s.title ?? '', ...(s.beats ?? [])]).join('\n');
        };
        const result = await evaluate(agent, [
          check('diff-json-lists-the-lockout', () => (readJson(path.join(work, 'diff.json'))?.files ?? []).some((f: { path: string }) => f.path === 'src/login.js')),
          check('quiz-gate-passed', () => fs.existsSync(path.join(work, 'quiz', 'BRIEF.md'))),
          check('keeps-the-named-change', () => /coupon/i.test(beats())),
          check('covers-the-diff-only-change', () => /\block(?:s|ed|out|ing)?\b|log-?in attempts?|failed (?:log-?in|sign.?in|attempts?)|\b5 (?:failed |wrong |bad )?(?:attempts|tries)/i.test(beats())),
        ], { failFast: false, onScorerError: 'zero' });
        fs.appendFileSync('/tmp/explain-video-diff-first.jsonl', `${JSON.stringify({ root: ROOT, run, score: result.score, workspace: ws, script: readJson(path.join(work, 'script.json')) })}\n`);
        expect(result.score).toBe(1);
      } finally {
        await agent.dispose();
      }
    }, 1_000_000);
  }
});
