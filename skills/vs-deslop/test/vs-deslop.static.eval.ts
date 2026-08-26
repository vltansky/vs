import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { describe, expect, it } from 'vitest';

const DIR = path.resolve(__dirname, '..');
const SKILL_RAW = fs.readFileSync(path.join(DIR, 'SKILL.md'), 'utf8');
const SKILL = SKILL_RAW.replace(/\s+/g, ' ');
const REJECT = path.join(DIR, 'scripts', 'reject-code-slop.mjs');
const FIXTURE_DIR = path.join(__dirname, 'fixtures');
const SECOND_MISS = path.join(FIXTURE_DIR, 'second-miss-after-pass.ts');
const CLEAN = path.join(FIXTURE_DIR, 'clean-add.ts');
const COMMENT_ONLY = path.join(FIXTURE_DIR, 'comment-only-canary.ts');
const SECOND_MISS_SRC = fs.readFileSync(SECOND_MISS, 'utf8');
const COMMENT_ONLY_SRC = fs.readFileSync(COMMENT_ONLY, 'utf8');

function reject(file: string) {
  return spawnSync(process.execPath, [REJECT, file], { encoding: 'utf8' });
}

describe('vs-deslop: keep flatten as the first cleanup move', () => {
  it('fails leftover-after-flatten and passes a clean flat file', () => {
    expect(SECOND_MISS_SRC).not.toMatch(/Manager/);
    expect(SECOND_MISS_SRC).not.toMatch(/Factory/);
    expect(SECOND_MISS_SRC).not.toMatch(/\/\*\s*second-miss\s*\*\//);
    expect(SECOND_MISS_SRC).toMatch(/mode === true/);
    const leftover = reject(SECOND_MISS);
    expect(leftover.status).toBe(1);
    expect(leftover.stderr).toMatch(/boolean mode flag leftover/);
    expect(reject(CLEAN).status).toBe(0);
  });

  it('does not fail a comment-only canary', () => {
    expect(COMMENT_ONLY_SRC).toMatch(/\/\*\s*second-miss\s*\*\//);
    expect(COMMENT_ONLY_SRC).not.toMatch(/\bmode\s*(?::|===?)/);
    expect(reject(COMMENT_ONLY).status).toBe(0);
  });

  it('does not add poteto-mode, principle skills, or slogan names', () => {
    expect(SKILL).not.toMatch(/keep-it-flat/i);
    expect(SKILL).not.toMatch(/encode-via-lint/i);
    expect(SKILL).not.toMatch(/poteto-mode/i);
    expect(SKILL).not.toMatch(/principle-encode/i);
    expect(SKILL).not.toMatch(/SLOGAN_ONLY_DESLOP_CANARY/);
    expect(SKILL).not.toMatch(/\/\*\s*second-miss\s*\*\//);
  });
});

describe('vs-deslop: second miss fails the workspace scorer', () => {
  it('rejects leftover slop after one flatten pass on fixture content', () => {
    const leftover = reject(SECOND_MISS);
    expect(leftover.status).toBe(1);
    expect(leftover.stderr).toMatch(/boolean mode flag leftover/);
    expect(reject(CLEAN).status).toBe(0);
    expect(SKILL).toMatch(/skills\/vs-deslop\/scripts\/reject-code-slop\.mjs/);
    expect(SKILL).not.toMatch(/WidgetManager/);
    expect(SKILL).not.toMatch(/second-miss-after-pass/);
  });
});
