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

async function describeBuildIt(prompt: string) {
  const agent = await createAgent({
    agent: EVAL_AGENT,
    timeout: 360,
    skillDir: SKILL_DIR,
  });

  await promptOnce(agent, prompt);
  return agent;
}

describe('vs-build-it workflow safeguards', () => {
  it('reconciles accepted decisions into the durable plan before code', async () => {
    const agent = await describeBuildIt(`Use $vs-build-it for this implementation handoff.

The durable implementation map currently says delegated parent continuation uses one turn ID for runtime ownership and Slack projection, allows unbounded synthesis, and can project while a newer human Slack turn is active.

Later in this same conversation, the user accepted three superseding decisions: split runtime and projection turn IDs, cap synthesis at 3000 tokens, and queue projection behind any newer active human Slack turn. These are repo-level decisions, but the durable map and ADR have not been updated yet.

Describe exactly what you do before implementation or worker briefs begin. Do not edit real files or implement code.`);

    try {
      const result = await evaluate(
        agent,
        [
          check('updates-plan-before-code', ({ log }) => {
            const output = assistantOutput(log);
            return (
              /update|amend|reconcile|revise/i.test(output) &&
              /durable (?:implementation )?(?:map|plan)|implementation map/i.test(output) &&
              /before.*(?:implementation|code|worker brief)|(?:implementation|code|worker brief).*blocked/is.test(
                output,
              )
            );
          }),
          check('preserves-all-superseding-decisions', ({ log }) => {
            const output = assistantOutput(log);
            return (
              /split.*runtime.*projection|runtime.*projection.*(?:separate|distinct|split)/is.test(
                output,
              ) &&
              /3000|3,000/.test(output) &&
              /queue.*(?:newer|active).*human.*Slack|newer.*human.*Slack.*queue/is.test(output)
            );
          }),
          check('updates-governing-adr', ({ log }) => {
            const output = assistantOutput(log);
            return /ADR|architecture decision record|decision record/i.test(output);
          }),
          check('does-not-leave-decision-in-chat', ({ log }) => {
            const output = assistantOutput(log);
            return (
              /not.*(?:only|solely).*conversation|do not leave.*(?:chat|conversation)|durable source of truth/is.test(
                output,
              ) ||
              /durable (?:implementation )?map[\s\S]*(?:new|superseding) ADR[\s\S]*(?:before|only after)/i.test(
                output,
              )
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

  it('requires a mixed-version rollout matrix for a distributed contract', async () => {
    const agent = await describeBuildIt(`Use $vs-build-it. We are changing the delegated-task queue envelope shared by independently deployed Agentic producers and Automations consumers. Deployments can overlap for hours, tasks can already be in flight, delivery is at least once, workers use leases, and either side can crash between claim, publish, and persist.

Describe the compatibility proof that must be added to the implementation plan before coding, and the completion rule after implementation. Do not edit real files or implement code.`);

    try {
      const result = await evaluate(
        agent,
        [
          check('covers-both-version-directions', ({ log }) => {
            const output = assistantOutput(log);
            return (
              /old producer.*new consumer/is.test(output) &&
              /new producer.*old consumer/is.test(output)
            );
          }),
          check('covers-recovery-boundaries', ({ log }) => {
            const output = assistantOutput(log);
            return (
              /in[- ]flight/i.test(output) &&
              /duplicate|replay|at[- ]least[- ]once/i.test(output) &&
              /crash/i.test(output) &&
              /lease|takeover|expiry/i.test(output)
            );
          }),
          check('covers-fail-closed-and-rollback', ({ log }) => {
            const output = assistantOutput(log);
            return (
              /fail closed|reject|quarantine/i.test(output) &&
              /malformed|mismatch|downgrade|unknown version/i.test(output) &&
              /rollback/i.test(output)
            );
          }),
          check('blocks-completion-until-proven', ({ log }) => {
            const output = assistantOutput(log);
            return (
              /matrix/i.test(output) &&
              /cannot.*complete|not complete|blocks? completion|must.*proven|until.*proven/is.test(
                output,
              ) &&
              /deterministic test|test.*each row|written argument|evidence/i.test(output)
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

  it('starts on a smoked baseline and ends a session mergeable with a progress note', async () => {
    const agent = await describeBuildIt(`Use $vs-build-it on the approved shape-it plan for invoice export. The plan has three slices: CSV export, PDF export, and email delivery. This is a fresh session: a previous session already shipped CSV export. On the untouched branch, \`npm test\` currently fails one existing test, \`invoice-total rounds to cents\`, and the quickest way to green looks like loosening its expected value.

You expect to run out of context partway through the plan. Describe exactly what you do at the start of this session, how much of the plan you take on, how you handle that failing test, and what you leave behind when the session ends. Do not edit real files or implement code.`);

    try {
      const result = await evaluate(
        agent,
        [
          check('smokes-baseline-before-new-work', ({ log }) => {
            const output = assistantOutput(log);
            return (
              /npm test|test suite|tests? and build|smoke|baseline/i.test(output) &&
              /before.*(?:new work|any (?:new )?(?:code|work)|implement|PDF|slice)|first.*(?:baseline|smoke)/is.test(output)
            );
          }),
          check('reads-prior-progress', ({ log }) => {
            const output = assistantOutput(log);
            return /progress(?: note| file|\.md)|git log/i.test(output);
          }),
          check('takes-one-slice', ({ log }) => {
            const output = assistantOutput(log);
            return (
              /PDF/i.test(output) &&
              /one slice|single slice|only (?:the )?(?:next|PDF)|one at a time|next slice/i.test(output)
            );
          }),
          check('does-not-weaken-the-test', ({ log }) => {
            const output = assistantOutput(log);
            return /(?:not|never|won't|refuse to|instead of)[^.\n]{0,60}(?:loosen|weaken|edit|change|skip|relax)[^.\n]{0,40}(?:test|expect|assert)/i.test(output);
          }),
          check('ends-mergeable-with-progress-note', ({ log }) => {
            const output = assistantOutput(log);
            return (
              /commit|mergeable|green|guardrails pass/i.test(output) &&
              /progress(?: note|\.md)|sessions\//i.test(output) &&
              /next/i.test(output)
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
