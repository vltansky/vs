import * as fs from 'fs';
import * as path from 'path';
import { describe, expect, it } from 'vitest';

// Static contract for build-it session discipline (Anthropic, "Effective harnesses for
// long-running agents"): start on a smoked baseline, take one slice, end mergeable with
// an appended progress note, and never edit tests to pass. `problems(skill, handoff, shared)`
// returns every broken rule; the shipped files return none and each mutant returns some.

const DIR = path.resolve(__dirname, '..');
const SKILL = fs.readFileSync(path.join(DIR, 'SKILL.md'), 'utf8');
const HANDOFF = fs.readFileSync(path.join(DIR, 'references', 'handoff.md'), 'utf8');
const SHARED = fs.readFileSync(path.resolve(DIR, '..', 'vs-internal-shared', 'SKILL.md'), 'utf8');
const NOTE = '~/.vs/$PROJECT_ID/sessions/YYYY-MM-DD-<slug>-progress.md';

function section(skill: string, from: string, to: string): string {
  const a = skill.indexOf(from);
  const b = skill.indexOf(to, a + from.length);
  return a === -1 || b === -1 ? '' : skill.slice(a, b);
}

function problems(skill: string, handoff = HANDOFF, shared = SHARED): string[] {
  const out: string[] = [];
  const discipline = section(skill, '## Session Discipline', '## Score-Critical Guidance');
  const read = section(skill, '### Step 1: Read context', '### Step 1a');
  const smoke = section(skill, '**Baseline smoke.**', '### Step 1c');
  const execute = section(skill, '## Phase 3: Execute', '### Step 0: Load TDD');
  const worker = section(skill, 'Implement the assigned step using TDD:', '6. Report:');
  const phase7 = section(skill, '## Phase 7: Handoff', '## Important Rules');

  if (!discipline) return ['no session discipline section'];
  if (!/Starts on a green baseline/.test(discipline)) out.push('no baseline step');
  if (!/Takes one slice/.test(discipline)) out.push('no one-slice step');
  if (!/Ends mergeable, with a progress note/.test(discipline)) out.push('no session-end step');
  if (!/However the session ends \(Phase 7,\s+a circuit-breaker stop, a blocker, or context pressure mid-plan\)/.test(discipline))
    out.push('session end only at Phase 7');
  if (!/committed code passes the guardrails and no half-built slice stays loose/.test(discipline)) out.push('session may end unmergeable');
  if (!/`git stash --include-untracked`/.test(discipline) || /reset --hard/.test(discipline)) out.push('loose slice discarded destructively');
  if (!discipline.includes(NOTE)) out.push('progress note path not under sessions/');
  for (const field of ['- Baseline:', '- Changed:', '- Next:', '- Open:'])
    if (!discipline.includes(field)) out.push(`progress note misses ${field}`);
  if (!/Append only; never rewrite an earlier entry/.test(discipline)) out.push('progress note may be rewritten');
  if (!/Never edits tests to pass/.test(discipline) || !/Never edit, weaken, skip, or delete a test,\s+eval assertion, or snapshot just to turn it green/.test(discipline))
    out.push('tests may be edited to pass');
  if (!/Change a\s+test only when the plan changes the behavior that test guards/.test(discipline)) out.push('no legitimate test-change path');

  if (!/git log --oneline -20/.test(read) || !/sessions\/\*-<slug>-progress\.md/.test(read)) out.push('session start skips prior notes');
  if (!/Resume at its `Next` slice; do not redo or re-declare done work/.test(read)) out.push('prior work may be redone');

  if (!smoke) out.push('no baseline smoke');
  if (!/A command that runs is not yet a healthy baseline/.test(smoke)) out.push('dry-run counts as baseline');
  if (!/run the existing tests and build once on the untouched branch/.test(smoke)) out.push('smoke not on untouched branch');
  if (!/start or basic end-to-end check when one exists/.test(smoke)) out.push('no start check');
  if (!/If the baseline is red, fix it first as a separate\s+prep commit/.test(smoke)) out.push('red baseline not fixed first');
  if (!/already failing on base/.test(smoke) || !/report it in the handoff/.test(smoke)) out.push('red baseline not reported');
  if (!/Never start a slice on an unexplained red baseline/.test(smoke)) out.push('slice may start on red baseline');
  const step2 = skill.indexOf('### Step 2: Create branch');
  if (skill.indexOf('**Baseline smoke.**') > step2) out.push('smoke runs after new work begins');

  if (!/\*\*One slice at a time\.\*\*/.test(execute) || !/Execution Strategy's next workstream or wave/.test(execute))
    out.push('slice not taken from the plan');
  if (!/Bring it to green and commit it before you start the next one/.test(execute)) out.push('slices may overlap');
  if (!/they never start the next slice early/.test(execute)) out.push('workers may start the next slice');
  if (!/Never edit, weaken, skip, or delete an existing test to make it pass/.test(worker)) out.push('worker brief allows test edits');

  const close = phase7.indexOf('Close the session first');
  if (close === -1 || close > phase7.indexOf('../vs-verify/SKILL.md')) out.push('handoff verifies before closing the session');
  if (!handoff.includes(`Progress: \`${NOTE}\``)) out.push('handoff does not link the progress note');
  if (!/sessions\/\s+# workflow session handoffs and build-it progress notes/.test(shared)) out.push('artifact tree misses progress notes');
  return out;
}

type F = [string, string, string];
const mutants: Record<string, (f: F) => F> = {
  'no session discipline': ([s, h, x]) => [s.replace('## Session Discipline', '## Sessions'), h, x],
  'session end only at Phase 7': ([s, h, x]) => [s.replace(/However the session ends \(Phase 7,\n   a circuit-breaker stop, a blocker, or context pressure mid-plan\)/, 'At Phase 7'), h, x],
  'unmergeable end': ([s, h, x]) => [s.replace('committed code passes the guardrails and no half-built slice stays loose', 'work so far is saved'), h, x],
  'destructive discard': ([s, h, x]) => [s.replace('`git stash --include-untracked` it', '`git reset --hard` it'), h, x],
  'note outside sessions/': ([s, h, x]) => [s.replaceAll('sessions/YYYY-MM-DD-<slug>-progress.md', 'build-it/progress.md'), h, x],
  'note without Next': ([s, h, x]) => [s.replace('   - Next: <next slice from the plan, or done>\n', ''), h, x],
  'note rewritten': ([s, h, x]) => [s.replace('Append only; never rewrite an earlier entry.', 'Overwrite the note.'), h, x],
  'tests may be skipped': ([s, h, x]) => [s.replace('Never edit, weaken, skip, or delete a test,\n   eval assertion, or snapshot just to turn it green.', 'Skip flaky tests.'), h, x],
  'no prior notes read': ([s, h, x]) => [s.replace(/- Get your bearings from earlier sessions:[\s\S]*?re-declare done work\.\n/, ''), h, x],
  'dry-run is baseline': ([s, h, x]) => [s.replace('A command that runs is not yet a healthy baseline. ', ''), h, x],
  'red baseline ignored': ([s, h, x]) => [s.replace('Never start a slice on an unexplained red baseline.', 'Continue on a red baseline.'), h, x],
  'no start check': ([s, h, x]) => [s.replace('plus the project\'s start or basic end-to-end check when one exists', 'only'), h, x],
  'smoke after branch work': ([s, h, x]) => {
    const smoke = s.slice(s.indexOf('**Baseline smoke.**'), s.indexOf('### Step 1c'));
    return [s.replace(smoke, '').replace('### Step 3: Extract plan steps', smoke + '### Step 3: Extract plan steps'), h, x];
  },
  'many slices at once': ([s, h, x]) => [s.replace('Bring it to green and commit it before you start the next one.', 'Start all slices together.'), h, x],
  'workers start next slice': ([s, h, x]) => [s.replace(' they never start the next slice early.', ' they may start the next slice.'), h, x],
  'worker may edit tests': ([s, h, x]) => [s.replace('   Never edit, weaken, skip, or delete an existing test to make it pass; fix\n   the code, or report the conflict if the plan changes that behavior.\n', ''), h, x],
  'verify before closing session': ([s, h, x]) => [s.replace('Close the session first: Session Discipline step 3 (mergeable code, progress\nnote appended).\n\n', ''), h, x],
  'handoff drops progress link': ([s, h, x]) => [s, h.replace(/Progress: `[^`]+`\n/, ''), x],
  'artifact tree drops notes': ([s, h, x]) => [s, h, x.replace(' and build-it progress notes', '')],
};

describe('build-it session discipline', () => {
  it('the shipped skill has no problems', () => {
    expect(problems(SKILL)).toEqual([]);
  });

  it.each(Object.entries(mutants))('mutant "%s" is caught', (_name, mutate) => {
    const [s, h, x] = mutate([SKILL, HANDOFF, SHARED]);
    expect(s + h + x).not.toBe(SKILL + HANDOFF + SHARED);
    expect(problems(s, h, x).length).toBeGreaterThan(0);
  });
});
