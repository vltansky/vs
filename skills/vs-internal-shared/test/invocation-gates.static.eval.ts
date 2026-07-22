import * as fs from 'fs';
import * as path from 'path';
import { describe, expect, it } from 'vitest';

const SKILLS_DIR = path.resolve(__dirname, '..', '..');
const ADR = fs.readFileSync(
  path.resolve(__dirname, '..', '..', '..', 'adr', 'invocation-gates-do-not-degrade-workflows.md'),
  'utf8',
);
const BUILD_IT = fs.readFileSync(path.join(SKILLS_DIR, 'vs-build-it', 'SKILL.md'), 'utf8');
const BUGFIX = fs.readFileSync(path.join(SKILLS_DIR, 'vs-bugfix', 'SKILL.md'), 'utf8');

describe('gated skill composition', () => {
  it('keeps the stop contract grounded in the ADR', () => {
    expect(ADR).toMatch(/exact slash command to type and\s+stops/);
    expect(ADR).toMatch(/Improvising a manual replacement[^\n]+not\s+allowed/);
  });

  it('stops build-it when gated pushback cannot be resolved', () => {
    expect(BUILD_IT).toMatch(/cannot resolve[^.]+type\s+`\/vs-pushback`[^.]+stop/is);
    expect(BUILD_IT).not.toMatch(/cannot resolve[^.]+lightweight adversarial review/is);
  });

  it('stops bugfix when gated TDD or QA cannot be resolved', () => {
    expect(BUGFIX).toMatch(/vs-tdd[^\n]+Stop; tell the user to type `\/vs-tdd`/);
    expect(BUGFIX).toMatch(/vs-qa[^\n]+Stop; tell the user to type `\/vs-qa`/);
    expect(BUGFIX).not.toMatch(/vs-tdd[^\n]+Manual reproduction script/);
    expect(BUGFIX).not.toMatch(/vs-qa[^\n]+Skip browser verification/);
  });
});
