#!/usr/bin/env node
// Score a recap inherit-and-re-prove fixture (skill.md or recap dir).
//
//   node reject-recap.mjs <skill.md|recap-dir>
//
// Exit 0 clean. Exit 1 reject. Exit 2 cannot check. Treat 2 as not a pass.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { basename, join } from 'node:path';

const target = process.argv[2];
if (!target) {
  console.error('Usage: node reject-recap.mjs <skill.md|recap-dir>');
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

function read(file) {
  try {
    return readFileSync(file, 'utf8');
  } catch (error) {
    console.error(`Cannot read ${file}: ${error.code ?? error.message}`);
    process.exit(2);
  }
}

const byName = new Map(files.map((file) => [basename(file), file]));
let text = '';
for (const file of files) text += `\n${read(file)}`;

const looksLikeSkill =
  files.length === 1 &&
  !stat.isDirectory() &&
  /^name:\s*/m.test(text) &&
  /^# /m.test(text);

const slogans =
  /inherit the trail|do not re-derive|re-prove claims on the artifact/i.test(
    text,
  );
const exclusiveHits = [
  /If `GOALS\.md` \/ `decisions\.tsv` \/ a baby-sit resume file \/ prior recap exists,\s*READ it first/i,
  /Do not re-run research, re-score sessions, or rebuild a roadmap/i,
  /Every status\/done\/blocked claim must point at a concrete artifact/i,
  /Missing trail is ok \(say unknown\); inventing one is not/i,
  /Recap consumes the trail\. Orchestrate owns `decisions\.tsv`/i,
].filter((re) => re.test(text)).length;

if (looksLikeSkill) {
  if (slogans && exclusiveHits < 3) {
    console.error('reject-recap: slogan-only skill');
    process.exit(1);
  }
  if (exclusiveHits < 4) {
    console.error('Cannot classify skill');
    process.exit(2);
  }
  process.exit(0);
}

const recapFile = byName.get('recap.md');
if (!recapFile) {
  console.error('Cannot check recap fixture without recap.md');
  process.exit(2);
}

const recap = read(recapFile);
const goals = byName.has('GOALS.md') ? read(byName.get('GOALS.md')) : '';
const tsv = byName.has('decisions.tsv')
  ? read(byName.get('decisions.tsv'))
  : '';
const resumeFile = files.find((file) => /resume/i.test(basename(file)));
const resume = resumeFile ? read(resumeFile) : '';
const hasTrail = Boolean(goals || tsv || resume);

const goalIds = goals
  ? new Set(
      [...goals.matchAll(/(?:^|\n)##\s*(M\d+)\b/g)].map((m) => m[1]),
    )
  : new Set();
const recapIds = [...recap.matchAll(/\bM\d+\b/g)].map((m) => m[0]);
const recapIdSet = new Set(recapIds);
const invented = recapIds.filter((id) => !goalIds.has(id));
const listsMilestones =
  recapIds.length >= 2 ||
  /milestone list|new roadmap|milestones:/i.test(recap);

if (goalIds.size > 0 && invented.length > 0 && listsMilestones) {
  console.error('reject-recap: re-derived milestone list ignoring GOALS.md');
  process.exit(1);
}

if (
  goalIds.size > 0 &&
  listsMilestones &&
  [...goalIds].every((id) => !recapIdSet.has(id))
) {
  console.error('reject-recap: re-derived milestone list ignoring GOALS.md');
  process.exit(1);
}

const saysUnknown = /\bunknown\b/i.test(recap);
if (!hasTrail && listsMilestones && !saysUnknown) {
  console.error('reject-recap: invented a trail');
  process.exit(1);
}

const POINTER =
  /(?:PR\s*#?\d+|#\d+|\b[0-9a-f]{7,40}\b|GOALS\.md|decisions\.tsv|`[^`]+`|\/[\w./-]+-resume\.md)/i;

const CLAIM =
  /\b(?:is\s+)?(?:done|complete|completed|shipped|merged|blocked)\b/gi;
const claims = [...recap.matchAll(CLAIM)];
for (const match of claims) {
  const start = Math.max(0, match.index - 80);
  const end = Math.min(recap.length, match.index + match[0].length + 80);
  const window = recap.slice(start, end);
  if (!POINTER.test(window)) {
    console.error('reject-recap: done/status claim with no artifact pointer');
    process.exit(1);
  }
}

if (
  slogans &&
  !hasTrail &&
  !saysUnknown &&
  !POINTER.test(recap)
) {
  console.error('reject-recap: mention-only run');
  process.exit(1);
}

process.exit(0);
