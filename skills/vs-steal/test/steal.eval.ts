import * as path from 'path';
import { describe, expect, it } from 'vitest';
import { check, createAgent, evaluate } from '@wix/pathgrade';

const SKILL_DIR = path.resolve(__dirname, '..');

void SKILL_DIR;

describe('steal', () => {
  // TODO: needs an octocode MCP shim (or offline snapshot of a real target repo)
  //   to exercise without hitting the live GitHub API. Gate this eval on the
  //   shim being present. Flow to check:
  //   - Phase 0 scope locked to one owner/repo + focus
  //   - Phase 2 candidate list capped ~15 with citations (repo path + ref)
  //   - Phase 3 value x cost ranking
  //   - Phase 4 writeout at ~/.vs/$PROJECT_ID/steals/YYYY-MM-DD-<target-slug>.html
  // See plugins/vs/skills/steal/SKILL.md for the full flow.
  it('has a runnable behavior-eval scaffold when an offline repo fixture exists', async () => {
    if (!process.env.RUN_PENDING_REMOTE_EVALS) {
      return;
    }

    const agent = await createAgent({ agent: 'codex', timeout: 300, skillDir: SKILL_DIR });
    const result = await evaluate(agent, [check('placeholder', () => true)]);
    expect(result.score).toBe(1);
  });

  it.todo('locks scope to one owner/repo before searching');
  it.todo('cites every candidate with a repo path + ref');
  it.todo('writes the HTMDX steal report to the $PROJECT_ID/steals path');
});
