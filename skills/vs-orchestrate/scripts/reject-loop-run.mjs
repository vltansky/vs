#!/usr/bin/env node
// Score an orchestrate loop-contract fixture (skill.md, run.md, or run dir).
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
  /done-predicate[\s\S]{0,120}BEFORE the first watch|first watch or `\/vs-build-it` delegate/i,
  /Two gates that find the same unfinished evidence/i,
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
const start = /delegated \/vs-build-it|started the watcher|watch_pr\.py/i;
const startIdx = text.search(start);
if (startIdx >= 0 && (predIdx < 0 || predIdx > startIdx)) {
  console.error('reject-loop-run: delegated without done-predicate');
  process.exit(1);
}

const resume = /(?:^|\n)\s*resume:\s*yes/im.test(text);
const resumeFile = /(?:^|\n)\s*resume-file:\s+\S+/im.test(text);
if (resume && !resumeFile) {
  console.error('reject-loop-run: resume without trail file');
  process.exit(1);
}

const unfinished = [...text.matchAll(/gate-unfinished:\s*(\S+)/gi)].map((m) => m[1]);
const counts = new Map();
for (const key of unfinished) counts.set(key, (counts.get(key) ?? 0) + 1);
const continued = /activate-next:|delegated \/vs-build-it again/i.test(text);
for (const [key, n] of counts) {
  if (n >= 3 || (n >= 2 && continued)) {
    console.error(`reject-loop-run: looped past two stuck gates of ${key}`);
    process.exit(1);
  }
}

if (slogans && predIdx < 0 && startIdx < 0 && !resume) {
  console.error('reject-loop-run: mention-only run');
  process.exit(1);
}

process.exit(0);
