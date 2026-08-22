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
const CLEAN_PAUSE = path.join(FIX, 'clean-pause-wrote-resume');
const BAD_PRED = path.join(FIX, 'bad-no-predicate');
const BAD_THREE = path.join(FIX, 'bad-three-stuck-gates');
const BAD_RESUME = path.join(FIX, 'bad-resume-no-trail');
const BAD_TWO_CONT = path.join(FIX, 'bad-two-then-continue');
const BAD_TSV = path.join(FIX, 'bad-missing-tsv');
const BAD_PAUSE = path.join(FIX, 'bad-pause-without-resume-file');
const BAD_MENTION = path.join(FIX, 'bad-mention-only-run');

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

  it('keeps loop canaries out of the skill', () => {
    expect(SKILL_RAW).not.toMatch(/SLOGAN_ONLY_LOOP_CANARY/);
    expect(SKILL_RAW).not.toMatch(/LOOP_NO_PREDICATE_CANARY/);
    expect(SKILL_RAW).not.toMatch(/LOOP_THREE_STUCK_CANARY/);
    expect(SKILL_RAW).not.toMatch(/LOOP_RESUME_NO_TRAIL_CANARY/);
    expect(SKILL_RAW).not.toMatch(/LOOP_TWO_STUCK_STOP_CANARY/);
    expect(SKILL_RAW).not.toMatch(/LOOP_PREDICATE_FIRST_CANARY/);
    expect(SKILL_RAW).not.toMatch(/LOOP_TWO_THEN_CONTINUE_CANARY/);
    expect(SKILL_RAW).not.toMatch(/LOOP_MISSING_TSV_CANARY/);
    expect(SKILL_RAW).not.toMatch(/LOOP_PAUSE_NO_RESUME_CANARY/);
    expect(SKILL_RAW).not.toMatch(/LOOP_MENTION_ONLY_RUN_CANARY/);
    expect(SKILL_RAW).not.toMatch(/LOOP_PAUSE_WROTE_RESUME_CANARY/);
    expect(SKILL).not.toMatch(/\/vs-interrogate|\/poteto-mode|principle-encode/i);
  });

  it('rejects slogan-only skill and the failing runs', () => {
    expect(reject(SLOGAN).status).toBe(1);
    expect(reject(BAD_PRED).status).toBe(1);
    expect(reject(BAD_PRED).stderr).toMatch(/without done-predicate/);
    expect(reject(BAD_THREE).status).toBe(1);
    expect(reject(BAD_THREE).stderr).toMatch(/two stuck gates|three stuck|looped past/);
    expect(reject(BAD_RESUME).status).toBe(1);
    expect(reject(BAD_RESUME).stderr).toMatch(/resume without resume-file/);
    expect(reject(BAD_TWO_CONT).status).toBe(1);
    expect(reject(BAD_TWO_CONT).stderr).toMatch(/two stuck|looped past/);
    expect(reject(BAD_TSV).status).toBe(1);
    expect(reject(BAD_TSV).stderr).toMatch(/missing TSV header\/row/);
    expect(reject(BAD_PAUSE).status).toBe(1);
    expect(reject(BAD_PAUSE).stderr).toMatch(/pause without resume-file/);
    expect(reject(BAD_MENTION).status).toBe(1);
    expect(reject(BAD_MENTION).stderr).toMatch(/mention-only run/);
  });

  it('accepts predicate-first, two-stuck-then-stop, and pause-wrote-resume plus this skill', () => {
    expect(fs.readFileSync(path.join(CLEAN_STOP, 'run.md'), 'utf8')).toMatch(
      /stopped:\s*yes/,
    );
    expect(fs.readFileSync(path.join(CLEAN_PAUSE, 'run.md'), 'utf8')).toMatch(
      /resume-file:\s+\S+/,
    );
    expect(reject(CLEAN_PRED).status).toBe(0);
    expect(reject(CLEAN_STOP).status).toBe(0);
    expect(reject(CLEAN_PAUSE).status).toBe(0);
    expect(reject(path.join(DIR, 'SKILL.md')).status).toBe(0);
  });

  it('exits 2 when a target is missing', () => {
    expect(reject(path.join(FIX, 'missing-run.md')).status).toBe(2);
  });
});
