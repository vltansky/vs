import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { describe, expect, it } from 'vitest';

const DIR = path.resolve(__dirname, '..');
const SKILL_RAW = fs.readFileSync(path.join(DIR, 'SKILL.md'), 'utf8');
const SKILL = SKILL_RAW.replace(/\s+/g, ' ');
const REJECT = path.join(DIR, 'scripts', 'reject-code-slop.mjs');
const REJECT_SRC = fs.readFileSync(REJECT, 'utf8');
const FIXTURE_DIR = path.join(__dirname, 'fixtures');
const SECOND_MISS = path.join(FIXTURE_DIR, 'second-miss-after-pass.ts');
const CLEAN = path.join(FIXTURE_DIR, 'clean-add.ts');
const SLOGAN_SKILL = path.join(FIXTURE_DIR, 'slogan-only-skill.md');
const SECOND_MISS_SRC = fs.readFileSync(SECOND_MISS, 'utf8');
const SLOGAN = fs.readFileSync(SLOGAN_SKILL, 'utf8');

function reject(file: string) {
  return spawnSync(process.execPath, [REJECT, file], { encoding: 'utf8' });
}

describe('vs-deslop: keep flatten as the first cleanup move', () => {
  it('names flatten-to-one-layer as the first cleanup move', () => {
    expect(SKILL).toMatch(
      /flatten first: delete down to one layer\. A new wrapper, helper, file, or mode flag is not a cleanup/i,
    );
    expect(SKILL).toMatch(
      /The first cleanup move is one-layer delete/i,
    );
    expect(SKILL).toMatch(/Do not clean by adding a wrapper, helper, file, or mode flag/i);
  });

  it('keeps the Flow Contract and rescan cap', () => {
    expect(SKILL).toMatch(/## Flow Contract/);
    expect(SKILL).toMatch(/The deslop run ends the pass/);
    expect(SKILL).toMatch(/At most 2 rescans\. Then stop/);
  });

  it('does not add poteto-mode, principle skills, or slogan names', () => {
    expect(SKILL).not.toMatch(/keep-it-flat/i);
    expect(SKILL).not.toMatch(/encode-via-lint/i);
    expect(SKILL).not.toMatch(/poteto-mode/i);
    expect(SKILL).not.toMatch(/principle-encode/i);
    expect(SKILL).not.toMatch(/\boxlint\b/i);
    expect(SKILL).not.toMatch(/SLOGAN_ONLY_DESLOP_CANARY/);
    expect(SKILL).not.toMatch(/\/\*\s*second-miss\s*\*\//);
  });
});

describe('vs-deslop: second miss fails the workspace scorer', () => {
  it('rejects leftover slop after one flatten pass on fixture content', () => {
    expect(SECOND_MISS_SRC).toMatch(/WidgetManager/);
    expect(SECOND_MISS_SRC).toMatch(/mode === true/);
    expect(SECOND_MISS_SRC).toMatch(/\/\* second-miss \*\//);
    expect(REJECT_SRC.length).toBeGreaterThan(200);
    expect(REJECT_SRC).toMatch(/second-miss/);
    expect(REJECT_SRC).toMatch(/boolean mode flag leftover/);
    expect(REJECT_SRC).toMatch(/class\\s\+\\w\*Factory\\b/);
    expect(REJECT_SRC).toMatch(/process\.exit\(1\)/);
    expect(reject(SECOND_MISS).status).toBe(1);
    expect(reject(CLEAN).status).toBe(0);
    expect(SKILL).toMatch(/skills\/vs-deslop\/scripts\/reject-code-slop\.mjs/);
    expect(SKILL).toMatch(/after one flatten pass/);
    expect(SKILL).not.toMatch(/WidgetManager/);
    expect(SKILL).not.toMatch(/second-miss-after-pass/);
  });

  it('fails a slogan-only skill that never scores fixture content', () => {
    expect(SLOGAN).toMatch(/keep-it-flat/i);
    expect(SLOGAN).toMatch(/Encode via lint/i);
    expect(SLOGAN).toMatch(/second miss/i);
    expect(SLOGAN).not.toMatch(/reject-code-slop\.mjs/);
    expect(SKILL).not.toMatch(/Prefer keep-it-flat/i);
    expect(reject(SLOGAN_SKILL).status).toBe(1);
    expect(reject(SECOND_MISS).status).toBe(1);
  });
});
