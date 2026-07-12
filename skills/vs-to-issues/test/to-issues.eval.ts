import * as fs from 'fs';
import * as path from 'path';
import { describe, expect, it } from 'vitest';
import { check, createAgent, evaluate } from '@wix/pathgrade';

const SKILL_DIR = path.resolve(__dirname, '..');
const SKILL = fs.readFileSync(path.join(SKILL_DIR, 'SKILL.md'), 'utf8');
const AGENT_BRIEF = fs.readFileSync(
  path.join(SKILL_DIR, 'references', 'agent-brief.md'),
  'utf8',
);

describe('to-issues', () => {
  it.skip('has a runnable behavior-eval scaffold for future issue-tracker fixtures', async () => {
    const agent = await createAgent({ agent: 'codex', timeout: 300, skillDir: SKILL_DIR });
    const result = await evaluate(agent, [check('placeholder', () => true)]);
    expect(result.score).toBe(1);
  });

  it('requires tracker conventions and safe REST fallback before issue creation', () => {
    expect(SKILL).toMatch(/docs\/agents\/issue-tracker\.md/);
    expect(SKILL).toMatch(/AGENTS\.md/);
    expect(SKILL).toMatch(/git config --get remote\.origin\.url/);
    expect(SKILL).toMatch(/gh api "search\/issues\?q=repo:\$REPO\+is:issue/);
    expect(SKILL).toMatch(/gh api -X POST "repos\/\$REPO\/issues"/);
    expect(SKILL).not.toMatch(/gh repo view --json/);
  });

  it('uses one canonical label contract for execution readiness', () => {
    expect(SKILL).toMatch(/Label contract/);
    expect(SKILL).toMatch(/ready-for-agent/);
    expect(SKILL).toMatch(/ready-for-human/);
    expect(SKILL).toMatch(/needs-review/);
    expect(SKILL).toMatch(/afk-safe/);
    expect(SKILL).toMatch(/hitl/);
    expect(SKILL).toMatch(/exactly one state label/);
  });

  it('blocks creation until the user approves the full draft set', () => {
    expect(SKILL).toMatch(/full draft set/i);
    expect(SKILL).toMatch(/one explicit approval/i);
    expect(SKILL).toMatch(/Do not create issues one-by-one/i);
  });

  it('allows durable current behavior and key contract sections without file paths', () => {
    expect(AGENT_BRIEF).toMatch(/Current behavior/);
    expect(AGENT_BRIEF).toMatch(/Key interfaces\/contracts/);
    expect(AGENT_BRIEF).toMatch(/public contracts/);
    expect(AGENT_BRIEF).toMatch(/No file paths/);
    expect(AGENT_BRIEF).toMatch(/No line numbers/);
  });
});
