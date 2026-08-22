#!/usr/bin/env node
// Score a skill file or a tune-skill-run fixture.
//
//   node reject-tune-run.mjs <skill.md|run-dir|run.md>
//
// Exit 0 clean. Exit 1 reject. Exit 2 cannot check. Treat 2 as not a pass.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const target = process.argv[2];
if (!target) {
  console.error('Usage: node reject-tune-run.mjs <skill.md|run-dir|run.md>');
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
if (stat.isDirectory()) {
  walk(target, (file) => files.push(file));
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

const slogans = /grade[\s\S]{0,120}(skill|chat)|scorecard|propose[d]? diffs|\/vs-tune-skill/i.test(text);
const exclusiveHits = [
  /Flow Contract/,
  /mktemp/,
  /never upload|do not upload/i,
  /ask whether to apply|never mutate|do not modify the user'?s real skill/i,
  /fired|followed|fire and follow/i,
].filter((re) => re.test(text)).length;
const looksLikeSkillDoc =
  files.length === 1 &&
  !stat.isDirectory() &&
  /^name:\s*/m.test(text) &&
  /^# /m.test(text) &&
  !hasInventory(text) &&
  !hasProposedDiff(text);
const uploaded =
  /uploaded transcripts:\s*yes/i.test(text) ||
  /posted [^\n]*\.(jsonl|md) to https?:\/\//i.test(text) ||
  /(?:^|[^\n.])uploads? transcripts? to /im.test(text);
const mutated = /wrote directly to skills\/|mutated repo skills:\s*yes|applied diffs to skills\//i.test(text);
const mentioned = /tune-skill|grade[d]? skills|scorecard/i.test(text);
const inventory = hasInventory(text);
const proposed = hasProposedDiff(text);
const zeroSessions = /sessions_sampled"?\s*:\s*0|NO_SESSIONS|zero sessions/i.test(text);

if (looksLikeSkillDoc) {
  if (exclusiveHits >= 4) process.exit(0);
  if (slogans && exclusiveHits < 3) {
    console.error('reject-tune-run: slogan-only skill');
    process.exit(1);
  }
  console.error('Cannot classify skill');
  process.exit(2);
}

if (uploaded) {
  console.error('reject-tune-run: uploaded transcripts');
  process.exit(1);
}
if (mutated) {
  console.error('reject-tune-run: mutated repo skills');
  process.exit(1);
}
if (mentioned && !inventory && !proposed && !zeroSessions) {
  console.error('reject-tune-run: mention-only run, no inventory or proposed diff');
  process.exit(1);
}
if (inventory && (proposed || zeroSessions) && !uploaded && !mutated) {
  process.exit(0);
}

console.error('Cannot classify tune-skill run');
process.exit(2);

function hasInventory(body) {
  return /skills_found|sessions_sampled|"skills"\s*:/.test(body);
}

function hasProposedDiff(body) {
  const unified = /^--- /m.test(body) && /^\+\+\+ /m.test(body) && /^@@ /m.test(body);
  const fullCopy = /name:\s*[a-z0-9-]+/.test(body) && /## /.test(body);
  return unified && fullCopy;
}

function walk(dir, visit) {
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) walk(full, visit);
    else if (entry.isFile()) visit(full);
  }
}
