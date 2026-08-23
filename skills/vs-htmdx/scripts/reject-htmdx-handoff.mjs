#!/usr/bin/env node
// Score a skill.md or an HTMDX handoff fixture.
//
//   node reject-htmdx-handoff.mjs <skill.md|handoff.md|dir>
//
// Exit 0 clean. Exit 1 reject. Exit 2 cannot check. Treat 2 as not a pass.
// Exclusive is fixture text only: the live rejector identity hash in the
// scored body, or an inherit pointer without the owner-string paste.
import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const SELF = fileURLToPath(import.meta.url);
const PUBLISHED_REJECTOR_SHA256 =
  '7f0d132a5da87497d26b5f7fa4b821422b7964472f2d28f4787bc0f260a56648';

function sha256(buf) {
  return createHash('sha256').update(buf).digest('hex');
}
function identityBytes(buf) {
  return Buffer.from(String(buf).replace(/[a-f0-9]{64}/gi, ''));
}

const SELF_ID = sha256(identityBytes(readFileSync(SELF)));

const target = process.argv[2];
if (!target) {
  console.error('Usage: node reject-htmdx-handoff.mjs <skill.md|handoff.md|dir>');
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

const hasPointer = /vs-htmdx\/SKILL\.md|\/vs-htmdx/.test(text);
const ownerPaste =
  /first-screen/i.test(text) &&
  /shot failed/i.test(text) &&
  /openable URL|file:\/\//i.test(text);
const inheritOnly = /inherit/i.test(text) && hasPointer && !ownerPaste;

if (looksLikeSkill) {
  if (exclusiveFromText(text) || inheritOnly) {
    process.exit(0);
  }
  console.error('reject-htmdx-handoff: slogan-only skill');
  process.exit(1);
}

const hasUrl = /https?:\/\/\S+|file:\/\/\S+/.test(text);
const hasFail = /shot failed|screenshot failed/i.test(text);
const hasMdShot =
  /!\[[^\]]*\]\([^)]+\.(?:png|jpe?g|webp)(?:\s+"[^"]*")?\)/i.test(text);
const hasShotField =
  /\bShot:\s*(?!\s*(?:failed|n\/a|none|—|-|tbd|todo|\.\.\.)\b)\S+\.(?:png|jpe?g|webp)\b/i.test(
    text,
  );

if (!hasUrl) {
  console.error('reject-htmdx-handoff: HTMDX handoff has no URL');
  process.exit(1);
}
if (!hasMdShot && !hasShotField && !hasFail) {
  console.error(
    'reject-htmdx-handoff: missing shot with no failure line',
  );
  process.exit(1);
}

process.exit(0);
