import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const SKILL = fs.readFileSync(path.resolve(__dirname, '..', 'SKILL.md'), 'utf8');

describe('pushback: small evidence-first core', () => {
  it('keeps the main skill concise enough to guide behavior', () => {
    expect(SKILL.split('\n').length).toBeLessThanOrEqual(220);
    expect(SKILL.split(/\s+/).length).toBeLessThanOrEqual(1800);
  });

  it('stays read-only and makes findings, not interrogation, the default', () => {
    expect(SKILL).toMatch(/Do not implement/i);
    expect(SKILL).toMatch(/findings first/i);
    expect(SKILL).toMatch(/facts are the reviewer'?s job/i);
    expect(SKILL).toMatch(/decisions are the user'?s/i);
  });

  it('uses simple evidence states instead of numeric confidence theater', () => {
    expect(SKILL).toMatch(/VERIFIED.*INFERENCE.*UNRESOLVED/is);
    expect(SKILL).not.toMatch(/\*\*(?:0|25|50|75|100)\*\*/);
    expect(SKILL).toMatch(/READY \| READY_WITH_RISKS \| NOT_READY/);
  });

  it('allows a clean plan to pass without manufactured objections', () => {
    expect(SKILL).toMatch(/A plan that survives is allowed to pass/i);
    expect(SKILL).toMatch(/do not invent findings/i);
    expect(SKILL).toMatch(/specific failure mode/i);
  });
});

describe('pushback: Ponytail is part of the review', () => {
  it('loads Ponytail and always tests the smaller complete alternative', () => {
    expect(SKILL).toMatch(/vs-ponytail\/SKILL\.md/);
    expect(SKILL).toMatch(/smaller complete alternative/i);
    expect(SKILL).toMatch(/machinery/i);
    expect(SKILL).toMatch(/requirements, safety, evidence, or\s+verification/i);
  });

  it('returns the Ponytail result without a second ceremony', () => {
    expect(SKILL).toMatch(/Smaller complete alternative:/);
    expect(SKILL).not.toMatch(/Ponytail decision:/);
  });
});

describe('pushback: targeted user questions', () => {
  it('asks only questions whose answers could change the review', () => {
    expect(SKILL).toMatch(/an answer could change a finding, recommendation, scope, or\s+verdict/i);
    expect(SKILL).toMatch(/ask up to 3 focused/i);
    expect(SKILL).toMatch(/zero questions is valid/i);
  });

  it('uses audience, edge-case, scope, and tradeoff probes', () => {
    expect(SKILL).toMatch(/Is .* really the intended audience/i);
    expect(SKILL).toMatch(/Is .* edge case actually relevant/i);
    expect(SKILL).toMatch(/scope/i);
    expect(SKILL).toMatch(/tradeoff/i);
  });

  it('does the factual work and gives the user a recommendation', () => {
    expect(SKILL).toMatch(/Do not ask the user to discover repository facts/i);
    expect(SKILL).toMatch(/Recommendation:/);
    expect(SKILL).toMatch(/Impact:/);
    expect(SKILL).toMatch(/request_user_input/);
  });

  it('never fabricates answers in composed or non-interactive mode', () => {
    expect(SKILL).toMatch(/never answer on the user'?s behalf/i);
    expect(SKILL).toMatch(/record the decision as\s+unresolved/i);
  });
});

describe('pushback: proportionate output', () => {
  it('has only quick and deep review depth', () => {
    expect(SKILL).toMatch(/Quick review/);
    expect(SKILL).toMatch(/Deep review/);
    expect(SKILL).toMatch(/auth, security, data loss, migration, concurrency/i);
  });

  it('keeps reports, eli5, and extra advisors opt-in or risk-driven', () => {
    expect(SKILL).toMatch(/Do not create a report or eli5 artifact by default/i);
    expect(SKILL).toMatch(/user explicitly requests/i);
    expect(SKILL).toMatch(/independent advisor[\s\S]*deep\s+review/i);
  });

  it('returns one compact contract to direct and composed callers', () => {
    expect(SKILL).toMatch(/What holds up:/);
    expect(SKILL).toMatch(/Top pushback:/);
    expect(SKILL).toMatch(/Smaller complete alternative:/);
    expect(SKILL).toMatch(/Open decision:/);
    expect(SKILL).toMatch(/Composed mode/);
  });

  it('keeps pre-implementation review separate from implementation proof', () => {
    expect(SKILL).toMatch(/Passing tests alone does not prove/i);
    expect(SKILL).toMatch(/manual, deployment, or served-behavior gap/i);
  });
});
