import * as fs from 'fs';
import * as path from 'path';
import { describe, expect, it } from 'vitest';

const SHARED_DIR = path.resolve(__dirname, '..');
const REFERENCES_DIR = path.join(SHARED_DIR, 'references');
const SHARED_SKILL = fs.readFileSync(path.join(SHARED_DIR, 'SKILL.md'), 'utf8');
const OUTPUT_STYLE = fs.readFileSync(
  path.join(REFERENCES_DIR, 'output-style.md'),
  'utf8',
);
const COMMUNICATION = fs.readFileSync(
  path.join(REFERENCES_DIR, 'communication.md'),
  'utf8',
);
const RICH_ARTIFACTS = fs.readFileSync(
  path.join(REFERENCES_DIR, 'rich-artifacts.md'),
  'utf8',
);
const SEARCH_THREADS = fs.readFileSync(
  path.resolve(SHARED_DIR, '..', 'vs-search-threads', 'SKILL.md'),
  'utf8',
);
const FIRST_ADOPTERS = ['vs-shape-it', 'vs-improve', 'vs-rfc-research', 'vs-build-it'].map(
  (skill) => ({
    skill,
    text: fs.readFileSync(
      path.resolve(SHARED_DIR, '..', skill, 'SKILL.md'),
      'utf8',
    ),
  }),
);

describe('two-layer explanation contract', () => {
  it('keeps chat as a TLDR and the artifact as the human review surface', () => {
    expect(OUTPUT_STYLE).toMatch(/chat TLDR/i);
    expect(OUTPUT_STYLE).toMatch(/must not duplicate.*artifact/is);
    expect(COMMUNICATION).not.toMatch(/final handoff shell.*exempt/is);
  });

  it('uses deterministic complexity signals instead of length alone', () => {
    expect(RICH_ARTIFACTS).toMatch(/three or more.*components|components.*three or more/is);
    expect(RICH_ARTIFACTS).toMatch(/comparison.*choices.*criteria/is);
    expect(RICH_ARTIFACTS).toMatch(/one short screen/i);
    expect(RICH_ARTIFACTS).toMatch(/poor editing.*shorten/i);
  });

  it('chooses the smallest trustworthy visual', () => {
    expect(RICH_ARTIFACTS).toMatch(/Mermaid.*flow/is);
    expect(RICH_ARTIFACTS).toMatch(/Mermaid.*chat or Markdown/is);
    expect(RICH_ARTIFACTS).toMatch(/HTMDX.*inline SVG/is);
    expect(RICH_ARTIFACTS).toMatch(/screenshots?.*visible.*behavior/is);
    expect(RICH_ARTIFACTS).toMatch(/generated images?.*mental model/is);
    expect(RICH_ARTIFACTS).toMatch(/never.*technical evidence/is);
  });

  it('checks understanding without adding approval ceremony', () => {
    expect(OUTPUT_STYLE).toMatch(/understanding or\s+decision question/i);
    expect(OUTPUT_STYLE).toMatch(/changes what happens next/i);
    expect(OUTPUT_STYLE).toMatch(/Do not ask\s+for ceremonial approval/i);
  });

  it('makes the shared contract discoverable and upgrades complex thread reports', () => {
    expect(SHARED_SKILL).toContain('references/explanation-surfaces.md');
    expect(SEARCH_THREADS).toMatch(/complex single.thread.*HTMDX/is);
    expect(SEARCH_THREADS).toMatch(/short single.thread.*Markdown/is);
  });

  it('routes the first adopter workflows through the shared contract', () => {
    for (const { skill, text } of FIRST_ADOPTERS) {
      expect(text, skill).toContain(
        'vs-internal-shared/references/explanation-surfaces.md',
      );
    }
  });
});
