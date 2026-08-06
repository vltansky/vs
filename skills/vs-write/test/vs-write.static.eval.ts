import * as fs from 'node:fs';
import * as path from 'node:path';
import { describe, expect, it } from 'vitest';
import { CASES, FIXTURE_DIR } from './cases';

const ROOT = path.resolve(__dirname, '..', '..', '..');
const SKILL_PATH = path.resolve(ROOT, 'skills', 'vs-write', 'SKILL.md');
// SKILL.md is hard-wrapped, so a phrase assertion has to survive a line break
// falling anywhere inside it. Collapsing runs of whitespace to one space keeps
// these checks about content rather than about where the wrap landed. For the
// canary checks it is also strictly stricter: a canary split across two lines
// still counts as present.
const SKILL = fs
  .readFileSync(SKILL_PATH, 'utf8')
  .replace(/\s+/g, ' ');
const NOTICES = fs.readFileSync(
  path.resolve(ROOT, 'THIRD_PARTY_NOTICES.md'),
  'utf8',
);

describe('vs-write: fidelity outranks concision', () => {
  it('states that tightening may not buy a fact', () => {
    expect(SKILL).toMatch(/concision (may not|must not|does not) buy a fact/i);
    expect(SKILL).toMatch(
      /names? (a|the) problem without naming the remedy|without the remedy/i,
    );
  });

  it('names the specific promotions that count as fidelity failures', () => {
    expect(SKILL).toMatch(/hedge (in)?to a claim/i);
    expect(SKILL).toMatch(/contributing factor (in)?to a cause/i);
  });
});

describe('vs-write: structure rules the blind test evidenced', () => {
  it('forbids sections the requested format does not need', () => {
    expect(SKILL).toMatch(
      /do not add a section (that )?the requested format does not need/i,
    );
  });

  it('forbids decorative bold run-in labels', () => {
    expect(SKILL).toMatch(/run-in label/i);
  });

  it('forbids restating a heading in the sentence beneath it', () => {
    expect(SKILL).toMatch(/restate a heading/i);
  });

  it('forbids explaining a concept the named audience already owns', () => {
    expect(SKILL).toMatch(/concept the (named )?audience already owns/i);
  });
});

describe('vs-write: the eval canaries stay out of the instructions', () => {
  // A canary quoted in SKILL.md measures compliance with the instructions, not
  // fidelity. See adr/gate-writing-concision-on-source-fidelity.md.
  for (const caseSpec of CASES) {
    for (const canary of caseSpec.canaries) {
      it(`${caseSpec.id} canary ${canary} is absent from SKILL.md`, () => {
        expect(canary.test(SKILL)).toBe(false);
      });
    }
  }
});

describe('vs-write: the merge did not change the contract', () => {
  it('keeps the Flow Contract and all three status values', () => {
    expect(SKILL).toMatch(/## Flow Contract/);
    expect(SKILL).toMatch(/`WRITING_READY`/);
    expect(SKILL).toMatch(/`BLOCKED_MISSING_FACTS`/);
    expect(SKILL).toMatch(/`BLOCKED_AMBIGUOUS_INTENT`/);
  });

  it('keeps both writing modes', () => {
    expect(SKILL).toMatch(/\*\*Direct mode:\*\*/);
    expect(SKILL).toMatch(/\*\*Shaping mode:\*\*/);
  });

  it('stays within the merged size ceiling', () => {
    // The merge took the skill from 176 lines to 210. The ceiling is that
    // result plus headroom: a distillation that keeps growing is a vendored
    // corpus with extra steps, and every line here is read on every write.
    const lines = fs.readFileSync(SKILL_PATH, 'utf8').split('\n').length;
    expect(lines).toBeLessThanOrEqual(240);
  });

  it('distills rather than vendoring a reference corpus', () => {
    const skillDir = path.resolve(ROOT, 'skills', 'vs-write');
    const subdirs = fs
      .readdirSync(skillDir, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name);
    expect(subdirs).not.toContain('references');
    expect(subdirs).not.toContain('elements-of-style');
  });
});

describe('vs-write: lineage and fixtures', () => {
  it('credits Strunk in the third-party notices', () => {
    expect(NOTICES).toMatch(/Elements of Style/i);
    expect(NOTICES).toMatch(/Strunk/);
    expect(NOTICES).toMatch(/`skills\/vs-write`/);
  });

  it('ships every fixture the case table references', () => {
    for (const caseSpec of CASES) {
      expect(fs.existsSync(path.join(FIXTURE_DIR, caseSpec.fixture))).toBe(true);
    }
  });

  it('holds a held-out slice back from iteration', () => {
    const heldOut = CASES.filter((caseSpec) => caseSpec.slice === 'held-out');
    expect(heldOut).toHaveLength(2);
  });
});
