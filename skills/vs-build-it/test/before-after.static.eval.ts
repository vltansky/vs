import * as fs from 'fs';
import * as path from 'path';
import { describe, expect, it } from 'vitest';

const BUILD_IT = fs.readFileSync(path.resolve(__dirname, '..', 'SKILL.md'), 'utf8');
const HANDOFF = fs.readFileSync(
  path.resolve(__dirname, '..', 'references', 'handoff.md'),
  'utf8',
);
const BRIEF = fs.readFileSync(
  path.resolve(__dirname, '..', '..', 'vs-brief', 'SKILL.md'),
  'utf8',
);

describe('build-it before and after evidence', () => {
  it('captures comparable evidence around user-visible changes', () => {
    expect(BUILD_IT).toMatch(/capture the baseline before implementation/is);
    expect(BUILD_IT).toMatch(
      /same\s+route, state,\s+viewport, and fixture/is,
    );
    expect(BUILD_IT).toMatch(/same command and representative input/is);
    expect(BUILD_IT).toMatch(
      /do not reconstruct the before state after editing/i,
    );
    expect(BUILD_IT).toMatch(/temporary directory outside the repository/is);
  });

  it('uses images for UI and exact output for text surfaces', () => {
    expect(BRIEF).toMatch(/UI comparison.*two images/is);
    expect(BRIEF).toMatch(/Text comparison.*exact before and after output/is);
    expect(BRIEF).toMatch(/### Before & after/);
    expect(BRIEF).toMatch(/!\[Before/);
    expect(BRIEF).toMatch(/```text/);
  });

  it('loads brief for relevant comparisons regardless of diff size', () => {
    expect(HANDOFF).toMatch(/meaningful before-and-after evidence/is);
    expect(HANDOFF).toMatch(/even when the diff\s+is small/is);
    expect(BUILD_IT).toMatch(/No meaningful comparison/is);
    expect(BUILD_IT).toMatch(
      /same capture mechanism.*`vs-qa` is\s+unavailable/is,
    );
    expect(BRIEF).toMatch(
      /comparison evidence overrides the trivial-diff skip/is,
    );
  });

  it('uses Mermaid only when relationships materially improve orientation', () => {
    expect(BRIEF).toMatch(/### How it fits together/);
    expect(BRIEF).toMatch(/```mermaid/);
    expect(BRIEF).toMatch(/three or more\s+interacting components/is);
    expect(BRIEF).toMatch(/Omit it for a simple file list/i);
  });
});
