import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { describe, expect, it } from 'vitest';

const DIR = path.resolve(__dirname, '..');
const ROOT = path.resolve(DIR, '..', '..');
const SKILL_RAW = fs.readFileSync(path.join(DIR, 'SKILL.md'), 'utf8');
const REJECT = path.join(DIR, 'scripts', 'reject-htmdx-handoff.mjs');
const FIX = path.join(__dirname, 'fixtures', 'handoff');
const SLOGAN = path.join(FIX, 'slogan-only-skill.md');
const BAD_NO_URL = path.join(FIX, 'bad-no-url');
const BAD_URL_ONLY = path.join(FIX, 'bad-url-only');
const CLEAN_SHOT = path.join(FIX, 'clean-url-shot');
const CLEAN_FAIL = path.join(FIX, 'clean-url-shot-failed');

function reject(target: string) {
  return spawnSync(process.execPath, [REJECT, target], { encoding: 'utf8' });
}

describe('vs-htmdx URL + first-screen shot', () => {
  it('keeps fixture canaries out of SKILL', () => {
    expect(SKILL_RAW).not.toMatch(/SLOGAN_ONLY_HTMDX_HANDOFF_CANARY/);
    expect(SKILL_RAW).not.toMatch(/BAD_NO_URL_HTMDX_HANDOFF_CANARY/);
    expect(SKILL_RAW).not.toMatch(/BAD_URL_ONLY_HTMDX_HANDOFF_CANARY/);
    expect(SKILL_RAW).not.toMatch(/CLEAN_URL_SHOT_HTMDX_HANDOFF_CANARY/);
    expect(SKILL_RAW).not.toMatch(/CLEAN_URL_SHOT_FAILED_HTMDX_HANDOFF_CANARY/);
  });

  it('rejects no-URL and URL-only-without-failure handoffs', () => {
    expect(reject(SLOGAN).status).toBe(1);
    expect(reject(SLOGAN).stderr).toMatch(/slogan-only skill/);
    expect(reject(BAD_NO_URL).status).toBe(1);
    expect(reject(BAD_NO_URL).stderr).toMatch(/no URL/);
    expect(reject(BAD_URL_ONLY).status).toBe(1);
    expect(reject(BAD_URL_ONLY).stderr).toMatch(
      /missing shot with no failure line/,
    );
  });

  it('accepts URL+shot, URL+shot-failed, this skill, and inherit pointers', () => {
    expect(SKILL_RAW).toMatch(
      /skills\/vs-htmdx\/scripts\/reject-htmdx-handoff\.mjs/,
    );
    expect(SKILL_RAW).toMatch(/test\/fixtures\/handoff/);
    expect(reject(CLEAN_SHOT).status).toBe(0);
    expect(reject(CLEAN_FAIL).status).toBe(0);
    expect(reject(path.join(DIR, 'SKILL.md')).status).toBe(0);
    for (const workflow of [
      'vs-eli5',
      'vs-brief',
      'vs-roast-ui',
      'vs-explain-diff',
    ]) {
      const skill = fs.readFileSync(
        path.join(ROOT, 'skills', workflow, 'SKILL.md'),
        'utf8',
      );
      expect(skill, workflow).toMatch(/inherit/i);
      expect(skill, workflow).toMatch(/vs-htmdx/);
      expect(skill, workflow).toMatch(/first-screen shot/i);
      expect(reject(path.join(ROOT, 'skills', workflow, 'SKILL.md')).status).toBe(
        0,
      );
    }
    const qa = fs.readFileSync(
      path.join(ROOT, 'skills', 'vs-qa', 'SKILL.md'),
      'utf8',
    );
    const rich = fs.readFileSync(
      path.join(
        ROOT,
        'skills',
        'vs-internal-shared',
        'references',
        'rich-artifacts.md',
      ),
      'utf8',
    );
    expect(qa).toContain('vs-internal-shared/references/rich-artifacts.md');
    expect(rich).toMatch(/inherit/i);
    expect(rich).toMatch(/first-screen shot/i);
    expect(rich).toMatch(/vs-htmdx\/SKILL\.md/);
  });

  it('exits 2 when a target is missing', () => {
    expect(reject(path.join(FIX, 'missing-run.md')).status).toBe(2);
  });
});
