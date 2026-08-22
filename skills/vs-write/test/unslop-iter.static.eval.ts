import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { describe, expect, it } from 'vitest';
import { SLOP_FIXTURES } from './cases';

const ROOT = path.resolve(__dirname, '..', '..', '..');
const SKILL_PATH = path.resolve(ROOT, 'skills', 'vs-write', 'SKILL.md');
const RAW = fs.readFileSync(SKILL_PATH, 'utf8');
const SKILL = RAW.replace(/\s+/g, ' ');
const FIXTURE_DIR = path.join(__dirname, 'fixtures');
const REJECT = path.resolve(
  ROOT,
  'skills',
  'vs-write',
  'scripts',
  'reject-slop.mjs',
);
const REJECT_SRC = fs.readFileSync(REJECT, 'utf8');
const CLOSER = path.join(FIXTURE_DIR, 'bad-closer.md');
const COMPARISON = path.join(FIXTURE_DIR, 'comparison-crutch.md');
const CLEAN = path.join(FIXTURE_DIR, 'clean-deploy-note.md');

function reject(file: string) {
  return spawnSync(process.execPath, [REJECT, file], { encoding: 'utf8' });
}

describe('vs-write: fixture-backed unslop pins', () => {
  it('names reject-slop.mjs as the rewrite audit step', () => {
    expect(SKILL).toMatch(/skills\/vs-write\/scripts\/reject-slop\.mjs/);
    expect(SKILL).toMatch(/then fix remaining tells/);
    expect(SKILL).not.toMatch(/self-audit/i);
  });

  it('keeps em dashes only for source or requested voice and does not model them', () => {
    expect(SKILL).toMatch(
      /keep an em dash only if (the )?source or requested voice uses them/i,
    );
    expect(RAW).not.toMatch(/\u2014/);
  });

  it('ends on the last concrete fact and reject-slop fails the closer fixture', () => {
    const closer = fs.readFileSync(CLOSER, 'utf8');
    expect(closer).toMatch(/In conclusion/);
    expect(closer).toMatch(/Overall/);
    expect(closer).toMatch(/the future looks bright/);
    expect(REJECT_SRC.length).toBeGreaterThan(200);
    expect(REJECT_SRC).toMatch(/In conclusion/);
    expect(REJECT_SRC).toMatch(/the future looks bright/);
    expect(REJECT_SRC).toMatch(/process\.exit\(1\)/);
    expect(reject(CLOSER).status).toBe(1);
    expect(reject(CLEAN).status).toBe(0);
    expect(SKILL).toMatch(
      /end the artifact on the last concrete fact, takeaway, or next action/i,
    );
    expect(SKILL).not.toMatch(
      /a draft that matches test\/fixtures\/bad-closer\.md fails the audit/i,
    );
    expect(SKILL).not.toMatch(/In conclusion/);
    expect(SKILL).not.toMatch(/Overall/);
    expect(SKILL).not.toMatch(/the future looks bright/);
  });

  it('reject-slop fails comparison-crutch without quoting the tokens in SKILL', () => {
    const comparison = fs.readFileSync(COMPARISON, 'utf8');
    expect(comparison).toMatch(/not X but Y/);
    expect(comparison).toMatch(/if you'?re coming from/i);
    expect(REJECT_SRC).toMatch(/not X but Y/);
    expect(REJECT_SRC).toMatch(/coming from/);
    expect(reject(COMPARISON).status).toBe(1);
    expect(SKILL).toMatch(/stands? without comparison framing/i);
    expect(SKILL).not.toMatch(
      /a draft that matches test\/fixtures\/comparison-crutch\.md fails the audit/i,
    );
    expect(SKILL).not.toMatch(/not X but Y/i);
    expect(SKILL).not.toMatch(/if you'?re coming from/i);
  });

  it('registers the slop fixtures in cases.ts', () => {
    expect([...SLOP_FIXTURES]).toEqual(['bad-closer.md', 'comparison-crutch.md']);
  });

  it('does not leave hedge slogans on the artifact', () => {
    expect(SKILL).not.toMatch(/you may want to consider/i);
    expect(SKILL).not.toMatch(/it'?s worth noting/i);
  });
});
