import * as fs from 'node:fs';
import * as path from 'node:path';
import { describe, expect, it } from 'vitest';
import { classify } from '../../vs-baby-sit/scripts/classify-failures.mjs';

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
    if (!/gh run list --branch <base>[\s\S]*--status completed/.test(t)) out.push(`${who}: no base-run baseline`);
    if (!/merge-base/.test(t)) out.push(`${who}: no merge-base fallback`);
    if (!/[Nn]ever (?:run )?the full\s+suite/.test(t) || /run the full suite to (?:get|find)/i.test(t.replace(/Never run the full\s+suite/, '')))
      out.push(`${who}: full suite run for baseline`);
    if (!/\*\*Unknown\*\*/.test(t) || !/(?:Do not guess|never a guess)/.test(t)) out.push(`${who}: guesses without evidence`);
  }
  if (!/\*\*Environment\*\* — flaky[\s\S]*with evidence/.test(a)) out.push('environment needs no evidence');
  if (!/Already failing on base\*\* — report it with the base run link; do not fix it\s+in this PR and do not rerun it/.test(b))
    out.push('baby-sit fixes or retries base failures');
  if (!/\*\*Unknown\*\* — rerun it exactly once; if still red, report it/.test(b)) out.push('Unknown not rerun once');
  if (!/when only those remain, report them and stop the repair loop/.test(b)) out.push('loop spins on base failures');
  if (!/\*\*New\*\* — fix and retry it in this PR/.test(b)) out.push('New failures not fixed');
  const ev = ship.slice(ship.indexOf('\n## Evidence\n'), ship.indexOf('\n## Tests\n'));
  for (const c of ['New:', 'Already failing on base:', 'Environment:', 'Unknown:'])
    if (!ev.includes(`  - ${c}`)) out.push(`body misses class ${c}`);
  if (!/Already failing on base: [^\n]*\(\[base run\]\(<base run URL>\)\)/.test(ev)) out.push('base class has no base-run link');
  return out;
}

type M = [string, string];
const mutants: Record<string, (p: M) => M> = {
  'no baseline': ([s, b]) => [s.replace(/\*\*Failure baseline\.\*\*[\s\S]*?turns this evidence into classes\.\n/, ''), b],
  'guess without evidence': ([s, b]) => [s.replace('no baseline exists; state the reason. Do not guess a class.', 'no baseline: pick the likeliest class.'), b],
  'full suite for baseline (ship-it)': ([s, b]) => [s.replace('Never run the full\nsuite to get a baseline.', 'Run the full suite to get a baseline.'), b],
  'full suite for baseline (baby-sit)': ([s, b]) => [s, b.replace('never the full suite.', 'or the full suite.')],
  'baby-sit fixes base failure': ([s, b]) => [s, b.replace('do not fix it\n  in this PR and do not rerun it', 'fix it in this PR too')],
  'baby-sit retries base in loop': ([s, b]) => [s, b.replace('when only those remain, report them and stop the repair loop', 'keep watching until they turn green')],
  'Unknown not rerun once': ([s, b]) => [s, b.replace('rerun it exactly once; if still red, report it', 'report it')],
  'class missing from body': ([s, b]) => [s.replace(/  - Already failing on base: [^\n]*\n/, ''), b],
  'baby-sit guesses': ([s, b]) => [s, b.replace(' No baseline at all is **Unknown**, never a guess.', '')],
  'env without evidence': ([s, b]) => [s.replace('an env reason\n  with evidence', 'any env-looking reason'), b],
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
  const base = { url: 'https://x/runs/1', conclusion: 'failure', jobs: [{ name: 'lint', conclusion: 'success' }, { name: 'e2e', conclusion: 'failure' }] };
  const cls = (input: object) => classify(input).map((r: { name: string; class: string }) => `${r.name}:${r.class}`);
  it('splits new from base by the base run', () => {
    expect(cls({ failing: [{ name: 'lint' }, { name: 'e2e' }], base })).toEqual(['lint:new', 'e2e:base']);
  });
  it('env needs a signal or a passing rerun', () => {
    expect(cls({ failing: [{ name: 'e2e', envSignal: 'chromium not installed' }, { name: 'lint', rerun: 'pass' }], base })).toEqual(['e2e:env', 'lint:env']);
  });
  it('falls back to merge-base local runs', () => {
    expect(cls({ failing: [{ name: 'a' }, { name: 'b' }], base: null, local: { a: 'fail', b: 'pass' } })).toEqual(['a:base', 'b:new']);
  });
  it('no baseline is unknown with a reason, never a guess', () => {
    const [r] = classify({ failing: [{ name: 'x' }], base: { url: 'u', conclusion: null, jobs: [] } });
    expect(r.class).toBe('unknown');
    expect(r.reason).toMatch(/base run not completed/);
    expect(classify({ failing: [{ name: 'y' }], base })[0].reason).toMatch(/job missing/);
  });
});
