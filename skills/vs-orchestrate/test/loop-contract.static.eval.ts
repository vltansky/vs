import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { describe, expect, it } from 'vitest';

const DIR = path.resolve(__dirname, '..');
const SKILL_RAW = fs.readFileSync(path.join(DIR, 'SKILL.md'), 'utf8');
const SKILL = SKILL_RAW.replace(/\s+/g, ' ');
const ROADMAP = fs.readFileSync(
  path.join(DIR, 'references', 'goals-roadmap.md'),
  'utf8',
);
const REJECT = path.join(DIR, 'scripts', 'reject-loop-run.mjs');
const FIX = path.join(__dirname, 'fixtures', 'loop');
const SLOGAN = path.join(FIX, 'slogan-only-skill.md');
const CLEAN_PRED = path.join(FIX, 'clean-predicate-first');
const CLEAN_STOP = path.join(FIX, 'clean-two-stuck-stop');
const BAD_PRED = path.join(FIX, 'bad-no-predicate');
const BAD_THREE = path.join(FIX, 'bad-three-stuck-gates');
const BAD_RESUME = path.join(FIX, 'bad-resume-no-trail');

function reject(target: string) {
  return spawnSync(process.execPath, [REJECT, target], { encoding: 'utf8' });
}

describe('vs-orchestrate loop contract', () => {
  it('names the required behavior before pinning slogans', () => {
    expect(SKILL).toMatch(/BEFORE the first watch or `\/vs-build-it` delegate/i);
    expect(SKILL).toMatch(/Two gates that find the same unfinished evidence/i);
    expect(SKILL).toMatch(/Resume reads that file and does not re-derive/i);
    expect(SKILL).toMatch(/decisions\.tsv/);
    expect(SKILL).toMatch(/Picture-show-me \/ eli5 is not this trail/i);
    expect(ROADMAP).toMatch(/decisions\.tsv/);
    expect(ROADMAP).toMatch(/ts\tphase\tdecision\twhy\tevidence\tresult/);
    expect(SKILL_RAW).toMatch(/\*\*Next:\*\* `\/vs-build-it`/);
    expect(SKILL_RAW).toMatch(/\*\*Relevant:\*\* `\/vs-baby-sit` \| `\/vs-decide-for-me`/);
  });

  it('pairs copied slogans with not.toMatch and a reject script', () => {
    expect('copied slogan').not.toMatch(/SLOGAN_ONLY_LOOP_CANARY/);
    expect('copied slogan').not.toMatch(/LOOP_NO_PREDICATE_CANARY/);
    expect('copied slogan').not.toMatch(/LOOP_THREE_STUCK_CANARY/);
    expect('copied slogan').not.toMatch(/LOOP_RESUME_NO_TRAIL_CANARY/);
    expect(SKILL_RAW).not.toMatch(/SLOGAN_ONLY_LOOP_CANARY/);
    expect(SKILL_RAW).not.toMatch(/LOOP_NO_PREDICATE_CANARY/);
    expect(SKILL_RAW).not.toMatch(/LOOP_THREE_STUCK_CANARY/);
    expect(SKILL_RAW).not.toMatch(/LOOP_RESUME_NO_TRAIL_CANARY/);
    expect(SKILL_RAW).not.toMatch(/LOOP_TWO_STUCK_STOP_CANARY/);
    expect(SKILL_RAW).not.toMatch(/LOOP_PREDICATE_FIRST_CANARY/);
    expect(SKILL).not.toMatch(/\/vs-interrogate|\/poteto-mode|principle-encode/i);
  });

  it('rejects slogan-only skill and the three failing runs', () => {
    expect(reject(SLOGAN).status).toBe(1);
    expect(reject(BAD_PRED).status).toBe(1);
    expect(reject(BAD_PRED).stderr).toMatch(/without done-predicate/);
    expect(reject(BAD_THREE).status).toBe(1);
    expect(reject(BAD_THREE).stderr).toMatch(/two stuck gates|three stuck|looped past/);
    expect(reject(BAD_RESUME).status).toBe(1);
    expect(reject(BAD_RESUME).stderr).toMatch(/resume without trail/);
  });

  it('accepts predicate-first and two-stuck-then-stop runs plus this skill', () => {
    expect(reject(CLEAN_PRED).status).toBe(0);
    expect(reject(CLEAN_STOP).status).toBe(0);
    expect(reject(path.join(DIR, 'SKILL.md')).status).toBe(0);
  });

  it('exits 2 when a target is missing', () => {
    expect(reject(path.join(FIX, 'missing-run.md')).status).toBe(2);
  });
});
