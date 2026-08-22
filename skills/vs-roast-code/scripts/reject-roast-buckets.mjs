#!/usr/bin/env node
// Score a skill.md or a roast-output fixture (file or dir).
//
//   node reject-roast-buckets.mjs <skill.md|roast-dir|roast.md>
//
// Exit 0 clean. Exit 1 reject. Exit 2 cannot check. Treat 2 as not a pass.
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';

const target = process.argv[2];
if (!target) {
  console.error('Usage: node reject-roast-buckets.mjs <skill.md|roast-dir|roast.md>');
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

const hasSlogans = /\bAct\b/.test(text) && /\bConsider\b/.test(text);
// Copied slogans plus the 13-phrase closer are not procedure. A skill
// exclusive is a wired rejector script plus roast fixtures next to
// SKILL.md — pasted path strings cannot satisfy that.
function wiredExclusive(skillFile) {
  const root = dirname(skillFile);
  const rejector = join(root, 'scripts', 'reject-roast-buckets.mjs');
  const fixtures = join(root, 'test', 'fixtures', 'buckets');
  if (!existsSync(rejector) || !existsSync(fixtures)) return false;
  if (!statSync(rejector).isFile() || !statSync(fixtures).isDirectory()) {
    return false;
  }
  if (readdirSync(fixtures).length === 0) return false;
  const body = readFileSync(rejector, 'utf8');
  return /^#!/m.test(body) && /process\.exit/.test(body);
}

if (looksLikeSkill) {
  if (!wiredExclusive(files[0])) {
    console.error('reject-roast-buckets: slogan-only skill');
    process.exit(1);
  }
  process.exit(0);
}

const FILE_LINE = /[\w./-]+\.[A-Za-z][\w]*:\d+/;
const SIN_NAME = /\*\*\[[^\]]+\]\*\*/;
const hasFindings = FILE_LINE.test(text) || SIN_NAME.test(text);

const BUCKET = '(Act|Consider|Noted|Dismissed)';
const headingRe = new RegExp(`^#{1,4}\\s+${BUCKET}\\b`, 'im');
const boldRe = new RegExp(`\\*\\*${BUCKET}\\*\\*`, 'i');
const prefixRe = new RegExp(`\\b${BUCKET}\\s+[—-]`, 'i');
const labeled = headingRe.test(text) || boldRe.test(text) || prefixRe.test(text);

if (hasSlogans && !hasFindings) {
  console.error('reject-roast-buckets: slogan-only Act/Consider with no findings');
  process.exit(1);
}

if (hasFindings && !labeled) {
  console.error('reject-roast-buckets: unbucketed list');
  process.exit(1);
}

function currentBucket(line) {
  const heading = line.match(new RegExp(`^#{1,4}\\s+${BUCKET}\\b`, 'i'));
  if (heading) return heading[1].toLowerCase();
  const inline = line.match(new RegExp(`(?:\\*\\*${BUCKET}\\*\\*|\\b${BUCKET}\\s+[—-])`, 'i'));
  if (inline) return (inline[1] || inline[2]).toLowerCase();
  return null;
}

function isFinding(line) {
  return FILE_LINE.test(line) || SIN_NAME.test(line);
}

const NIT =
  /trailing whitespace|parking ticket|prefer\b|rename\b|polish|style only|formatting|indent|semicolon|quote style/i;
const REAL =
  /secret|inject|auth|crash|null|off-by-one|data loss|race|sql|bypass|unsanitized/i;
const WHY =
  /because|why:|not a |missing context|already |intentional|out of scope|would not|does not|rejected/i;

const assigned = [];
let section = null;
for (const raw of text.split(/\r?\n/)) {
  const line = raw.trim();
  const next = currentBucket(line);
  if (next && /^#{1,4}\s+/.test(line)) {
    section = next;
    continue;
  }
  if (!isFinding(line)) continue;
  const bucket = currentBucket(line) || section;
  assigned.push({ line, bucket });
}

if (hasFindings && assigned.some((item) => !item.bucket)) {
  console.error('reject-roast-buckets: unbucketed list');
  process.exit(1);
}

const used = new Set(assigned.map((item) => item.bucket).filter(Boolean));
const allAct = assigned.length > 0 && assigned.every((item) => item.bucket === 'act');
const allNits =
  assigned.length >= 2 &&
  assigned.every((item) => NIT.test(item.line)) &&
  assigned.every((item) => !REAL.test(item.line));
const actNits = assigned.filter(
  (item) =>
    item.bucket === 'act' && NIT.test(item.line) && !REAL.test(item.line),
);

if (allAct && allNits) {
  console.error('reject-roast-buckets: all-Act dump of nits');
  process.exit(1);
}

if (actNits.length > 0) {
  console.error('reject-roast-buckets: dismissed-as-Act');
  process.exit(1);
}

if (hasFindings && assigned.length > 0 && !used.has('act')) {
  console.error('reject-roast-buckets: missing Act');
  process.exit(1);
}

const dismissed = assigned.filter((item) => item.bucket === 'dismissed');
const dismissedWhy = dismissed.every((item) => WHY.test(item.line));

if (dismissed.length > 0 && !dismissedWhy) {
  console.error('reject-roast-buckets: Dismissed needs a why on that finding');
  process.exit(1);
}

process.exit(0);
