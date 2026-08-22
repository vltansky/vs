import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { describe, expect, it } from 'vitest';

const DIR = path.resolve(__dirname, '..');
const SKILL_RAW = fs.readFileSync(path.join(DIR, 'SKILL.md'), 'utf8');
const REJECT = path.join(DIR, 'scripts', 'reject-variate.mjs');
const FIX = path.join(__dirname, 'fixtures', 'variate');
const SLOGAN = path.join(FIX, 'slogan-only-skill.md');
const BAD_AVERAGE = path.join(FIX, 'bad-average-layout');
const BAD_LEAKED = path.join(FIX, 'bad-leaked-rubric');
const BAD_NO_BASE = path.join(FIX, 'bad-no-base');
const CLEAN = path.join(FIX, 'clean-isolate-graft');

function reject(target: string) {
  return spawnSync(process.execPath, [REJECT, target], { encoding: 'utf8' });
}

describe('vs-prototype isolate-pick-graft', () => {
  it('keeps fixture canaries and arena skill names out of SKILL', () => {
    expect(SKILL_RAW).not.toMatch(/SLOGAN_ONLY_VARIATE_CANARY/);
    expect(SKILL_RAW).not.toMatch(/AVERAGE_LAYOUT_CANARY/);
    expect(SKILL_RAW).not.toMatch(/LEAKED_RUBRIC_CANARY/);
    expect(SKILL_RAW).not.toMatch(/NO_BASE_CANARY/);
    expect(SKILL_RAW).not.toMatch(/CLEAN_ISOLATE_GRAFT_CANARY/);
    expect(SKILL_RAW).not.toMatch(/\/vs-arena|\/poteto|\/variate/i);
  });

  it('rejects a slogan-only skill and the failing runs', () => {
    expect(reject(SLOGAN).status).toBe(1);
    expect(reject(SLOGAN).stderr).toMatch(/slogan-only skill/);
    expect(reject(BAD_AVERAGE).status).toBe(1);
    expect(reject(BAD_AVERAGE).stderr).toMatch(/averages two layouts/);
    expect(reject(BAD_LEAKED).status).toBe(1);
    expect(reject(BAD_LEAKED).stderr).toMatch(/rubric leaked into the generate prompt/);
    expect(reject(BAD_NO_BASE).status).toBe(1);
    expect(reject(BAD_NO_BASE).stderr).toMatch(/no base named/);
  });

  it('accepts two isolated candidates with a hidden rubric, named base, and graft', () => {
    expect(reject(CLEAN).status).toBe(0);
    expect(reject(path.join(DIR, 'SKILL.md')).status).toBe(0);
  });

  it('exits 2 when a target is missing', () => {
    expect(reject(path.join(FIX, 'missing-run.md')).status).toBe(2);
  });
});
