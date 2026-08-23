#!/usr/bin/env node
// Score a skill.md or a phase-boundary chat fixture.
//
//   node reject-step-map.mjs <skill.md|chat.md|dir>
//
// Exit 0 clean. Exit 1 reject. Exit 2 cannot check. Treat 2 as not a pass.
// Exclusive is fixture text only: the live rejector identity hash in the
// scored body, or an inherit pointer without a pasted checkpoint.
import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const SELF = fileURLToPath(import.meta.url);
const PUBLISHED_REJECTOR_SHA256 =
  'ee2e6aed87fd652c945d67a1e7a580bb65ffd23a01a12d7b2b79607ce9a4cdea';

function sha256(buf) {
  return createHash('sha256').update(buf).digest('hex');
}
function identityBytes(buf) {
  return Buffer.from(String(buf).replace(/[a-f0-9]{64}/gi, ''));
}

const SELF_ID = sha256(identityBytes(readFileSync(SELF)));

const target = process.argv[2];
if (!target) {
  console.error('Usage: node reject-step-map.mjs <skill.md|chat.md|dir>');
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

function exclusiveFromText(body) {
  return (
    SELF_ID === PUBLISHED_REJECTOR_SHA256 &&
    PUBLISHED_REJECTOR_SHA256.length === 64 &&
    new RegExp(PUBLISHED_REJECTOR_SHA256, 'i').test(body)
  );
}

const hasPointer =
  /communication\.md/i.test(text) && /visual progress checkpoint/i.test(text);
const inheritOnly =
  /inherit/i.test(text) &&
  hasPointer &&
  !/^Progress:/im.test(text);

if (looksLikeSkill) {
  if (exclusiveFromText(text) || inheritOnly) {
    process.exit(0);
  }
  console.error('reject-step-map: slogan-only skill');
  process.exit(1);
}

const hasTopic = /^───\s+\S.+\s+───$/m.test(text);
const hasExactProgress =
  /^Progress:\s*(?:25%\s+█░░░|50%\s+██░░|75%\s+███░|100%\s+████)\s*$/im.test(
    text,
  );
const hasPhases =
  /^[✓→○]\s+Alignment:\s*\S/im.test(text) &&
  /^[✓→○]\s+Shaping:\s*\S/im.test(text) &&
  /^[✓→○]\s+Your input needed:\s*\S/im.test(text) &&
  /^[✓→○]\s+Handoff:\s*\S/im.test(text);
const hasSubskills = /^Subskills completed:\s*\S/im.test(text);
const hasOutput = /^Output:\s*\S/im.test(text);

if (!hasTopic || !hasExactProgress || !hasPhases || !hasSubskills || !hasOutput) {
  console.error(
    'reject-step-map: phase checkpoint omits visual progress / phases / subskills / output',
  );
  process.exit(1);
}

process.exit(0);
