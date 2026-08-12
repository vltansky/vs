import * as path from 'path';
import { check, createAgent, evaluate } from '@wix/pathgrade';
import { describe, expect, it } from 'vitest';
import { promptOnce } from '../../vs-internal-shared/test/pathgrade-v1';

const SKILL_DIR = path.resolve(__dirname, '..');
const EVAL_AGENT = (process.env.PATHGRADE_AGENT ?? 'claude') as
  | 'claude'
  | 'codex';

const GENERIC_PUBLISHER =
  'github:yeet — Publish local changes by committing, pushing, and opening a draft PR.';

describe('vs-ship-it routing collision', () => {
  for (const request of [
    'ok so remove it create pr',
    'do it create pr',
    'add logs - create pr',
    'ok open pr',
  ]) {
    it(`prefers vs-ship-it for: ${request}`, async () => {
      const agent = await createAgent({
        agent: EVAL_AGENT,
        timeout: 300,
        skillDir: SKILL_DIR,
      });

      try {
        await promptOnce(
          agent,
          `The implementation is complete. The user now says: "${request}".

The host exposes both publishing skills:
- vs-ship-it — the primary VS workflow for PRs, commits, pushes, verification, and handback.
- ${GENERIC_PUBLISHER}

Do not modify files or contact GitHub in this fixture. State which single skill
should own the request and why. Reply in exactly two lines beginning with
"Skill:" and "Why:".`,
        );

        const result = await evaluate(
          agent,
          [
            check('selects-vs-ship-it', ({ transcript }) =>
              /^Skill:\s*`?(?:vs:)?vs-ship-it`?\s*$/im.test(transcript),
            ),
            check(
              'does-not-select-or-compose-yeet',
              ({ transcript }) =>
                !/^Skill:.*(?:github:)?yeet/im.test(transcript) &&
                !/use both|compose both|then.*yeet/i.test(transcript),
            ),
            check('explains-precedence', ({ transcript }) =>
              /^Why:.*(?:VS|primary|preferred|verification|handback)/im.test(transcript),
            ),
          ],
          { failFast: false, onScorerError: 'zero' },
        );

        expect(result.score).toBe(1);
      } finally {
        await agent.dispose();
      }
    });
  }
});
