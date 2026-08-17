import * as fs from 'node:fs';
import * as path from 'node:path';
import { describe, expect, it } from 'vitest';

const SKILLS_DIR = path.resolve(__dirname, '..', '..');
const readSkill = (name: string) =>
  fs.readFileSync(path.join(SKILLS_DIR, name, 'SKILL.md'), 'utf8');

const ARCHITECT = readSkill('vs-architect');
const IMPROVE = readSkill('vs-improve');
const SHAPE = readSkill('vs-shape-it');
const BUILD = readSkill('vs-build-it');
const README = fs.readFileSync(path.resolve(SKILLS_DIR, '..', 'README.md'), 'utf8');

describe('vs-architect composition', () => {
  it('supplies improve architecture findings without stealing its plan workflow', () => {
    expect(IMPROVE).toMatch(/tech debt & architecture[\s\S]+vs-architect\/SKILL\.md/i);
    expect(IMPROVE).toMatch(/architect[\s\S]+in composed mode/i);
    expect(IMPROVE).toMatch(/Improve still owns[\s\S]+selection[\s\S]+implementation plans/i);
    expect(IMPROVE).toMatch(/do not emit architect's[\s\S]+candidate-selection question/i);
  });

  it('runs before shape-it design only for existing architecture-sensitive code', () => {
    const evidence = SHAPE.match(/#### Architecture evidence[\s\S]+?(?=\n#### )/)?.[0] ?? '';
    expect(evidence).toMatch(/Before Design/);
    expect(evidence).toMatch(/existing implementation/);
    expect(evidence).toMatch(/interfaces, seams, coupling, or\s+consolidation/);
    expect(evidence).toMatch(/in composed mode/);
    expect(evidence).toMatch(/Skip architect for greenfield work/);
    expect(evidence).toMatch(/already approved design or spec/);
  });

  it('uses architect only before unplanned architecture builds', () => {
    expect(BUILD).toMatch(/unplanned request[\s\S]+vs-architect\/SKILL\.md/i);
    expect(BUILD).toMatch(/approved shape-it spec[\s\S]+source of truth/i);
    expect(BUILD).toMatch(/Do not run architect after implementation/i);
    expect(BUILD).toMatch(/\/vs-roast-code[\s\S]+diff-scoped architecture review/i);
    expect(BUILD).toMatch(/route the\s+decision through `\/vs-shape-it`/i);
  });

  it('keeps architect available as a public building block', () => {
    expect(ARCHITECT).toMatch(/\*\*Kind:\*\* Building block/);
    expect(ARCHITECT).toMatch(/\/vs-improve/);
    expect(ARCHITECT).toMatch(/\/vs-shape-it/);
    expect(ARCHITECT).toMatch(/\/vs-build-it/);
    expect(README).toMatch(
      /Architecture:\s+\/vs-architect -> \/vs-shape-it -> \/vs-build-it/,
    );
  });
});
