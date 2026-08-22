import * as fs from 'node:fs';
import * as path from 'node:path';
import { describe, expect, it } from 'vitest';

const DIR = path.resolve(__dirname, '..');
const SKILL_RAW = fs.readFileSync(path.join(DIR, 'SKILL.md'), 'utf8');
const SKILL = SKILL_RAW.replace(/\s+/g, ' ');

describe('vs-deslop: wave-2 exclusive code-cleanup pins', () => {
  it('names the invariant or call site, not only smell and file', () => {
    expect(SKILL).toMatch(
      /name each smell.{0,80}(invariant|call site).{0,80}(invariant|call site|file)/i,
    );
    expect(SKILL).toMatch(/\binvariant\b/i);
    expect(SKILL).toMatch(/call site/i);
  });

  it('forbids inventing types, files, or flags while cleaning', () => {
    expect(SKILL).toMatch(
      /do not invent types, files, flags/i,
    );
  });

  it('requires smell category on each Deslop Result cleaned line', () => {
    expect(SKILL).toMatch(/## Deslop Result/);
    expect(SKILL).toMatch(
      /Cleaned:.*- <change, smell category/i,
    );
  });

  it('cuts unnecessary async/await and Promise wrapping', () => {
    expect(SKILL).toMatch(/async`?\/`?await/i);
    expect(SKILL).toMatch(/Promise wrapping/i);
  });

  it('keeps one job per unit and does not restate logic across layers', () => {
    expect(SKILL).toMatch(/one job per unit/i);
    expect(SKILL).toMatch(
      /restate the same logic in (many |multiple )?layers/i,
    );
  });

  it('takes the minimum effective edit and leaves strong local code alone', () => {
    expect(SKILL).toMatch(/minimum effective edit/i);
    expect(SKILL).toMatch(/leave strong local code alone/i);
  });

  it('binds exclusive procedure order collect-validate-delete-verify-rescan', () => {
    expect(SKILL).toMatch(
      /exclusive (procedure )?order:\*?\*?\s*collect\s*(→|->)\s*validate/i,
    );
    expect(SKILL).toMatch(
      /collect\s*(→|->)\s*validate\/?discard[^.]{0,40}(→|->)\s*surgical delete\s*(→|->)\s*verify\s*(→|->)\s*re-?scan/i,
    );
  });
});

describe('vs-deslop: wave-2 stays off writing-voice rules', () => {
  it('rejects writing-voice, em-dash policy, and add-soul rules', () => {
    expect(SKILL).not.toMatch(/writing[- ]voice/i);
    expect(SKILL).not.toMatch(/em[- ]dash policy/i);
    expect(SKILL).not.toMatch(/add soul/i);
    expect(SKILL).not.toMatch(/\bsoul\b/i);
    expect(SKILL).not.toMatch(/\brhythm\b/i);
    expect(SKILL).not.toMatch(/banned-?word/i);
  });
});
