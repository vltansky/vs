import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { describe, expect, it } from 'vitest';

const DIR = path.resolve(__dirname, '..');
const SKILL_RAW = fs.readFileSync(path.join(DIR, 'SKILL.md'), 'utf8');
const REJECT = path.join(DIR, 'scripts', 'reject-roast-preflight.mjs');
const FIX = path.join(__dirname, 'fixtures', 'preflight');
const SKILLS_DIR = path.resolve(DIR, '..');

const SLOGAN = path.join(FIX, 'slogan-only-skill.md');
const COPIED = path.join(FIX, 'copied-slogans-skill.md');
const PHRASE = path.join(FIX, 'phrase-copy-skill.md');
const STRUCTURE = path.join(FIX, 'structure-paste-skill.md');
const PREFLIGHT_SKILL = path.join(FIX, 'vs-pre-flight-skill.md');
const PUBLISH_INVOKE = path.join(FIX, 'publish-invoke-skill.md');
const EMPTY_DIFF = path.join(FIX, 'empty-diff');
const BAD_REF = path.join(FIX, 'bad-ref');
const SHIP_ACT = path.join(FIX, 'ship-with-act');
const SHIP_PIN = path.join(FIX, 'ship-unresolved-pin');
const SHIP_Q = path.join(FIX, 'ship-open-interview');
const AUTO_FIX = path.join(FIX, 'auto-fix');
const PUBLISH_RUN = path.join(FIX, 'publish-run');
const CLEAN = path.join(FIX, 'clean-ship');
const BLOCKED = path.join(FIX, 'do-not-ship-act');
const STUB = path.join(FIX, 'stub-rejector', 'SKILL.md');
const FORGED_PIN = path.join(FIX, 'forged-pin');
const EMPTY_WAIVER = path.join(FIX, 'empty-diff-waiver');
const MUTATE = path.join(FIX, 'mutate-no-ask');
const APPLY_FIX = path.join(FIX, 'apply-fix-no-ask');
const FIX_IT = path.join(FIX, 'fix-it-no-ask');

function reject(target: string) {
  return spawnSync(process.execPath, [REJECT, target], { encoding: 'utf8' });
}

describe('vs-roast-code pre-flight mode', () => {
  it('keeps fixture canaries and a /vs-pre-flight skill out', () => {
    expect(SKILL_RAW).not.toMatch(/SLOGAN_ONLY_ROAST_PREFLIGHT_CANARY/);
    expect(SKILL_RAW).not.toMatch(/COPIED_SLOGANS_ROAST_PREFLIGHT_CANARY/);
    expect(SKILL_RAW).not.toMatch(/PHRASE_COPY_ROAST_PREFLIGHT_CANARY/);
    expect(SKILL_RAW).not.toMatch(/STRUCTURE_PASTE_ROAST_PREFLIGHT_CANARY/);
    expect(SKILL_RAW).not.toMatch(/VS_PREFLIGHT_SKILL_CANARY/);
    expect(SKILL_RAW).not.toMatch(/PUBLISH_INVOKE_PREFLIGHT_CANARY/);
    expect(SKILL_RAW).not.toMatch(/EMPTY_DIFF_PREFLIGHT_CANARY/);
    expect(SKILL_RAW).not.toMatch(/BAD_REF_PREFLIGHT_CANARY/);
    expect(SKILL_RAW).not.toMatch(/SHIP_WITH_ACT_PREFLIGHT_CANARY/);
    expect(SKILL_RAW).not.toMatch(/SHIP_UNRESOLVED_PIN_PREFLIGHT_CANARY/);
    expect(SKILL_RAW).not.toMatch(/SHIP_OPEN_INTERVIEW_PREFLIGHT_CANARY/);
    expect(SKILL_RAW).not.toMatch(/AUTO_FIX_PREFLIGHT_CANARY/);
    expect(SKILL_RAW).not.toMatch(/PUBLISH_RUN_PREFLIGHT_CANARY/);
    expect(SKILL_RAW).not.toMatch(/CLEAN_SHIP_PREFLIGHT_CANARY/);
    expect(SKILL_RAW).not.toMatch(/DO_NOT_SHIP_PREFLIGHT_CANARY/);
    expect(SKILL_RAW).not.toMatch(/STUB_REJECTOR_PREFLIGHT_CANARY/);
    expect(SKILL_RAW).not.toMatch(/FORGED_PIN_PREFLIGHT_CANARY/);
    expect(SKILL_RAW).not.toMatch(/EMPTY_DIFF_WAIVER_PREFLIGHT_CANARY/);
    expect(SKILL_RAW).not.toMatch(/MUTATE_NO_ASK_PREFLIGHT_CANARY/);
    expect(SKILL_RAW).not.toMatch(/APPLY_FIX_NO_ASK_PREFLIGHT_CANARY/);
    expect(SKILL_RAW).not.toMatch(/FIX_IT_NO_ASK_PREFLIGHT_CANARY/);
    expect(fs.readdirSync(SKILLS_DIR)).not.toContain('vs-pre-flight');
    expect(SKILL_RAW).not.toMatch(/\/vs-pre-flight\b/);
  });

  it('rejects publish routing, a new skill, fail-closed pins, illegal SHIP, and auto-fix', () => {
    expect(reject(SLOGAN).status).toBe(1);
    expect(reject(SLOGAN).stderr).toMatch(/slogan-only skill/);
    expect(reject(COPIED).status).toBe(1);
    expect(reject(COPIED).stderr).toMatch(/slogan-only skill/);
    expect(reject(PHRASE).status).toBe(1);
    expect(reject(PHRASE).stderr).toMatch(/slogan-only skill/);
    expect(reject(STRUCTURE).status).toBe(1);
    expect(reject(STRUCTURE).stderr).toMatch(/slogan-only skill/);
    expect(reject(STUB).status).toBe(1);
    expect(reject(STUB).stderr).toMatch(/slogan-only skill/);
    expect(reject(PREFLIGHT_SKILL).status).toBe(1);
    expect(reject(PREFLIGHT_SKILL).stderr).toMatch(/vs-pre-flight skill/);
    expect(reject(PUBLISH_INVOKE).status).toBe(1);
    expect(reject(PUBLISH_INVOKE).stderr).toMatch(/pre-flight invoke publishes/);
    expect(reject(EMPTY_DIFF).status).toBe(1);
    expect(reject(EMPTY_DIFF).stderr).toMatch(/empty-diff/);
    expect(reject(BAD_REF).status).toBe(1);
    expect(reject(BAD_REF).stderr).toMatch(/bad-ref/);
    expect(reject(SHIP_ACT).status).toBe(1);
    expect(reject(SHIP_ACT).stderr).toMatch(/SHIP with Act/);
    expect(reject(SHIP_PIN).status).toBe(1);
    expect(reject(SHIP_PIN).stderr).toMatch(/unresolved healthy-point/);
    expect(reject(SHIP_Q).status).toBe(1);
    expect(reject(SHIP_Q).stderr).toMatch(/open interview/);
    expect(reject(AUTO_FIX).status).toBe(1);
    expect(reject(AUTO_FIX).stderr).toMatch(/auto-fix before user said fix/);
    expect(reject(PUBLISH_RUN).status).toBe(1);
    expect(reject(PUBLISH_RUN).stderr).toMatch(/pre-flight invoke publishes/);
    expect(reject(FORGED_PIN).status).toBe(1);
    expect(reject(FORGED_PIN).stderr).toMatch(/unresolved healthy-point/);
    expect(reject(EMPTY_WAIVER).status).toBe(1);
    expect(reject(EMPTY_WAIVER).stderr).toMatch(/empty-diff/);
    expect(reject(MUTATE).status).toBe(1);
    expect(reject(MUTATE).stderr).toMatch(/auto-fix before user said fix/);
    expect(reject(APPLY_FIX).status).toBe(1);
    expect(reject(APPLY_FIX).stderr).toMatch(/auto-fix before user said fix/);
    expect(reject(FIX_IT).status).toBe(1);
    expect(reject(FIX_IT).stderr).toMatch(/auto-fix before user said fix/);
  });

  it('accepts clean SHIP, DO NOT SHIP with Act path+line+snippet, and this skill', () => {
    expect(SKILL_RAW).toMatch(
      /skills\/vs-roast-code\/scripts\/reject-roast-preflight\.mjs/,
    );
    expect(SKILL_RAW).toMatch(/test\/fixtures\/preflight/);
    expect(reject(CLEAN).status).toBe(0);
    expect(reject(BLOCKED).status).toBe(0);
    expect(reject(path.join(DIR, 'SKILL.md')).status).toBe(0);
  });

  it('exits 2 when a target is missing', () => {
    expect(reject(path.join(FIX, 'missing-run.md')).status).toBe(2);
  });
});
