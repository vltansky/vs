import * as fs from 'fs';
import * as path from 'path';
import { describe, expect, it } from 'vitest';

const BUILD_IT = fs.readFileSync(path.resolve(__dirname, '..', 'SKILL.md'), 'utf8');
const HANDOFF = fs.readFileSync(
  path.resolve(__dirname, '..', 'references', 'handoff.md'),
  'utf8',
);
const BEFORE_AFTER = fs.readFileSync(
  path.resolve(__dirname, '..', '..', 'vs-before-after', 'SKILL.md'),
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

  it('turns captured evidence into a functional comparison', () => {
    expect(BEFORE_AFTER).toMatch(/same actor.*input.*precondition/is);
    expect(BEFORE_AFTER).toMatch(/\*\*Before\*\*/);
    expect(BEFORE_AFTER).toMatch(/\*\*After\*\*/);
    expect(BEFORE_AFTER).toMatch(/\*\*Impact\*\*/);
    expect(BEFORE_AFTER).toMatch(/Observed|Tested/);
  });

  it('loads before-after for relevant comparisons regardless of diff size', () => {
    expect(HANDOFF).toMatch(/meaningful before-and-after evidence/is);
    expect(HANDOFF).toMatch(/even when the diff\s+is small/is);
    expect(BUILD_IT).toMatch(/No meaningful comparison/is);
    expect(BUILD_IT).toMatch(
      /same capture mechanism.*`vs-qa` is\s+unavailable/is,
    );
    expect(BEFORE_AFTER).toMatch(/NO_FUNCTIONAL_CHANGE/);
  });

  it('keeps implementation-oriented material out of the comparison', () => {
    expect(BEFORE_AFTER).toMatch(/Do not add a file inventory/i);
    expect(BEFORE_AFTER).toMatch(/code walkthrough/i);
    expect(BEFORE_AFTER).toMatch(/architecture diagram/i);
  });
});
