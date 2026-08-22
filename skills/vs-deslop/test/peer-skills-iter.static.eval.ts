import * as fs from 'node:fs';
import * as path from 'node:path';
import { describe, expect, it } from 'vitest';

const DIR = path.resolve(__dirname, '..');
const SKILL_RAW = fs.readFileSync(path.join(DIR, 'SKILL.md'), 'utf8');
const SKILL = SKILL_RAW.replace(/\s+/g, ' ');
const THEATER = fs.readFileSync(
  path.join(__dirname, 'fixtures', 'try-catch-theater.ts'),
  'utf8',
);

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

  it('ties the theater fixture to a catalog fail without quoting its tokens', () => {
    expect(THEATER).toMatch(/addNonThrowingPair/);
    expect(SKILL).toMatch(
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
