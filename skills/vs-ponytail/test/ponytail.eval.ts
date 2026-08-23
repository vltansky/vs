import fs from 'node:fs';
import path from 'node:path';
import { check, evaluate } from '@wix/pathgrade';
import { describe, expect, it } from 'vitest';

import { createAgent } from '../../vs-internal-shared/test/pathgrade-agent';
import { promptOnce } from '../../vs-internal-shared/test/pathgrade-v1';

const SKILL_DIR = path.resolve(__dirname, '..');
const FIXTURE_DIR = path.join(__dirname, 'fixtures', 'existing-helper');
const EVAL_AGENT = (process.env.PATHGRADE_AGENT ?? 'codex') as
  | 'claude'
  | 'codex';

describe('vs-ponytail behavior', () => {
  it('chooses the repository helper and avoids new machinery', async () => {
    const agent = await createAgent({
      agent: EVAL_AGENT,
      timeout: 420,
      skillDir: SKILL_DIR,
      workspace: FIXTURE_DIR,
      copyFromHome:
        EVAL_AGENT === 'codex' ? ['.codex/auth.json'] : undefined,
      debug: true,
    });

    await agent.exec('git init -q');
    await agent.exec('git config user.name "Pathgrade"');
    await agent.exec('git config user.email "pathgrade@example.test"');
    await agent.exec('git add .');
    await agent.exec('git commit -qm "fixture: initial state"');

    await promptOnce(
      agent,
      'Ponytail this change: add createDraftOrder() in src/orders.js. It must return a unique id and draft status. Implement it directly, do not ask questions, and do not add dependencies.',
    );

    const result = await evaluate(
      agent,
      [
        check('working-behavior', async ({ runCommand }) => {
          const { stdout } = await runCommand(
            "node -e \"const {createDraftOrder}=require('./src/orders'); const a=createDraftOrder(); const b=createDraftOrder(); console.log(a.status,b.status,a.id!==b.id)\"",
          );
          return stdout.trim() === 'draft draft true';
        }, { weight: 3 }),
        check('reuses-existing-helper', async ({ runCommand }) => {
          const { stdout } = await runCommand('sed -n "1,200p" src/orders.js');
          return /newId\s*\(/.test(stdout) && /require\(['"]\.\/id['"]\)/.test(stdout);
        }, { weight: 3 }),
        check('avoids-new-machinery', async ({ runCommand }) => {
          const { stdout: diff } = await runCommand('git diff --name-only HEAD');
          const source = fs.readFileSync(path.join(agent.workspace, 'src', 'orders.js'), 'utf8');
          return (
            diff.trim() === 'src/orders.js' &&
            !/randomUUID|Date\.now|Math\.random|uuid/i.test(source)
          );
        }, { weight: 2 }),
      ],
      { failFast: false, onScorerError: 'zero' },
    );

    expect(result.score).toBe(1);
    await agent.dispose();
  }, 480_000);
});
