#!/usr/bin/env node
// Score a skill.md or a phase-boundary chat fixture.
//
//   node reject-step-map.mjs <skill.md|chat.md|dir>
//
// Exit 0 clean. Exit 1 reject. Exit 2 cannot check. Treat 2 as not a pass.
// Exclusive is fixture text only: the live rejector identity hash in the
// scored body, or an inherit pointer without a you-are-here paste.
import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const SELF = fileURLToPath(import.meta.url);
const PUBLISHED_REJECTOR_SHA256 =
  '3ec809b19c36c2d41700e25d19f1a50f4bc4750dbcfc413b84f4e7ccb42af3cf';

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

const hasPointer = /communication\.md/i.test(text) && /step map/i.test(text);
const inheritOnly =
  /inherit/i.test(text) &&
  hasPointer &&
  !/you-are-here|you are here/i.test(text);

if (looksLikeSkill) {
  if (exclusiveFromText(text) || inheritOnly) {
    process.exit(0);
  }
  console.error('reject-step-map: slogan-only skill');
  process.exit(1);
}

const four =
  /\balign\b/i.test(text) &&
  /i shape/i.test(text) &&
  /you decide/i.test(text) &&
  /\bhandoff\b/i.test(text);
const labeledYou = /you-are-here\s*:/i.test(text);
const labeledRemaining = /\bremaining\s*:/i.test(text);
const labeledNext = /next decision\s*:/i.test(text);
const mapped =
  /align\s*(?:→|->)\s*i shape\s*(?:→|->)\s*you decide\s*(?:→|->)\s*handoff/i.test(
    text,
  );

if (!four || !labeledYou || !labeledRemaining || !labeledNext || !mapped) {
  console.error(
    'reject-step-map: phase-boundary chat line omits you-are-here / remaining / next decision',
  );
  process.exit(1);
}

process.exit(0);
