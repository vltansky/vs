#!/usr/bin/env node
// Score a skill.md or a pre-flight closeout fixture (file or dir).
//
//   node reject-roast-preflight.mjs <skill.md|preflight-dir|preflight.md>
//
// Exit 0 clean. Exit 1 reject. Exit 2 cannot check. Treat 2 as not a pass.
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';

const target = process.argv[2];
if (!target) {
  console.error('Usage: node reject-roast-preflight.mjs <skill.md|preflight-dir|preflight.md>');
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

function wiredExclusive(skillFile) {
  const rootDir = dirname(skillFile);
  const rejectorPath = join(rootDir, 'scripts', 'reject-roast-preflight.mjs');
  const fixtureDir = join(rootDir, 'test', 'fixtures', 'preflight');
  if (!existsSync(rejectorPath) || !existsSync(fixtureDir)) return false;
  if (!statSync(rejectorPath).isFile() || !statSync(fixtureDir).isDirectory()) {
    return false;
  }
  if (readdirSync(fixtureDir).length === 0) return false;
  const body = readFileSync(rejectorPath, 'utf8');
  return /^#!/m.test(body) && /process\.exit/.test(body);
}

function skillName(body) {
  return body.match(/^name:\s*(\S+)/m)?.[1] ?? '';
}

function skillDescription(body) {
  return body.match(/^description:\s*"([^"]*)"/m)?.[1] ?? '';
}

const READINESS = /pre-flight|ready to merge|reasons not to ship/i;

function routesReadinessToPublish(body) {
  const name = skillName(body);
  const desc = skillDescription(body);
  if (name === 'vs-pre-flight') return true;
  if (name === 'vs-ship-it' && READINESS.test(desc)) return true;
  if (
    name &&
    name !== 'vs-roast-code' &&
    READINESS.test(desc) &&
    /ship-it|create (or open )?a? ?pr|publish/i.test(desc)
  ) {
    return true;
  }
  return false;
}

if (looksLikeSkill) {
  if (skillName(text) === 'vs-pre-flight') {
    console.error('reject-roast-preflight: vs-pre-flight skill');
    process.exit(1);
  }
  if (routesReadinessToPublish(text)) {
    console.error('reject-roast-preflight: pre-flight invoke publishes');
    process.exit(1);
  }
  if (!wiredExclusive(files[0])) {
    console.error('reject-roast-preflight: slogan-only skill');
    process.exit(1);
  }
  process.exit(0);
}

function hasDoNotShip(body) {
  return /\bDO NOT SHIP\b/.test(body);
}

function hasShip(body) {
  if (hasDoNotShip(body)) return false;
  return /(?:^|[^A-Z])SHIP(?:[^A-Z]|$)/.test(body);
}

function isPinned(body) {
  return (
    /rev-parse/i.test(body) &&
    /\S+\.\.\.HEAD/.test(body) &&
    /\b[0-9a-f]{7,40}\b/.test(body)
  );
}

function isEmptyDiff(body) {
  if (/non-empty (?:three-dot )?diff/i.test(body)) return false;
  return /empty (?:three-dot )?diff|\bdiff is empty\b|0 files? changed|nothing to roast|forgot to stage|\(empty\)/i.test(
    body,
  );
}

function isBadRef(body) {
  return /unknown revision|bad (?:ref|revision)|needed a single revision|rev-parse[^\n]*(fail|fatal|error|invalid)|does not resolve|ambiguous argument|invalid object name/i.test(
    body,
  );
}

function usedPreflightSkill(body) {
  return (
    /^name:\s*vs-pre-flight\b/m.test(body) ||
    /(?:used|running|invoked|opened)\s+`?\/vs-pre-flight\b/i.test(body)
  );
}

function published(body) {
  return /opened pr #\d+|created (?:a )?(?:draft )?pr|gh pr create|git push -u origin|published via vs-ship-it/i.test(
    body,
  );
}

function userSaidFix(body) {
  return /user (?:explicitly )?(?:said|asked to) fix/i.test(body);
}

function autoFixed(body) {
  if (userSaidFix(body)) return false;
  return /pass 1:\s*\d+\s*fixed|auto-apply|fixed automatically|auto-fix/i.test(
    body,
  );
}

function interviewOpen(body) {
  if (/interview skipped|nothing implicit|interview done|no implicit/i.test(body)) {
    return false;
  }
  return /open decision|question \d|still open|awaiting (?:an )?answer/i.test(
    body,
  );
}

const FILE_LINE = /[\w./-]+\.[A-Za-z][\w]*:\d+/;
const SIN_NAME = /\*\*\[[^\]]+\]\*\*/;
const BUCKET = '(Act|Consider|Noted|Dismissed)';

function currentBucket(line) {
  const heading = line.match(new RegExp(`^#{1,4}\\s+${BUCKET}\\b`, 'i'));
  if (heading) return heading[1].toLowerCase();
  const inline = line.match(
    new RegExp(`(?:\\*\\*${BUCKET}\\*\\*|\\b${BUCKET}\\s+[—-])`, 'i'),
  );
  if (inline) return (inline[1] || inline[2]).toLowerCase();
  return null;
}

function isFinding(line) {
  return FILE_LINE.test(line) || SIN_NAME.test(line);
}

function collectAssigned(body) {
  const assigned = [];
  let section = null;
  for (const raw of body.split(/\r?\n/)) {
    const line = raw.trim();
    const next = currentBucket(line);
    if (next && /^#{1,4}\s+/.test(line)) {
      section = next;
      continue;
    }
    if (!isFinding(line)) continue;
    assigned.push({ line, bucket: currentBucket(line) || section });
  }
  return assigned;
}

function hasSnippet(body) {
  return /```[\s\S]+?```/.test(body) || /`[^`\n]{6,}`/.test(body);
}

if (usedPreflightSkill(text)) {
  console.error('reject-roast-preflight: vs-pre-flight skill');
  process.exit(1);
}

if (published(text)) {
  console.error('reject-roast-preflight: pre-flight invoke publishes');
  process.exit(1);
}

if (isEmptyDiff(text)) {
  console.error('reject-roast-preflight: empty-diff');
  process.exit(1);
}

if (isBadRef(text)) {
  console.error('reject-roast-preflight: bad-ref');
  process.exit(1);
}

if (autoFixed(text)) {
  console.error('reject-roast-preflight: auto-fix before user said fix');
  process.exit(1);
}

const assigned = collectAssigned(text);
const actFindings = assigned.filter((item) => item.bucket === 'act');
const actWithPathLine = actFindings.filter((item) => FILE_LINE.test(item.line));

if (hasShip(text)) {
  if (actFindings.length > 0) {
    console.error('reject-roast-preflight: SHIP with Act');
    process.exit(1);
  }
  if (!isPinned(text)) {
    console.error('reject-roast-preflight: SHIP with unresolved healthy-point');
    process.exit(1);
  }
  if (interviewOpen(text)) {
    console.error('reject-roast-preflight: SHIP with open interview');
    process.exit(1);
  }
  process.exit(0);
}

if (hasDoNotShip(text)) {
  if (actWithPathLine.length === 0 || !hasSnippet(text)) {
    console.error('reject-roast-preflight: DO NOT SHIP missing Act path+line+snippet');
    process.exit(1);
  }
  process.exit(0);
}

console.error('reject-roast-preflight: missing SHIP or DO NOT SHIP');
process.exit(1);
