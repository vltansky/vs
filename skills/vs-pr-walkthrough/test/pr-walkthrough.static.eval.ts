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
    expect(SKILL).toMatch(/PR URL plus exact head SHA/i);
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

  it('keeps the original CLI and narrative surface without rendered hunk panels', () => {
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

describe('vs-pr-walkthrough pseudocode spine', () => {
  it('makes short fenced language-agnostic pseudocode the section spine, not prose lede', () => {
    expect(SKILL).toMatch(/pseudocode/i);
    expect(SKILL).toMatch(/short fenced pseudocode|fenced.*pseudocode|language-agnostic/i);
    expect(SKILL).toMatch(/not (?:a )?(?:real[- ]language|TypeScript|Python|prose)|language-agnostic/i);
    expect(SKILL).toMatch(/lede.{0,120}(?:not|secondary|context|one[- ]line)|(?:not|secondary).{0,80}lede|primary spine.{0,80}pseudocode|pseudocode.{0,80}(?:spine|primary)/is);
    expect(SCHEMA).toMatch(/`pseudocode`/);
  });

  it('caps section pseudocode at about 12 lines and does not render unified diffs in the HTML', () => {
    expect(SKILL).toMatch(/~?\s*12\s*lines?|12[- ]line/i);
    expect(SKILL).toMatch(/must not (?:show|render) (?:actual )?code diffs|no (?:green\/?red|unified[- ]?diff)|(?:drop|stop rendering|does not render).{0,40}(?:hunk|file panel|unified[- ]?diff)|HTML must not show.{0,40}diff/is);
    expect(SKILL).not.toMatch(/Real diff hunks stay as evidence/i);
    expect(SKILL).not.toMatch(/Do not remove the\s+diff surface/i);
  });

  it('keeps PR URL, head SHA, and ordered per-file blob links so the reader opens real code on GitHub', () => {
    expect(SKILL).toMatch(/opens? real code on GitHub/i);
    expect(SKILL).toMatch(/head SHA link|commit link|\/commit\//i);
    expect(SKILL).toMatch(/ordered (?:GitHub )?(?:file )?links|file links in reading order|blob at headSha|\/blob\//i);
    expect(SCHEMA).toMatch(/`pr`/);
    expect(SCHEMA).toMatch(/`headSha`/);
  });

  it('treats files arrays as reading-order source for ordered GitHub links, not hunk panels', () => {
    expect(SKILL).toMatch(/authoring\/(?:order )?validation|order validation without rendering|not rendered as hunk|without rendering hunks|files arrays.{0,80}(?:optional|authoring)|reading[- ]order/is);
    expect(SKILL).toMatch(/ordered (?:GitHub )?(?:file )?links|GitHub (?:file )?links.{0,40}reading[- ]order|blob\/|\/blob\//is);
    expect(SCHEMA).toMatch(/authoring|without rendering hunks|not rendered|optional.*files|files.*optional|reading[- ]order|ordered.*(?:GitHub|blob|link)/is);
    expect(SCHEMA).toMatch(/blob\/|\/blob\/|ordered (?:GitHub )?(?:file )?links/is);
  });

  it('uses the show-me litmus: predict next step under a condition vs who/what connects', () => {
    expect(SKILL).toMatch(/predict(?:\s+the)?\s+next\s+step/i);
    expect(SKILL).toMatch(/condition/i);
    expect(SKILL).toMatch(/who\/what connects|who or what connects/i);
  });

  it('does not change ship-it Summary pick-one', () => {
    expect(SKILL).toMatch(/not (?:change|touch|alter|inherit).{0,80}ship-it|ship-it.{0,80}(?:pick-one|Summary).{0,80}(?:unchanged|untouched|stays)|unlike.{0,40}ship-it|do not.{0,40}ship-it/is);
  });
});
