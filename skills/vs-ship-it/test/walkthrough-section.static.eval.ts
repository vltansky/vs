import * as fs from 'node:fs';
import * as path from 'node:path';
import { describe, expect, it } from 'vitest';

// Static contract for the collapsed Walkthrough that ship-it writes into every
// PR body. `problems(skill)` returns every broken rule; the shipped skill must
// return none, and each mutant (a known way to regress the cut) must return some.

const ROOT = path.resolve(__dirname, '..', '..', '..');
const SKILL = fs.readFileSync(path.resolve(__dirname, '..', 'SKILL.md'), 'utf8');

function section(skill: string, heading: string): string {
  const from = skill.indexOf(`\n${heading}\n`);
  if (from === -1) return '';
  const rest = skill.slice(from + heading.length + 2);
  const stop = rest.search(/\n#{2,3} /);
  return stop === -1 ? rest : rest.slice(0, stop);
}

function problems(skill: string): string[] {
  const out: string[] = [];
  const rules = section(skill, '### Walkthrough');
  const template = skill.slice(skill.indexOf('## Review focus'));
  if (!rules) return ['no ### Walkthrough rules section'];

  if (!/<details><summary>Walkthrough: <N> areas, <M> files<\/summary>/.test(template))
    out.push('template has no collapsed Walkthrough <details>');
  if (!/`<details><summary>Walkthrough: N areas, M files<\/summary>`/.test(rules))
    out.push('rules do not require a collapsed <details> summary');
  if (!/Every PR body ends with one collapsed Walkthrough section, always, including\s+a one-file PR/.test(rules))
    out.push('walkthrough is not on every PR');
  if (/\b(?:10|ten)\+?\s*(?:or more\s+)?(?:changed\s+)?files\b|size gate applies|only (?:on|for) (?:large|big)/i.test(rules.replace(/There is no size gate/, '')))
    out.push('walkthrough has a size gate');
  if (!/Grouped by area, not by file/.test(rules) || /one group per file/i.test(rules))
    out.push('walkthrough is not grouped by area');
  if (!/Riskiest first/.test(rules) || !/Order 🔴 groups, then 🟡, then 🟢/.test(rules))
    out.push('groups are not risk-ordered');
  if (!/🔴 high risk, 🟡 medium, or 🟢 low/.test(rules)) out.push('no risk markers');
  if (!/Merge risk\s+vocabulary/.test(rules)) out.push('risk does not reuse Merge risk vocabulary');
  if (!/fenced `diff` block of\s+language-agnostic logic pseudocode/.test(rules))
    out.push('group body is not a logic pseudocode diff');
  if (!/No real code, no hunks, no file\s+contents/.test(rules) || /include (?:the )?(?:real code|hunks)/i.test(rules))
    out.push('real code or hunks allowed');
  if (!/never invent a step/.test(rules)) out.push('pseudocode may be invented');
  if (!/blob\/<HEAD_SHA>\/<path>/.test(rules) || !/blob\/<HEAD_SHA>\//.test(template))
    out.push('links are not pinned to the head SHA');
  if (!/Refresh the links at every handoff where the head moved/.test(rules) || /refresh (?:the links |it )?once/i.test(skill))
    out.push('links are not refreshed at every handoff where the head moved');
  if (!/rerun `pr-media-gate\.mjs` on the body/.test(rules)) out.push('refresh does not rerun the gate');
  if (!/the last block of the body, after Review focus/.test(rules) || !/Tests, if present, then Review focus, then Walkthrough/.test(rules))
    out.push('Walkthrough is not the last block after Tests and Review focus');
  if (/vs-pr-walkthrough|SKIPPED_SMALL_PR|walkthrough child/i.test(skill))
    out.push('old walkthrough skill still referenced');
  return out;
}

const mutants: Record<string, (s: string) => string> = {
  'section dropped': (s) => s.replace(/### Walkthrough\n[\s\S]*?(?=### Step 3)/, ''),
  'not collapsed': (s) =>
    s.replaceAll('<details><summary>Walkthrough', '<div><b>Walkthrough').replaceAll('`<details><summary>Walkthrough', '`## Walkthrough'),
  'grouped by file': (s) => s.replace('Grouped by area, not by file', 'One group per file'),
  'not risk-ordered': (s) => s.replace('Order 🔴 groups, then 🟡, then 🟢.', 'Order groups alphabetically.'),
  'real code allowed': (s) =>
    s.replace('No real code, no hunks, no file\n  contents', 'Include the real code hunks and file\n  contents'),
  'size gate (10+ files)': (s) =>
    s.replace('Every PR body ends with one collapsed Walkthrough section, always, including\na one-file PR.', 'PRs with 10 or more changed files end with one collapsed Walkthrough section.'),
  'old skill referenced': (s) => s.replace('Hand the verified PR to `vs-baby-sit`', 'Start `vs-pr-walkthrough`, then hand the verified PR to `vs-baby-sit`'),
  'links not head-pinned': (s) => s.replaceAll('blob/<HEAD_SHA>/', 'blob/master/'),
  'refresh once only': (s) =>
    s.replace('Refresh the links at every handoff where the head moved', 'Refresh the links once at the end'),
  'refresh skips the gate': (s) => s.replace('rerun `pr-media-gate.mjs` on the body', 'skip the gate'),
  'not the last block': (s) => s.replace('the last block of the body, after Review focus', 'placed after Merge risk'),
};

describe('ship-it Walkthrough section contract', () => {
  it('the shipped skill has no problems', () => {
    expect(problems(SKILL)).toEqual([]);
  });

  it.each(Object.entries(mutants))('mutant "%s" is caught', (_name, mutate) => {
    const mutated = mutate(SKILL);
    expect(mutated).not.toBe(SKILL);
    expect(problems(mutated).length).toBeGreaterThan(0);
  });

  it('the vs-pr-walkthrough skill is gone from the repo and plugin manifest', () => {
    expect(fs.existsSync(path.join(ROOT, 'skills', 'vs-pr-walkthrough'))).toBe(false);
    const manifest = fs.readFileSync(path.join(ROOT, '.claude-plugin', 'plugin.json'), 'utf8');
    expect(manifest).not.toMatch(/vs-pr-walkthrough/);
  });
});
