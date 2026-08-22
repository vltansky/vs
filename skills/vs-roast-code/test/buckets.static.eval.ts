import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { describe, expect, it } from 'vitest';

const DIR = path.resolve(__dirname, '..');
const SKILL_RAW = fs.readFileSync(path.join(DIR, 'SKILL.md'), 'utf8');
const REJECT = path.join(DIR, 'scripts', 'reject-roast-buckets.mjs');
const FIX = path.join(__dirname, 'fixtures', 'buckets');
const SLOGAN = path.join(FIX, 'slogan-only-skill.md');
const COPIED = path.join(FIX, 'copied-slogans-skill.md');
const BAD_UNBUCKETED = path.join(FIX, 'bad-unbucketed');
const BAD_ALL_ACT = path.join(FIX, 'bad-all-act-nits');
const BAD_SLOGAN_ROAST = path.join(FIX, 'bad-slogan-only-roast');
const CLEAN = path.join(FIX, 'clean-mixed-buckets');

function reject(target: string) {
  return spawnSync(process.execPath, [REJECT, target], { encoding: 'utf8' });
}

describe('vs-roast-code review buckets', () => {
  it('keeps fixture canaries and source skill names out of SKILL', () => {
    expect(SKILL_RAW).not.toMatch(/SLOGAN_ONLY_ROAST_BUCKETS_CANARY/);
    expect(SKILL_RAW).not.toMatch(/COPIED_SLOGANS_ROAST_BUCKETS_CANARY/);
    expect(SKILL_RAW).not.toMatch(/UNBUCKETED_ROAST_CANARY/);
    expect(SKILL_RAW).not.toMatch(/ALL_ACT_NITS_CANARY/);
    expect(SKILL_RAW).not.toMatch(/SLOGAN_ONLY_ROAST_CANARY/);
    expect(SKILL_RAW).not.toMatch(/CLEAN_MIXED_BUCKETS_CANARY/);
    expect(SKILL_RAW).not.toMatch(/\/vs-interrogate|\/poteto-mode|\/poteto\b/i);
  });

  it('rejects slogan-only skill and the failing roasts', () => {
    expect(reject(SLOGAN).status).toBe(1);
    expect(reject(SLOGAN).stderr).toMatch(/slogan-only skill/);
    expect(reject(COPIED).status).toBe(1);
    expect(reject(COPIED).stderr).toMatch(/slogan-only skill/);
    expect(reject(BAD_UNBUCKETED).status).toBe(1);
    expect(reject(BAD_UNBUCKETED).stderr).toMatch(/unbucketed list/);
    expect(reject(BAD_ALL_ACT).status).toBe(1);
    expect(reject(BAD_ALL_ACT).stderr).toMatch(/all-Act dump of nits/);
    expect(reject(BAD_SLOGAN_ROAST).status).toBe(1);
    expect(reject(BAD_SLOGAN_ROAST).stderr).toMatch(/slogan-only Act\/Consider/);
  });

  it('accepts mixed buckets plus one Dismissed with why, and this skill', () => {
    expect(reject(CLEAN).status).toBe(0);
    expect(reject(path.join(DIR, 'SKILL.md')).status).toBe(0);
  });

  it('exits 2 when a target is missing', () => {
    expect(reject(path.join(FIX, 'missing-run.md')).status).toBe(2);
  });
});
