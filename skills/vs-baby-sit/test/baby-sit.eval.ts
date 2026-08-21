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

describe('vs-baby-sit behavior', () => {
  it('repairs PR-owned external CI and returns to the same watcher', async () => {
    const agent = await createAgent({
      agent: EVAL_AGENT,
      timeout: 360,
      skillDir: SKILL_DIR,
      copyFromHome:
        EVAL_AGENT === 'codex' ? ['.codex/auth.json'] : undefined,
    });

    try {
      await promptOnce(
        agent,
        `Use $vs-baby-sit on PR #542 and automatically fix failures caused by this PR until it is merge-ready.

The watcher has just returned this first event with exit code 10:
{"event":"attention","reason":"ci-failure","snapshot":{"headSha":"abc123","mergeable":true,"reviewDecision":"REVIEW_REQUIRED","unresolvedThreads":0,"ciState":"FAILURE","failures":[]}}

The shared check inspector identifies one external provider check and its build URL, but no GitHub Actions logs. This environment has an installed provider build-investigation skill that can retrieve those logs. The configured checkout contains unrelated user changes.

Describe the exact actions you take now, including what happens after a successful fix is pushed and what you do if the next watcher event says CI is successful and review approval from requested team platform-reviewers is the only remaining gate. Auto-merge is armed and a production rollout is planned afterward. Do not invent the missing provider error.`,
      );

      const result = await evaluate(
        agent,
        [
          check('uses-provider-evidence-before-editing', ({ log }) => {
            const output = assistantOutput(log);
            const provider = output.search(
              /provider.*(?:skill|tool|evidence)|build-investigation|provider(?:'s)? (?:returned )?logs/i,
            );
            const evidenceAfterProvider = output
              .slice(provider)
              .search(/evidence.*(?:PR-owned|caused by this PR)|provider.*logs/i);
            const mutationSetup = output.search(/(temporary|isolated|separate|detached).*worktree/i);
            return (
              provider >= 0 &&
              evidenceAfterProvider >= 0 &&
              (mutationSetup < 0 || provider + evidenceAfterProvider < mutationSetup)
            );
          }),
          check('proves-pr-ownership', ({ log }) => {
            const output = assistantOutput(log);
            return (
              /failure.*(?:belongs to|caused by|is PR-owned)|PR-owned.*(?:failure|defect)/i.test(
                output,
              ) &&
              /not caused by this PR|not tied to the current head|failure.*(flake|infra(?:structure)?|unrelated)|(flake|infra(?:structure)?).*failure|infra.*issue|(?:infrastructure|unrelated).*(?:no code change|make no code change)|logs? (?:cannot|can't) be retrieved[\s\S]*no code change/i.test(
                output,
              )
            );
          }),
          check('protects-configured-checkout', ({ log }) => {
            const output = assistantOutput(log);
            return (
              /(temporary|isolated|detached).*worktree/i.test(output) &&
              /not .*current (checkout|worktree)|do not work in the current worktree|not modify.*dirty checkout|(configured|current|existing) checkout.*(do not touch|untouched|unchanged|read-only)|checkout as read-only|do not mutate.*checkout|leave.*checkout.*(untouched|unchanged)|separate worktree.*user.*changes|preserv(?:e|ing).*(?:configured checkout.*unrelated changes|unrelated checkout changes)/is.test(
                output,
              )
            );
          }),
          check('returns-to-same-watcher-task', ({ log }) => {
            const output = assistantOutput(log);
            return (
              /reuse the (existing|same).*watcher|same (dedicated )?watcher (task|thread|child|agent|process(?:\/task)?)|resume the same watcher/i.test(
                output,
              ) &&
              !/new watcher (task|thread|child|agent)/i.test(output)
            );
          }),
          check('preserves-watcher-strengths', ({ log }) => {
            const output = assistantOutput(log);
            return (
              /next watcher event|return.*watcher|resume.*watcher|reuse.*watcher/i.test(output) &&
              !/sleep loop|repeated.*gh|re-check PR state/i.test(output)
            );
          }),
          check('stops-on-approval-only-gate', ({ log }) => {
            const output = assistantOutput(log);
            return (
              /review-approval|approval.*only remaining|waiting for approval/i.test(output) &&
              /Review needed:.*@?platform-reviewers/i.test(output) &&
              /stop (the )?watcher|stop babysitting|hand.*back|do not (keep|continue).*(watch|poll)/i.test(
                output,
              ) &&
              !/continue babysitting|still waiting|keep(?:ing)? .*under watch/i.test(output)
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
