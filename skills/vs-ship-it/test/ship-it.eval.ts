import * as path from 'path';
import { check, createAgent, evaluate } from '@wix/pathgrade';
import { describe, expect, it } from 'vitest';
import { promptOnce } from '../../vs-internal-shared/test/pathgrade-v1';

const SKILL_DIR = path.resolve(__dirname, '..');
const EVAL_AGENT = (process.env.PATHGRADE_AGENT ?? 'claude') as 'claude' | 'codex';

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

Assume the scoped changes are already validated and committed, PR #542 was just created, and Step 5b verified its URL, branch, and head SHA. CI and automated review are pending.

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
            const verifiedPr = output.search(/verified PR|PR.*(?:created|verified)|Step 5b/i);
            const babysit = output.search(
              /start.*(?:baby-?sit|babysitting)|transition.*babysit|hand off.*vs-baby-sit/i,
            );
            return verifiedPr >= 0 && babysit > verifiedPr;
          }),
          check('uses-the-babysit-contract', ({ log }) => {
            const output = assistantOutput(log);
            return (
              /vs-baby-sit|babysitting phase/i.test(output) &&
              /(?:monitor|watch).*CI/is.test(output) &&
              /automated review|reviewer-bot findings/i.test(output) &&
              /failure|fails|actionable|needs a human/i.test(output)
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
