#!/usr/bin/env node
// Classify each red check as new | base | env | unknown from evidence only. Never guesses.
// Input JSON:
// { mergeBase: "<sha>",
//   failing: [{ name, tests?: [failing test names], url?, env?: { reason, log } }],
//   base: { url, sha, conclusion, jobs: [{ name, conclusion, failingTests? }] } | null,
//   local?: { [job]: { result: "pass"|"fail", failingTests?, envRecord?: { os, browsers }, env?: { reason, log } } } }
// Base run: latest completed run on the base branch whose conclusion is success or failure,
// at the merge-base or newer. Renamed or matrix-reshaped jobs have no match -> unknown.
// Exit: 1 any new, 3 unknown (no new), 0 only base/env, 2 bad input.
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';

export const ENV_REASONS = new Set(['browser-not-installed', 'network-unreachable', 'runner-out-of-disk', 'missing-secret-on-fork']);
const FAILED = new Set(['failure', 'timed_out']);
const lc = (v) => String(v ?? '').toLowerCase();

function envOf(env) {
  return env && ENV_REASONS.has(env.reason) && String(env.log ?? '').trim() ? env : null;
}

function compare(tests, baseFailing) {
  if (!Array.isArray(tests) || !tests.length || !Array.isArray(baseFailing)) return null;
  const extra = tests.filter((t) => !baseFailing.includes(t));
  return extra.length ? { cls: 'new', why: `fails only on this PR: ${extra.join(', ')}` } : { cls: 'base', why: 'same tests fail on base' };
}

export function classify({ failing = [], base = null, local = {}, mergeBase = null } = {}, { isAncestor = () => false } = {}) {
  const usable = base && ['success', 'failure'].includes(lc(base.conclusion)) && Array.isArray(base.jobs);
  const fresh = usable && mergeBase && base.sha && isAncestor(mergeBase, base.sha);
  const baseWhy = !base ? 'no base run' : !usable ? `base run conclusion ${base.conclusion || 'none'} skipped` : !fresh ? 'base run older than merge-base' : null;
  return failing.map((check) => {
    const { name } = check;
    const r = (cls, reason, evidence) => ({ name, class: cls, reason, evidence: evidence ?? null });
    const env = envOf(check.env);
    if (env) return r('env', env.reason, env.log);
    if (fresh) {
      const job = base.jobs.find((j) => j.name === name);
      if (job && lc(job.conclusion) === 'success') return r('new', 'same job passes on base', base.url);
      if (job && FAILED.has(lc(job.conclusion))) {
        const c = compare(check.tests, job.failingTests);
        return c ? r(c.cls, c.why, base.url) : r('unknown', 'no test-level data to compare with base', base.url);
      }
    }
    const loc = local[name];
    if (loc) {
      if (!loc.envRecord || !loc.envRecord.os) return r('unknown', 'merge-base run has no environment record', null);
      const ev = `merge-base local (${loc.envRecord.os}; browsers: ${(loc.envRecord.browsers || []).join(', ') || 'none'})`;
      if (loc.result === 'pass') return r('new', 'passes at merge-base', ev);
      const lenv = envOf(loc.env);
      if (lenv) return r('env', lenv.reason, `${ev}: ${lenv.log}`);
      const c = compare(check.tests, loc.failingTests);
      return c ? r(c.cls, c.why, ev) : r('unknown', 'no test-level data to compare at merge-base', ev);
    }
    const why = baseWhy ?? 'job missing from base run (renamed or matrix-reshaped)';
    return r('unknown', `${why}; no merge-base run`);
  });
}

export function exitCode(results) {
  if (results.some((x) => x.class === 'new')) return 1;
  if (results.some((x) => x.class === 'unknown')) return 3;
  return 0;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const file = process.argv[2];
  if (!file) { console.error('usage: classify-failures.mjs <input.json | ->'); process.exit(2); }
  let input;
  try { input = JSON.parse(fs.readFileSync(file === '-' ? 0 : file, 'utf8')); }
  catch (e) { console.error(`bad input: ${e.message}`); process.exit(2); }
  const isAncestor = (a, b) => { try { execFileSync('git', ['merge-base', '--is-ancestor', a, b], { stdio: 'ignore' }); return true; } catch { return false; } };
  const out = classify(input, { isAncestor });
  console.log(JSON.stringify(out, null, 2));
  process.exit(exitCode(out));
}
