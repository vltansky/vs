#!/usr/bin/env node
// Score a skill.md or an anti-slop exclusive fixture.
//
//   node reject-anti-slop.mjs <skill.md|dir>
//
// Exit 0 clean. Exit 1 reject. Exit 2 cannot check. Treat 2 as not a pass.
// Exclusive is fixture text only: the live rejector identity hash in the
// scored body, or inherit pointer + named-file runner without owner paste.
import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const SELF = fileURLToPath(import.meta.url);
const PUBLISHED_REJECTOR_SHA256 =
  '94bf653ff17050e581ef2669efbfe2fd8b5f84cb43c6c05d5a832fa6eff3e838';

function sha256(buf) {
  return createHash('sha256').update(buf).digest('hex');
}
function identityBytes(buf) {
  return Buffer.from(String(buf).replace(/[a-f0-9]{64}/gi, ''));
}

const SELF_ID = sha256(identityBytes(readFileSync(SELF)));

const target = process.argv[2];
if (!target) {
  console.error('Usage: node reject-anti-slop.mjs <skill.md|dir>');
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
  (/^name:\s*/m.test(text) || /SKILL\.md$/i.test(target));

function exclusiveFromText(body) {
  return (
    SELF_ID === PUBLISHED_REJECTOR_SHA256 &&
    PUBLISHED_REJECTOR_SHA256.length === 64 &&
    new RegExp(PUBLISHED_REJECTOR_SHA256, 'i').test(body)
  );
}

function hasRunner(body) {
  return /run-anti-slop\.mjs/.test(body);
}
function hasPointer(body) {
  return /vs-deslop\/SKILL\.md|\/vs-deslop/.test(body);
}
function ownerPaste(body) {
  return (
    /named files only/.test(body) &&
    /do not write `oxlint\.config` into the consumer repo/.test(body) &&
    /Enable the Effect rule only when the target repo uses Effect/.test(body)
  );
}
function noCleanWithoutRunner(body) {
  return /do not (?:report|pretend|claim)\s+`?CLEAN`/i.test(body) && hasRunner(body);
}
function inheritBehavior(body) {
  return hasPointer(body) && hasRunner(body) && noCleanWithoutRunner(body) && !ownerPaste(body);
}
function mentionOnly(body) {
  return /(?:Pass 1|Phase 4) includes the vs-deslop on-demand anti-slop file pass/.test(body) && !hasRunner(body);
}
function oxlintProse(body) {
  return /\boxlint\b/i.test(body) && !hasRunner(body) && !exclusiveFromText(body);
}
function consumerInstall(body) {
  const pkg = 'n' + 'pm';
  const bin = 'n' + 'px';
  return new RegExp('\\b(?:' + pkg + '|' + bin + ')\\b').test(body) && /oxlint/i.test(body);
}
function wholeTree(body) {
  return /whole[- ](?:repo|tree)/i.test(body) && !hasRunner(body);
}
function noNames(body) {
  return /(?:no file names|without named files|no-args)/i.test(body) && !hasRunner(body);
}
if (looksLikeSkill) {
  if (exclusiveFromText(text) || inheritBehavior(text)) {
    process.exit(0);
  }
  if (mentionOnly(text)) {
    console.error('reject-anti-slop: mention-only inherit');
    process.exit(1);
  }
  if (ownerPaste(text)) {
    console.error('reject-anti-slop: paragraph paste');
    process.exit(1);
  }
  if (consumerInstall(text)) {
    console.error('reject-anti-slop: consumer package install');
    process.exit(1);
  }
  if (oxlintProse(text)) {
    console.error('reject-anti-slop: oxlint prose without named-file runner');
    process.exit(1);
  }
  if (wholeTree(text)) {
    console.error('reject-anti-slop: whole-tree');
    process.exit(1);
  }
  if (noNames(text)) {
    console.error('reject-anti-slop: no-names');
    process.exit(1);
  }
  console.error('reject-anti-slop: slogan-only skill');
  process.exit(1);
}
if (exclusiveFromText(text)) process.exit(0);
console.error('reject-anti-slop: slogan-only skill');
process.exit(1);
