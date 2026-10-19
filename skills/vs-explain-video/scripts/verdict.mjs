#!/usr/bin/env node
// Reads the fresh reviewer's reply and decides the round by its scores, not by
// the verdict word: PASS needs the bar (8) or more on every axis.
//
//   node verdict.mjs <work-dir> [reply.md] [--round N]
//
// The round defaults to the newest review/round-N; the reply defaults to
// review/round-N/REPLY.md. Writes review/round-N/VERDICT.json.
// Exit codes: 0 PASS; 1 RETURN (fix, check, render, pack the next round);
// 2 blocked: no pack, no reply, or a reply without a score for every axis.
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

import { AXES, parseVerdict, RULES } from './checks.mjs';
import { fail } from './media.mjs';

const args = process.argv.slice(2);
const positional = args.filter((arg, i) => !arg.startsWith('--') && args[i - 1] !== '--round');
const [workArg, replyArg] = positional;
if (!workArg) fail('Usage: node verdict.mjs <work-dir> [reply.md] [--round N]');
const reviewDir = path.join(path.resolve(workArg), 'review');
const rounds = existsSync(reviewDir)
  ? readdirSync(reviewDir).map((name) => /^round-(\d+)$/.exec(name)?.[1]).filter(Boolean).map(Number).sort((a, b) => a - b)
  : [];
const roundArg = args.includes('--round') ? args[args.indexOf('--round') + 1] : null;
const round = roundArg === null ? rounds.at(-1) : Number(roundArg);
if (!round || !rounds.includes(round)) fail(`No pack for ${roundArg === null ? 'any round' : `round ${roundArg}`} in ${reviewDir}. Run pack.mjs first.`);
const dir = path.join(reviewDir, `round-${round}`);
const replyFile = path.resolve(replyArg ?? path.join(dir, 'REPLY.md'));
if (!existsSync(replyFile)) fail(`${replyFile} is missing. Save the reviewer's whole reply there, then rerun verdict.mjs.`);

const result = parseVerdict(readFileSync(replyFile, 'utf8'));
if (result.missing.length) {
  fail(`The reply has no score for: ${result.missing.join(', ')}. It is not a review; give BRIEF.md to a new reviewer. Axes: ${AXES.join(', ')}.`);
}
const last = round >= RULES.rounds;
const out = {
  round,
  bar: RULES.bar,
  ...result,
  next: result.verdict === 'PASS'
    ? `PASS in round ${round}. Hand off with the scores.`
    : `${result.overruled ? `The reviewer wrote PASS, but ${result.below.join(', ')} ${result.below.length > 1 ? 'are' : 'is'} under ${RULES.bar}: this is a RETURN. ` : ''}${last
      ? `Round ${round} was the last. Deliver the video with these scores and the open problems, and say it did not pass.`
      : `RETURN: fix what the reviewer named in scenes.js, rerun check.mjs, render, and pack round ${round + 1} for a new reviewer.`}`,
};
writeFileSync(path.join(dir, 'VERDICT.json'), `${JSON.stringify(out, null, 2)}\n`);
process.stdout.write(`${JSON.stringify(out, null, 2)}\n`);
process.exit(result.verdict === 'PASS' ? 0 : 1);
