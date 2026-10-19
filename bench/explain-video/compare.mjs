#!/usr/bin/env node
// Compare the newest benchmark row against the stored baseline.
//
//   npm run bench:explain-video:compare -- [--history <file>] [--baseline <sha>]
//       [--time 0.2] [--tokens 0.15] [--cost 0.15] [--tools 0.25] [--min-time-ms 5000]
//
// The baseline is the newest row marked "baseline": true for the same agent
// and model, or the row whose git sha starts with --baseline. Prints one line
// per metric and a warning per regression. Warn only: exit 0 with or without
// regressions; exit 2 when there is nothing to compare.
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { compare, fmtDelta, pickBaseline } from './lib.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const opt = (name, fallback) => {
  const i = args.findIndex((a) => a === name || a.startsWith(`${name}=`));
  if (i < 0) return fallback;
  return args[i].includes('=') ? args[i].split('=').slice(1).join('=') : args[i + 1];
};
const num = (name) => {
  const v = opt(name);
  if (v === undefined) return undefined;
  const n = Number(v);
  if (!Number.isFinite(n) || n < 0) {
    process.stderr.write(`${name} must be a non-negative number, got ${v}\n`);
    process.exit(2);
  }
  return n;
};

const file = opt('--history', path.join(HERE, 'history.jsonl'));
if (!existsSync(file)) {
  process.stderr.write(`${file} does not exist. Run npm run bench:explain-video first.\n`);
  process.exit(2);
}
const history = readFileSync(file, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l));
const latest = history.at(-1);
if (!latest) {
  process.stderr.write(`${file} has no rows.\n`);
  process.exit(2);
}
const baseline = pickBaseline(history, latest, opt('--baseline'));
if (!baseline) {
  process.stderr.write(latest.baseline
    ? 'The newest row is the baseline. Run the benchmark again to compare against it.\n'
    : `No baseline row for ${latest.agent} ${latest.model}. Not compared.\n`);
  process.exit(2);
}
const thresholds = Object.fromEntries(
  [['time', num('--time')], ['tokens', num('--tokens')], ['cost', num('--cost')], ['tools', num('--tools')], ['minTimeMs', num('--min-time-ms')]]
    .filter(([, v]) => v !== undefined),
);
const { rows, warnings } = compare(baseline, latest, thresholds);
process.stdout.write(`latest ${String(latest.gitSha).slice(0, 7)} (${latest.date}) vs baseline ${String(baseline.gitSha).slice(0, 7)} (${baseline.date})\n`);
for (const r of rows) {
  if (!r.metric) {
    process.stdout.write(`  ${r.brief}: ${r.note}\n`);
    continue;
  }
  process.stdout.write(`  ${r.regressed ? '⚠' : ' '} ${r.brief} ${r.metric}: ${r.baseline} -> ${r.latest} (${fmtDelta(r.delta)})\n`);
}
process.stdout.write(warnings.length ? `${warnings.length} regression warning(s):\n${warnings.map((w) => `  - ${w}`).join('\n')}\n` : 'No regressions.\n');
process.exit(0);
