import * as fs from 'node:fs';
import * as path from 'node:path';
import { describe, expect, it } from 'vitest';

// mt-reports failure class: scheduled Cloud Functions shipped on the platform default
// memory and were OOM-killed. Review (roast-code) must flag a function with no explicit
// memory, and build-it must set one when it writes the function. `problems` returns every
// broken rule; the shipped skills return none, and each mutant must return some.

const SKILLS = path.resolve(__dirname, '..', '..');
const ROAST = fs.readFileSync(path.join(SKILLS, 'vs-roast-code', 'SKILL.md'), 'utf8');
const BUILD = fs.readFileSync(path.join(SKILLS, 'vs-build-it', 'SKILL.md'), 'utf8');

function problems(roast: string, build: string): string[] {
  const out: string[] = [];
  const parent = roast.slice(roast.indexOf('### Parent Roast'), roast.indexOf('### Ponytail pass'));
  const lens = roast.slice(roast.indexOf('### Lens 3: Efficiency'), roast.indexOf('### Auto-apply'));
  const step = build.slice(build.indexOf('### Step 1f: Set runtime limits explicitly'), build.indexOf('## Phase 1: Roast the Plan'));
  if (!/\*\*Runtime limits\*\* — a Cloud Function, Lambda, Cloud Run service, or\s+scheduled job whose deploy config sets no explicit `memory`/.test(parent))
    out.push('roast: parent roast has no runtime-limits lens');
  if (!/Cite each\s+definition at file:line, rank it with correctness \(FELONIES\)/.test(parent)) out.push('roast: not cited or ranked');
  if (!/set an\s+explicit value sized from the measured footprint/.test(parent)) out.push('roast: no explicit value advised');
  if (!/A function that already\s+declares its memory is not a finding/.test(parent)) out.push('roast: flags functions that declare memory');
  if (!/Find every definition in scope, then\s+read each options object for `memory`:\s+`rg -n 'onSchedule\|onRequest\|onCall/.test(parent))
    out.push('roast: no deterministic sweep for function definitions');
  if (!/Serverless functions or jobs with no explicit memory limit/.test(lens)) out.push('roast: SMALL pass skips runtime limits');
  if (/(?:platform|provider) default (?:memory )?is (?:fine|acceptable|safe)/i.test(roast)) out.push('roast: default memory accepted');
  if (!step) return [...out, 'build-it: no runtime-limits step'];
  if (!/sets `memory` \(and the\s+timeout\) explicitly in the deploy config/.test(step)) out.push('build-it: memory not set explicitly');
  if (!/with the value and its source in the plan/.test(step)) out.push('build-it: value not recorded in plan');
  if (!/a new function left on the default memory is an\s+unfinished step/.test(step)) out.push('build-it: default memory counts as done');
  return out;
}

type Pair = [string, string];
const mutants: Record<string, (p: Pair) => Pair> = {
  'roast lens removed': ([r, b]) => [r.replace(/- \*\*Runtime limits\*\*[\s\S]*?<scope>`\.\n/, ''), b],
  'roast accepts default': ([r, b]) => [r.replace('runs on the\n  platform default and gets OOM-killed', 'runs on the\n  platform default memory is fine'), b],
  'roast flags declared memory': ([r, b]) => [r.replace(' A function that already\n  declares its memory is not a finding.', ''), b],
  'roast skips file:line': ([r, b]) => [r.replace('Cite each\n  definition at file:line, rank', 'Rank'), b],
  'no definition sweep': ([r, b]) => [r.replace(/ Find every definition in scope, then\n[\s\S]*?<scope>`\.\n/, '\n'), b],
  'SMALL pass skips it': ([r, b]) => [r.replace(/8\. Serverless functions or jobs[^\n]*\n/, ''), b],
  'build-it step removed': ([r, b]) => [r, b.replace(/### Step 1f: Set runtime limits explicitly[\s\S]*?unfinished step, not a done one\.\n/, '')],
  'build-it leaves default as done': ([r, b]) => [r, b.replace('a new function left on the default memory is an\nunfinished step, not a done one.', 'the default memory is fine for a first cut.')],
  'build-it does not record the value': ([r, b]) => [r, b.replace(', with the value and its source in the plan', '')],
};

describe('runtime limits contract (roast-code + build-it)', () => {
  it('the shipped skills have no problems', () => {
    expect(problems(ROAST, BUILD)).toEqual([]);
  });
  it.each(Object.entries(mutants))('mutant "%s" is caught', (_n, mutate) => {
    const [r, b] = mutate([ROAST, BUILD]);
    expect(r + b).not.toBe(ROAST + BUILD);
    expect(problems(r, b).length).toBeGreaterThan(0);
  });
});
