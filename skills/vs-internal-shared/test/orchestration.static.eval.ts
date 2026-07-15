import * as fs from 'fs';
import * as path from 'path';
import { describe, expect, it } from 'vitest';

const SHARED_DIR = path.resolve(__dirname, '..');
const GOALS = fs.readFileSync(
  path.join(SHARED_DIR, 'references', 'codex-goal.md'),
  'utf8',
);
const SUBAGENTS = fs.readFileSync(
  path.join(SHARED_DIR, 'references', 'subagents.md'),
  'utf8',
);
const BUILD_IT = fs.readFileSync(
  path.resolve(SHARED_DIR, '..', 'vs-build-it', 'SKILL.md'),
  'utf8',
);
const ROAST_REVIEW = fs.readFileSync(
  path.resolve(SHARED_DIR, '..', 'vs-roast-review', 'SKILL.md'),
  'utf8',
);

describe('Codex goal ownership', () => {
  it('requires explicit user authorization before creating a goal', () => {
    expect(GOALS).toMatch(/Goal-tool availability is not\s+authorization/);
    expect(GOALS).toMatch(/explicitly asks.*Codex goal/is);
  });

  it('keeps goal mutation with the parent workflow', () => {
    expect(GOALS).toMatch(
      /Subagents do not create,\s+complete, or block goals/,
    );
    expect(GOALS).toMatch(/parent workflow owns goal state/);
  });
});

describe('subagent budget', () => {
  it('sets bounded fanout and fresh-context defaults', () => {
    expect(SUBAGENTS).toMatch(/At most two active subagents/);
    expect(SUBAGENTS).toMatch(/At most four total child runs/);
    expect(SUBAGENTS).toMatch(/fresh context/);
    expect(SUBAGENTS).toMatch(/Do not\s+poll `wait_agent`/);
  });

  it('is applied by build and review workflows', () => {
    expect(BUILD_IT).toContain(
      '../vs-internal-shared/references/subagents.md',
    );
    expect(ROAST_REVIEW).toContain(
      '../vs-internal-shared/references/subagents.md',
    );
    expect(ROAST_REVIEW).not.toMatch(/Run 3 agents in parallel/);
    expect(ROAST_REVIEW).not.toMatch(/Two agents in parallel/);
  });
});
