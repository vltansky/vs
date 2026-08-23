import path from 'node:path';
import { check, evaluate } from '@wix/pathgrade';
import { describe, expect, it } from 'vitest';

import { createAgent } from '../../vs-internal-shared/test/pathgrade-agent';
import { promptOnce } from '../../vs-internal-shared/test/pathgrade-v1';

const SKILL_DIR = path.resolve(__dirname, '..');
const FIXTURE_DIR = path.join(__dirname, 'fixtures', 'ponytail-bloat');
const EVAL_AGENT = (process.env.PATHGRADE_AGENT ?? 'codex') as
  | 'claude'
  | 'codex';

async function runReview(file: string) {
  const agent = await createAgent({
    agent: EVAL_AGENT,
    timeout: 420,
    skillDir: SKILL_DIR,
    workspace: FIXTURE_DIR,
    copyFromHome:
      EVAL_AGENT === 'codex' ? ['.codex/auth.json'] : undefined,
    debug: true,
  });
  await promptOnce(
    agent,
    `/vs-roast-code Review only ${file}. Run the Ponytail pass, do not edit, and give the final review without asking questions.`,
  );
  return agent;
}

describe('roast-code Ponytail pass', () => {
  it('names removable dependency and wrapper machinery', async () => {
    const agent = await runReview('src/bloated-name.js');
    const result = await evaluate(
      agent,
      [
        check('finds-removable-dependency', ({ transcript }) =>
          /lodash|get\(|dependency/i.test(transcript) &&
          /remove|replace|direct|native|property/i.test(transcript),
        { weight: 2 }),
        check('finds-removable-wrapper', ({ transcript }) =>
          /NameFormatterFactory|factory|wrapper/i.test(transcript) &&
          /remove|delete|collapse|direct/i.test(transcript),
        { weight: 2 }),
        check('preserves-behavior', ({ transcript }) =>
          /profile\.name|trim|behavior|test|verify/i.test(transcript)),
      ],
      { failFast: false, onScorerError: 'zero' },
    );
    expect(result.score).toBe(1);
    await agent.dispose();
  }, 480_000);

  it('does not invent simplification work for the first complete rung', async () => {
    const agent = await runReview('src/direct-name.js');
    const result = await evaluate(
      agent,
      [
        check('reports-clean-ponytail-pass', ({ transcript }) =>
          /clean|no (?:ponytail )?finding|nothing to remove|already.*(?:direct|small|simple)|first complete rung/i.test(transcript),
        { weight: 2 }),
        check('avoids-invented-machinery', ({ transcript }) =>
          !/extract (?:a )?(?:helper|class|service)|add (?:a )?(?:wrapper|factory|dependency)|introduce (?:a )?(?:layer|abstraction)/i.test(transcript),
        { weight: 2 }),
      ],
      { failFast: false, onScorerError: 'zero' },
    );
    expect(result.score).toBe(1);
    await agent.dispose();
  }, 480_000);
});
