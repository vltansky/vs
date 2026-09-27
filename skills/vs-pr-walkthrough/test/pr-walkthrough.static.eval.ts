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
    expect(SKILL).toMatch(/\/vs-before-after/);
    expect(SKILL).toMatch(/\/vs-roast-code/);
    expect(SKILL).toMatch(/Do not turn the walkthrough into a review verdict/i);
  });

  it('pins the walkthrough to the exact PR head', () => {
    expect(SKILL).toMatch(/exact head SHA/i);
    expect(SKILL).toMatch(/PR URL plus exact head SHA|head SHA commit link/i);
    expect(SKILL).toMatch(/BLOCKED_STALE_HEAD/);
    expect(SCHEMA).toMatch(/40-character PR head SHA/i);
  });

  it('can be composed by ship-it for automatic large-PR handoff', () => {
    expect(SKILL).toMatch(/Consumers:[\s\S]*`vs-ship-it`[\s\S]*automatic large-PR review handoff/i);
  });
});

describe('vs-pr-walkthrough story contract', () => {
  it('orders the walkthrough as a product or execution story rather than directory dump', () => {
    expect(SKILL).toMatch(/cause to effect|product|execution (?:story|path)|story/i);
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

  it('keeps the original CLI and narrative surface', () => {
    expect(SKILL).toMatch(/original positional CLI/i);
    expect(SKILL).toMatch(/renderer-side diff fetching/i);
    expect(SKILL).toMatch(/Re-running after the PR changes/i);
    for (const field of ['subtitle', 'pr_label', 'fold', 'notes']) {
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
    expect(SKILL).toMatch(/single-column walkthrough UI|GitHub-native/i);
    expect(SKILL).toMatch(/direct GitHub links|PR URL|head SHA/i);
    expect(SKILL).toMatch(/first-screen screenshot/i);
  });

  it('registers the public walkthrough skill', () => {
    const manifest = fs.readFileSync(path.join(ROOT, '.claude-plugin', 'plugin.json'), 'utf8');
    const readme = fs.readFileSync(path.join(ROOT, 'README.md'), 'utf8');
    expect(JSON.parse(manifest).skills).toContain('./skills/vs-pr-walkthrough');
    expect(readme).toMatch(/\| `\/vs-pr-walkthrough` \|/);
  });
});

describe('vs-pr-walkthrough section spine + pair-file expand', () => {
  it('makes short fenced language-agnostic pseudocode the section spine', () => {
    expect(SKILL).toMatch(/pseudocode/i);
    expect(SKILL).toMatch(/short fenced pseudocode|fenced.*pseudocode|language-agnostic/i);
    expect(SKILL).toMatch(/section spine|spine per section/i);
    expect(SKILL).toMatch(/lede.{0,120}(?:not|secondary|context|one[- ]line)|(?:not|secondary).{0,80}lede|primary spine.{0,80}pseudocode|pseudocode.{0,80}(?:spine|primary)/is);
    expect(SCHEMA).toMatch(/`pseudocode`/);
  });

  it('requires pair-file pseudocode per path and click-expand real hunks (collapsed by default)', () => {
    expect(SKILL).toMatch(/pair[- ]file pseudocode|per[- ]file pseudocode|file card/i);
    expect(SKILL).toMatch(/Show real diff|click[- ]expand|expand(?:s|\/collapses)?|collapsed by default/i);
    expect(SKILL).toMatch(/real (?:diff )?hunks|unified hunks|green\/?red/i);
    expect(SCHEMA).toMatch(/pair[- ]file|file.*pseudocode|pseudocode.*path|"path"/i);
    expect(SCHEMA).toMatch(/Show real diff|click[- ]expand|collapsed|details|expand/i);
  });

  it('caps section and pair-file pseudocode at about 12 lines', () => {
    expect(SKILL).toMatch(/~?\s*12\s*lines?|12[- ]line/i);
    expect(SCHEMA).toMatch(/12\s*(?:non-empty )?lines?/i);
  });

  it('keeps PR URL, head SHA, and per-file blob links at headSha', () => {
    expect(SKILL).toMatch(/blob\/|\/blob\/|blob at headSha/i);
    expect(SKILL).toMatch(/head SHA link|commit link|\/commit\//i);
    expect(SCHEMA).toMatch(/`pr`/);
    expect(SCHEMA).toMatch(/`headSha`/);
    expect(SCHEMA).toMatch(/blob\/|\/blob\//);
  });

  it('keeps placement fail-closed with the new files object shape', () => {
    expect(SKILL).toMatch(/exactly once|placement/i);
    expect(SCHEMA).toMatch(/path.*pseudocode|files.*object|"path"/i);
    expect(SCHEMA).toMatch(/rejects missing, duplicated, and unknown paths/i);
  });

  it('uses the show-me litmus: predict next step under a condition vs who/what connects', () => {
    expect(SKILL).toMatch(/predict(?:\s+the)?\s+next\s+step/i);
    expect(SKILL).toMatch(/condition/i);
    expect(SKILL).toMatch(/who\/what connects|who or what connects/i);
  });

  it('does not change ship-it Summary pick-one or pathgrade', () => {
    expect(SKILL).toMatch(/not (?:change|touch|alter|inherit).{0,80}ship-it|ship-it.{0,80}(?:pick-one|Summary).{0,80}(?:unchanged|untouched|stays)|unlike.{0,40}ship-it|do not.{0,40}ship-it/is);
    expect(SKILL).toMatch(/pathgrade|Do not change pathgrade/i);
  });
});
