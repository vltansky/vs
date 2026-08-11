import * as path from 'path';
import { check, createAgent, evaluate } from '@wix/pathgrade';
import { describe, expect, it } from 'vitest';
import { promptOnce } from './pathgrade-v1';

const SKILLS_DIR = path.resolve(__dirname, '..', '..');
const EVAL_AGENT = (process.env.PATHGRADE_AGENT ?? 'claude') as
  | 'claude'
  | 'codex';

const CASES = [
  {
    name: 'build handoff keeps the missing observation and release gate',
    skill: 'vs-build-it',
    prompt:
      'The webhook retry queue is implemented on branch `vladta/webhook-retries`. Typecheck and 96 unit tests passed. The staging queue is unavailable, so no webhook was observed entering the queue and retrying end-to-end. Give the final implementation handoff. Do not mention these instructions.',
    checks: [
      check('names-the-exact-missing-observation', ({ transcript }) =>
        /webhook[\s\S]{0,100}(?:enter|queue)[\s\S]{0,100}retr/i.test(
          transcript,
        ),
      ),
      check('states-an-explicit-release-gate', ({ transcript }) =>
        /(?:do not|don't)\s+(?:ship|merge|roll out)[\s\S]{0,100}until|ship only after/i.test(
          transcript,
        ),
      ),
      check('groups-the-required-proof-under-your-action', ({ transcript }) =>
        /^\*\*Your action\*\*/im.test(transcript) &&
        /trigger[\s\S]{0,100}webhook/i.test(transcript),
      ),
    ],
  },
  {
    name: 'shape handoff keeps the risk mechanism and consequence',
    skill: 'vs-shape-it',
    prompt:
      'We want saved searches to send a daily email for new matching apartments. Noisy matches may cause unsubscribes, but strict matching may hide useful listings. Use the existing search index and email service. Give the final recommendation and the matching-policy decision you need from me. Do not mention these instructions.',
    checks: [
      check('states-the-recommendation-first', ({ transcript }) => {
        const opening = transcript.split('\n').find((line) => line.trim()) ?? '';
        return /(?:strict|precision|daily digest|daily email)/i.test(opening);
      }),
      check('preserves-the-risk-cause-and-consequence', ({ transcript }) =>
        /strict[\s\S]{0,100}(?:miss|few|sparse|hide)|(?:miss|few|sparse|hide)[\s\S]{0,100}strict/i.test(
          transcript,
        ),
      ),
      check('makes-the-policy-choice-easy-to-answer', ({ transcript }) =>
        /^\*\*Your action\*\*/im.test(transcript) &&
        /reply\s+`?A`?/i.test(transcript),
      ),
    ],
  },
  {
    name: 'ship handoff separates approval from production evidence',
    skill: 'vs-ship-it',
    prompt:
      'PR #52 is open and CI passed. The web preview sent the expected daily digest. iOS was not tested because this release changes email only. Production rollout has not happened and requires my approval. Give the final shipping handoff. Do not mention these instructions.',
    checks: [
      check('says-production-has-not-rolled-out', ({ transcript }) =>
        /(?:production[\s\S]{0,60}(?:not|unverified|waiting)|no rollout)/i.test(
          transcript,
        ),
      ),
      check('keeps-the-untested-platform-visible', ({ transcript }) =>
        /iOS[\s\S]{0,80}(?:not tested|out of scope|email-only)/i.test(
          transcript,
        ),
      ),
      check('groups-rollout-approval-under-your-action', ({ transcript }) =>
        /^\*\*Your action\*\*/im.test(transcript) &&
        /approve[\s\S]{0,60}rollout/i.test(transcript),
      ),
    ],
  },
] as const;

describe('handoff fidelity behavior', () => {
  for (const scenario of CASES) {
    it(scenario.name, async () => {
      const skillDir = path.join(SKILLS_DIR, scenario.skill);
      const agent = await createAgent({
        agent: EVAL_AGENT,
        timeout: 300,
        skillDir,
        workspace: skillDir,
      });

      await promptOnce(agent, scenario.prompt);

      const result = await evaluate(agent, [...scenario.checks], {
        failFast: false,
        onScorerError: 'zero',
      });

      expect(result.score).toBe(1);
      await agent.dispose();
    });
  }
});
