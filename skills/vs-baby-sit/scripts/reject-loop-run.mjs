#!/usr/bin/env node
// Score a baby-sit loop-contract fixture (skill.md, run.md, or run dir).
//
//   node reject-loop-run.mjs <skill.md|run-dir|run.md>
//
// Exit 0 clean. Exit 1 reject. Exit 2 cannot check. Treat 2 as not a pass.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const target = process.argv[2];
if (!target) {
  console.error('Usage: node reject-loop-run.mjs <skill.md|run-dir|run.md>');
  process.exit(2);
}

let stat;
try {
  stat = statSync(target);
} catch (error) {
  console.error(`Cannot read ${target}: ${error.code ?? error.message}`);
  process.exit(2);
}

const files = [];
function walk(dir) {
  for (const name of readdirSync(dir)) {
    const next = join(dir, name);
    const nextStat = statSync(next);
    if (nextStat.isDirectory()) walk(next);
    else files.push(next);
  }
}

if (stat.isDirectory()) {
  walk(target);
  if (files.length === 0) {
    console.error(`Cannot check empty directory: ${target}`);
    process.exit(2);
  }
} else {
  files.push(target);
}

let text = '';
for (const file of files) {
  try {
    text += `\n${readFileSync(file, 'utf8')}`;
  } catch (error) {
    console.error(`Cannot read ${file}: ${error.code ?? error.message}`);
    process.exit(2);
  }
}

const looksLikeSkill =
  files.length === 1 &&
  !stat.isDirectory() &&
  /^name:\s*/m.test(text) &&
  /^# /m.test(text);

const slogans = /done-predicate|two stuck|decision trail|pause \+ off-context resume/i.test(
  text,
);
const exclusiveHits = [
  /done-predicate[\s\S]{0,80}before the first watch|before the first watch[\s\S]{0,80}done-predicate|Do not run the watcher until the done-predicate/i,
  /Two stuck iterations of the same repair/i,
  /Resume reads[\s\S]{0,40}file and does not re-derive/i,
  /decisions\.tsv/i,
  /Picture-show-me/i,
].filter((re) => re.test(text)).length;

if (looksLikeSkill) {
  if (slogans && exclusiveHits < 3) {
    console.error('reject-loop-run: slogan-only skill');
    process.exit(1);
  }
  if (exclusiveHits < 4) {
    console.error('Cannot classify skill');
    process.exit(2);
  }
  process.exit(0);
}

const pred = /(?:^|\n)\s*done-predicate:\s+\S+/im;
const predIdx = text.search(pred);
const watch = /watch_pr\.py|started the watcher|start(?:ed|s)? the watcher/i;
const watchIdx = text.search(watch);
if (watchIdx >= 0 && (predIdx < 0 || predIdx > watchIdx)) {
  console.error('reject-loop-run: watcher started without done-predicate');
  process.exit(1);
}

const resume = /(?:^|\n)\s*resume:\s*yes/im.test(text);
const paused = /(?:^|\n)\s*paused:\s*yes/im.test(text);
const resumeFile = /(?:^|\n)\s*resume-file:\s+\S+/im.test(text);
if (resume && !resumeFile) {
  console.error('reject-loop-run: resume without resume-file');
  process.exit(1);
}
if (paused && !resumeFile) {
  console.error('reject-loop-run: pause without resume-file');
  process.exit(1);
}

const stuck = [...text.matchAll(/stuck-iteration:\s*(\S+)/gi)].map((m) => m[1]);
const counts = new Map();
for (const key of stuck) counts.set(key, (counts.get(key) ?? 0) + 1);
const continued =
  /(?:^|\n)\s*continued:\s*yes/im.test(text) ||
  /started the watcher again/i.test(text) ||
  /watch_pr\.py/i.test(text);
const stopped = /(?:^|\n)\s*stopped:\s*yes/im.test(text);
for (const [key, n] of counts) {
  if (n >= 3) {
    console.error(`reject-loop-run: three stuck iterations of ${key}`);
    process.exit(1);
  }
  if (n >= 2 && (continued || !stopped)) {
    console.error(`reject-loop-run: looped past two stuck iterations of ${key}`);
    process.exit(1);
  }
}

const hasTsvHeader = /(?:^|\n)ts\tphase\tdecision\twhy\tevidence\tresult(?:\n|$)/.test(
  text,
);
const hasTsvRow = /(?:^|\n)\d{4}-\d{2}-\d{2}T[^\n]*\t[^\n]+\t[^\n]+\t/.test(text);
const shouldHaveTrail =
  predIdx >= 0 || watchIdx >= 0 || resume || paused || stuck.length > 0;
if (shouldHaveTrail && (!hasTsvHeader || !hasTsvRow)) {
  console.error('reject-loop-run: missing TSV header/row');
  process.exit(1);
}

if (slogans && predIdx < 0 && watchIdx < 0 && !resume && !paused) {
  console.error('reject-loop-run: mention-only run');
  process.exit(1);
}

process.exit(0);
