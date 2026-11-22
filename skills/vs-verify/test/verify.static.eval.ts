import * as fs from 'fs';
import * as path from 'path';
import { describe, expect, it } from 'vitest';

const SKILLS_DIR = path.resolve(__dirname, '..', '..');
const VERIFY = fs.readFileSync(path.join(SKILLS_DIR, 'vs-verify', 'SKILL.md'), 'utf8');
const BUILD_IT = fs.readFileSync(path.join(SKILLS_DIR, 'vs-build-it', 'SKILL.md'), 'utf8');
const BUGFIX = fs.readFileSync(path.join(SKILLS_DIR, 'vs-bugfix', 'SKILL.md'), 'utf8');
const SHIP_IT = fs.readFileSync(path.join(SKILLS_DIR, 'vs-ship-it', 'SKILL.md'), 'utf8');
const VERIFY_BEHAVIOR_EVAL = fs.readFileSync(
  path.join(SKILLS_DIR, 'vs-verify', 'test', 'verify.eval.ts'),
  'utf8',
);

describe('verification status contract', () => {
  it('distinguishes proof, gaps, failures, and blocked environments', () => {
    expect(VERIFY).toMatch(/PASS`, `WARN`, `FAIL`, or `BLOCKED/);
    expect(VERIFY).toMatch(/tests pass but the user-visible behavior was not exercised[\s\S]+`WARN`/);
    expect(VERIFY).toMatch(/check fails, report `FAIL`/);
    expect(VERIFY).toMatch(/environment blocks verification, report `BLOCKED`/);
    expect(VERIFY).toMatch(/Reachability \(HTTP 200\) alone proves nothing/);
  });

  it('requires config presence, not a green smoke, for deploy claims', () => {
    const ladder = VERIFY.slice(VERIFY.indexOf('8. **Config presence**'), VERIFY.indexOf('## User path'));
    const rule = VERIFY.slice(VERIFY.indexOf('- A deploy claim whose smoke never read'), VERIFY.indexOf('- Keep logs concise'));
    expect(ladder).toMatch(/Grep the changed code for each new or\s+changed key/);
    expect(ladder).toMatch(/A secret bound with `defineSecret` is\s+resolved at deploy/);
    expect(ladder).toMatch(/A plain env var, flag, or resource name is the real gap/);
    expect(ladder).toMatch(/names\s+and metadata only, never values/);
    expect(ladder).toMatch(/name the listing command when it was not run/);
    expect(ladder).toMatch(/A smoke or health check\s+that\s+never\s+reads\s+that\s+config\s+proves\s+nothing\s+about\s+it/);
    expect(rule).toMatch(/smoke never read the new or changed config is `WARN`\s+until config presence is shown/);
    expect(rule).toMatch(/list each unproven key by name in Gaps/);
    expect(rule).toMatch(/Config shown missing on the live target is `FAIL`, even when the smoke is\s+green/);
    // Structural: the ladder and the rule scope the same keys (new or changed), not every key vs new keys.
    for (const part of [ladder, rule]) {
      expect(part).toMatch(/new or\s+changed/);
      expect(part).not.toMatch(/\bevery key\b|\ball (?:config )?keys\b/);
    }
    expect(VERIFY).not.toMatch(/(?:smoke|health check)[^.\n]*(?:passes|green|200)[^.\n]*(?:is|report) `PASS`/i);
  });

  it('propagates verification status through delivery workflows', () => {
    expect(BUILD_IT).toMatch(/handoff verdict inherits the verification status/);
    expect(BUILD_IT).toMatch(/`WARN`, `FAIL`, or\s+`BLOCKED`[\s\S]+do not\s+describe the outcome as fixed or working/);
    expect(BUGFIX).toMatch(/handoff verdict inherits the verification status/);
    expect(BUGFIX).toMatch(/Only `PASS` or `SKIPPED_TRIVIAL` may describe the bug as[\s\S]+fixed or complete/);
    expect(SHIP_IT).toMatch(/carry the WARN\s+wording into[\s\S]+do not describe the change as fixed or\s+verified/);
  });

  it('scores behavior against the agent response without prompt leakage', () => {
    expect(VERIFY_BEHAVIOR_EVAL).toMatch(/await promptOnce\(/);
    expect(VERIFY_BEHAVIOR_EVAL).toMatch(/agent\.messages/);
    expect(VERIFY_BEHAVIOR_EVAL).toMatch(/return \{ agent, response \};/);
    expect(VERIFY_BEHAVIOR_EVAL).not.toMatch(/\(\{\s*transcript\s*\}\)\s*=>/);
  });
});
