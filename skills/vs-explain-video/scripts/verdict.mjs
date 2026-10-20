#!/usr/bin/env node
// Reads the fresh reviewer's reply and reports the score, decided by the
// numbers, not by the verdict word: PASS needs the bar (8) or more on every
// axis, anything less is BELOW. There is one review per video, so BELOW goes
// into the handoff with the open problems; it never starts another round.
//
//   node verdict.mjs <work-dir> [reply.md]
//
// The reply defaults to review/REPLY.md. Writes review/VERDICT.json.
// Exit codes: 0 the reply was scored (PASS or BELOW); 2 blocked: no pack, no
// reply, or a reply without a score for every axis.
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

import { AXES, parseVerdict, RULES } from './checks.mjs';
import { fail } from './media.mjs';

const [workArg, replyArg] = process.argv.slice(2).filter((arg) => !arg.startsWith('--'));
if (!workArg) fail('Usage: node verdict.mjs <work-dir> [reply.md]');
const dir = path.join(path.resolve(workArg), 'review');
if (!existsSync(dir)) fail(`No pack in ${dir}. Run pack.mjs first.`);
const replyFile = path.resolve(replyArg ?? path.join(dir, 'REPLY.md'));
if (!existsSync(replyFile)) fail(`${replyFile} is missing. Save the reviewer's whole reply there, then rerun verdict.mjs.`);

const result = parseVerdict(readFileSync(replyFile, 'utf8'));
if (result.missing.length) {
  fail(`The reply has no score for: ${result.missing.join(', ')}. It is not a review; give BRIEF.md to a new reviewer. Axes: ${AXES.join(', ')}.`);
}
const out = {
  bar: RULES.bar,
  ...result,
  next: result.verdict === 'PASS'
    ? 'PASS. Hand off with the scores.'
    : `${result.overruled ? `The reviewer wrote PASS, but ${result.below.join(', ')} ${result.below.length > 1 ? 'are' : 'is'} under ${RULES.bar}. ` : ''}BELOW the bar on ${result.below.join(', ')}. Hand off with these scores and the reviewer's three problems, and say it did not pass. Do not re-render or review again.`,
};
writeFileSync(path.join(dir, 'VERDICT.json'), `${JSON.stringify(out, null, 2)}\n`);
process.stdout.write(`${JSON.stringify(out, null, 2)}\n`);
