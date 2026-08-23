import path from 'node:path';
import { check, evaluate } from '@wix/pathgrade';
import { describe, expect, it } from 'vitest';

import { createAgent } from '../../vs-internal-shared/test/pathgrade-agent';
import { promptOnce } from '../../vs-internal-shared/test/pathgrade-v1';

const SKILL_DIR = path.resolve(__dirname, '..');
const FIXTURE_DIR = path.join(__dirname, 'fixtures', 'ponytail-plan');
const EVAL_AGENT = (process.env.PATHGRADE_AGENT ?? 'codex') as
  | 'claude'
  | 'codex';

describe('shape-it Ponytail composition', () => {
  it('shapes the smallest complete slice and cuts speculative machinery', async () => {
    const agent = await createAgent({
      agent: EVAL_AGENT,
      timeout: 480,
      skillDir: SKILL_DIR,
      workspace: FIXTURE_DIR,
      copyFromHome:
        EVAL_AGENT === 'codex' ? ['.codex/auth.json'] : undefined,
      debug: true,
    });

    await promptOnce(
      agent,
      'Shape this without asking questions: add a Node CLI that reads contacts.json, rejects a record without an email, and prints the valid contact count. The outcome, boundary, and proof are settled. The repository has no dependencies. I considered Ajv, a DI container, a plugin system, and a configuration abstraction, but none is required. Return a complete buildable design, not code.',
    );

    const result = await evaluate(
      agent,
      [
        check('names-smallest-complete-slice', ({ transcript }) =>
          /Ponytail cut[\s\S]*(smallest|complete|slice)/i.test(transcript),
        { weight: 2 }),
        check('uses-native-node-capabilities', ({ transcript }) =>
          /JSON\.parse|readFile|node:fs|standard library|built.?in/i.test(transcript),
        { weight: 2 }),
        check('defers-speculative-machinery', ({ transcript }) => {
          const lower = transcript.toLowerCase();
          const rejected = ['ajv', 'di container', 'plugin system', 'configuration abstraction']
            .filter((term) => lower.includes(term)).length;
          return rejected >= 2 && /avoid|defer|not required|no dependency|unnecessary/i.test(transcript);
        }, { weight: 2 }),
        check('stays-planning-only', async ({ runCommand }) => {
          const { stdout } = await runCommand('git status --short 2>/dev/null || true');
          return stdout.trim() === '';
        }),
      ],
      { failFast: false, onScorerError: 'zero' },
    );

    expect(result.score).toBeGreaterThanOrEqual(0.85);
    await agent.dispose();
  }, 540_000);
});
