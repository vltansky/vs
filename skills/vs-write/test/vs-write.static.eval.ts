import * as fs from 'node:fs';
import * as path from 'node:path';
import { describe, expect, it } from 'vitest';
import { spawnSync } from 'node:child_process';
import { CASES, FIXTURE_DIR, SLOP_FIXTURES } from './cases';

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
const REJECT = path.resolve(
  ROOT,
  'skills',
  'vs-write',
  'scripts',
  'reject-slop.mjs',
);
const REJECT_SRC = fs.readFileSync(REJECT, 'utf8');

function reject(file: string) {
  return spawnSync(process.execPath, [REJECT, file], { encoding: 'utf8' });
}

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

describe('vs-write: prose unslop pins', () => {
  it('forbids default em dashes', () => {
    expect(SKILL).toMatch(/do not use em dashes as a default/i);
  });

  it('forbids unsolicited comparisons and examples', () => {
    expect(SKILL).toMatch(/do not invent a comparison, analogy, or example/i);
  });

  it('forbids filler closings in the copy', () => {
    expect(SKILL).toMatch(/generic uplift, recap, or chatbot send-off/i);
  });

  it('names reject-slop.mjs as the audit and rejects the closer fixture', () => {
    const closer = path.join(FIXTURE_DIR, 'bad-closer.md');
    const closerText = fs.readFileSync(closer, 'utf8');
    expect(closerText).toMatch(/In conclusion/);
    expect(closerText).toMatch(/Overall/);
    expect(closerText).toMatch(/the future looks bright/);
    expect(REJECT_SRC.length).toBeGreaterThan(200);
    expect(REJECT_SRC).toMatch(/In conclusion/);
    expect(REJECT_SRC).toMatch(/the future looks bright/);
    expect(REJECT_SRC).toMatch(/process\.exit\(1\)/);
    expect(reject(closer).status).toBe(1);
    expect(
      reject(path.join(FIXTURE_DIR, 'clean-deploy-note.md')).status,
    ).toBe(0);
    expect(SKILL).toMatch(/skills\/vs-write\/scripts\/reject-slop\.mjs/);
    expect(SKILL).toMatch(/end the artifact on the last concrete fact/i);
    expect(SKILL).not.toMatch(/self-audit/i);
    expect(SKILL).not.toMatch(
      /a draft that matches test\/fixtures\/bad-closer\.md fails the audit/i,
    );
    expect(SKILL).not.toMatch(/In conclusion/);
    expect(SKILL).not.toMatch(/Overall/);
    expect(SKILL).not.toMatch(/the future looks bright/);
  });

  it('pairs the audit with preserve meaning and match tone', () => {
    expect(SKILL).toMatch(/preserve meaning and match the intended tone/i);
  });

  it('reject-slop fails structural-no-chain and keeps the canary out of SKILL', () => {
    const fixture = path.join(FIXTURE_DIR, 'structural-no-chain.md');
    const body = fs.readFileSync(fixture, 'utf8');
    expect(body).toMatch(/No fluff, no filler, no jargon/);
    expect(body).toMatch(/NOXYCHAIN_CANARY_K7/);
    expect(reject(fixture).status).toBe(1);
    expect(reject(SKILL_PATH).status).toBe(0);
    expect(SKILL).not.toMatch(/NOXYCHAIN_CANARY_K7/);
    expect(SKILL).not.toMatch(/No fluff, no filler, no jargon/);
  });

  it('reject-slop fails structural-dont-verb-it and keeps the canary out of SKILL', () => {
    const fixture = path.join(FIXTURE_DIR, 'structural-dont-verb-it.md');
    const body = fs.readFileSync(fixture, 'utf8');
    expect(body).toMatch(/Don't call it a rewrite\. Call it a rescue/);
    expect(body).toMatch(/DONTVERBIT_CANARY_K7/);
    expect(reject(fixture).status).toBe(1);
    expect(reject(SKILL_PATH).status).toBe(0);
    expect(SKILL).not.toMatch(/DONTVERBIT_CANARY_K7/);
    expect(SKILL).not.toMatch(/Don't call it a rewrite/);
  });

  it('reject-slop fails structural-sit-with and keeps the canary out of SKILL', () => {
    const fixture = path.join(FIXTURE_DIR, 'structural-sit-with.md');
    const body = fs.readFileSync(fixture, 'utf8');
    expect(body).toMatch(/Sit with that for a moment/);
    expect(body).toMatch(/SITWITH_CANARY_K7/);
    expect(reject(fixture).status).toBe(1);
    expect(reject(SKILL_PATH).status).toBe(0);
    expect(SKILL).not.toMatch(/SITWITH_CANARY_K7/);
  });

  it('reject-slop fails structural-whole-point and keeps the canary out of SKILL', () => {
    const fixture = path.join(FIXTURE_DIR, 'structural-whole-point.md');
    const body = fs.readFileSync(fixture, 'utf8');
    expect(body).toMatch(/That's the whole point/);
    expect(body).toMatch(/WHOLEPOINT_CANARY_K7/);
    expect(reject(fixture).status).toBe(1);
    expect(reject(SKILL_PATH).status).toBe(0);
    expect(SKILL).not.toMatch(/WHOLEPOINT_CANARY_K7/);
    expect(SKILL).not.toMatch(/That's the whole point/);
  });

  it('reject-slop fails structural-stacked-questions and keeps the canary out of SKILL', () => {
    const fixture = path.join(FIXTURE_DIR, 'structural-stacked-questions.md');
    const body = fs.readFileSync(fixture, 'utf8');
    expect(body).toMatch(/Do I know how it works\? Where it breaks\?/);
    expect(body).toMatch(/STACKQ_CANARY_K7/);
    expect(reject(fixture).status).toBe(1);
    expect(reject(SKILL_PATH).status).toBe(0);
    expect(SKILL).not.toMatch(/STACKQ_CANARY_K7/);
    expect(SKILL).not.toMatch(/Do I know how it works\? Where it breaks\?/);
  });

  it('reject-slop fails structural-echo-run and keeps the canary out of SKILL', () => {
    const fixture = path.join(FIXTURE_DIR, 'structural-echo-run.md');
    const body = fs.readFileSync(fixture, 'utf8');
    expect(body).toMatch(/A shopping cart is an object in the system\. A chat room is an object in the system\./);
    expect(body).toMatch(/ECHOSKEL_CANARY_K7/);
    expect(reject(fixture).status).toBe(1);
    expect(reject(SKILL_PATH).status).toBe(0);
    expect(SKILL).not.toMatch(/ECHOSKEL_CANARY_K7/);
    expect(SKILL).not.toMatch(/is an object in the system/);
  });

  it('reject-slop fails structural-colon-triple and keeps the canary out of SKILL', () => {
    const fixture = path.join(FIXTURE_DIR, 'structural-colon-triple.md');
    const body = fs.readFileSync(fixture, 'utf8');
    expect(body).toMatch(/three things: a blog post, a demo video, and a pricing page/);
    expect(body).toMatch(/COLONTRIP_CANARY_K7/);
    expect(reject(fixture).status).toBe(1);
    expect(reject(SKILL_PATH).status).toBe(0);
    expect(SKILL).not.toMatch(/COLONTRIP_CANARY_K7/);
    expect(SKILL).not.toMatch(/a blog post, a demo video, and a pricing page/);
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
    for (const fixture of SLOP_FIXTURES) {
      expect(fs.existsSync(path.join(FIXTURE_DIR, fixture))).toBe(true);
    }
  });

  it('holds a held-out slice back from iteration', () => {
    const heldOut = CASES.filter((caseSpec) => caseSpec.slice === 'held-out');
    expect(heldOut).toHaveLength(2);
  });
});
