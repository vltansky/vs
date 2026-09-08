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
  it('explains before and after and obtains frontend proof', async () => {
    const agent = await createAgent({ agent: EVAL_AGENT, timeout: 360, skillDir: SKILL_DIR });
    try {
      await promptOnce(agent, `Use $vs-ship-it. Prepare the description and evidence plan only; do not publish or invoke tools beyond reading the skill.
The PR fixes checkout: with an expired coupon, clicking Pay previously spun forever; now an inline error lets the customer remove the coupon and retry. This is source-derived; tests and media have not been supplied. Base and head previews and browser recording tools are available. No screenshots or videos exist. The user said create pr and do not watch.
Then give the Before/After copy for a separate internal refactor that preserves the API response while consolidating duplicate parsing, and a new CSV export feature where export was previously unavailable.`);
      const result = await evaluate(agent, [
        check('paired-concrete-behavior', ({ log }) => {
          const output = assistantOutput(log);
          return /before/i.test(output) && /after/i.test(output) && /spinn|spinner/i.test(output) && /inline error/i.test(output);
        }),
        check('capture-missing-frontend-proof', ({ log }) => {
          const output = assistantOutput(log);
          return /captur|record/i.test(output) && /video|recording/i.test(output) && /screenshot|still/i.test(output)
            && !/would you like|shall I|ask.*(?:permission|approval)|approve.*record/i.test(output);
        }),
        check('honest-new-and-internal-comparisons', ({ log }) => {
          const output = assistantOutput(log);
          return /source-derived/i.test(output) && /unchanged|same.*response|response.*same/i.test(output)
            && /(?:no|unavailable|could not|cannot).*export|export.*(?:unavailable|not available)/i.test(output);
        }),
      ], { failFast: false, onScorerError: 'zero' });
      expect(result.score).toBe(1);
    } finally {
      await agent.dispose();
    }
  });

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

Assume the scoped changes are already validated and committed, PR #542 was just created as a regular non-draft PR, and the PR verification resolved its URL, branch, open state, exact head SHA, and 12 changed files. CI and automated review are pending.

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
          check('starts-large-pr-walkthrough-by-default', ({ log }) => {
            const output = assistantOutput(log);
            return /(?:spawn|start|launch).*(?:subagent|child).*(?:PR )?walkthrough|(?:PR )?walkthrough.*(?:subagent|child)/is.test(
              output,
            );
          }),
          check('walkthrough-does-not-delay-babysitting', ({ log }) => {
            const output = assistantOutput(log);
            return /(?:parallel|concurrent|without waiting|immediately)[\s\S]*(?:baby-?sit|babysitting)|(?:baby-?sit|babysitting)[\s\S]*(?:parallel|concurrent|without waiting)/is.test(
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
          check('keeps-the-pr-regular-until-a-repair', ({ log }) => {
            const output = assistantOutput(log);
            return (
              !/keeps? (?:it|the PR) (?:as a |in )?draft|draft until|gh pr ready(?! --undo)/i.test(output) &&
              !/auto-?merge/i.test(output)
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
