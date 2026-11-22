import { SHIP_IT_SOURCE } from './ship-it-source';
import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { describe, expect, it } from 'vitest';

// Static contract for three ship-it rules from the long-running-harness work: the PR
// carries the shape-it plan, Verification carries test or prod evidence for the head,
// and no test is edited just to pass. `problems(skill)` returns every broken rule; the
// shipped skill returns none and each mutant returns some. The gate cases run the real
// pr-media-gate.mjs, so the documented `**Plan:**` block is proven to fit the one expander.

const SKILL = SHIP_IT_SOURCE;
const GATE = path.resolve(__dirname, '..', '..', 'vs-internal-shared', 'scripts', 'pr-media-gate.mjs');

function para(skill: string, lead: string): string {
  const from = skill.indexOf(lead);
  if (from === -1) return '';
  const rest = skill.slice(from + lead.length);
  const stop = rest.search(/\n(?:- )?\*\*[A-Z][^*\n]+\.\*\* |\n\n(?!  )|\n#{2,4} /);
  return lead + (stop === -1 ? rest : rest.slice(0, stop));
}

function problems(skill: string): string[] {
  const out: string[] = [];
  const plan = para(skill, '**Plan.**');
  const evidence = para(skill, '- **Test or prod evidence.**');
  const noEdit = para(skill, '**Never edit tests to pass.**');
  const example = skill.match(/````markdown[\s\S]*?````/)?.[0] ?? '';
  const verification = example.split('\n## Verification\n')[1] ?? '';

  if (!plan) out.push('no plan rule');
  if (!/shape-it plan/.test(plan) || !/build-it handoff, its\s+progress note/.test(plan)) out.push('plan sources missing');
  if (!/committed in the repo gets the head-pinned `\[Spec\]` link/.test(plan)) out.push('in-repo plan not linked');
  if (!/outside the repo cannot be linked: add a `\*\*Plan:\*\*` block inside the expander/.test(plan)) out.push('outside plan dropped');
  if (!/the goal, the slice this PR delivers, and the slices still to come/.test(plan)) out.push('plan block contents missing');
  if (!/Never add a second `<details>`/.test(plan)) out.push('plan may add a second expander');
  if (!/No plan found: skip\s+the block; never invent one/.test(plan)) out.push('plan may be invented');
  if (!/\n\*\*Plan:\*\* <goal> · This PR: <slice> · Next: </.test(example)) out.push('example has no Plan block');

  if (!evidence) out.push('no evidence rule');
  if (!/at least one real result\s+for this head/.test(evidence)) out.push('evidence not tied to head');
  if (!/`\*\*Automated:\*\*` with the command and its result/.test(evidence) || !/`\*\*Prod:\*\*` with what was observed after a deploy/.test(evidence))
    out.push('evidence kinds missing');
  if (!/Reuse existing results;\s+this adds no runs/.test(evidence)) out.push('evidence starts new runs');
  if (!/`\*\*Still unverified:\*\* tests; <blocker>`/.test(evidence)) out.push('no evidence gap line');
  if (!/Never claim a pass without the\s+command/.test(evidence)) out.push('pass without command allowed');
  if (!/- \*\*Automated:\*\* `<command>` passed\.\n- \*\*Prod:\*\* </.test(verification)) out.push('example has no Prod line');

  if (!noEdit) out.push('no test-edit rule');
  if (!/Do not edit, weaken, skip, or delete a test to\s+turn a red check green/.test(noEdit)) out.push('test edits allowed');
  if (!/Fix the code, or classify the failure above/.test(noEdit)) out.push('no fix path');
  const baseline = skill.indexOf('**Failure baseline.**');
  if (baseline === -1 || skill.indexOf('**Never edit tests to pass.**') < baseline) out.push('test-edit rule before failure baseline');

  if (!/- \[ \] A shape-it plan, when found, is in the expander/.test(skill)) out.push('checklist misses plan');
  if (!/- \[ \] Verification has test or prod evidence for this head/.test(skill)) out.push('checklist misses evidence');
  if (!/- \[ \] No test was edited, weakened, skipped, or deleted just to pass/.test(skill)) out.push('checklist misses test edits');
  return out;
}

const mutants: Record<string, (s: string) => string> = {
  'no plan rule': (s) => s.replace(/\*\*Plan\.\*\*[\s\S]*?never invent one\.\n/, ''),
  'outside plan dropped': (s) => s.replace('A plan\noutside the repo cannot be linked: add a `**Plan:**` block inside the expander', 'A plan outside the repo is skipped'),
  'plan in second expander': (s) => s.replace(' Never add a second `<details>` for it.', ' Put it in its own `<details>`.'),
  'plan invented': (s) => s.replace('No plan found: skip\nthe block; never invent one.', 'No plan found: summarize the diff as the plan.'),
  'plan contents vague': (s) => s.replace('the goal, the slice this PR delivers, and the slices still to come', 'a summary'),
  'example drops Plan': (s) => s.replace('**Plan:** <goal> · This PR: <slice> · Next: <remaining slices, or none>\n', ''),
  'evidence not head': (s) => s.replace('at least one real result\n  for this head', 'a result'),
  'evidence prod only': (s) => s.replace('`**Automated:**` with the command and its result, or\n  ', ''),
  'evidence runs suites': (s) => s.replace('Reuse existing results;\n  this adds no runs.', 'Run the full suite for it.'),
  'evidence gap silent': (s) => s.replace('write\n  `**Still unverified:** tests; <blocker>`', 'omit the line'),
  'pass without command': (s) => s.replace(' Never claim a pass without the\n  command that produced it.', ''),
  'example drops Prod': (s) => s.replace('- **Prod:** <observed result after deploy, with URL or log line and time>\n', ''),
  'tests may be skipped': (s) => s.replace('Do not edit, weaken, skip, or delete a test to\nturn a red check green.', 'Skip a flaky test to turn a red check green.'),
  'checklist misses test edits': (s) => s.replace('- [ ] No test was edited, weakened, skipped, or deleted just to pass.\n', ''),
  'checklist misses plan': (s) => s.replace('- [ ] A shape-it plan, when found, is in the expander', '- [ ] Plan optional'),
};

function git(cwd: string, ...args: string[]) {
  const r = spawnSync('git', args, { cwd, encoding: 'utf8' });
  if (r.status !== 0) throw new Error(r.stderr);
  return r.stdout.trim();
}

function skillRepo() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'vs-plan-gate-'));
  git(dir, 'init', '-q', '-b', 'main');
  git(dir, 'config', 'user.email', 'eval@example.com');
  git(dir, 'config', 'user.name', 'eval');
  fs.writeFileSync(path.join(dir, 'README.md'), 'base\n');
  git(dir, 'add', '.');
  git(dir, 'commit', '-q', '-m', 'base');
  git(dir, 'checkout', '-q', '-b', 'feature');
  fs.mkdirSync(path.join(dir, 'skills', 'a'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'skills', 'a', 'SKILL.md'), 'rule\n');
  git(dir, 'add', '.');
  git(dir, 'commit', '-q', '-m', 'feat: add rule');
  return dir;
}

function runGate(cwd: string, body: string) {
  const file = path.join(cwd, 'pr-body.md');
  fs.writeFileSync(file, body);
  return spawnSync(process.execPath, [GATE, file, '--base', 'main', '--title', 'feat: add rule', '--proof-first'], { cwd, encoding: 'utf8' });
}

const assets = 'https://raw.githubusercontent.com/vltansky/vs/master/skills/vs-ship-it/assets';
const BODY = [
  'Builders now start each session on a green baseline.',
  '**Before:** a session starts new work on a broken branch.\n\n**After:** a session runs the smoke first.',
  `**Risk:** <img alt="Two-way door" height="20" src="${assets}/badge-two-way-door.svg"> <img alt="Narrow blast radius" height="20" src="${assets}/badge-narrow-blast.svg"><br>\nA revert restores the old skill text.`,
  '<details>\n<summary>Plan and verification</summary>\n\n<!-- vs:proof-first -->\n\n'
    + '**Plan:** Session discipline · This PR: baseline smoke · Next: progress note\n\n'
    + '## Verification\n\n- **Automated:** `npm run eval:static` passed.\n- **Prod:** installed plugin loaded the new rule at 10:00 UTC.\n'
    + '- **No tests changed:** the skill rule has no test yet.\n\n</details>',
].join('\n\n');

describe('ship-it plan, evidence, and no-test-edit contract', () => {
  it('the shipped skill has no problems', () => {
    expect(problems(SKILL)).toEqual([]);
  });

  it.each(Object.entries(mutants))('mutant "%s" is caught', (_name, mutate) => {
    const mutated = mutate(SKILL);
    expect(mutated).not.toBe(SKILL);
    expect(problems(mutated).length).toBeGreaterThan(0);
  });

  it('the gate accepts a Plan block and Prod line inside the one expander', () => {
    const result = runGate(skillRepo(), BODY);
    expect(result.status, result.stderr).toBe(0);
  });

  it('the gate rejects the plan in a second nested expander', () => {
    const nested = BODY.replace('**Plan:** Session discipline · This PR: baseline smoke · Next: progress note',
      '<details><summary>Plan</summary>Session discipline</details>');
    expect(runGate(skillRepo(), nested).status).toBe(1);
  });
});
