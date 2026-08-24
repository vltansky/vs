import * as path from 'path';
import { check, evaluate } from '@wix/pathgrade';
import { describe, expect, it } from 'vitest';
import { promptOnce } from '../../vs-internal-shared/test/pathgrade-v1';

import { createAgent } from '../../vs-internal-shared/test/pathgrade-agent';

const SKILL_DIR = path.resolve(__dirname, '..');
const EVAL_AGENT = (process.env.PATHGRADE_AGENT ?? 'codex') as 'claude' | 'codex';

function assistantOutput(log: Array<{ type: string; assistant_message?: string }>) {
  return log
    .filter((entry) => entry.type === 'agent_result')
    .map((entry) => entry.assistant_message ?? '')
    .join('\n');
}

describe('vs-ship-it behavior', () => {
  it('hands a newly created PR to babysitting by default', async () => {
    const agent = await createAgent({
      agent: EVAL_AGENT,
      timeout: 360,
      skillDir: SKILL_DIR,
    });

    try {
      await promptOnce(
        agent,
        `Use $vs-ship-it. The user said only "create pr" and did not ask to skip watching.

Assume the scoped changes are already validated and committed, PR #542 was just created as a draft, and Step 5b verified its URL, branch, draft state, and head SHA. CI and automated review are pending.

Describe what you do next. Do not perform real GitHub writes or start a real watcher.`,
      );

      const result = await evaluate(
        agent,
        [
          check('starts-babysitting-by-default', ({ log }) => {
            const output = assistantOutput(log);
            return /start.*(?:baby-?sit|babysitting)|transition.*babysit|hand off.*vs-baby-sit/is.test(
              output,
            );
          }),
          check('does-not-end-at-pr-link', ({ log }) => {
            const output = assistantOutput(log);
            const verifiedPr = output.search(
              /verified (?:draft )?PR|PR.*(?:created|verified)|Step 5b/i,
            );
            const babysit = output.search(
              /start.*(?:baby-?sit|babysitting)|transition.*babysit|hand (?:off )?.*to .*vs-baby-sit/i,
            );
            return verifiedPr >= 0 && babysit > verifiedPr;
          }),
          check('keeps-pr-draft-until-babysit-gates-pass', ({ log }) => {
            const output = assistantOutput(log);
            return (
              /draft/i.test(output) &&
              /(?:baby-?sit|babysitting).*ready for review|ready for review.*(?:baby-?sit|babysitting)|babysit.*transition/is.test(
                output,
              ) &&
              (/(?:after|once|only when).*(?:CI|exact head).*(?:pass|green|success)/is.test(
                output,
              ) ||
                /CI[\s\S]*automated review[\s\S]*once both pass/i.test(output))
            );
          }),
          check('uses-the-babysit-contract', ({ log }) => {
            const output = assistantOutput(log);
            return (
              /vs-baby-sit|babysitting phase/i.test(output) &&
              /(?:monitor|watch|wait).*CI/is.test(output) &&
              /automated review|reviewer-bot findings/i.test(output) &&
              /separate.*(?:vs-baby-sit|babysitting)|hand.*to.*vs-baby-sit/is.test(output)
            );
          }),
        ],
        { failFast: false, onScorerError: 'zero' },
      );

      expect(result.score).toBe(1);
    } finally {
      await agent.dispose();
    }
  });
});
