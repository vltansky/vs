import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { describe, expect, it } from 'vitest';

const DIR = path.resolve(__dirname, '..');
const ROOT = path.resolve(DIR, '..', '..');
const SKILL_RAW = fs.readFileSync(path.join(DIR, 'SKILL.md'), 'utf8');
const REJECT = path.join(DIR, 'scripts', 'reject-step-map.mjs');
const FIX = path.join(__dirname, 'fixtures', 'step-map');
const SLOGAN = path.join(FIX, 'slogan-only-skill.md');
const COPY = path.join(FIX, 'copy-phrases-skill.md');
const BAD = path.join(FIX, 'bad-no-map');
const CLEAN = path.join(FIX, 'clean-map');

function reject(target: string) {
  return spawnSync(process.execPath, [REJECT, target], { encoding: 'utf8' });
}

describe('vs-shape-it user step map', () => {
  it('keeps fixture canaries out of SKILL', () => {
    expect(SKILL_RAW).not.toMatch(/SLOGAN_ONLY_STEP_MAP_CANARY/);
    expect(SKILL_RAW).not.toMatch(/COPY_PHRASES_STEP_MAP_CANARY/);
    expect(SKILL_RAW).not.toMatch(/PHASE_BOUNDARY_BAD_NO_MAP_CANARY/);
    expect(SKILL_RAW).not.toMatch(/PHASE_BOUNDARY_GOOD_MAP_CANARY/);
  });

  it('rejects slogan-only skill and a phase change without the map', () => {
    expect(reject(SLOGAN).status).toBe(1);
    expect(reject(SLOGAN).stderr).toMatch(/slogan-only skill/);
    expect(reject(COPY).status).toBe(1);
    expect(reject(COPY).stderr).toMatch(/slogan-only skill/);
    expect(reject(BAD).status).toBe(1);
    expect(reject(BAD).stderr).toMatch(
      /omits you-are-here \/ remaining \/ next decision/,
    );
  });

  it('accepts a full map line, this skill, and inherit pointers', () => {
    expect(SKILL_RAW).toMatch(/skills\/vs-shape-it\/scripts\/reject-step-map\.mjs/);
    expect(SKILL_RAW).toMatch(/test\/fixtures\/step-map/);
    expect(reject(CLEAN).status).toBe(0);
    expect(reject(path.join(DIR, 'SKILL.md')).status).toBe(0);
    for (const workflow of ['vs-build-it', 'vs-ship-it', 'vs-orchestrate']) {
      const skill = fs.readFileSync(
        path.join(ROOT, 'skills', workflow, 'SKILL.md'),
        'utf8',
      );
      expect(skill, workflow).toMatch(/inherit/i);
      expect(skill, workflow).toContain(
        '../vs-internal-shared/references/communication.md',
      );
      expect(skill, workflow).toMatch(/step map/i);
      expect(skill, workflow).not.toMatch(/you-are-here/i);
      expect(reject(path.join(ROOT, 'skills', workflow, 'SKILL.md')).status).toBe(
        0,
      );
    }
  });

  it('exits 2 when a target is missing', () => {
    expect(reject(path.join(FIX, 'missing-run.md')).status).toBe(2);
  });
});
