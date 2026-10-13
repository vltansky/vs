import * as fs from 'node:fs';
import * as path from 'node:path';
import { describe, expect, it } from 'vitest';
import { classify, exitCode } from '../../vs-baby-sit/scripts/classify-failures.mjs';

// Static contract: red checks are classified New / Already failing on base / Environment / Unknown
// from evidence, in ship-it (body) and baby-sit (loop). `problems` returns every broken rule;
// the shipped skills return none, and each mutant must return some.

const SHIP = fs.readFileSync(path.resolve(__dirname, '..', 'SKILL.md'), 'utf8');
const SIT = fs.readFileSync(path.resolve(__dirname, '..', '..', 'vs-baby-sit', 'SKILL.md'), 'utf8');


function problems(ship: string, sit: string): string[] {
  const out: string[] = [];
  const a = ship.slice(ship.indexOf('**Failure baseline.**'), ship.indexOf('If authentication fails'));
  const b = sit.slice(sit.indexOf('**Failure baseline.**'), sit.indexOf('Prove from the provider evidence'));
  if (!ship.includes('**Failure baseline.**')) return ['ship-it has no failure baseline'];
  if (!sit.includes('**Failure baseline.**')) return ['baby-sit has no failure baseline'];
  for (const [who, t] of [['ship-it', a], ['baby-sit', b]] as const) {
    if (!/gh run list --branch <base>[\s\S]*--status\s+completed/.test(t)) out.push(`${who}: no base-run baseline`);
    if (!/merge-base/.test(t)) out.push(`${who}: no merge-base fallback`);
    if (!/[Nn]ever (?:run )?the full\s+suite/.test(t) || /run the full suite to (?:get|find)/i.test(t.replace(/Never run the full\s+suite/, '')))
      out.push(`${who}: full suite run for baseline`);
    if (!/conclusion is\s+`success` or `failure`/.test(t)) out.push(`${who}: cancelled base run used`);
    if (!/git merge-base --is-ancestor <mergeBase>\s+<headSha>/.test(t)) out.push(`${who}: stale base run used`);
    if (!/OS and browsers present/.test(t)) out.push(`${who}: local env not recorded`);
    if (!/[Rr]enamed or matrix-reshaped\s+jobs (?:have no match and )?are Unknown/.test(t)) out.push(`${who}: renamed jobs not Unknown`);
    if (!/\*\*Unknown\*\*/.test(t) || !/(?:Do not\s+guess|never a guess)/.test(t)) out.push(`${who}: guesses without evidence`);
  }
  if (!/`browser-not-installed`,\s+`network-unreachable`, `runner-out-of-disk`, `missing-secret-on-fork`\) plus\s+the log line/.test(a))
    out.push('environment needs no allowlist or evidence');
  if (!/Compare failing test\s+names, not whole jobs/.test(a)) out.push('whole-job comparison');
  if (!/timeout, OOM, or rerun-pass with the base green is New/.test(a)) out.push('timeout or flaky with base green not New');
  if (!/Unknown blocks done: never report merge-ready over it/.test(b) || !/report it as\s+Unknown and stop/.test(b)) out.push('Unknown counted as done');
  if (!/Already failing on base\*\* — report it with the base run link; do not fix it\s+in this PR and do not rerun it/.test(b))
    out.push('baby-sit fixes or retries base failures');
  if (!/\*\*Unknown\*\* \(exit 3\) — rerun it exactly once; if still red, report it/.test(b)) out.push('Unknown not rerun once');
  if (!/when only those remain, report them and stop the repair loop/.test(b)) out.push('loop spins on base failures');
  if (!/\*\*New\*\* \(exit 1\) — fix and retry it in this PR/.test(b)) out.push('New failures not fixed');
  const ev = ship.slice(ship.indexOf('\n## Evidence\n'), ship.indexOf('\n## Tests\n'));
  for (const c of ['New:', 'Already failing on base:', 'Environment:', 'Unknown:'])
    if (!ev.includes(`  - ${c}`)) out.push(`body misses class ${c}`);
  if (!/Already failing on base: [^\n]*\(\[base run\]\(<base run URL>\)\)/.test(ev)) out.push('base class has no base-run link');
  return out;
}

type M = [string, string];
const mutants: Record<string, (p: M) => M> = {
  'no baseline': ([s, b]) => [s.replace(/\*\*Failure baseline\.\*\*[\s\S]*?turns this evidence into classes[^\n]*\n/, ''), b],
  'guess without evidence': ([s, b]) => [s.replace('no baseline or no test-level data; state the reason. Do not\n  guess a class.', 'no baseline: pick the likeliest class.'), b],
  'full suite for baseline (ship-it)': ([s, b]) => [s.replace('Never run the full\nsuite to get a baseline.', 'Run the full suite to get a baseline.'), b],
  'full suite for baseline (baby-sit)': ([s, b]) => [s, b.replace('never the full suite.', 'or the full suite.')],
  'baby-sit fixes base failure': ([s, b]) => [s, b.replace('do not fix it\n  in this PR and do not rerun it', 'fix it in this PR too')],
  'baby-sit retries base in loop': ([s, b]) => [s, b.replace('when only those remain, report them and stop the repair loop', 'keep watching until they turn green')],
  'Unknown not rerun once': ([s, b]) => [s, b.replace('rerun it exactly once; if still red, report it as', 'report it as')],
  'class missing from body': ([s, b]) => [s.replace(/  - Already failing on base: [^\n]*\n/, ''), b],
  'baby-sit guesses': ([s, b]) => [s, b.replace('No baseline at all is **Unknown**, never a guess.', '')],
  'env free text': ([s, b]) => [s.replace('only a fixed reason', 'any reason').replace(/\(`browser-not-installed`[^)]*\) plus\n  the log line that shows it/, ''), b],
  'whole-job compare': ([s, b]) => [s.replace('Compare failing test\nnames, not whole jobs:', 'Compare whole jobs:'), b],
  'timeout with base green is env': ([s, b]) => [s.replace('A\n  timeout, OOM, or rerun-pass with the base green is New.', 'A timeout is Environment.'), b],
  'cancelled base run used': ([s, b]) => [s, b.replace('whose conclusion is\n`success` or `failure`', '')],
  'stale base run used': ([s, b]) => [s.replace(/Use it only when `git merge-base[^.]*holds\. /, ''), b],
  'local env not recorded': ([s, b]) => [s, b.replace(', recording the OS and browsers present', '')],
  'renamed jobs guessed': ([s, b]) => [s.replace(' Renamed or matrix-reshaped jobs have no match and are Unknown.', ''), b],
  'Unknown counted as done': ([s, b]) => [s, b.replace(' Unknown blocks done: never report merge-ready over it.', '')],
};

describe('failure baseline contract (ship-it + baby-sit)', () => {
  it('the shipped skills have no problems', () => {
    expect(problems(SHIP, SIT)).toEqual([]);
  });
  it.each(Object.entries(mutants))('mutant "%s" is caught', (_n, mutate) => {
    const [s, b] = mutate([SHIP, SIT]);
    expect(s + b).not.toBe(SHIP + SIT);
    expect(problems(s, b).length).toBeGreaterThan(0);
  });
});

describe('classify-failures.mjs', () => {
  const MB = 'mb';
  const fresh = { isAncestor: () => true };
  const stale = { isAncestor: () => false };
  const base = (jobs: object[], conclusion = 'failure') => ({ url: 'https://x/runs/1', sha: 's', conclusion, jobs });
  const log = { reason: 'browser-not-installed', log: "Executable doesn't exist at chromium" };
  const one = (input: object, opts = fresh) => classify({ mergeBase: MB, ...input }, opts)[0];

  it('base only when failing tests are a subset of base failing tests in the same job', () => {
    const b = base([{ name: 'e2e', conclusion: 'failure', failingTests: ['a', 'b'] }]);
    expect(one({ failing: [{ name: 'e2e', tests: ['a'] }], base: b }).class).toBe('base');
  });
  it('same job, different failing test is new', () => {
    const b = base([{ name: 'e2e', conclusion: 'failure', failingTests: ['a'] }]);
    const r = one({ failing: [{ name: 'e2e', tests: ['a', 'c'] }], base: b });
    expect(r.class).toBe('new');
    expect(r.reason).toMatch(/c/);
  });
  it('failed job without test-level data is unknown', () => {
    const b = base([{ name: 'e2e', conclusion: 'failure' }]);
    expect(one({ failing: [{ name: 'e2e', tests: ['a'] }], base: b }).class).toBe('unknown');
  });
  it('cancelled base run is skipped, not a baseline', () => {
    const r = one({ failing: [{ name: 'e2e', tests: ['a'] }], base: base([{ name: 'e2e', conclusion: 'failure', failingTests: ['a'] }], 'cancelled') });
    expect(r.class).toBe('unknown');
    expect(r.reason).toMatch(/cancelled skipped/);
  });
  it('a cancelled job in a usable run is not a failing baseline', () => {
    const b = base([{ name: 'e2e', conclusion: 'cancelled', failingTests: ['a'] }]);
    expect(one({ failing: [{ name: 'e2e', tests: ['a'] }], base: b }).class).toBe('unknown');
  });
  it('a free-text env signal is not env; an allowlisted reason with a log is', () => {
    const b = base([{ name: 'e2e', conclusion: 'success' }], 'success');
    expect(one({ failing: [{ name: 'e2e', env: { reason: 'looks like infra', log: 'x' } }], base: b }).class).toBe('new');
    expect(one({ failing: [{ name: 'e2e', env: { reason: 'browser-not-installed', log: '' } }], base: b }).class).toBe('new');
    expect(one({ failing: [{ name: 'e2e', env: log }], base: b }).class).toBe('env');
  });
  it('timeout with base green is new', () => {
    const b = base([{ name: 'e2e', conclusion: 'success' }], 'success');
    expect(one({ failing: [{ name: 'e2e', tests: ['slow'], conclusion: 'timed_out' }], base: b }).class).toBe('new');
  });
  it('rerun-pass with base green is new (flaky introduced), never env', () => {
    const b = base([{ name: 'e2e', conclusion: 'success' }], 'success');
    expect(one({ failing: [{ name: 'e2e', rerun: 'pass' }], base: b }).class).toBe('new');
  });
  it('stale base run falls back to the merge-base local run, with env recorded', () => {
    const b = base([{ name: 'e2e', conclusion: 'success' }], 'success');
    const local = { e2e: { result: 'fail', failingTests: ['a'], envRecord: { os: 'linux', browsers: [] } } };
    const r = one({ failing: [{ name: 'e2e', tests: ['a'] }], base: b, local }, stale);
    expect(r.class).toBe('base');
    expect(r.evidence).toMatch(/linux; browsers: none/);
    expect(one({ failing: [{ name: 'e2e', tests: ['a'] }], base: b }, stale).reason).toMatch(/older than merge-base/);
  });
  it('local run needs an env record; local env needs an allowlisted reason', () => {
    expect(one({ failing: [{ name: 'e2e', tests: ['a'] }], local: { e2e: { result: 'fail', failingTests: ['a'] } } }).class).toBe('unknown');
    const rec = { os: 'linux', browsers: [] };
    expect(one({ failing: [{ name: 'e2e', tests: ['a'] }], local: { e2e: { result: 'fail', envRecord: rec, env: { reason: 'weird', log: 'x' } } } }).class).toBe('unknown');
    expect(one({ failing: [{ name: 'e2e', tests: ['a'] }], local: { e2e: { result: 'fail', envRecord: rec, env: log } } }).class).toBe('env');
  });
  it('renamed or matrix-reshaped job is unknown', () => {
    const b = base([{ name: 'e2e (ubuntu, 18)', conclusion: 'failure', failingTests: ['a'] }]);
    expect(one({ failing: [{ name: 'e2e (ubuntu, 20)', tests: ['a'] }], base: b }).reason).toMatch(/renamed or matrix-reshaped/);
  });
  it('exit codes: 1 any new, 3 unknown only, 0 base/env only', () => {
    expect(exitCode([{ class: 'unknown' }, { class: 'unknown' }])).toBe(3);
    expect(exitCode([{ class: 'unknown' }, { class: 'new' }])).toBe(1);
    expect(exitCode([{ class: 'base' }, { class: 'env' }])).toBe(0);
  });
});
