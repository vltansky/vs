import * as path from 'path';
import { describe, expect, it } from 'vitest';
import { check, createAgent, evaluate } from '@wix/pathgrade';

const SKILL_DIR = path.resolve(__dirname, '..');

void SKILL_DIR;

describe('competitors', () => {
  // TODO: needs an octocode MCP shim (or offline snapshot) so the landscape
  //   scan is reproducible. Flow to check:
  //   - Phase 0 fixes 4-7 axes BEFORE searching
  //   - Phase 1 discovers 5-10 competitors
  //   - Phase 2 tags uncited claims with [inference]
  //   - Phase 3 cross-cut matrix includes a "this project" row
  //   - Honest "lagging" section present (not just strengths)
  //   - Phase 4 writeout at ~/.vs/$PROJECT_ID/competitors/YYYY-MM-DD-landscape.md
  // See plugins/vs/skills/competitors/SKILL.md for the full flow.
  it('has a runnable behavior-eval scaffold when an offline search fixture exists', async () => {
    if (!process.env.RUN_PENDING_REMOTE_EVALS) {
      return;
    }

    const agent = await createAgent({ agent: 'codex', timeout: 300, skillDir: SKILL_DIR });
    const result = await evaluate(agent, [check('placeholder', () => true)]);
    expect(result.score).toBe(1);
  });

  it.todo('fixes axes before searching (no retrofitting)');
  it.todo('tags uncited claims with [inference]');
  it.todo('includes a lagging section for this project in the matrix');
});
