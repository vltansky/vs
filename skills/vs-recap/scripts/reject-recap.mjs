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
// Procedure is an example pointer plus an action closer — not four copied
// contract sentences.
const hasProcedure =
  /Possible actions/i.test(text) &&
  /PR\s*#?\d+/i.test(text) &&
  /\b[0-9a-f]{7,40}\b/i.test(text);

if (looksLikeSkill) {
  if (slogans && !hasProcedure) {
    console.error('reject-recap: slogan-only skill');
    process.exit(1);
  }
  if (!hasProcedure) {
    console.error('reject-recap: slogan-only skill');
    process.exit(1);
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
const trailText = `${goals}\n${tsv}\n${resume}`;

const trailNames = [];
if (goals) trailNames.push('GOALS.md');
if (tsv) trailNames.push('decisions.tsv');
if (resumeFile) trailNames.push(basename(resumeFile));

const trailPrs = new Set(
  [...trailText.matchAll(/PR\s*#?(\d+)/gi)].map((m) => m[1]),
);
const trailShas = new Set(
  [...trailText.matchAll(/\b([0-9a-f]{7,40})\b/gi)].map((m) =>
    m[1].toLowerCase(),
  ),
);
const recapPrs = [...recap.matchAll(/PR\s*#?(\d+)/gi)].map((m) => m[1]);
const recapShas = [...recap.matchAll(/\b([0-9a-f]{7,40})\b/gi)].map((m) =>
  m[1].toLowerCase(),
);

const citesInherited =
  trailNames.some((name) =>
    new RegExp(name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i').test(recap),
  ) ||
  recapPrs.some((id) => trailPrs.has(id)) ||
  recapShas.some((sha) => trailShas.has(sha));

const goalIds = goals
  ? new Set(
      [...goals.matchAll(/(?:^|\n)##\s*(M\d+)\b/g)].map((m) => m[1]),
    )
  : new Set();
const recapIds = [...recap.matchAll(/\bM\d+\b/g)].map((m) => m[0]);
const recapIdSet = new Set(recapIds);
const invented = recapIds.filter((id) => !goalIds.has(id));
const rebuildsList = /milestone list|new roadmap|milestones:/i.test(recap);
const listsMilestones = recapIds.length >= 2 || rebuildsList;

if (goalIds.size > 0 && rebuildsList) {
  console.error('reject-recap: re-derived milestone list ignoring GOALS.md');
  process.exit(1);
}

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

// File / SHA / PR / row. Bare GOALS.md, any #\d, and any backtick are not enough.
const POINTER =
  /(?:PR\s*#?\d+|\b[0-9a-f]{7,40}\b|GOALS\.md\s+M\d+|decisions\.tsv|\/[\w./-]+-resume\.md)/i;

const CLAIM =
  /\b(?:is\s+)?(?:done|complete|completed|shipped|merged|blocked|active)\b/gi;
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

if (hasTrail && !citesInherited) {
  console.error('reject-recap: ignored the trail');
  process.exit(1);
}

if (slogans && !citesInherited && !saysUnknown) {
  console.error('reject-recap: mention-only run');
  process.exit(1);
}

process.exit(0);
