import * as fs from 'fs';
import * as path from 'path';
import { describe, expect, it } from 'vitest';

const SKILL_DIR = path.resolve(__dirname, '..');
const SKILL = fs.readFileSync(path.join(SKILL_DIR, 'SKILL.md'), 'utf8');

describe('prototype', () => {
  it('keeps the prototype question-first and throwaway', () => {
    expect(SKILL).toMatch(/state the question the prototype will answer/i);
    expect(SKILL).toMatch(/A prototype learns/i);
    expect(SKILL).toMatch(/No production hardening/i);
    expect(SKILL).toMatch(/Do not commit, branch, delete/i);
  });

  it('chooses the easiest trustworthy seam in an existing project', () => {
    expect(SKILL).toMatch(/time to a useful comparison/i);
    expect(SKILL).toMatch(/Wire into the app/);
    expect(SKILL).toMatch(/Build a lookalike/);
    expect(SKILL).toMatch(/Mock data is allowed in either path/);
    expect(SKILL).toMatch(/Prototype seam: existing app \| lookalike/);
    expect(SKILL).toMatch(/tactical decision for the agent/);
  });

  it('separates UI exploration from logic exploration', () => {
    expect(SKILL).toMatch(/UI:.*three structurally/is);
    expect(SKILL).toMatch(/Logic:.*interactive harness/is);
    expect(SKILL).toMatch(/\?variant=/);
    expect(SKILL).toMatch(/pure reducer/);
    expect(SKILL).toMatch(/state machine/);
  });

  it('preserves user review and repository safety', () => {
    expect(SKILL).toMatch(/Do not start a dev server unless the user explicitly\s+asks/i);
    expect(SKILL).toMatch(/Status: READY_FOR_REVIEW/);
    expect(SKILL).toMatch(/~\/\.vs\/\$PROJECT_ID\/prototypes/);
    expect(SKILL).toMatch(/human review, then `\/vs-shape-it` or `\/vs-build-it`/i);
  });
});
