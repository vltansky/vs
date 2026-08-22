import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { describe, expect, it } from 'vitest';

const DIR = path.resolve(__dirname, '..');
const SKILL_RAW = fs.readFileSync(path.join(DIR, 'SKILL.md'), 'utf8');
const SKILL = SKILL_RAW.replace(/\s+/g, ' ');
const REJECT = path.join(DIR, 'scripts', 'reject-code-slop.mjs');
const REJECT_SRC = fs.readFileSync(REJECT, 'utf8');
const THEATER_PATH = path.join(__dirname, 'fixtures', 'try-catch-theater.ts');
const CLEAN_PATH = path.join(__dirname, 'fixtures', 'clean-add.ts');
const THEATER = fs.readFileSync(THEATER_PATH, 'utf8');

function reject(file: string) {
  return spawnSync(process.execPath, [REJECT, file], { encoding: 'utf8' });
}

describe('vs-deslop: exclusive code-cleanup pins', () => {
  it('names smell, category, invariant or call site, and file together', () => {
    expect(SKILL).toMatch(
      /Name each smell, its category, the invariant or call site, and the file it affects/i,
    );
  });

  it('forbids inventing types, files, or flags while cleaning', () => {
    expect(SKILL).toMatch(
      /do not invent types, files, flags, or behavior "for cleanliness\."/i,
    );
  });

  it('requires smell category on each Deslop Result cleaned line', () => {
    expect(SKILL).toMatch(/## Deslop Result/);
    expect(SKILL).toMatch(
      /Cleaned:.*- <change, smell category/i,
    );
  });

  it('cuts wrapping of sync work instead of pinning async/await as a slogan', () => {
    expect(SKILL).toMatch(
      /unnecessary `async`\/`await` or Promise wrapping around sync work/i,
    );
  });

  it('keeps one job per unit by forbidding restated logic across layers', () => {
    expect(SKILL).toMatch(
      /one job per unit: do not restate the same logic in many layers/i,
    );
  });

  it('takes the minimum effective edit and leaves strong local code alone', () => {
    expect(SKILL).toMatch(
      /Take the minimum effective edit\.\s+Leave strong local code alone/i,
    );
  });

  it('binds exclusive order after lock-behavior, with a hard stop', () => {
    expect(SKILL).toMatch(
      /Lock behavior first, then collect\s*(→|->)\s*validate\/discard FP\s*(→|->)\s*surgical delete\s*(→|->)\s*verify\s*(→|->)\s*re-?scan/i,
    );
    expect(SKILL).toMatch(/The deslop run ends the pass/);
    expect(SKILL).toMatch(/At most 2 rescans\. Then stop/);
    expect(SKILL).toMatch(/Do not keep looping/);
  });

  it('ties the theater fixture to reject-code-slop without quoting its tokens', () => {
    expect(THEATER).toMatch(/addNonThrowingPair/);
    expect(REJECT_SRC.length).toBeGreaterThan(200);
    expect(REJECT_SRC).toMatch(/addNonThrowingPair/);
    expect(REJECT_SRC).toMatch(/process\.exit\(1\)/);
    expect(reject(THEATER_PATH).status).toBe(1);
    expect(reject(CLEAN_PATH).status).toBe(0);
    expect(SKILL).toMatch(/skills\/vs-deslop\/scripts\/reject-code-slop\.mjs/);
    expect(SKILL).toMatch(
      /try\/catch theater: a try\/catch around non-throwing code/i,
    );
    expect(SKILL).not.toMatch(
      /a file that matches test\/fixtures\/try-catch-theater\.ts fails the catalog/i,
    );
    expect(SKILL).not.toMatch(/addNonThrowingPair/);
  });
});

describe('vs-deslop: stays off writing-voice rules', () => {
  it('rejects writing-voice, em-dash policy, and add-soul rules', () => {
    expect(SKILL).not.toMatch(/writing[- ]voice/i);
    expect(SKILL).not.toMatch(/em[- ]dash policy/i);
    expect(SKILL).not.toMatch(/add soul/i);
    expect(SKILL).not.toMatch(/\bsoul\b/i);
    expect(SKILL).not.toMatch(/\brhythm\b/i);
    expect(SKILL).not.toMatch(/banned-?word/i);
  });
});
