import * as fs from 'node:fs';
import * as path from 'node:path';
import { describe, expect, it } from 'vitest';

const SKILL = fs.readFileSync(path.resolve(__dirname, '..', 'SKILL.md'), 'utf8');

describe('pushback: advisor, not interrogator', () => {
  it('makes the finding the unit of work', () => {
    expect(SKILL).toMatch(/the unit of work is a \*\*finding\*\*, not a question/i);
    expect(SKILL).toMatch(/they do not\s+supply the analysis that produces them/i);
  });

  it('names interrogation and sycophancy as the two failure modes', () => {
    expect(SKILL).toMatch(/\*\*Interrogation\*\*/);
    expect(SKILL).toMatch(/\*\*Sycophancy\*\*/);
    expect(SKILL).toMatch(/it is the more common failure/i);
  });

  it('draws the facts-versus-decisions line before any question', () => {
    expect(SKILL).toMatch(/## Facts are yours, decisions are theirs/);
    expect(SKILL).toMatch(/\*\*Facts are yours\.\*\*/);
    expect(SKILL).toMatch(/\*\*Decisions are theirs\.\*\*/);
    expect(SKILL).toMatch(
      /a question that a `grep`, a benchmark,\s+or a search would have answered is a defect in the review/i,
    );
  });

  it('owns mechanics rather than putting them to the user', () => {
    expect(SKILL).toMatch(/mechanics are yours too/i);
    expect(SKILL).toMatch(/choose, state\s+the choice, move on/i);
  });

  it('converts unresolvable uncertainty into a decisive fact plus cheapest experiment', () => {
    expect(SKILL).toMatch(/do not hand the\s+uncertainty back as a question/i);
    expect(SKILL).toMatch(/cheapest\s+experiment that would settle it/i);
    expect(SKILL).toMatch(/## Decisive Question/);
  });

  it('pushes the review to measure contested claims', () => {
    expect(SKILL).toMatch(/the strongest reviews compute something/i);
    expect(SKILL).toMatch(/a number the\s+user did not have before is worth more than any question/i);
  });
});

describe('pushback: confidence gating', () => {
  it('uses behavioral anchors rather than continuous confidence', () => {
    expect(SKILL).toMatch(/## Confidence/);
    expect(SKILL).toMatch(/do not\s+invent values between them/i);
    for (const anchor of ['0', '25', '50', '75', '100']) {
      expect(SKILL).toMatch(new RegExp(`\\*\\*${anchor}\\*\\* —`));
    }
  });

  it('drops low confidence, surfaces 50 as non-blocking FYI, actions 75+', () => {
    expect(SKILL).toMatch(/\*\*0-25:\*\* drop it silently/i);
    expect(SKILL).toMatch(/\*\*50:\*\* surface as FYI/i);
    expect(SKILL).toMatch(/it forces no decision and does not\s+block the verdict/i);
    expect(SKILL).toMatch(/\*\*75-100:\*\* actionable/i);
  });

  it('protects premise findings from a proof bar they can never meet', () => {
    expect(SKILL).toMatch(/premise and strategy findings have a natural ceiling/i);
    expect(SKILL).toMatch(/do\s+not filter them out for lacking proof they could never have/i);
  });

  it('keeps confidence independent of severity', () => {
    expect(SKILL).toMatch(/confidence and severity are independent/i);
  });

  it('only lets confident findings move the score', () => {
    expect(SKILL).toMatch(/adjustments, applied only to findings at 75-100 confidence/i);
    expect(SKILL).toMatch(/FYI findings at 50 do not move the score/i);
  });
});

describe('pushback: anti-noise and anti-sycophancy', () => {
  it('carries a false-positive catalog', () => {
    expect(SKILL).toMatch(/## What not to raise/);
    expect(SKILL).toMatch(/nitpicks a senior engineer would not bother mentioning/i);
    expect(SKILL).toMatch(/a linter, typechecker, compiler, or test run would catch/i);
    expect(SKILL).toMatch(/objections invented to fill a dimension/i);
    expect(SKILL).toMatch(/never fabricate a counter-argument/i);
  });

  it('demands specific failure modes over generic risk recitals', () => {
    expect(SKILL).toMatch(/X breaks when\s+concurrency exceeds Y/);
    expect(SKILL).toMatch(/base rates beat plot twists/i);
  });

  it('steelmans the plan before attacking it', () => {
    expect(SKILL).toMatch(/### 2\. Steelman/);
    expect(SKILL).toMatch(/not flattery/i);
    expect(SKILL).toMatch(/stronger than every objection you have, that is the finding/i);
  });

  it('refuses to let the author grade their own plan', () => {
    expect(SKILL).toMatch(/the author's rationale is a claim, not evidence/i);
    expect(SKILL).toMatch(/only\s+new evidence does/i);
    expect(SKILL).toMatch(/a finding is retired by evidence or it is not retired at all/i);
  });

  it('allows a clean pass instead of manufacturing a grill', () => {
    expect(SKILL).toMatch(/a plan that survives is allowed to pass/i);
    expect(SKILL).toMatch(/## What holds up/);
    expect(SKILL).toMatch(/gap check/i);
  });
});

describe('pushback: questions must earn their place', () => {
  it('treats zero questions as a normal outcome', () => {
    expect(SKILL).toMatch(/### 4\. Ask only what is left/);
    expect(SKILL).toMatch(/a typical review earns zero to\s+three; zero is a normal, good outcome/i);
  });

  it('bans the accept/defend/modify/skip ballot', () => {
    expect(SKILL).toMatch(/never offer "defend the current plan" or "skip" as options/i);
    expect(SKILL).toMatch(/putting it on the ballot invites self-grading/i);
    expect(SKILL).toMatch(/options are competing\s+designs, scopes, or tradeoffs/i);
    expect(SKILL).not.toMatch(/B\) Defend current plan/);
  });

  it('keeps a recommendation on every surviving question', () => {
    expect(SKILL).toMatch(/Recommendation: A — <why>/);
  });
});

describe('pushback: integrity of the record', () => {
  it('bans fabricated rounds and invented user decisions', () => {
    expect(SKILL).toMatch(/never simulate the exchange/i);
    expect(SKILL).toMatch(/never answer your own round/i);
    expect(SKILL).toMatch(/never record a\s+`User Decision` the user did not actually make/i);
    expect(SKILL).toMatch(/attributes invented decisions to the user is worse than no report/i);
  });

  it('requires naming what retired a finding', () => {
    expect(SKILL).toMatch(/retiring a finding requires naming what retired it/i);
    expect(SKILL).toMatch(/never a bare `resolved`/i);
  });

  it('scores the plan rather than the conversation', () => {
    expect(SKILL).toMatch(/score the plan as it now stands, not the conversation/i);
    expect(SKILL).toMatch(/an\s+engaged user is not evidence/i);
    expect(SKILL).toMatch(/belongs below 60 no matter how responsive its author was/i);
  });
});
