#!/usr/bin/env node
// Score a skill.md or a variate run fixture (UI variants / design candidates).
//
//   node reject-variate.mjs <skill.md|run-dir>
//
// Exit 0 clean. Exit 1 reject. Exit 2 cannot check. Treat 2 as not a pass.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { basename, join } from 'node:path';

const target = process.argv[2];
if (!target) {
  console.error('Usage: node reject-variate.mjs <skill.md|run-dir>');
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

let text = '';
for (const file of files) text += `\n${read(file)}`;

const looksLikeSkill =
  files.length === 1 &&
  !stat.isDirectory() &&
  /^name:\s*/m.test(text) &&
  /^# /m.test(text);

const hasProcedure =
  /separate\s+(?:sketches|files)|own sketch or file/i.test(text) &&
  /score after(?: the)? candidates exist/i.test(text) &&
  /do not write the\s+rubric into the first prompt/i.test(text) &&
  /never average/i.test(text) &&
  /(?:graft|steal) one concrete bit/i.test(text);

if (looksLikeSkill) {
  if (!hasProcedure) {
    console.error('reject-variate: slogan-only skill');
    process.exit(1);
  }
  process.exit(0);
}

function kind(name) {
  if (/generate|first-prompt/i.test(name)) return 'generate';
  if (/rubric/i.test(name)) return 'rubric';
  if (/pick|decision|winner/i.test(name)) return 'pick';
  if (/candidate|variant|sketch|layout/i.test(name)) return 'candidate';
  return 'other';
}

const grouped = { generate: [], rubric: [], pick: [], candidate: [], other: [] };
for (const file of files) grouped[kind(basename(file))].push(file);

if (grouped.candidate.length === 0) {
  console.error('Cannot check variate fixture without candidate files');
  process.exit(2);
}

const generateText = grouped.generate.map(read).join('\n');
const pickText = grouped.pick.map(read).join('\n');
const candidateTexts = grouped.candidate.map((file) => ({
  file,
  text: read(file),
}));

const AVERAGE =
  /average|50\s*\/\s*50|blend(?:ed)?(?: the)?|hybrid of both/i;
if (
  grouped.candidate.length < 2 ||
  candidateTexts.some((item) => AVERAGE.test(item.text))
) {
  console.error('reject-variate: one file that averages two layouts');
  process.exit(1);
}

const LEAKED = /##?\s*Rubric\b|score (?:each|on):|Score on:/i;
if (grouped.generate.length === 0 || LEAKED.test(generateText)) {
  console.error('reject-variate: rubric leaked into the generate prompt');
  process.exit(1);
}

if (grouped.rubric.length === 0) {
  console.error('reject-variate: rubric leaked into the generate prompt');
  process.exit(1);
}

if (!/^Base:\s+\S+/m.test(`${pickText}\n${text}`)) {
  console.error('reject-variate: no base named');
  process.exit(1);
}

if (!/^Graft:\s+\S+/m.test(`${pickText}\n${text}`)) {
  console.error('reject-variate: no base named');
  process.exit(1);
}

process.exit(0);
