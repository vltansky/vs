import * as fs from 'node:fs';
import * as path from 'node:path';
import { describe, expect, it } from 'vitest';

// Static contract for two ship-it body rules: Not covered becomes a reviewer checklist of
// `- [ ]` boxes (or `none`), and bugfix PRs add one `Root cause:` line under What Problem.
// `problems(skill, gate)` returns every broken rule; shipped files return none, mutants some.

const SKILL = fs.readFileSync(path.resolve(__dirname, '..', 'SKILL.md'), 'utf8');
const BUGFIX = fs.readFileSync(path.resolve(__dirname, '..', '..', 'vs-bugfix', 'SKILL.md'), 'utf8');
const GATE = fs.readFileSync(path.resolve(__dirname, '..', '..', 'vs-internal-shared', 'scripts', 'pr-media-gate.mjs'), 'utf8');

function para(skill: string, lead: string): string {
  const from = skill.indexOf(lead);
  if (from === -1) return '';
  const rest = skill.slice(from + lead.length);
  const stop = rest.search(/\n(?:- )?\*\*[A-Z][^*\n]+\.\*\* |\n\n(?!  )|\n#{2,4} /);
  return lead + (stop === -1 ? rest : rest.slice(0, stop));
}

function problems(skill: string, gate: string, bugfix = BUGFIX): string[] {
  const out: string[] = [];
  const box = para(skill, '- **Reviewer checklist.**');
  const root = para(skill, '**Root cause (bugfix PRs only).**');
  const problem = skill.slice(skill.indexOf('\n## What Problem This Solves\n'), skill.indexOf('\n**Before** <same-state'));
  const tests = skill.slice(skill.indexOf('\n## Tests\n\n- `<test file'), skill.indexOf('<!-- From the diff only'));
  if (!box) out.push('no reviewer checklist rule');
  if (!root) out.push('no root cause rule');
  if (!/`- \[ \]`\s+checkboxes the reviewer must verify/.test(box)) out.push('Not covered not a checklist');
  if (!/one\s+concrete\s+check the human runs: the action and the expected result/.test(box)) out.push('checklist items may be vague');
  if (!/write `\*\*Not covered:\*\* none` with\s+no boxes/.test(box)) out.push('none path has boxes or is missing');
  if (!/Never tick a box yourself/.test(box)) out.push('agent may tick boxes');
  if (!/- \*\*Not covered:\*\*\n  - \[ \] </.test(tests)) out.push('template Not covered is not a checklist');
  if (!/branch starts\s+with `fix\/`/.test(root) || !/`fix:` \/\s+`fix\(<scope>\):` conventional prefix/.test(root) || !/labeled `bug`/.test(root))
    out.push('bugfix detection incomplete');
  if (!/after the STE scenario/.test(root) || !/`Root cause: <mechanism>`/.test(root)) out.push('root cause line not after scenario');
  if (!/only place in \*\*What Problem This\s+Solves\*\* where mechanism is allowed;\s+the scenario itself still has no How/.test(root))
    out.push('no-How rule loosened');
  if (!/Non-bug PRs skip the line/.test(root)) out.push('non-bug PRs get root cause');
  if (!/\nRoot cause: <mechanism[^\n]*>\n/.test(problem)) out.push('template has no Root cause line');
  if (!/pass `--bugfix` for a bug-label or vs-bugfix\s+handoff/.test(root) || !/\[--bugfix\]/.test(skill)) out.push('gate not told about bugfix');
  if (!/ship-it was entered from a `\/vs-bugfix` handoff/.test(root) || !/reuse its\s+`\*\*Root cause:\*\*` sentence as is/.test(root))
    out.push('vs-bugfix handoff not a bugfix');
  if (!/at least 4 words, never a `<…>`\s+placeholder or TBD\/TODO\/unknown\/N\/A/.test(root)) out.push('placeholder root cause allowed');
  if (!/auto-detects a bugfix from the\s+head branch and commit subjects/.test(root) || !/`--bugfix=false` only when/.test(root)) out.push('no auto-detect or opt-out');
  if (!/`--template` with no \*\*What Problem This Solves\*\* section/.test(root) || !/Note: Root cause skipped: <template constraint>/.test(root))
    out.push('template without What Problem not handled');
  if (!/convert the text to `- \[ \]` reviewer checkboxes, or to\s+`none`, before updating/.test(skill)) out.push('refresh does not convert old Not covered');
  if (!/reuses the \*\*Root cause:\*\* sentence above as the PR's `Root cause:` line and runs the gate with `--bugfix`/.test(bugfix)
    || !/\*\*Next:\*\* `\/vs-ship-it` \(bugfix handoff: carry the \*\*Root cause:\*\* sentence/.test(bugfix))
    out.push('vs-bugfix handoff drops root cause');
  if (!/Do not name the fix in that block/.test(skill)) out.push('no-How rule removed');
  if (!/notCovered: notCoveredLines\.length > 0 && checklist\.ok/.test(gate)) out.push('gate ignores checklist format');
  if (!/const rootCauseOk = !bugfix \|\| rootCause\.present/.test(gate) || !/const valid = rootCauseOk &&/.test(gate)) out.push('gate ignores root cause');
  if (!/\^--bugfix\(\?:=\(\.\*\)\)\?\$/.test(gate)) out.push('gate rejects --bugfix=value');
  if (!/value = next;\n\s+flagValueAt\.add\(index \+ 1\)/.test(gate) || !/BOOL_TRUE\.test\(next\) \|\| BOOL_FALSE\.test\(next\)/.test(gate))
    out.push('gate rejects --bugfix <value> or eats the body');
  if (!/const bugfix = bugfixFlag \?\? Boolean\(detected\)/.test(gate) || !/FIX_BRANCH = /.test(gate) || !/FIX_SUBJECT = /.test(gate)) out.push('gate does not auto-detect');
  if (!/<\[\^>\]\*>\/\.test\(rootText\)/.test(gate) || !/TBD\|TODO\|unknown/.test(gate) || !/\.length < 4/.test(gate)) out.push('gate accepts placeholder root cause');
  if (!/if \(ticked\) return \{ ok: false/.test(gate)) out.push('gate accepts ticked boxes');
  return out;
}

type P = [string, string, string?];
const mutants: Record<string, (p: P) => P> = {
  'Not covered inline prose': ([s, g]) => [s.replace('list it under it as `- [ ]`\n  checkboxes the reviewer must verify', 'name it inline after the label'), g],
  'vague checklist items': ([s, g]) => [s.replace('one concrete\n  check the human runs: the action and the expected result', 'one area to look at'), g],
  'none with boxes': ([s, g]) => [s.replace('write `**Not covered:** none` with\n  no boxes', 'add a `- [ ] none` box'), g],
  'agent ticks boxes': ([s, g]) => [s.replace(' Never tick a box yourself.', ''), g],
  'template inline Not covered': ([s, g]) => [s.replace('- **Not covered:**\n  - [ ] <action the reviewer runs>', '- **Not covered:** <action the reviewer runs>'), g],
  'no root cause rule': ([s, g]) => [s.replace(/\*\*Root cause \(bugfix PRs only\)\.\*\*[\s\S]*?(?=Examples \(either perspective)/, ''), g],
  'bugfix detection drops issue label': ([s, g]) => [s.replace(' the linked issue is labeled `bug`,', ''), g],
  'vs-bugfix handoff not a bugfix': ([s, g]) => [s.replace(', or\nship-it was entered from a `/vs-bugfix` handoff', ''), g],
  'handoff root cause rewritten': ([s, g]) => [s.replace('reuse its\n`**Root cause:**` sentence as is', 'write a new root cause'), g],
  'placeholder root cause allowed': ([s, g]) => [s.replace('at least 4 words, never a `<…>`\nplaceholder or TBD/TODO/unknown/N/A', 'any text'), g],
  'no auto-detect in skill': ([s, g]) => [s.replace('auto-detects a bugfix from the\nhead branch and commit subjects', 'needs the flag'), g],
  'template without What Problem ignored': ([s, g]) => [s.replace(/A repo `--template` with no[\s\S]*?<template constraint>` line\.\n/, ''), g],
  'refresh keeps old Not covered': ([s, g]) => [s.replace(/ When that rerun fails on an older body[\s\S]*?before updating\./, ''), g],
  'vs-bugfix drops root cause': ([s, g]) => [s, g, BUGFIX.replace(/ as a bugfix: it reuses[^\n]*/, '')],
  'vs-bugfix Next drops root cause': ([s, g]) => [s, g, BUGFIX.replace(' (bugfix handoff: carry the **Root cause:** sentence; ship-it passes `--bugfix`)', '')],
  'gate eats body after --bugfix': ([s, g]) => [s, g.replace('value = next;\n    flagValueAt.add(index + 1);', 'value = next;')],
  'gate no auto-detect': ([s, g]) => [s, g.replace('const bugfix = bugfixFlag ?? Boolean(detected)', 'const bugfix = bugfixFlag ?? false')],
  'gate accepts placeholder': ([s, g]) => [s, g.replace('/<[^>]*>/.test(rootText)', 'false')],
  'gate accepts short root cause': ([s, g]) => [s, g.replace('.length < 4', '.length < 1')],
  'gate accepts ticked boxes': ([s, g]) => [s, g.replace('if (ticked) return { ok: false', 'if (false) return { ok: false')],
  'mechanism allowed in scenario': ([s, g]) => [s.replace('the scenario itself still has no How', 'the scenario may name it too'), g],
  'root cause on every PR': ([s, g]) => [s.replace('Non-bug PRs skip the line.', 'Every PR gets the line.'), g],
  'template drops root cause': ([s, g]) => [s.replace('\nRoot cause: <mechanism that made the bug happen>\n', '\n'), g],
  'gate call without --bugfix': ([s, g]) => [s.replace(' [--bugfix]', ''), g],
  'gate ignores checklist': ([s, g]) => [s, g.replace('notCovered: notCoveredLines.length > 0 && checklist.ok', 'notCovered: notCoveredLines.length > 0')],
  'gate ignores root cause': ([s, g]) => [s, g.replace('const valid = rootCauseOk &&', 'const valid =')],
  'gate bare --bugfix only': ([s, g]) => [s, g.replace('^--bugfix(?:=(.*))?$', '^--bugfix$')],
};

describe('ship-it reviewer checklist + root cause contract', () => {
  it('the shipped skill and gate have no problems', () => {
    expect(problems(SKILL, GATE)).toEqual([]);
  });
  it.each(Object.entries(mutants))('mutant "%s" is caught', (_n, mutate) => {
    const [s, g, b = BUGFIX] = mutate([SKILL, GATE]);
    expect(s + g + b).not.toBe(SKILL + GATE + BUGFIX);
    expect(problems(s, g, b).length).toBeGreaterThan(0);
  });
});
