import * as fs from 'fs';
import * as path from 'path';
import { describe, expect, it } from 'vitest';

const DIR = path.resolve(__dirname, '..');
const ROOT = path.resolve(DIR, '..', '..');
const SKILL = fs.readFileSync(path.join(DIR, 'SKILL.md'), 'utf8');
const SCHEMA = fs.readFileSync(path.join(DIR, 'references', 'config-schema.md'), 'utf8');

describe('vs-pr-walkthrough boundary', () => {
  it('credits the original skill by Oren Roth', () => {
    expect(SKILL).toMatch(/original `pr-walkthrough` skill by \*\*Oren Roth\*\*/);
  });

  it('owns large GitHub PR walkthroughs and routes adjacent needs elsewhere', () => {
    expect(SKILL).toMatch(/large or unfamiliar GitHub PR/i);
    expect(SKILL).toMatch(/normally ten\s+or more changed files/i);
    expect(SKILL).toMatch(/SKIPPED_SMALL_PR/);
    expect(SKILL).toMatch(/\/vs-brief/);
    expect(SKILL).toMatch(/\/vs-roast-code/);
    expect(SKILL).toMatch(/Do not turn the walkthrough into a review verdict/i);
  });

  it('pins the walkthrough to the exact PR head', () => {
    expect(SKILL).toMatch(/exact head SHA/i);
    expect(SKILL).toMatch(/PR URL plus exact head SHA/i);
    expect(SKILL).toMatch(/BLOCKED_STALE_HEAD/);
    expect(SCHEMA).toMatch(/40-character PR head SHA/i);
  });

  it('can be composed by ship-it for automatic large-PR handoff', () => {
    expect(SKILL).toMatch(/Consumers:[\s\S]*`vs-ship-it`[\s\S]*automatic large-PR review handoff/i);
  });
});

describe('vs-pr-walkthrough story contract', () => {
  it('orders the complete diff by behavior rather than directory', () => {
    expect(SKILL).toMatch(/cause to effect/i);
    expect(SKILL).toMatch(/Aim for four to eight sections/i);
    expect(SKILL).toMatch(/never split one stage merely to hit a number/i);
    expect(SKILL).toMatch(/User journey/);
    expect(SKILL).toMatch(/Request path/);
    expect(SKILL).toMatch(/Policy path/);
    expect(SKILL).toMatch(/Alphabetical files with narrative\s+labels/i);
  });

  it('requires honest narrative and a final plumbing section', () => {
    expect(SKILL).toMatch(/say what happens, not name a directory/i);
    expect(SKILL).toMatch(/first-needed reading order/i);
    expect(SKILL).toMatch(/Aside · Plumbing/);
    expect(SKILL).toMatch(/verified decision, assumption, workaround, or uncertainty/i);
    expect(SKILL).toMatch(/label unsupported intent as\s+inference/i);
  });
});

describe('vs-pr-walkthrough strict rendering', () => {
  it('fails closed on incomplete or stale maps', () => {
    expect(SKILL).toMatch(/changed file is missing/i);
    expect(SKILL).toMatch(/file is listed twice/i);
    expect(SKILL).toMatch(/listed path is absent/i);
    expect(SKILL).toMatch(/Do not weaken or bypass these checks/i);
    expect(SCHEMA).toMatch(/rejects missing, duplicated, and unknown paths/i);
  });

  it('keeps the complete original feature surface', () => {
    expect(SKILL).toMatch(/original positional CLI/i);
    expect(SKILL).toMatch(/renderer-side diff fetching/i);
    expect(SKILL).toMatch(/self-contained syntax highlighting/i);
    expect(SKILL).toMatch(/Re-running after the PR changes/i);
    for (const field of ['subtitle', 'pr_label', 'path_prefix', 'fold', 'notes']) {
      expect(SCHEMA).toContain(`\`${field}\``);
    }
    expect(SCHEMA).toMatch(/<b> <i> <em> <strong> <code> <br>/);
  });

  it('documents every VS-only adaptation and its reason', () => {
    expect(SKILL).toMatch(/## VS adaptations/);
    expect(SKILL).toMatch(/headSha.*older PR\s+revision/is);
    expect(SKILL).toMatch(/Unsorted.*incomplete story/is);
    expect(SKILL).toMatch(/exact repo paths rather than basenames/i);
    expect(SKILL).toMatch(/Node built-ins.*VS runtime/is);
    expect(SKILL).toMatch(/disk-backed diff.*reproducible evidence/is);
  });

  it('uses bespoke HTML for the interactive review surface', () => {
    expect(SKILL).toMatch(/render-walkthrough\.mjs/);
    expect(SKILL).toMatch(/bespoke HTML rather than\s+HTMDX/i);
    expect(SKILL).toMatch(/original GitHub-native, single-column walkthrough UI/i);
    expect(SKILL).toMatch(/per-file and per-section viewed controls/i);
    expect(SKILL).toMatch(/direct GitHub links/i);
    expect(SKILL).toMatch(/first-screen screenshot/i);
  });

  it('registers the public walkthrough skill', () => {
    const manifest = fs.readFileSync(path.join(ROOT, '.claude-plugin', 'plugin.json'), 'utf8');
    const readme = fs.readFileSync(path.join(ROOT, 'README.md'), 'utf8');
    expect(JSON.parse(manifest).skills).toContain('./skills/vs-pr-walkthrough');
    expect(readme).toMatch(/\| `\/vs-pr-walkthrough` \|/);
  });
});
