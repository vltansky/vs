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
const STUB = path.join(FIX, 'stub-rejector', 'SKILL.md');
const BESIDE = path.join(FIX, 'slogan-beside-scripts', 'SKILL.md');
const BAG = path.join(FIX, 'bag-of-words');
const NO_HERE = path.join(FIX, 'four-names-no-here');
const HEADINGS = path.join(FIX, 'headings-four-names');

function reject(target: string) {
  return spawnSync(process.execPath, [REJECT, target], { encoding: 'utf8' });
}

describe('vs-shape-it user step map', () => {
  it('keeps fixture canaries out of SKILL', () => {
    expect(SKILL_RAW).not.toMatch(/SLOGAN_ONLY_STEP_MAP_CANARY/);
    expect(SKILL_RAW).not.toMatch(/COPY_PHRASES_STEP_MAP_CANARY/);
    expect(SKILL_RAW).not.toMatch(/PHASE_BOUNDARY_BAD_NO_MAP_CANARY/);
    expect(SKILL_RAW).not.toMatch(/PHASE_BOUNDARY_GOOD_MAP_CANARY/);
    expect(SKILL_RAW).not.toMatch(/STUB_REJECTOR_STEP_MAP_CANARY/);
    expect(SKILL_RAW).not.toMatch(/SLOGAN_BESIDE_SCRIPTS_STEP_MAP_CANARY/);
    expect(SKILL_RAW).not.toMatch(/BAG_OF_WORDS_STEP_MAP_CANARY/);
    expect(SKILL_RAW).not.toMatch(/FOUR_NAMES_NO_HERE_STEP_MAP_CANARY/);
    expect(SKILL_RAW).not.toMatch(/HEADINGS_FOUR_NAMES_STEP_MAP_CANARY/);
  });

  it('rejects slogan-only skill and a phase change without the map', () => {
    expect(reject(SLOGAN).status).toBe(1);
    expect(reject(SLOGAN).stderr).toMatch(/slogan-only skill/);
    expect(reject(COPY).status).toBe(1);
    expect(reject(COPY).stderr).toMatch(/slogan-only skill/);
    expect(reject(STUB).status).toBe(1);
    expect(reject(STUB).stderr).toMatch(/slogan-only skill/);
    expect(reject(BESIDE).status).toBe(1);
    expect(reject(BESIDE).stderr).toMatch(/slogan-only skill/);
    expect(reject(BAD).status).toBe(1);
    expect(reject(BAD).stderr).toMatch(
      /omits you-are-here \/ remaining \/ next decision/,
    );
    expect(reject(BAG).status).toBe(1);
    expect(reject(BAG).stderr).toMatch(
      /omits you-are-here \/ remaining \/ next decision/,
    );
    expect(reject(NO_HERE).status).toBe(1);
    expect(reject(NO_HERE).stderr).toMatch(
      /omits you-are-here \/ remaining \/ next decision/,
    );
    expect(reject(HEADINGS).status).toBe(1);
    expect(reject(HEADINGS).stderr).toMatch(
      /omits you-are-here \/ remaining \/ next decision/,
    );
  });

  it('accepts a full map line, this skill, and inherit pointers', () => {
    expect(SKILL_RAW).toMatch(/skills\/vs-shape-it\/scripts\/reject-step-map\.mjs/);
    expect(SKILL_RAW).toMatch(/test\/fixtures\/step-map/);
    expect(SKILL_RAW).toMatch(
      /3ec809b19c36c2d41700e25d19f1a50f4bc4750dbcfc413b84f4e7ccb42af3cf/,
    );
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
