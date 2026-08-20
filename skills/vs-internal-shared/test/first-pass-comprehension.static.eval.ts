import * as fs from 'fs';
import * as path from 'path';
import { describe, expect, it } from 'vitest';

const SKILLS_DIR = path.resolve(__dirname, '..', '..');
const OUTPUT_STYLE = fs.readFileSync(
  path.resolve(__dirname, '..', 'references', 'output-style.md'),
  'utf8',
);
const COMMUNICATION = fs.readFileSync(
  path.resolve(__dirname, '..', 'references', 'communication.md'),
  'utf8',
);
const SHAPE_IT = fs.readFileSync(
  path.join(SKILLS_DIR, 'vs-shape-it', 'SKILL.md'),
  'utf8',
);
const BUILD_IT = fs.readFileSync(
  path.join(SKILLS_DIR, 'vs-build-it', 'SKILL.md'),
  'utf8',
);
const BUILD_HANDOFF = fs.readFileSync(
  path.join(SKILLS_DIR, 'vs-build-it', 'references', 'handoff.md'),
  'utf8',
);
const SHIP_IT = fs.readFileSync(
  path.join(SKILLS_DIR, 'vs-ship-it', 'SKILL.md'),
  'utf8',
);

describe('first-pass comprehension contract', () => {
  it('applies the vs-tldr repair principles before the first response', () => {
    expect(OUTPUT_STYLE).toMatch(/as if `\/vs-tldr` had already repaired it/i);
    expect(OUTPUT_STYLE).toMatch(/missing premise/i);
    expect(OUTPUT_STYLE).toMatch(/project nouns/i);
    expect(OUTPUT_STYLE).toMatch(/define.*acronym|acronym.*define/i);
    expect(OUTPUT_STYLE).toMatch(/decision,\s+caveat,\s+and action/i);
    expect(OUTPUT_STYLE).toMatch(/translate[\s\S]*workflow status|workflow status[\s\S]*translate/i);
    expect(OUTPUT_STYLE).toMatch(/When the workflow produced an artifact/i);
    expect(OUTPUT_STYLE).toMatch(/Otherwise keep the essential evidence/i);
    expect(COMMUNICATION).toMatch(/first working slice is committed/i);
    expect(COMMUNICATION).not.toMatch(/guardrails green/i);
  });

  it('makes shape-it questions and approval easy to answer', () => {
    expect(SHAPE_IT).toMatch(/state the decision in everyday language/i);
    expect(SHAPE_IT).toMatch(/what changes for the user/i);
    expect(SHAPE_IT).toMatch(/one approval request/i);
    expect(SHAPE_IT).toMatch(/first sentence.*recommendation/i);
    expect(SHAPE_IT).toMatch(/`Your action`/);
  });

  it('preserves the sharpest supported risk explanation', () => {
    expect(SHAPE_IT).toMatch(/sharpest supported reason/i);
    expect(SHAPE_IT).toMatch(/cause and user consequence/i);
    expect(SHAPE_IT).toMatch(/generic risk label is not enough/i);
  });

  it('keeps build-it audit detail out of the chat handoff', () => {
    expect(BUILD_IT).toMatch(/plain-language outcome/i);
    expect(BUILD_IT).toMatch(/machine audit[\s\S]*sidecar/i);
    expect(BUILD_HANDOFF).toMatch(/first line\s+is\s+the plain-language outcome/i);
    expect(BUILD_HANDOFF).toMatch(/machine audit[\s\S]*sidecar/i);
    expect(BUILD_HANDOFF).toMatch(/visual report[\s\S]*problem[\s\S]*before.*after/is);
    expect(BUILD_HANDOFF).not.toMatch(/full audit ledger lives in the report/i);
    expect(BUILD_HANDOFF).not.toMatch(/MUST include every section/i);
    expect(BUILD_HANDOFF).not.toContain('## Build It Complete');
    expect(BUILD_HANDOFF).toMatch(/report\s+link is required\s+only when this run owed a report/i);
  });

  it('preserves the exact missing observation when proof is blocked', () => {
    expect(BUILD_HANDOFF).toMatch(/exact observation that did not happen/i);
    expect(BUILD_HANDOFF).toMatch(/surface or environment\s+was unavailable is not enough/i);
  });

  it('keeps an explicit release gate when required evidence is missing', () => {
    expect(BUILD_HANDOFF).toMatch(/state the release gate explicitly/i);
    expect(BUILD_HANDOFF).toMatch(/do not ship, merge, or roll out until/i);
    expect(BUILD_HANDOFF).toMatch(/can move to shipping\s+is not an equivalent gate/i);
  });

  it('starts ship-it with what shipped instead of a workflow heading', () => {
    expect(SHIP_IT).toMatch(/first line.*what shipped/i);
    expect(SHIP_IT).toMatch(/translate[\s\S]*status/i);
    expect(SHIP_IT).not.toContain('## Handed back to you');
  });
});
