import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { describe, expect, it } from 'vitest';

const DIR = path.resolve(__dirname, '..');
const SKILL_RAW = fs.readFileSync(path.join(DIR, 'SKILL.md'), 'utf8');
const SKILL = SKILL_RAW.replace(/\s+/g, ' ');
const REJECT = path.join(DIR, 'scripts', 'reject-recap.mjs');
const FIX = path.join(__dirname, 'fixtures', 'recap');
const SLOGAN = path.join(FIX, 'slogan-only-skill.md');
const COPY_PHRASES = path.join(FIX, 'copy-phrases-skill.md');
const CLEAN = path.join(FIX, 'clean-inherit-pointers');
const BAD_REDERIVE = path.join(FIX, 'bad-rederive-milestones');
const BAD_DONE = path.join(FIX, 'bad-done-no-pointer');
const MISSING = path.join(FIX, 'missing-trail-unknown');
const BAD_INVENT = path.join(FIX, 'bad-invent-trail');
const BAD_IGNORE = path.join(FIX, 'bad-ignore-trail');
const BAD_SAME_ID = path.join(FIX, 'bad-same-id-rederive');
const BAD_FILENAME = path.join(FIX, 'bad-filename-only-pointer');
const BAD_ACTIVE = path.join(FIX, 'bad-active-no-pointer');
const BAD_MENTION = path.join(FIX, 'bad-mention-only');

function reject(target: string) {
  return spawnSync(process.execPath, [REJECT, target], { encoding: 'utf8' });
}

describe('vs-recap inherit-and-re-prove', () => {
  it('keeps workflow edges and fixture canaries out of SKILL', () => {
    expect(SKILL_RAW).toMatch(/\*\*Next:\*\* done/);
    expect(SKILL_RAW).toMatch(
      /\*\*Relevant:\*\* `\/vs-search-threads` \| `\/vs-before-after`/,
    );
    expect(SKILL_RAW).not.toMatch(/SLOGAN_ONLY_RECAP_CANARY/);
    expect(SKILL_RAW).not.toMatch(/REDERIVE_MILESTONE_CANARY/);
    expect(SKILL_RAW).not.toMatch(/DONE_NO_POINTER_CANARY/);
    expect(SKILL_RAW).not.toMatch(/CLEAN_INHERIT_RECAP_CANARY/);
    expect(SKILL_RAW).not.toMatch(/MISSING_TRAIL_UNKNOWN_CANARY/);
    expect(SKILL_RAW).not.toMatch(/INVENT_TRAIL_CANARY/);
    expect(SKILL_RAW).not.toMatch(/IGNORE_TRAIL_CANARY/);
    expect(SKILL_RAW).not.toMatch(/SAME_ID_REDERIVE_CANARY/);
    expect(SKILL_RAW).not.toMatch(/FILENAME_ONLY_POINTER_CANARY/);
    expect(SKILL_RAW).not.toMatch(/ACTIVE_NO_POINTER_CANARY/);
    expect(SKILL_RAW).not.toMatch(/MENTION_ONLY_RECAP_CANARY/);
    expect(SKILL_RAW).not.toMatch(/COPY_PHRASES_RECAP_CANARY/);
    expect(SKILL).not.toMatch(/\/vs-interrogate|\/poteto-mode|principle-encode/i);
  });

  it('rejects slogan-only skill, copied phrases, and the failing recaps', () => {
    expect(reject(SLOGAN).status).toBe(1);
    expect(reject(SLOGAN).stderr).toMatch(/slogan-only skill/);
    expect(reject(COPY_PHRASES).status).toBe(1);
    expect(reject(COPY_PHRASES).stderr).toMatch(/slogan-only skill/);
    expect(reject(BAD_REDERIVE).status).toBe(1);
    expect(reject(BAD_REDERIVE).stderr).toMatch(/re-derived milestone list/);
    expect(reject(BAD_SAME_ID).status).toBe(1);
    expect(reject(BAD_SAME_ID).stderr).toMatch(/re-derived milestone list/);
    expect(reject(BAD_DONE).status).toBe(1);
    expect(reject(BAD_DONE).stderr).toMatch(/no artifact pointer/);
    expect(reject(BAD_FILENAME).status).toBe(1);
    expect(reject(BAD_FILENAME).stderr).toMatch(/no artifact pointer/);
    expect(reject(BAD_ACTIVE).status).toBe(1);
    expect(reject(BAD_ACTIVE).stderr).toMatch(/no artifact pointer/);
    expect(reject(BAD_INVENT).status).toBe(1);
    expect(reject(BAD_INVENT).stderr).toMatch(/invented a trail/);
    expect(reject(BAD_IGNORE).status).toBe(1);
    expect(reject(BAD_IGNORE).stderr).toMatch(/ignored the trail/);
    expect(reject(BAD_MENTION).status).toBe(1);
    expect(reject(BAD_MENTION).stderr).toMatch(/mention-only run/);
  });

  it('accepts inherit-plus-pointers, missing-trail unknown, and this skill', () => {
    expect(reject(CLEAN).status).toBe(0);
    expect(reject(MISSING).status).toBe(0);
    expect(reject(path.join(DIR, 'SKILL.md')).status).toBe(0);
  });

  it('exits 2 when a target is missing', () => {
    expect(reject(path.join(FIX, 'missing-run.md')).status).toBe(2);
  });
});
