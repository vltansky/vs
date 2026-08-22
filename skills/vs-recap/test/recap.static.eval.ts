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
const CLEAN = path.join(FIX, 'clean-inherit-pointers');
const BAD_REDERIVE = path.join(FIX, 'bad-rederive-milestones');
const BAD_DONE = path.join(FIX, 'bad-done-no-pointer');
const MISSING = path.join(FIX, 'missing-trail-unknown');
const BAD_INVENT = path.join(FIX, 'bad-invent-trail');

function reject(target: string) {
  return spawnSync(process.execPath, [REJECT, target], { encoding: 'utf8' });
}

describe('vs-recap inherit-and-re-prove', () => {
  it('names inherit, no re-derive, and artifact pointers', () => {
    expect(SKILL).toMatch(
      /If `GOALS\.md` \/ `decisions\.tsv` \/ a baby-sit resume file \/ prior recap exists, READ it first/i,
    );
    expect(SKILL).toMatch(
      /Do not re-run research, re-score sessions, or rebuild a roadmap/i,
    );
    expect(SKILL).toMatch(
      /Every status\/done\/blocked claim must point at a concrete artifact/i,
    );
    expect(SKILL).toMatch(
      /Missing trail is ok \(say unknown\); inventing one is not/i,
    );
    expect(SKILL).toMatch(/Recap consumes the trail\. Orchestrate owns `decisions\.tsv`/i);
    expect(SKILL_RAW).toMatch(/\*\*Next:\*\* done/);
    expect(SKILL_RAW).toMatch(/\*\*Relevant:\*\* `\/vs-search-threads` \| `\/vs-brief`/);
  });

  it('keeps fixture canaries and foreign skills out', () => {
    expect(SKILL_RAW).not.toMatch(/SLOGAN_ONLY_RECAP_CANARY/);
    expect(SKILL_RAW).not.toMatch(/REDERIVE_MILESTONE_CANARY/);
    expect(SKILL_RAW).not.toMatch(/DONE_NO_POINTER_CANARY/);
    expect(SKILL_RAW).not.toMatch(/CLEAN_INHERIT_RECAP_CANARY/);
    expect(SKILL_RAW).not.toMatch(/MISSING_TRAIL_UNKNOWN_CANARY/);
    expect(SKILL_RAW).not.toMatch(/INVENT_TRAIL_CANARY/);
    expect(SKILL).not.toMatch(/inherit the trail\. do not re-derive\. re-prove claims on the artifact\./i);
    expect(SKILL).not.toMatch(/\/vs-interrogate|\/poteto-mode|principle-encode/i);
  });

  it('rejects slogan-only skill and the failing recaps', () => {
    expect(reject(SLOGAN).status).toBe(1);
    expect(reject(SLOGAN).stderr).toMatch(/slogan-only skill/);
    expect(reject(BAD_REDERIVE).status).toBe(1);
    expect(reject(BAD_REDERIVE).stderr).toMatch(/re-derived milestone list/);
    expect(reject(BAD_DONE).status).toBe(1);
    expect(reject(BAD_DONE).stderr).toMatch(/no artifact pointer/);
    expect(reject(BAD_INVENT).status).toBe(1);
    expect(reject(BAD_INVENT).stderr).toMatch(/invented a trail/);
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
