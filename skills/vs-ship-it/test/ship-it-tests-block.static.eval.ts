import * as fs from 'node:fs';
import * as path from 'node:path';
import { describe, expect, it } from 'vitest';

// Static contract for the PR-body Tests block and the no-test flag.
// `problems(skill)` returns every broken rule; the base skill must return none,
// and each mutant below (a known way to regress this contract) must return some.

const SKILL = fs.readFileSync(path.resolve(__dirname, '..', 'SKILL.md'), 'utf8');

function between(text: string, start: string | RegExp, end: RegExp): string {
  const from = typeof start === 'string' ? text.indexOf(start) : text.search(start);
  if (from === -1) return '';
  const rest = text.slice(from);
  const head = rest.indexOf('\n');
  const stop = rest.slice(head + 1).search(end);
  return stop === -1 ? rest : rest.slice(0, head + 1 + stop);
}

const sentences = (text: string) =>
  text
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/\s+/g, ' ')
    .split(/(?<=[.:])\s+(?=[A-Z`*-])/);

function parse(skill: string) {
  const template = skill.match(/````markdown[\s\S]*?````/)?.[0] ?? '';
  const live = template.replace(/<!--[\s\S]*?-->/g, '');
  const tmplTests = between(template, /^## Tests$/m, /^## /m);
  const tmplFocus = between(template, /^## Review focus$/m, /^````/m);
  const rule = between(skill, '### Tests block and no-test flag', /^### /m);
  const testsBullet = rule.match(/^- \*\*Tests block\.\*\*[\s\S]*?(?=^- \*\*|^$)/m)?.[0] ?? '';
  const flagBullet = rule.match(/^- \*\*No-test flag\.\*\*[\s\S]*?(?=^- \*\*|^$)/m)?.[0] ?? '';
  const step1 = between(skill, '### Step 1', /^### Step 2/m);
  const handoff = between(skill, '## Handoff', /^### Closing link/m);
  const handoffBlock = handoff.match(/```markdown[\s\S]*?```/)?.[0] ?? '';
  const contract = between(skill, '## Verification contract', /^## /m);
  return { template, live, tmplTests, tmplFocus, rule, testsBullet, flagBullet, step1, handoffBlock, contract };
}

// A sentence that tells the agent to run something for the Tests block or flag.
// Negated forms ("do not run", "never starts a test run") are not instructions.
const RUN = /\b(?:run|rerun|re-run|execute|start)s?\b[^.]{0,40}?\b(?:tests?|suites?|vs-verify|vs-before-after|evals?)\b/i;
const NEGATED_RUN = /\b(?:do not|don't|never|no|without|not)\b[^.]{0,60}\b(?:run|rerun|re-run|execute|start)/i;
// A sentence that makes the flag stop, block, or ask. Negated forms are fine.
const BLOCKING = /\b(?:block(?:s|ing)?|stop(?:s|ping)?|ask(?:s|ing)?|refuse[sd]?|fail(?:s|ing)?|require[sd]?)\b/i;
const NEGATED_BLOCK = /\b(?:never|not|no|do not|don't)\b[^.]{0,30}\b(?:block|stop|ask|refuse|fail|require)/i;

const TEST_PATTERNS = ['`*.test.*`', '`*.spec.*`', '`*.eval.*`', '`__tests__/`', '`test/`', '`tests/`', '`evals/`'];
const EXEMPT = ['docs-only', 'copy/styling-only', 'config/CI-only', 'test-only'];

function problems(skill: string): string[] {
  const out: string[] = [];
  const fail = (cond: boolean, msg: string) => {
    if (cond) out.push(msg);
  };
  const p = parse(skill);

  // Template placement: Tests sits between Evidence and Review focus.
  const evidenceAt = p.live.search(/^## Evidence$/m);
  const testsAt = p.live.search(/^## Tests$/m);
  const focusAt = p.live.search(/^## Review focus$/m);
  fail(testsAt === -1, 'template: no live ## Tests heading');
  fail(testsAt !== -1 && !(evidenceAt < testsAt && testsAt < focusAt), 'template: ## Tests is not between Evidence and Review focus');

  // Template lines: behavior per test, deleted tests, Not covered with a none option, cap.
  const liveTests = p.tmplTests.replace(/<!--[\s\S]*?-->/g, '');
  const bullets = liveTests.split('\n').filter((l) => /^- /.test(l));
  fail(!bullets.some((l) => /^- `<test file or case>` — proves <behavior/.test(l)), 'template: no per-test behavior line');
  fail(!bullets.some((l) => /^- Deleted `/.test(l)), 'template: no deleted-test line');
  fail(!bullets.some((l) => /^- \*\*Not covered:\*\* <[^>]*\| none>/.test(l)), 'template: no Not covered line with a none option');
  fail(bullets.length > 5, `template: Tests block has ${bullets.length} lines, over the cap`);
  fail(!/From the diff only; no new runs/.test(p.tmplTests), 'template: Tests comment does not say diff-only, no runs');
  fail(!/About 5 lines max/.test(p.tmplTests), 'template: no line cap');

  // Template flag: lives under Review focus, not in Evidence or Tests.
  fail(!/^- \*\*No tests changed:\*\* <[^>]*behavior[^>]*>/m.test(p.tmplFocus), 'template: no No-tests-changed bullet under Review focus');
  fail(/No tests changed/.test(between(p.template, /^## Evidence$/m, /^## Review focus$/m)), 'template: flag outside Review focus');

  // Rule: ADR-ish, diff-only, no runs, no duplicate of Checks.
  fail(!p.rule, 'rule: no "Tests block and no-test flag" section');
  fail(!/^\*\*Rule\.\*\*/m.test(p.rule) || !/^\*\*Why\.\*\*/m.test(p.rule), 'rule: not Rule/Why shaped');
  fail(!/come from the scoped diff only and add no runs/.test(p.rule), 'rule: does not say diff-only, no runs');
  fail(!/do not run the\s+suite, a focused test, `vs-verify`, or `vs-before-after`/.test(p.rule), 'rule: run ban does not name suite, focused test, vs-verify, vs-before-after');
  fail(!/handoff `Checks:` line; do not\s+repeat it here/.test(p.rule), 'rule: does not keep pass/fail in Checks');
  for (const s of sentences(p.rule)) {
    if (RUN.test(s) && !NEGATED_RUN.test(s)) out.push(`rule: instructs a run: "${s.trim().slice(0, 120)}"`);
  }

  // Test-file detection: generic patterns plus repo convention passed to the gate.
  for (const pattern of TEST_PATTERNS) fail(!p.rule.includes(pattern), `rule: test pattern ${pattern} missing`);
  fail(!/honor an obvious repository convention/.test(p.rule), 'rule: no repo-convention clause');
  fail(!/`--tests <regex>`/.test(p.rule), 'rule: repo convention not passed to the gate');

  // Tests block bullet.
  fail(!p.testsBullet, 'rule: no Tests block bullet');
  fail(!/added, changed, or deleted/.test(p.testsBullet), 'Tests block: not triggered by added, changed, or deleted tests');
  fail(!/right before Review focus/.test(p.testsBullet), 'Tests block: placement not stated');
  fail(!/the behavior it proves, in behavior words, not the test\s+name restated/.test(p.testsBullet), 'Tests block: no behavior-not-name rule');
  fail(!/List deleted tests too/.test(p.testsBullet), 'Tests block: deleted tests not listed');
  fail(!/one `\*\*Not covered:\*\*` line[\s\S]*?or `none`/.test(p.testsBullet), 'Tests block: no Not covered line with none');
  fail(!/about 5 lines; group many tests/.test(p.testsBullet), 'Tests block: no cap or grouping');

  // No-test flag bullet: Review focus, warn only, exemptions.
  fail(!p.flagBullet, 'rule: no No-test flag bullet');
  fail(!/touches zero test\/eval files/.test(p.flagBullet), 'flag: trigger is not zero test/eval files');
  fail(!/product or runtime code,\s+or a skill contract/.test(p.flagBullet), 'flag: behavior scope missing code or skill contract');
  fail(!/add one bullet under \*\*Review focus\*\*/.test(p.flagBullet), 'flag: not under Review focus');
  fail(!/never blocks PR creation, never asks the user/.test(p.flagBullet), 'flag: not warn-only');
  fail(!/never\s+starts a test run/.test(p.flagBullet), 'flag: may start a run');
  for (const s of sentences(p.flagBullet)) {
    if (BLOCKING.test(s) && !NEGATED_BLOCK.test(s)) out.push(`flag: blocks or asks: "${s.trim().slice(0, 120)}"`);
    if (RUN.test(s) && !NEGATED_RUN.test(s)) out.push(`flag: instructs a run: "${s.trim().slice(0, 120)}"`);
  }
  for (const e of EXEMPT) fail(!p.flagBullet.includes(e), `flag: exemption ${e} missing`);

  // Gate wiring: fails on missing Tests block, warns (not fails) on the flag.
  fail(!/`pr-media-gate\.mjs` fails a body that has changed test\/eval files but no\s+`## Tests` block/.test(p.rule), 'gate: Tests block not enforced');
  fail(!/prints a non-blocking warning/.test(p.rule), 'gate: flag is not a non-blocking warning');

  // The existing no-broad-suite rule and its tie to the new block.
  fail(!/do not introduce `vs-before-after`, `vs-verify`, broad test suites/.test(p.step1), 'Step 1: no-broad-suite rule removed');
  fail(!/Tests block and no-test flag in Step 2 come from the diff and add no runs/.test(p.step1), 'Step 1: no diff-only tie');

  // Handoff keeps one Checks line and gains no Tests line.
  fail(!/^- Checks: </m.test(p.handoffBlock), 'handoff: Checks line missing');
  fail(/^- Tests?\b/m.test(p.handoffBlock), 'handoff: duplicates Checks with a Tests line');

  // Verification contract.
  fail(!/- \[ \] Changed test\/eval files have a `## Tests` block/.test(p.contract), 'contract: no Tests checkbox');
  fail(!/came from the diff and added no runs/.test(p.contract), 'contract: checkbox does not pin no runs');
  return out;
}

describe('ship-it Tests block and no-test flag: base skill', () => {
  it('has no contract problems', () => {
    expect(problems(SKILL)).toEqual([]);
  });
});

// Each mutant must change the text and must be caught.
const MUTANTS: Array<[string, (s: string) => string]> = [
  ['M1 Tests heading dropped from the template', (s) => s.replace('\n## Tests\n\n- `<test file or case>`', '\n- `<test file or case>`')],
  [
    'M2 Tests moved after Review focus',
    (s) => {
      const block = s.match(/## Tests\n[\s\S]*?(?=## Review focus)/)?.[0] ?? '';
      return s.replace(block, '').replace(/(## Review focus\n[\s\S]*?)(\n````)/, `$1\n\n${block.trim()}$2`);
    },
  ],
  ['M3 Not covered line dropped', (s) => s.replace(/^- \*\*Not covered:\*\* <changed behavior no test exercises \| none>\n/m, '')],
  ['M4 behavior rule replaced by test-name restating', (s) => s.replace(/the behavior it proves, in behavior words, not the test\s+name restated/, 'the test name as written')],
  ['M5 rule tells the agent to run the suite', (s) => s.replace('**Why.** A reviewer', 'Run the full test suite first so the Tests block is accurate.\n\n**Why.** A reviewer')],
  [
    'M6 flag turned blocking',
    (s) => s.replace('`**No tests changed:** <the behavior that changed with no test>`. It is a', '`**No tests changed:** <the behavior that changed with no test>`. Stop and ask the user to add tests before the PR is created. It is a'),
  ],
  ['M7 flag moved to Evidence', (s) => s.replace('add one bullet under **Review focus**:', 'add one bullet under **Evidence**:')],
  ['M8 docs-only exemption dropped', (s) => s.replace('Exempt docs-only, copy/styling-only,', 'Exempt copy/styling-only,')],
  ['M9 __tests__/ pattern dropped', (s) => s.replace('any file under `__tests__/`, `test/`', 'any file under `test/`')],
  ['M10 handoff duplicates Checks with a Tests line', (s) => s.replace('- Checks: <fresh results reused', '- Tests: <tests run and passed>\n- Checks: <fresh results reused')],
  ['M11 Step 1 no-broad-suite rule removed', (s) => s.replace('do not introduce `vs-before-after`, `vs-verify`, broad test suites, or another', 'do not introduce another')],
  ['M12 deleted tests no longer listed', (s) => s.replace(/ List deleted tests too, with the behavior they no longer\s+guard\./, '')],
  ['M13 line cap removed', (s) => s.replace(/ Keep it to about 5 lines; group many tests into\s+one line per behavior\./, '')],
  ['M14 gate fails on the flag instead of warning', (s) => s.replace('It prints a non-blocking warning', 'It fails')],
  ['M15 flag starts a test run', (s) => s.replace(/never\s+starts a test run or new test writing/, 'starts a focused test run')],
];

describe('ship-it Tests block and no-test flag: mutants are caught', () => {
  for (const [name, mutate] of MUTANTS) {
    it(name, () => {
      const mutant = mutate(SKILL);
      expect(mutant, `${name} did not change the skill`).not.toBe(SKILL);
      expect(problems(mutant).length, `${name} survived`).toBeGreaterThan(0);
    });
  }
});
