// Stage timer for the explain-video benchmark. run.mjs preloads it into every
// Node process the agent starts (NODE_OPTIONS=--import=<this file>) and sets
// VS_BENCH_STAGE_LOG. When the process is one of the skill's scripts, it
// appends one JSON line on exit: { script, args, start, end, exit }.
// Every other Node process is left alone. Outside a benchmark run
// (no VS_BENCH_STAGE_LOG) it does nothing.
import { appendFileSync } from 'node:fs';
import path from 'node:path';

const log = process.env.VS_BENCH_STAGE_LOG;
const entry = process.argv[1] ?? '';
const parts = entry.split(/[\\/]/);
const name = path.basename(entry).replace(/\.mjs$/, '');
const owner = parts.at(-3);
const tracked =
  (owner === 'vs-explain-video' && ['preflight', 'init', 'narrate', 'render', 'check', 'pack', 'verdict'].includes(name)) ||
  (owner === 'vs-write' && name === 'check-ste');

if (log && tracked && parts.at(-2) === 'scripts') {
  const start = Date.now();
  process.on('exit', (code) => {
    try {
      appendFileSync(log, `${JSON.stringify({ script: name, args: process.argv.slice(2), start, end: Date.now(), exit: code })}\n`);
    } catch {
      // A benchmark log must never break the skill.
    }
  });
}
