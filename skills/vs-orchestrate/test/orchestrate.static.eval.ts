import * as fs from 'fs';
import * as path from 'path';
import { describe, expect, it } from 'vitest';

const DIR = path.resolve(__dirname, '..');
const SKILL = fs.readFileSync(path.join(DIR, 'SKILL.md'), 'utf8');
const ROADMAP = fs.readFileSync(
  path.join(DIR, 'references', 'goals-roadmap.md'),
  'utf8',
);

describe('orchestrate: invariants encoded in the skill', () => {
  it('is a user-invoked-only workflow', () => {
    expect(SKILL).toMatch(/disable-model-invocation:\s*true/);
  });

  it('never implements — delegates milestones to build-it', () => {
    expect(SKILL).toMatch(/Do NOT implement/i);
    expect(SKILL).toMatch(/\/vs-build-it/);
  });

  it('owns a living GOALS.md separate from and cross-linked to the frozen spec', () => {
    expect(SKILL).toMatch(/GOALS\.md/);
    expect(SKILL).toMatch(/frozen spec|does not rewrite the spec|stays frozen/i);
    expect(SKILL).toMatch(/cross-link/i);
    expect(SKILL).toMatch(/owned only[\s\S]{0,12}orchestrate|its only writer|sole writer/i);
  });

  it('keeps exactly one milestone active at a time', () => {
    expect(SKILL).toMatch(/one milestone.*active|exactly one milestone/i);
  });

  it('gates each milestone with audit + review + verify before the next activates', () => {
    expect(SKILL).toMatch(/audit/i);
    expect(SKILL).toMatch(/\/vs-roast-review/);
    expect(SKILL).toMatch(/\/vs-verify/);
    expect(SKILL).toMatch(/before activating the next milestone/i);
  });

  it('never marks a milestone done without its required evidence', () => {
    expect(SKILL).toMatch(/evidence.required|required evidence|its evidence/i);
    expect(SKILL).toMatch(/inherit the verify status|never mark a milestone done/i);
  });

  it('distinguishes within-milestone lanes from across-milestone state', () => {
    expect(SKILL).toMatch(/\*?within\*? a milestone/i);
    expect(SKILL).toMatch(/across\*? milestones/i);
  });

  it('reports on change, not per tick, and documents a Codex/Claude degrade', () => {
    expect(SKILL).toMatch(/what.?s done/i);
    expect(SKILL).toMatch(/blockers/i);
    expect(SKILL).toMatch(/without native goals|Claude Code/i);
  });

  it('has a sharp use-when boundary against build-it, baby-sit, and shape-it', () => {
    expect(SKILL).toMatch(/multi-milestone|several milestones/i);
    expect(SKILL).toMatch(/single-session|single PR|does not need a coordinator/i);
  });
});

describe('orchestrate: GOALS.md roadmap reference', () => {
  it('defines the milestone schema fields', () => {
    for (const field of [
      /Outcome/i,
      /In scope/i,
      /Decisions/i,
      /Blockers/i,
      /Evidence required/i,
    ]) {
      expect(ROADMAP).toMatch(field);
    }
  });

  it('marks one active milestone and moves it on completion', () => {
    expect(ROADMAP).toMatch(/\[active\]/);
    expect(ROADMAP).toMatch(/\[complete\]/);
    expect(ROADMAP).toMatch(/exactly one milestone.*active/i);
  });

  it('keeps the dashboard optional and proportional', () => {
    expect(ROADMAP).toMatch(/optional/i);
    expect(ROADMAP).toMatch(/Skip it/i);
  });

  it('uses HTMDX only for a dashboard whose visual structure helps orientation', () => {
    expect(ROADMAP).toMatch(/HTMDX/);
    expect(ROADMAP).toMatch(/visual\s+structure/i);
    expect(ROADMAP).toMatch(/GOALS\.md.*source of truth/is);
    expect(ROADMAP).toMatch(/single.*\.html/is);
  });
});
