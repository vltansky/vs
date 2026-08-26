import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { describe, expect, it } from 'vitest';

const DIR = path.resolve(__dirname, '..');
const SKILL_RAW = fs.readFileSync(path.join(DIR, 'SKILL.md'), 'utf8');
const SKILL = SKILL_RAW.replace(/\s+/g, ' ');
const RUNNER = path.join(DIR, 'scripts', 'run-anti-slop.mjs');
const FIXTURE_DIR = path.join(__dirname, 'fixtures');
const BAD = path.join(FIXTURE_DIR, 'anti-slop-bad.ts');
const GOOD = path.join(FIXTURE_DIR, 'anti-slop-good.ts');
const BAD_SRC = fs.readFileSync(BAD, 'utf8');
const GOOD_SRC = fs.readFileSync(GOOD, 'utf8');
const ROAST = fs
  .readFileSync(path.resolve(DIR, '..', 'vs-roast-code', 'SKILL.md'), 'utf8')
  .replace(/\s+/g, ' ');
const BUILD = fs
  .readFileSync(path.resolve(DIR, '..', 'vs-build-it', 'SKILL.md'), 'utf8')
  .replace(/\s+/g, ' ');

function antiSlop(file: string) {
  return spawnSync(process.execPath, [RUNNER, file], { encoding: 'utf8' });
}

describe('vs-deslop: on-demand anti-slop file pass', () => {
  it('requires the named-file anti-slop run before CLEAN', () => {
    expect(SKILL).toMatch(/skills\/vs-deslop\/scripts\/run-anti-slop\.mjs/);
    expect(SKILL).toMatch(/named files only/);
    expect(SKILL).toMatch(/in-scope TS\/JS/);
    expect(SKILL).toMatch(/Exit 1 is a catalog fail \(not `CLEAN`\)/);
    expect(SKILL).toMatch(/`WARN` or `BLOCKED`/);
    expect(SKILL).toMatch(/do not pretend `CLEAN`/);
    expect(SKILL).toMatch(/do not write `oxlint\.config` into the consumer repo/);
    expect(SKILL).toMatch(/Enable the Effect rule only when the target repo uses Effect/);
    expect(SKILL).not.toMatch(/\/anti-slop\b/);
    expect(SKILL).not.toMatch(/SLOGAN_ONLY_ANTISLOP_CANARY/);
  });

  it('rejects a chained assertion fixture and passes a typed file', () => {
    expect(BAD_SRC).toMatch(/as object as User/);
    expect(GOOD_SRC).not.toMatch(/ as /);
    const leftover = antiSlop(BAD);
    expect(leftover.status).toBe(1);
    expect(`${leftover.stdout}${leftover.stderr}`).toMatch(
      /no-chained-type-assertions/,
    );
    expect(antiSlop(GOOD).status).toBe(0);
  });
});

describe('vs-deslop: roast-code and build-it compose the file pass', () => {
  it('keeps the Pass 1 and Phase 4 pointers', () => {
    expect(ROAST).toMatch(
      /Pass 1 includes the vs-deslop on-demand anti-slop file pass/,
    );
    expect(BUILD).toMatch(
      /Phase 4 includes the vs-deslop on-demand anti-slop file pass/,
    );
    expect(ROAST).not.toMatch(/run-anti-slop\.mjs/);
    expect(BUILD).not.toMatch(/run-anti-slop\.mjs/);
  });
});
