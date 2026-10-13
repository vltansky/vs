import * as fs from 'node:fs';
import * as path from 'node:path';
import { describe, expect, it } from 'vitest';

// Static contract for two ship-it body rules: fill the repo's own PR template, and add a
// found-only `Closes #N` / spec line under What Problem This Solves. `problems(skill)` returns
// every broken rule; the shipped skill returns none, and each mutant must return some.

const SKILL = fs.readFileSync(path.resolve(__dirname, '..', 'SKILL.md'), 'utf8');

function para(skill: string, lead: string): string {
  const from = skill.indexOf(lead);
  if (from === -1) return '';
  const rest = skill.slice(from);
  const stop = rest.slice(lead.length).search(/\n\*\*[A-Z][^*\n]+\.\*\* |\n#{2,4} /);
  return stop === -1 ? rest : rest.slice(0, stop + lead.length);
}

function problems(skill: string): string[] {
  const out: string[] = [];
  const tpl = para(skill, '**Repo PR template first.**');
  const link = para(skill, '**Linked issue and spec.**');
  const problem = skill.slice(skill.indexOf('\n## What Problem This Solves\n'), skill.indexOf('\n## What Was Done\n'));
  if (!tpl) return ['no repo PR template rule'];
  if (!link) return ['no linked issue/spec rule'];

  const order = ['.github/pull_request_template.md', '.github/PULL_REQUEST_TEMPLATE.md', 'PULL_REQUEST_TEMPLATE.md', 'docs/pull_request_template.md', '.github/PULL_REQUEST_TEMPLATE/*.md'];
  const at = order.map((name) => tpl.indexOf('`' + name + '`'));
  if (at.some((i) => i === -1) || at.some((i, k) => k > 0 && i < at[k - 1]) || !/case-insensitive/.test(tpl))
    out.push('template lookup order is not fixed');
  if (!/Before you write the body, look for the target/.test(tpl)) out.push('template ignored');
  if (!/keep all of its headings and checklists, in its\s+order, and fill them/.test(tpl)) out.push('template headings not kept');
  if (!/Never delete a template section: write `N\/A`/.test(tpl) || /(?:drop|delete|remove) (?:the )?template sections? that/i.test(tpl))
    out.push('template sections may be deleted');
  if (!/append the other vs sections after the template content\s+\(Walkthrough stays last\)/.test(tpl)) out.push('vs sections not appended after template');
  if (!/Keep template checkboxes unchecked unless the diff or\s+evidence proves them/.test(tpl)) out.push('checkboxes may be ticked without proof');
  if (!/Several templates \(a directory\), none clearly fits:\*\* ask once/.test(tpl) || !/only question ship-it may ask/.test(tpl))
    out.push('multi-template does not ask');
  if (!/Do not ask about a single template\./.test(tpl) || /Exactly one template:\*\*[^-]*ask/i.test(tpl.replace('Do not ask about a single template.', '')))
    out.push('asks when there is a single template');
  if (!/\*\*No template:\*\* use the vs body/.test(tpl)) out.push('no-template path changed');
  if (!/`--template <path>`/.test(tpl) || !/--template <repo PR template>/.test(skill)) out.push('gate does not check template headings');

  if (!/Never invent an issue; if nothing\s+is found, skip the line/.test(link) || /(?:open|create|file) (?:a |an )?(?:new )?issue/i.test(link))
    out.push('issue may be invented');
  if (!/Use `Closes` only when this PR fully resolves the\s+issue, otherwise `Refs #N`/.test(link)) out.push('Closes used for partial');
  if (!/Pin the spec link to the head SHA/.test(link) || !/blob\/<HEAD_SHA>\/<spec path>/.test(problem)) out.push('spec link not pinned');
  if (!/one separate line \(never part of the scenario prose\)/.test(link) || !/\n\nCloses #<N> · \[Spec\]/.test(problem))
    out.push('link line merged into the STE prose');
  if (!/branch name \(`fix\/123-x`\), commit\s+messages, or the shape-it\/build-it handoff/.test(link)) out.push('issue sources missing');
  return out;
}

const mutants: Record<string, (s: string) => string> = {
  'template ignored': (s) => s.replace(/\*\*Repo PR template first\.\*\*[\s\S]*?(?=\*\*Linked issue and spec\.\*\*)/, ''),
  'template sections deleted': (s) =>
    s.replace('Never delete a template section: write `N/A` under\n  one that does not apply.', 'Delete template sections that do not apply.'),
  'multi-template does not ask': (s) =>
    s.replace('ask once with the\n  template names as options. This is the only question ship-it may ask.', 'pick the first template.'),
  'asks when single template': (s) => s.replace('Do not ask about a single template.', 'Ask the user to confirm the template.'),
  'issue invented': (s) =>
    s.replace('Never invent an issue; if nothing\nis found, skip the line.', 'If nothing is found, create a new issue and link it.'),
  'Closes used for partial': (s) =>
    s.replace('Use `Closes` only when this PR fully resolves the\nissue, otherwise `Refs #N`.', 'Always use `Closes`.'),
  'spec link not pinned': (s) =>
    s.replace('Pin the spec link to the head SHA', 'Link the spec on the branch').replace('blob/<HEAD_SHA>/<spec path>', 'blob/<branch>/<spec path>'),
  'link line merged into STE prose': (s) =>
    s
      .replace('one separate line (never part of the scenario prose)', 'a clause at the end of the scenario sentence')
      .replace('mechanism stays in Endpoint / Schema / UI.>\n\nCloses #<N>', 'mechanism stays in Endpoint / Schema / UI. Closes #<N>>'),
  'checkboxes ticked': (s) => s.replace('Keep template checkboxes unchecked unless the diff or\n  evidence proves them.', 'Tick every template checkbox.'),
  'gate skips template': (s) => s.replace(' [--template <repo PR template>]', ''),
  'lookup order shuffled': (s) => s.replace('`PULL_REQUEST_TEMPLATE.md`, `docs/pull_request_template.md`', '`docs/pull_request_template.md`, `PULL_REQUEST_TEMPLATE.md`'),
};

describe('ship-it repo PR template + linked issue/spec contract', () => {
  it('the shipped skill has no problems', () => {
    expect(problems(SKILL)).toEqual([]);
  });

  it.each(Object.entries(mutants))('mutant "%s" is caught', (_name, mutate) => {
    const mutated = mutate(SKILL);
    expect(mutated).not.toBe(SKILL);
    expect(problems(mutated).length).toBeGreaterThan(0);
  });
});
