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
    expect(
      reject(path.join(FIXTURE_DIR, 'task-6-release-announcement.md')).status,
    ).toBe(0);
    expect(
      reject(path.join(FIXTURE_DIR, 'ordinary-ops-note.md')).status,
    ).toBe(0);
    expect(
      reject(path.join(FIXTURE_DIR, 'ordinary-verify-replica.md')).status,
    ).toBe(0);
    expect(
      reject(path.join(FIXTURE_DIR, 'ordinary-ensure-redis.md')).status,
    ).toBe(0);
    expect(
      reject(path.join(FIXTURE_DIR, 'ordinary-confirm-replica.md')).status,
    ).toBe(0);
    expect(
      reject(path.join(FIXTURE_DIR, 'ordinary-please-verify.md')).status,
    ).toBe(0);
    expect(fs.readFileSync(path.join(FIXTURE_DIR, 'ordinary-verify-replica.md'), 'utf8')).toContain(
      'Verify the redis replica is up. Verify the redis replica is up. Verify the redis replica is up.',
    );
    expect(fs.readFileSync(path.join(FIXTURE_DIR, 'ordinary-ensure-redis.md'), 'utf8')).toContain(
      'Ensure redis is up. Ensure redis is up. Ensure redis is up.',
    );
    expect(fs.readFileSync(path.join(FIXTURE_DIR, 'ordinary-confirm-replica.md'), 'utf8')).toContain(
      'Confirm the redis replica is healthy. Confirm the redis replica is healthy. Confirm the redis replica is healthy.',
    );
    expect(fs.readFileSync(path.join(FIXTURE_DIR, 'ordinary-please-verify.md'), 'utf8')).toContain(
      'Please verify redis. Please verify redis. Please verify redis.',
    );
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

  it('reject-slop fails structural-did-not-chain and keeps the canary out of SKILL', () => {
    const fixture = path.join(FIXTURE_DIR, 'structural-did-not-chain.md');
    const body = fs.readFileSync(fixture, 'utf8');
    expect(body).toMatch(/Did not flinch, did not blink/);
    expect(body).toMatch(/DIDNOTCHAIN_CANARY_K7/);
    expect(reject(fixture).status).toBe(1);
    expect(reject(SKILL_PATH).status).toBe(0);
    expect(SKILL).not.toMatch(/DIDNOTCHAIN_CANARY_K7/);
    expect(SKILL).not.toMatch(/Did not flinch, did not blink/);
  });

  it('reject-slop fails structural-already-know and keeps the canary out of SKILL', () => {
    const fixture = path.join(FIXTURE_DIR, 'structural-already-know.md');
    const body = fs.readFileSync(fixture, 'utf8');
    expect(body).toMatch(/You already know the answer/);
    expect(body).toMatch(/ALREADYKNOW_CANARY_K7/);
    expect(reject(fixture).status).toBe(1);
    expect(reject(SKILL_PATH).status).toBe(0);
    expect(SKILL).not.toMatch(/ALREADYKNOW_CANARY_K7/);
    expect(SKILL).not.toMatch(/You already know the answer/);
  });


  it('reject-slop fails structural-punchline and keeps the canary out of SKILL', () => {
    const fixture = path.join(FIXTURE_DIR, 'structural-punchline.md');
    const body = fs.readFileSync(fixture, 'utf8');
    expect(body).toMatch(/The punchline is that nobody laughed/);
    expect(body).toMatch(/PUNCHLINE_CANARY_K7/);
    expect(reject(fixture).status).toBe(1);
    expect(reject(SKILL_PATH).status).toBe(0);
    expect(SKILL).not.toMatch(/PUNCHLINE_CANARY_K7/);
    expect(SKILL).not.toMatch(/The punchline is that nobody laughed/);
  });


  it('reject-slop fails structural-heres-the-twist and keeps the canary out of SKILL', () => {
    const fixture = path.join(FIXTURE_DIR, 'structural-heres-the-twist.md');
    const body = fs.readFileSync(fixture, 'utf8');
    expect(body).toMatch(/Here's the twist: nobody clicked it/);
    expect(body).toMatch(/HERESTWIST_CANARY_K7/);
    expect(reject(fixture).status).toBe(1);
    expect(reject(SKILL_PATH).status).toBe(0);
    expect(SKILL).not.toMatch(/HERESTWIST_CANARY_K7/);
    expect(SKILL).not.toMatch(/Here's the twist: nobody clicked it/);
  });


  it('reject-slop fails structural-not-nothing and keeps the canary out of SKILL', () => {
    const fixture = path.join(FIXTURE_DIR, 'structural-not-nothing.md');
    const body = fs.readFileSync(fixture, 'utf8');
    expect(body).toMatch(/That's not nothing/);
    expect(body).toMatch(/NOTNOTHING_CANARY_K7/);
    expect(reject(fixture).status).toBe(1);
    expect(reject(SKILL_PATH).status).toBe(0);
    expect(SKILL).not.toMatch(/NOTNOTHING_CANARY_K7/);
    expect(SKILL).not.toMatch(/That's not nothing/);
  });


  it('reject-slop fails structural-worth-naming and keeps the canary out of SKILL', () => {
    const fixture = path.join(FIXTURE_DIR, 'structural-worth-naming.md');
    const body = fs.readFileSync(fixture, 'utf8');
    expect(body).toMatch(/It's worth naming that this hurts/);
    expect(body).toMatch(/WORTHNAMING_CANARY_K7/);
    expect(reject(fixture).status).toBe(1);
    expect(reject(SKILL_PATH).status).toBe(0);
    expect(SKILL).not.toMatch(/WORTHNAMING_CANARY_K7/);
    expect(SKILL).not.toMatch(/It's worth naming that this hurts/);
  });


  it('reject-slop fails structural-performative-honesty and keeps the canary out of SKILL', () => {
    const fixture = path.join(FIXTURE_DIR, 'structural-performative-honesty.md');
    const body = fs.readFileSync(fixture, 'utf8');
    expect(body).toMatch(/I won't pretend the rollout was smooth/);
    expect(body).toMatch(/PERFHONEST_CANARY_K7/);
    expect(reject(fixture).status).toBe(1);
    expect(reject(SKILL_PATH).status).toBe(0);
    expect(SKILL).not.toMatch(/PERFHONEST_CANARY_K7/);
    expect(SKILL).not.toMatch(/I won't pretend the rollout was smooth/);
  });


  it('reject-slop fails structural-take-my-word and keeps the canary out of SKILL', () => {
    const fixture = path.join(FIXTURE_DIR, 'structural-take-my-word.md');
    const body = fs.readFileSync(fixture, 'utf8');
    expect(body).toMatch(/Don't take my word for it/);
    expect(body).toMatch(/TAKEMYWORD_CANARY_K7/);
    expect(reject(fixture).status).toBe(1);
    expect(reject(SKILL_PATH).status).toBe(0);
    expect(SKILL).not.toMatch(/TAKEMYWORD_CANARY_K7/);
    expect(SKILL).not.toMatch(/Don't take my word for it/);
  });


  it('reject-slop fails structural-turns-out and keeps the canary out of SKILL', () => {
    const fixture = path.join(FIXTURE_DIR, 'structural-turns-out.md');
    const body = fs.readFileSync(fixture, 'utf8');
    expect(body).toMatch(/Turns out nobody tested it/);
    expect(body).toMatch(/TURNSOUT_CANARY_K7/);
    expect(reject(fixture).status).toBe(1);
    expect(reject(SKILL_PATH).status).toBe(0);
    expect(SKILL).not.toMatch(/TURNSOUT_CANARY_K7/);
    expect(SKILL).not.toMatch(/Turns out nobody tested it/);
  });


  it('reject-slop fails structural-sentence-anaphora and keeps the canary out of SKILL', () => {
    const fixture = path.join(FIXTURE_DIR, 'structural-sentence-anaphora.md');
    const body = fs.readFileSync(fixture, 'utf8');
    expect(body).toMatch(/Maybe nobody needed it\. Maybe the timing was off\. Maybe both\./);
    expect(body).toMatch(/ANAPHORA_CANARY_K7/);
    expect(reject(fixture).status).toBe(1);
    expect(reject(SKILL_PATH).status).toBe(0);
    expect(SKILL).not.toMatch(/ANAPHORA_CANARY_K7/);
    expect(SKILL).not.toMatch(/Maybe nobody needed it\. Maybe the timing was off\. Maybe both\./);
  });


  it('reject-slop fails structural-not-just and keeps the canary out of SKILL', () => {
    const fixture = path.join(FIXTURE_DIR, 'structural-not-just.md');
    const body = fs.readFileSync(fixture, 'utf8');
    expect(body).toMatch(/This is not just a tool, but a philosophy/);
    expect(body).toMatch(/NOTJUST_CANARY_K7/);
    expect(reject(fixture).status).toBe(1);
    expect(reject(SKILL_PATH).status).toBe(0);
    expect(SKILL).not.toMatch(/NOTJUST_CANARY_K7/);
    expect(SKILL).not.toMatch(/This is not just a tool, but a philosophy/);
  });


  it('reject-slop fails structural-ai-leftovers and keeps the canary out of SKILL', () => {
    const fixture = path.join(FIXTURE_DIR, 'structural-ai-leftovers.md');
    const body = fs.readFileSync(fixture, 'utf8');
    expect(body).toMatch(/As of my last update, the API was in beta/);
    expect(body).toMatch(/AILEFTOVER_CANARY_K7/);
    expect(reject(fixture).status).toBe(1);
    expect(reject(SKILL_PATH).status).toBe(0);
    expect(SKILL).not.toMatch(/AILEFTOVER_CANARY_K7/);
    expect(SKILL).not.toMatch(/As of my last update, the API was in beta/);
  });


  it('reject-slop fails structural-despite-challenges and keeps the canary out of SKILL', () => {
    const fixture = path.join(FIXTURE_DIR, 'structural-despite-challenges.md');
    const body = fs.readFileSync(fixture, 'utf8');
    expect(body).toMatch(/Despite these challenges, growth continued/);
    expect(body).toMatch(/DESPITECHAL_CANARY_K7/);
    expect(reject(fixture).status).toBe(1);
    expect(reject(SKILL_PATH).status).toBe(0);
    expect(SKILL).not.toMatch(/DESPITECHAL_CANARY_K7/);
    expect(SKILL).not.toMatch(/Despite these challenges, growth continued/);
  });


  it('reject-slop fails structural-participle-tail and keeps the canary out of SKILL', () => {
    const fixture = path.join(FIXTURE_DIR, 'structural-participle-tail.md');
    const body = fs.readFileSync(fixture, 'utf8');
    expect(body).toMatch(/Sales doubled, underscoring the strength of the brand/);
    expect(body).toMatch(/PARTICIPLE_CANARY_K7/);
    expect(reject(fixture).status).toBe(1);
    expect(reject(SKILL_PATH).status).toBe(0);
    expect(SKILL).not.toMatch(/PARTICIPLE_CANARY_K7/);
    expect(SKILL).not.toMatch(/Sales doubled, underscoring the strength of the brand/);
  });


  it('reject-slop fails structural-vague-experts and keeps the canary out of SKILL', () => {
    const fixture = path.join(FIXTURE_DIR, 'structural-vague-experts.md');
    const body = fs.readFileSync(fixture, 'utf8');
    expect(body).toMatch(/Experts argue that the policy failed/);
    expect(body).toMatch(/VAGUEEXPERT_CANARY_K7/);
    expect(reject(fixture).status).toBe(1);
    expect(reject(SKILL_PATH).status).toBe(0);
    expect(SKILL).not.toMatch(/VAGUEEXPERT_CANARY_K7/);
    expect(SKILL).not.toMatch(/Experts argue that the policy failed/);
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
