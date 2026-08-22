import * as fs from 'node:fs';
import * as path from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = path.resolve(__dirname, '..', '..', '..');
const SKILL_PATH = path.resolve(ROOT, 'skills', 'vs-write', 'SKILL.md');
const RAW = fs.readFileSync(SKILL_PATH, 'utf8');
const SKILL = RAW.replace(/\s+/g, ' ');
const FIXTURE_DIR = path.join(__dirname, 'fixtures');
const CLOSER = fs.readFileSync(path.join(FIXTURE_DIR, 'bad-closer.md'), 'utf8');
const COMPARISON = fs.readFileSync(
  path.join(FIXTURE_DIR, 'comparison-crutch.md'),
  'utf8',
);

describe('vs-write: fixture-backed unslop pins', () => {
  it('requires rewrite then self-audit then fix remaining tells', () => {
    expect(SKILL).toMatch(
      /Rewrite, then self-audit, then fix remaining tells/,
    );
  });

  it('keeps em dashes only for source or requested voice and does not model them', () => {
    expect(SKILL).toMatch(
      /keep an em dash only if (the )?source or requested voice uses them/i,
    );
    expect(RAW).not.toMatch(/\u2014/);
  });

  it('ends on the last concrete fact and rejects the closer fixture class', () => {
    expect(CLOSER).toMatch(/In conclusion/);
    expect(CLOSER).toMatch(/Overall/);
    expect(CLOSER).toMatch(/the future looks bright/);
    expect(SKILL).toMatch(
      /end the artifact on the last concrete fact, takeaway, or next action/i,
    );
    expect(SKILL).toMatch(
      /a draft that matches test\/fixtures\/bad-closer\.md fails the audit/i,
    );
    expect(SKILL).not.toMatch(/In conclusion/);
    expect(SKILL).not.toMatch(/Overall/);
    expect(SKILL).not.toMatch(/the future looks bright/);
  });

  it('rejects comparison-crutch drafts without quoting the crutch tokens', () => {
    expect(COMPARISON).toMatch(/not X but Y/);
    expect(COMPARISON).toMatch(/if you'?re coming from/i);
    expect(SKILL).toMatch(/stands? without comparison framing/i);
    expect(SKILL).toMatch(
      /a draft that matches test\/fixtures\/comparison-crutch\.md fails the audit/i,
    );
    expect(SKILL).not.toMatch(/not X but Y/i);
    expect(SKILL).not.toMatch(/if you'?re coming from/i);
  });

  it('does not leave hedge slogans on the artifact', () => {
    expect(SKILL).not.toMatch(/you may want to consider/i);
    expect(SKILL).not.toMatch(/it'?s worth noting/i);
  });
});
