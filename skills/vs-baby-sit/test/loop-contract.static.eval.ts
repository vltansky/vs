import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { describe, expect, it } from 'vitest';

const DIR = path.resolve(__dirname, '..');
const SKILL_RAW = fs.readFileSync(path.join(DIR, 'SKILL.md'), 'utf8');
const SKILL = SKILL_RAW.replace(/\s+/g, ' ');
const REJECT = path.join(DIR, 'scripts', 'reject-loop-run.mjs');
const FIX = path.join(__dirname, 'fixtures', 'loop');
const SLOGAN = path.join(FIX, 'slogan-only-skill.md');
const CLEAN_PRED = path.join(FIX, 'clean-predicate-first');
const CLEAN_STOP = path.join(FIX, 'clean-two-stuck-stop');
const BAD_PRED = path.join(FIX, 'bad-no-predicate');
const BAD_THREE = path.join(FIX, 'bad-three-stuck-ci');
const BAD_RESUME = path.join(FIX, 'bad-resume-no-trail');

function reject(target: string) {
  return spawnSync(process.execPath, [REJECT, target], { encoding: 'utf8' });
}

describe('vs-baby-sit loop contract', () => {
  it('names the required behavior before pinning slogans', () => {
    expect(SKILL).toMatch(
      /done-predicate before the first watch|Do not run the watcher until the done-predicate/i,
    );
    expect(SKILL).toMatch(/Two stuck iterations of the same repair/i);
    expect(SKILL).toMatch(/Resume reads that file and does not re-derive/i);
    expect(SKILL).toMatch(/decisions\.tsv/);
    expect(SKILL).toMatch(/Picture-show-me \/ eli5 is not this trail/i);
    expect(SKILL_RAW).toMatch(/\*\*Next:\*\* done/);
    expect(SKILL_RAW).toMatch(/\*\*Relevant:\*\* `\/vs-fix-pr` \| `\/vs-orchestrate`/);
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
    expect(reject(BAD_THREE).stderr).toMatch(/three stuck/);
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
