import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { check, evaluate } from '@wix/pathgrade';
import { createAgent } from './pathgrade-agent';
import { promptOnce } from './pathgrade-v1';

const EVAL_AGENT = (process.env.PATHGRADE_AGENT ?? 'codex') as 'claude' | 'codex';
const output = (log: Array<{ type: string; assistant_message?: string }>) => log
  .filter(entry => entry.type === 'agent_result').map(entry => entry.assistant_message ?? '').join('\n');

describe('demo evidence handoff', () => {
  it('shapes executable scenarios without beginning capture', async () => {
    const agent = await createAgent({ agent: EVAL_AGENT, timeout: 300, skillDir: path.resolve(__dirname, '../../vs-shape-it') });
    try {
      await promptOnce(agent, `Use $vs-shape-it. Give only the Evidence plan subsection of an already agreed design; do not invoke other skills or tools except reading instructions. Mobile comments at /preview use the busy-review fixture at 390x844. The approved changes preserve drafts across thread switching, discard on Cancel, and retain text after HTTP 503 so Retry can submit. Outcome, scope, and approvals are settled. No media exists.`);
      const result = await evaluate(agent, [
        check('concrete-scenarios', ({ log }) => /390/.test(output(log)) && /busy-review/.test(output(log)) && /cancel/i.test(output(log)) && /retry/i.test(output(log))),
        check('observable-proof', ({ log }) => /before/i.test(output(log)) && /after/i.test(output(log)) && /assert|verify|expect/i.test(output(log))),
        check('does-not-claim-capture', ({ log }) => !/I (?:have )?(?:recorded|captured)|videos? (?:are|is) attached/i.test(output(log))),
      ], { failFast: false, onScorerError: 'zero' });
      expect(result.score).toBe(1);
    } finally { await agent.dispose(); }
  });

  it('distinguishes unaffected evidence from a changed demonstrated flow', async () => {
    const agent = await createAgent({ agent: EVAL_AGENT, timeout: 300, skillDir: path.resolve(__dirname, '../../vs-ship-it') });
    try {
      await promptOnce(agent, `Use $vs-ship-it. Explain only how to update existing PR evidence; do not publish or invoke tools except reading instructions. A video proves the mobile composer flow at aaa111. Head bbb222 changes only test imports. A subsequent head ccc333 moves the composer and changes its visible controls. Browser access is unavailable at ccc333. Give the action and honest PR wording for each head.`);
      const result = await evaluate(agent, [
        check('retains-unaffected-attribution', ({ log }) => /aaa111/.test(output(log)) && /bbb222/.test(output(log)) && /retain|reuse|keep/i.test(output(log))),
        check('requires-new-proof-for-visible-change', ({ log }) => /ccc333/.test(output(log)) && /re-?record|recaptur|new (?:recording|video)/i.test(output(log))),
        check('states-access-gap', ({ log }) => /unverified|unavailable|blocked|gap/i.test(output(log)) && !/ccc333.*(?:verified|proven) by.*aaa111/i.test(output(log))),
      ], { failFast: false, onScorerError: 'zero' });
      expect(result.score).toBe(1);
    } finally { await agent.dispose(); }
  });
});
