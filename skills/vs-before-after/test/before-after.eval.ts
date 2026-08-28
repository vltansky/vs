import * as path from 'path';
import { check, evaluate } from '@wix/pathgrade';
import { describe, expect, it } from 'vitest';
import { createAgent } from '../../vs-internal-shared/test/pathgrade-agent';
import { promptOnce } from '../../vs-internal-shared/test/pathgrade-v1';

const SKILL_DIR = path.resolve(__dirname, '..');
const EVAL_AGENT = (process.env.PATHGRADE_AGENT ?? 'codex') as
  | 'claude'
  | 'codex';

async function run(message: string) {
  const agent = await createAgent({
    agent: EVAL_AGENT,
    timeout: 300,
    skillDir: SKILL_DIR,
    copyFromHome: EVAL_AGENT === 'codex' ? ['.codex/auth.json'] : undefined,
  });
  await promptOnce(agent, message);
  return agent;
}

describe('vs-before-after behavior', () => {
  it('turns source changes into a functional comparison without claiming proof', async () => {
    const agent = await run(`Use $vs-before-after. Treat this supplied diff summary as the exact base-to-head evidence; do not fetch or edit anything.

Base: POST /jobs calls enqueue(), returns 500 when enqueue throws QueueBusy, and clients must retry the entire request themselves.
Head: POST /jobs catches QueueBusy, retries enqueue up to two times with the same idempotency key, returns 202 when a retry succeeds, and still returns 500 after all attempts fail. Existing validation and authorization execute before enqueue in both versions. No runtime or test output was supplied.

Show me only the functional before and after.`);
    try {
      const result = await evaluate(agent, [
        check('functional-before-after', ({ transcript }) =>
          /Before[\s\S]*clients?.{0,80}retry|Before[\s\S]*500[\s\S]*After[\s\S]*202/is.test(
            transcript,
          ),
        ),
        check('preserved-contract', ({ transcript }) =>
          /Unchanged[\s\S]*(validation|authorization)/is.test(transcript),
        ),
        check('honest-evidence', ({ transcript }) =>
          /source-derived|proof gap|not (?:runtime )?(?:observed|tested|verified)/is.test(
            transcript,
          ),
        ),
        check('no-code-inventory', ({ transcript }) =>
          !/files changed|diff stat|architecture diagram|review focus/i.test(
            transcript,
          ),
        ),
      ]);
      expect(result.score).toBe(1);
    } finally {
      await agent.dispose();
    }
  });

  it('does not invent behavior for a refactor-only diff', async () => {
    const agent = await run(`Use $vs-before-after. The exact diff only renames parseConfig() to readConfig(), updates all callers, and preserves byte-for-byte output for the existing tests. No public API exports change. Do not fetch or edit anything. Show the functional difference.`);
    try {
      const result = await evaluate(agent, [
        check('no-functional-change', ({ transcript }) =>
          /NO_FUNCTIONAL_CHANGE/.test(transcript),
        ),
        check('no-invented-impact', ({ transcript }) =>
          !/users? (?:can|now|gain)|faster|safer|improved experience/i.test(
            transcript,
          ),
        ),
      ]);
      expect(result.score).toBe(1);
    } finally {
      await agent.dispose();
    }
  });
});
