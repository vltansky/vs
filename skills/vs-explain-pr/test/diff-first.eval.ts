import * as fs from 'node:fs';
import * as path from 'node:path';
import { check, evaluate } from '@wix/pathgrade';
import { describe, expect, it } from 'vitest';
import { createAgent } from '../../vs-internal-shared/test/pathgrade-agent';
import { promptOnce } from '../../vs-internal-shared/test/pathgrade-v1';
import { buildRepo } from '../../vs-explain-video/test/diff-repo';

// Diff first, live: the PR body names one change (coupons work on their last
// day) and leaves out a second one the diff shows (login locks after 5 failed
// attempts). The old skill wrote the beats from the body only, so the lockout
// never reached the video. The skill must start from base...head and cover it.
// Opt-in (each run is a full agent session):
//   EXPLAIN_PR_DIFF_LIVE=1 [EXPLAIN_PR_DIFF_RUNS=3] [EXPLAIN_PR_SKILLS_ROOT=<master checkout>/skills]
//   npx vitest run skills/vs-explain-pr/test/diff-first.eval.ts

const EVAL_AGENT = (process.env.PATHGRADE_AGENT ?? 'codex') as 'claude' | 'codex';
const ROOT = path.resolve(process.env.EXPLAIN_PR_SKILLS_ROOT ?? path.resolve(__dirname, '..', '..'));
const RUNS = Number(process.env.EXPLAIN_PR_DIFF_RUNS ?? 3);

const BODY = `Coupons now work on their last day.

## What problem

A shopper opens checkout on the day their coupon expires, after the exact
expiry time, and the coupon is rejected. Support gets about 40 tickets a week.

## What was done

- \`isValid\` compares against the end of the expiry day, not the exact time.

## Change and proof

**Before:** \`isValid({ active: true, expiresAt: <today 09:00> }, <today 15:00>)\` → \`false\`
**After:** the same call → \`true\`

## Review map

- Risk: low. Review focus: \`src/coupon.js\` time-zone handling.
- Still unverified: shoppers in other time zones.
`;

// The skill calls its siblings' scripts (../vs-explain-video, ../vs-internal-shared).
function stageSiblings(ws: string) {
  for (const dir of ['.agents/skills', '.claude/skills']) {
    if (!fs.existsSync(path.join(ws, dir, 'vs-explain-pr'))) continue;
    for (const sib of ['vs-explain-video', 'vs-internal-shared', 'vs-write']) {
      fs.cpSync(path.join(ROOT, sib), path.join(ws, dir, sib), { recursive: true, filter: (src) => !/\/(test|node_modules)(\/|$)/.test(src) });
    }
  }
}

const beatsText = (ws: string) => {
  try {
    const script = JSON.parse(fs.readFileSync(path.join(ws, 'video-work', 'script.json'), 'utf8'));
    return (script.scenes ?? []).flatMap((s: { beats?: string[]; title?: string }) => [s.title ?? '', ...(s.beats ?? [])]).join('\n');
  } catch {
    return '';
  }
};

describe.skipIf(!process.env.EXPLAIN_PR_DIFF_LIVE)(`vs-explain-pr starts from the diff (${EVAL_AGENT}, ${ROOT})`, () => {
  for (let run = 1; run <= RUNS; run += 1) {
    it(`covers a change the PR body leaves out #${run}`, async () => {
      const agent = await createAgent({ agent: EVAL_AGENT, timeout: 900, skillDir: path.join(ROOT, 'vs-explain-pr') });
      try {
        const ws = agent.workspace;
        const sha = buildRepo(ws, ['video-work/', 'pr-body.md']);
        stageSiblings(ws);
        fs.writeFileSync(path.join(ws, 'pr-body.md'), BODY);
        fs.mkdirSync(path.join(ws, 'video-work'), { recursive: true });
        await promptOnce(agent, `Use $vs-explain-pr for PR #42 in acme/shop (this repo, branch fix/coupon-last-day). Head SHA: ${sha}. Base ref: main. The final PR body is pr-body.md. The PR has no screenshots or recordings. Use ./video-work as the work dir. This machine has no voice, ffmpeg, or browser, and gh is offline, so make only the story: write video-work/script.json, run the skill's lint with --no-page until it passes, then stop and list the scenes. Do not narrate, render, or attach.`);
        const result = await evaluate(agent, [
          check('script-written', () => {
            try {
              return JSON.parse(fs.readFileSync(path.join(ws, 'video-work', 'script.json'), 'utf8')).scenes.length === 5;
            } catch {
              return false;
            }
          }),
          check('keeps-the-body-change', () => /coupon/i.test(beatsText(ws))),
          check('covers-the-diff-only-change', () => /\block(?:s|ed|out|ing)?\b|log-?in attempts?|failed (?:log-?in|sign.?in|attempts?)|\b5 (?:failed |wrong |bad )?(?:attempts|tries)/i.test(beatsText(ws))),
        ], { failFast: false, onScorerError: 'zero' });
        fs.appendFileSync('/tmp/explain-pr-diff-first.jsonl', `${JSON.stringify({ root: ROOT, run, score: result.score, workspace: ws })}\n`);
        expect(result.score).toBe(1);
      } finally {
        await agent.dispose();
      }
    }, 1_000_000);
  }
});
