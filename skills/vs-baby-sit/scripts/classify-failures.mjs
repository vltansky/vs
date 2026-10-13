#!/usr/bin/env node
// Classify each red check as new | base | env | unknown from evidence only.
// Input JSON: { failing: [{name, url?, envSignal?, rerun?: "pass"|"fail"}],
//               base: { url, conclusion, jobs: [{name, conclusion}] } | null,
//               local?: { [name]: "pass"|"fail" } }   // merge-base reruns of only that test
// Output JSON: [{ name, class, reason, evidence }]. Never guesses: no baseline -> unknown.
import fs from 'node:fs';

const FAIL = new Set(['failure', 'timed_out', 'cancelled', 'startup_failure', 'error']);

export function classify({ failing = [], base = null, local = {} } = {}) {
  const baseDone = base && base.conclusion && Array.isArray(base.jobs);
  return failing.map((check) => {
    const { name } = check;
    if (check.envSignal) return { name, class: 'env', reason: check.envSignal, evidence: check.url ?? null };
    if (check.rerun === 'pass') return { name, class: 'env', reason: 'passed on rerun of the same head (flaky)', evidence: check.url ?? null };
    const job = baseDone ? base.jobs.find((j) => j.name === name) : undefined;
    if (job && FAIL.has(String(job.conclusion).toLowerCase()))
      return { name, class: 'base', reason: 'same job fails on the base branch latest run', evidence: base.url };
    if (job && String(job.conclusion).toLowerCase() === 'success')
      return { name, class: 'new', reason: 'same job passes on the base branch latest run', evidence: base.url };
    if (local[name] === 'fail') return { name, class: 'base', reason: 'fails at the merge-base (local, this test only)', evidence: 'merge-base' };
    if (local[name] === 'pass') return { name, class: 'new', reason: 'passes at the merge-base (local, this test only)', evidence: 'merge-base' };
    const why = !base ? 'no completed base run' : !baseDone ? 'base run not completed' : 'job missing from base run';
    return { name, class: 'unknown', reason: `${why}; no merge-base run`, evidence: null };
  });
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const file = process.argv[2];
  if (!file) { console.error('usage: classify-failures.mjs <input.json | ->'); process.exit(2); }
  let input;
  try { input = JSON.parse(fs.readFileSync(file === '-' ? 0 : file, 'utf8')); }
  catch (e) { console.error(`bad input: ${e.message}`); process.exit(2); }
  const out = classify(input);
  console.log(JSON.stringify(out, null, 2));
  process.exit(out.some((r) => r.class === 'new') ? 1 : 0);
}
