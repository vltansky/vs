import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { expect, it } from 'vitest';
import { answerOnly, signalBeforeSpeedup, SPEEDUP, zeroSignalRow } from './ci-signal-cost.helpers';

// Static contract for the CI signal-vs-cost gate (backlog #7). The behavior
// eval ci-signal-cost.eval.ts replays the Aug 29, Oct 16 and Oct 19-20 Repo
// turns; this pins the prose so the gate cannot silently drop out.

const read = (path: string) => readFileSync(resolve(__dirname, '..', path), 'utf8');
const skill = read('SKILL.md');
const playbook = read('references/audit-playbook.md');
const gate = playbook.slice(
  playbook.indexOf('### CI & test suite: signal vs cost'),
  playbook.indexOf('## 5. Tech Debt & Architecture'),
);

it('the playbook has a signal-vs-cost section with a per-step table', () => {
  expect(gate).toContain('### CI & test suite: signal vs cost');
  expect(gate).toMatch(/\|\s*Step \/ job\s*\|\s*Runs\s*\|\s*Real failures caught \/ output used\s*\|\s*Infra \/ flaky failures\s*\|\s*Time per run\s*\|\s*Billed min \(window\)\s*\|\s*Verdict\s*\|/);
  expect(gate).toMatch(/flakes\s+that\s+passed\s+on\s+rerun\s+are\s+not\s+signal/);
});

it('zero-signal steps go to the user as cut, path-gate, or move local', () => {
  expect(gate).toMatch(/cut,\s+path-gate\s+\(run\s+only\s+when\s+its\s+inputs\s+change\),\s+move\s+to\s+nightly\s+\/\s+local,\s+or\s+keep\?/);
  expect(skill).toMatch(/Cut,\s+path-gate,\s+move\s+to\s+nightly\s+\/\s+local,\s+or\s+keep\?/);
  expect(gate).toMatch(/do\s+not\s+mark\s+a\s+zero-signal\s+step\s+"keep"\s+or\s+"harden"\s+on\s+your\s+own/);
  expect(gate).toMatch(/"checked,\s+none\s+found"/);
});

it('speed-ups and hardening come only after the "is it needed?" row', () => {
  expect(gate).toMatch(/Only\s+steps\s+that\s+passed\s+the\s+"is\s+it\s+needed\?"\s+row\s+get\s+speed-ups/);
  expect(gate).toMatch(/List\s+them\s+after\s+the\s+table,\s+never\s+before\s+it/);
});

it('the same finding covers tests that cannot fail and test-only seams', () => {
  expect(gate).toMatch(/tests\s+that\s+cannot\s+fail/);
  expect(gate).toMatch(/test-only\s+production\s+seams/);
  expect(gate).toMatch(/duplicate\s+coverage/);
});

it('Performance and DX defer CI speed-ups to the gate', () => {
  expect(playbook).toMatch(/- Build\/CI: run \[CI & test suite: signal vs cost\]\(#ci--test-suite-signal-vs-cost\) first/);
  expect(playbook).not.toMatch(/CI without caching\./);
});

it('SKILL.md opens CI and test replies with the table, before the findings table', () => {
  expect(skill).toMatch(/\*\*CI and test cost come with a gate\.\*\*/);
  expect(skill).toMatch(/\(references\/audit-playbook\.md#ci--test-suite-signal-vs-cost\)/);
  expect(skill).toMatch(/\*\*When CI or tests are in scope, the reply opens with the signal-vs-cost\s+table\*\*/);
  expect(skill.indexOf('the reply opens with the signal-vs-cost')).toBeLessThan(
    skill.indexOf('Then present the vetted findings table'),
  );
  expect(skill).toMatch(/Do\s+not\s+decide\s+"keep"\s+or\s+"harden"\s+for\s+it\s+yourself/);
  expect(skill).toMatch(/even\s+when\s+the\s+zero\s+is\s+weak\s+evidence/);
  expect(skill).toMatch(/`ci`\) → run Recon[\s\S]*A `ci` or `tests` focus starts with the signal-vs-cost table/);
});

it('no /vs-test-audit skill appears', () => {
  expect(() => readFileSync(resolve(__dirname, '..', '..', 'vs-test-audit', 'SKILL.md'))).toThrow();
});

it('jobs that do not block merge are measured by output use, not failures caught', () => {
  expect(gate).toMatch(/A\s+job\s+that\s+does\s+not\s+block\s+merge/);
  expect(gate).toMatch(/failures\s+caught\s+is\s+the\s+wrong\s+measure/);
  expect(gate).toMatch(/looked\s+at\s+or\s+acted\s+on/);
  expect(skill).toMatch(/failures\s+caught\s+is\s+the\s+wrong\s+measure/);
  expect(skill).toMatch(/non-blocking\s+job\s+whose\s+output\s+nobody\s+used/);
  expect(playbook).toMatch(/signal-vs-cost\s+table\s+above\s+comes\s+before\s+any\s+caching\s+idea/);
});

it('speed-up regex matches proposals, not quotes of the data', () => {
  for (const quote of [
    'Screenmap run 39168396911 paid a 29-minute Gradle cache miss and then the emulator failed to boot.',
    'Cost drivers: a Gradle/dev-client cache miss rebuilds the APK; a hit restores in ~6s.',
    'All 7 failures were infra (emulator boot, runner disk, cache misses) and passed on rerun.',
  ]) {
    expect(SPEEDUP.test(quote), quote).toBe(false);
  }
  for (const proposal of [
    'Add a Gradle cache keyed on the lockfile.',
    'Run the three backend suites in parallel.',
    'Parallelize lint and typecheck.',
    'Shard the e2e suite.',
    'Split backend-test into 3 jobs.',
    'Cache node_modules between jobs.',
    'Enable dependency caching for npm.',
  ]) {
    expect(SPEEDUP.test(proposal), proposal).toBe(true);
  }
});

it('narration filter drops progress notes but keeps answers that start with "I\'ll"', () => {
  const reply = [
    "I'm checking ci/runs-30d.csv before proposing anything.",
    "I'll keep Firestore rules on every PR until you decide; it caught 0 real failures in 30 days.",
    'Let me compare step durations next.',
  ].join('\n\n');
  const answer = answerOnly(reply);
  expect(answer).not.toContain("I'm checking");
  expect(answer).not.toContain('Let me compare');
  expect(answer).toContain("I'll keep Firestore rules");
});

it('order check: a zero-signal row before a speed-up passes; a speed-up first fails', () => {
  const good = [
    'Firestore rules caught 0 real failures in 30 days (76s per run). Cut, path-gate, move to nightly / local, or keep?',
    '',
    '| Step / job | Real failures caught / output used | Time per run |',
    '| --- | --- | --- |',
    '| Firestore rules tests | 0 | 76s |',
    '',
    'After that: run the remaining suites in parallel.',
  ].join('\n');
  expect(signalBeforeSpeedup(good).ok).toBe(true);
  expect(zeroSignalRow(good)).toBeGreaterThan(0);
  expect(signalBeforeSpeedup('Parallelize backend-test first. Firestore rules caught 0 real failures.').ok).toBe(false);
});

it('negative control: an all-signal table has no zero row; a setup row marked 0 is not a zero claim', () => {
  const table = [
    '| Step / job | Real failures caught | Time |',
    '| --- | --- | --- |',
    '| Install | 0 — setup only | 97s |',
    '| changes | 0 | 15s |',
    '| backend: Install | 0 | 97s |',
    '| Firestore rules tests | 3 | 76s |',
    '| headless-test | 2 | 150s |',
  ].join('\n');
  expect(zeroSignalRow(table)).toBe(-1);
});

it('a speed-up named only to defer it does not count as the first speed-up', () => {
  const reply = [
    'The CI gate needs a per-step table before suggesting caching or parallelism.',
    '',
    'Firestore rules caught 0 real failures in 30 days. Cut, path-gate, move to nightly / local, or keep?',
    '',
    'Then parallelize what stays.',
  ].join('\n');
  expect(signalBeforeSpeedup(reply).ok).toBe(true);
});

it('the negative-control fixture has no zero-signal check', () => {
  const csv = readFileSync(resolve(__dirname, 'fixtures', 'mt-reports-ci-allsignal', 'ci', 'runs-30d.csv'), 'utf8')
    .trim()
    .split('\n')
    .slice(1)
    .map((l) => l.split(','));
  const checks = new Map<string, number>();
  for (const [, , workflow, job, step, , , conclusion, , rerun] of csv) {
    if (workflow !== 'CI Test' || job === 'changes' || step === 'Install' || (job === 'backend-test' && !step)) continue;
    const key = step || job;
    checks.set(key, (checks.get(key) ?? 0) + (conclusion === 'failure' && rerun !== 'yes' ? 1 : 0));
  }
  expect(checks.size).toBeGreaterThanOrEqual(8);
  for (const [name, real] of checks) expect(real, name).toBeGreaterThan(0);
  expect(csv.some((r) => r[2] === 'Screenmap')).toBe(false);
});
