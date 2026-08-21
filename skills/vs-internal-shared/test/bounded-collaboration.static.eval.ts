import * as fs from 'fs';
import * as path from 'path';
import { describe, expect, it } from 'vitest';

const SKILLS = path.resolve(__dirname, '..', '..');
const REFERENCE_PATH = path.join(
  SKILLS,
  'vs-internal-shared',
  'references',
  'bounded-collaboration.md',
);
const BEHAVIOR_EVAL = fs.readFileSync(
  path.join(
    SKILLS,
    'vs-internal-shared',
    'test',
    'bounded-collaboration.eval.ts',
  ),
  'utf8',
);
const readSkill = (name: string) =>
  fs.readFileSync(path.join(SKILLS, name, 'SKILL.md'), 'utf8');

describe('bounded collaboration contract', () => {
  it('defines one inferred contract for non-trivial owning work', () => {
    expect(fs.existsSync(REFERENCE_PATH)).toBe(true);
    const contract = fs.readFileSync(REFERENCE_PATH, 'utf8');

    expect(contract).toMatch(/non-trivial owning workflow/i);
    expect(contract).toMatch(/outcome/i);
    expect(contract).toMatch(/in scope.*out of scope|scope.*boundary/is);
    expect(contract).toMatch(/proof required|proof.*require/is);
    expect(contract).toMatch(/durable artifact/i);
    expect(contract).toMatch(/authority.*granted|granted.*authority/is);
    expect(contract).toMatch(/stop trigger|reassessment.*trigger/is);
  });

  it('reassesses on evidence instead of time and chooses one next state', () => {
    const contract = fs.readFileSync(REFERENCE_PATH, 'utf8');

    expect(contract).toMatch(/evidence event/i);
    expect(contract).toMatch(/two focused hypotheses/i);
    expect(contract).toMatch(/connector|authentication|authorization/i);
    expect(contract).toMatch(/scope.*expand|authority.*expand/is);
    expect(contract).toMatch(/broad scanning|expensive delegation/i);
    expect(contract).toMatch(/continue.*narrow.*hand off.*park.*stop/is);
    expect(contract).toMatch(/not.*elapsed time|rather than.*time/is);
  });

  it('keeps simple work silent and resolves facts without asking', () => {
    const contract = fs.readFileSync(REFERENCE_PATH, 'utf8');

    expect(contract).toMatch(/simple.*does not emit|do not emit.*simple/is);
    expect(contract).toMatch(/facts.*agent|agent.*facts/is);
    expect(contract).toMatch(/ask.*strategic|strategic.*ask/is);
    expect(contract).toMatch(/access|ownership|authority/i);
  });

  it('uses only delivery gates required by the claimed outcome', () => {
    const contract = fs.readFileSync(REFERENCE_PATH, 'utf8');

    expect(contract).toMatch(/code.*tests.*review.*merge.*deployment.*live behavior.*monitoring/is);
    expect(contract).toMatch(/only.*(?:applicable|required).*gates|gates.*(?:applicable|required)/is);
    expect(contract).toMatch(/current gate.*next blocker|next blocker.*current gate/is);
  });

  it('is composed by the approved first-slice consumers', () => {
    for (const name of [
      'vs-build-it',
      'vs-search-threads',
      'vs-chief-of-staff',
      'vs-verify',
    ]) {
      expect(readSkill(name)).toMatch(/bounded-collaboration\.md/);
    }
  });

  it('scores observable actions instead of prose alone', () => {
    expect(BEHAVIOR_EVAL).toMatch(/\{ workspace \}/);
    expect(BEHAVIOR_EVAL).toContain('.auth-attempts');
    expect(BEHAVIOR_EVAL).toContain('.external-write');
    expect(BEHAVIOR_EVAL).toMatch(/did-not-expand-authority/);
  });
});
