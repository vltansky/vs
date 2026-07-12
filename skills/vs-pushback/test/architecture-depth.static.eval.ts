import * as fs from 'fs';
import * as path from 'path';
import { describe, expect, it } from 'vitest';
import { check, createAgent, evaluate } from '@wix/pathgrade';

const SKILL_DIR = path.resolve(__dirname, '..');
const SKILL = fs.readFileSync(path.join(SKILL_DIR, 'SKILL.md'), 'utf8');
const ARCH_REF = fs.readFileSync(
  path.join(SKILL_DIR, 'references', 'architecture-depth-dimension.md'),
  'utf8',
);
const ROAST_SKILL = fs.readFileSync(
  path.resolve(SKILL_DIR, '..', 'vs-roast-review', 'SKILL.md'),
  'utf8',
);

describe('architecture depth skill guards', () => {
  it.skip('has a runnable behavior-eval scaffold for future architecture fixtures', async () => {
    const agent = await createAgent({ agent: 'codex', timeout: 300, skillDir: SKILL_DIR });
    const result = await evaluate(agent, [check('placeholder', () => true)]);
    expect(result.score).toBe(1);
  });

  it('wires Architecture Depth as a conditional pushback dimension', () => {
    expect(SKILL).toMatch(/Architecture Depth/);
    expect(SKILL).toMatch(/architecture-depth-dimension\.md/);
    expect(SKILL).toMatch(/module boundaries, abstractions, or interfaces/);
    expect(SKILL).toMatch(/normalize over active dimensions/);
  });

  it('defines concrete architecture vocabulary and deletion-test pressure', () => {
    for (const term of ['Module', 'Interface', 'Seam', 'Depth', 'Leverage', 'Locality']) {
      expect(ARCH_REF).toContain(`**${term}**`);
    }
    expect(ARCH_REF).toMatch(/Deletion test/);
    expect(ARCH_REF).toMatch(/test surface/i);
  });

  it('forces roast architecture findings to be deepening opportunities', () => {
    expect(ROAST_SKILL).toMatch(/deepening opportunities/);
    expect(ROAST_SKILL).toMatch(/Suggested deepening/);
    expect(ROAST_SKILL).toMatch(/Test surface/);
    expect(ROAST_SKILL).toMatch(/locality\/leverage/);
  });
});
