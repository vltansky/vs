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
const PHRASE = path.join(FIX, 'phrase-copy-skill.md');
const BAD_UNBUCKETED = path.join(FIX, 'bad-unbucketed');
const BAD_ALL_ACT = path.join(FIX, 'bad-all-act-nits');
const BAD_SLOGAN_ROAST = path.join(FIX, 'bad-slogan-only-roast');
const BAD_MISSING_ACT = path.join(FIX, 'bad-missing-act');
const BAD_DISMISSED_AS_ACT = path.join(FIX, 'bad-dismissed-as-act');
const CLEAN = path.join(FIX, 'clean-mixed-buckets');
const CLEAN_ACT = path.join(FIX, 'clean-act-only');

function reject(target: string) {
  return spawnSync(process.execPath, [REJECT, target], { encoding: 'utf8' });
}

describe('vs-roast-code review buckets', () => {
  it('keeps fixture canaries and source skill names out of SKILL', () => {
    expect(SKILL_RAW).not.toMatch(/SLOGAN_ONLY_ROAST_BUCKETS_CANARY/);
    expect(SKILL_RAW).not.toMatch(/COPIED_SLOGANS_ROAST_BUCKETS_CANARY/);
    expect(SKILL_RAW).not.toMatch(/PHRASE_COPY_ROAST_BUCKETS_CANARY/);
    expect(SKILL_RAW).not.toMatch(/UNBUCKETED_ROAST_CANARY/);
    expect(SKILL_RAW).not.toMatch(/ALL_ACT_NITS_CANARY/);
    expect(SKILL_RAW).not.toMatch(/SLOGAN_ONLY_ROAST_CANARY/);
    expect(SKILL_RAW).not.toMatch(/MISSING_ACT_CANARY/);
    expect(SKILL_RAW).not.toMatch(/DISMISSED_AS_ACT_CANARY/);
    expect(SKILL_RAW).not.toMatch(/CLEAN_MIXED_BUCKETS_CANARY/);
    expect(SKILL_RAW).not.toMatch(/CLEAN_ACT_ONLY_CANARY/);
    expect(SKILL_RAW).not.toMatch(/\/vs-interrogate|\/poteto-mode|\/poteto\b/i);
  });

  it('rejects slogan-only, phrase-copy, missing Act, and dismissed-as-Act', () => {
    expect(reject(SLOGAN).status).toBe(1);
    expect(reject(SLOGAN).stderr).toMatch(/slogan-only skill/);
    expect(reject(COPIED).status).toBe(1);
    expect(reject(COPIED).stderr).toMatch(/slogan-only skill/);
    expect(reject(PHRASE).status).toBe(1);
    expect(reject(PHRASE).stderr).toMatch(/slogan-only skill/);
    expect(reject(BAD_UNBUCKETED).status).toBe(1);
    expect(reject(BAD_UNBUCKETED).stderr).toMatch(/unbucketed list/);
    expect(reject(BAD_ALL_ACT).status).toBe(1);
    expect(reject(BAD_ALL_ACT).stderr).toMatch(/all-Act dump of nits/);
    expect(reject(BAD_SLOGAN_ROAST).status).toBe(1);
    expect(reject(BAD_SLOGAN_ROAST).stderr).toMatch(/slogan-only Act\/Consider/);
    expect(reject(BAD_MISSING_ACT).status).toBe(1);
    expect(reject(BAD_MISSING_ACT).stderr).toMatch(/missing Act/);
    expect(reject(BAD_DISMISSED_AS_ACT).status).toBe(1);
    expect(reject(BAD_DISMISSED_AS_ACT).stderr).toMatch(/dismissed-as-Act/);
  });

  it('accepts Act-only security, mixed buckets plus Dismissed with why, and this skill', () => {
    expect(reject(CLEAN_ACT).status).toBe(0);
    expect(reject(CLEAN).status).toBe(0);
    expect(reject(path.join(DIR, 'SKILL.md')).status).toBe(0);
  });

  it('exits 2 when a target is missing', () => {
    expect(reject(path.join(FIX, 'missing-run.md')).status).toBe(2);
  });
});
