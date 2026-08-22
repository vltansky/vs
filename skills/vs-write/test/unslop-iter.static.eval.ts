import * as fs from 'node:fs';
import * as path from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = path.resolve(__dirname, '..', '..', '..');
const SKILL_PATH = path.resolve(ROOT, 'skills', 'vs-write', 'SKILL.md');
const RAW = fs.readFileSync(SKILL_PATH, 'utf8');
const SKILL = RAW.replace(/\s+/g, ' ');

describe('vs-write: wave-2 unslop pins', () => {
  it('requires rewrite then self-audit then fix remaining tells', () => {
    expect(SKILL).toMatch(
      /rewrite[,.]? then self-audit[,.]? then fix remaining tells/i,
    );
  });

  it('keeps em dashes only for source or requested voice and does not model them', () => {
    expect(SKILL).toMatch(
      /keep an em dash only if (the )?source or requested voice uses them/i,
    );
    expect(RAW).not.toMatch(/\u2014/);
  });

  it('ends the artifact on the last concrete fact, takeaway, or next action', () => {
    expect(SKILL).toMatch(
      /end the artifact on the last concrete fact, takeaway, or next action/i,
    );
    expect(SKILL).toMatch(/In conclusion/);
    expect(SKILL).toMatch(/Overall/);
  });

  it('the point must stand without comparison framing', () => {
    expect(SKILL).toMatch(/stands? without comparison framing/i);
    expect(SKILL).toMatch(/not X but Y/i);
    expect(SKILL).toMatch(/if you'?re coming from/i);
  });

  it('does not leave hedge slogans on the artifact', () => {
    expect(SKILL).not.toMatch(/you may want to consider/i);
    expect(SKILL).not.toMatch(/it'?s worth noting/i);
  });
});
