import * as fs from 'fs';
import * as path from 'path';
import { describe, expect, it } from 'vitest';

const ROOT = path.resolve(__dirname, '..', '..', '..');
const SKILL_PATH = path.join(
  ROOT,
  'skills',
  'vs-before-after',
  'SKILL.md',
);
const SKILL = fs.readFileSync(SKILL_PATH, 'utf8');
const PLUGIN = fs.readFileSync(
  path.join(ROOT, '.claude-plugin', 'plugin.json'),
  'utf8',
);

describe('vs-before-after contract', () => {
  it('translates an exact code diff into observable behavior', () => {
    expect(SKILL).toMatch(/name:\s*vs-before-after/);
    expect(SKILL).toMatch(/functional|observable behavior/i);
    expect(SKILL).toMatch(/exact comparison boundary|base.*head/is);
    expect(SKILL).toMatch(/same actor.*input.*precondition/is);
    expect(SKILL).toMatch(/read.*affected flow/is);
  });

  it('renders only the functional comparison and material qualification', () => {
    expect(SKILL).toMatch(/## Before & After/);
    expect(SKILL).toMatch(/\*\*Before\*\*/);
    expect(SKILL).toMatch(/\*\*After\*\*/);
    expect(SKILL).toMatch(/\*\*Impact\*\*/);
    expect(SKILL).toMatch(/\*\*Unchanged\*\*/);
    expect(SKILL).toMatch(/\*\*Evidence\*\*/);
    expect(SKILL).toMatch(/proof gap/i);
  });

  it('does not confuse implementation churn with functional change', () => {
    expect(SKILL).toMatch(/NO_FUNCTIONAL_CHANGE/);
    expect(SKILL).toMatch(/refactor|generated|lockfile/i);
    expect(SKILL).toMatch(/breaking/i);
    expect(SKILL).toMatch(/source-derived.*observed|observed.*source-derived/is);
    expect(SKILL).toMatch(/no file inventory|do not.*file inventory/i);
    expect(SKILL).toMatch(/no code walkthrough|do not.*code walkthrough/i);
  });

  it('replaces vs-brief instead of registering both skills', () => {
    expect(PLUGIN).toContain('./skills/vs-before-after');
    expect(PLUGIN).not.toContain('./skills/vs-brief');
    expect(
      fs.existsSync(path.join(ROOT, 'skills', 'vs-brief', 'SKILL.md')),
    ).toBe(false);
  });
});
