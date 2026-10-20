import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { expect, it } from 'vitest';

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
  expect(gate).toMatch(/\|\s*Step \/ job\s*\|\s*Runs\s*\|\s*Real failures caught\s*\|\s*Infra \/ flaky failures\s*\|\s*Time per run\s*\|\s*Billed min \(window\)\s*\|\s*Verdict\s*\|/);
  expect(gate).toMatch(/flakes\s+that\s+passed\s+on\s+rerun\s+are\s+not\s+signal/);
});

it('zero-signal steps go to the user as cut, path-gate, or move local', () => {
  expect(gate).toMatch(/cut,\s+path-gate\s+\(run\s+only\s+when\s+its\s+inputs\s+change\),\s+or\s+move\s+local\s+\/\s+nightly\?/);
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
