import * as fs from 'fs';
import * as path from 'path';
import { describe, expect, it } from 'vitest';

const SKILLS_DIR = path.resolve(__dirname, '..', '..');
const VERIFY = fs.readFileSync(path.join(SKILLS_DIR, 'vs-verify', 'SKILL.md'), 'utf8');
const BUILD_IT = fs.readFileSync(path.join(SKILLS_DIR, 'vs-build-it', 'SKILL.md'), 'utf8');
const BUGFIX = fs.readFileSync(path.join(SKILLS_DIR, 'vs-bugfix', 'SKILL.md'), 'utf8');
const SHIP_IT = fs.readFileSync(path.join(SKILLS_DIR, 'vs-ship-it', 'SKILL.md'), 'utf8');

describe('verification status contract', () => {
  it('distinguishes proof, gaps, failures, and blocked environments', () => {
    expect(VERIFY).toMatch(/PASS`, `WARN`, `FAIL`, or `BLOCKED/);
    expect(VERIFY).toMatch(/tests pass but the user-visible behavior was not exercised[\s\S]+`WARN`/);
    expect(VERIFY).toMatch(/check fails, report `FAIL`/);
    expect(VERIFY).toMatch(/environment blocks verification, report `BLOCKED`/);
    expect(VERIFY).toMatch(/Reachability \(HTTP 200\) alone proves nothing/);
  });

  it('propagates verification status through delivery workflows', () => {
    expect(BUILD_IT).toMatch(/handoff verdict inherits the verification status/);
    expect(BUILD_IT).toMatch(/`WARN`, `FAIL`, or\s+`BLOCKED`[\s\S]+do not describe the outcome as fixed or working/);
    expect(BUGFIX).toMatch(/handoff verdict inherits the verification status/);
    expect(BUGFIX).toMatch(/Only `PASS` or `SKIPPED_TRIVIAL` may describe the bug as[\s\S]+fixed or complete/);
    expect(SHIP_IT).toMatch(/carry the WARN wording into[\s\S]+do not describe the change as fixed or\s+verified/);
  });
});
