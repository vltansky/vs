#!/usr/bin/env node
// Score a skill.md or an HTMDX handoff fixture.
//
//   node reject-htmdx-handoff.mjs <skill.md|handoff.md|dir>
//
// Exit 0 clean. Exit 1 reject. Exit 2 cannot check. Treat 2 as not a pass.
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';

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

function wiredExclusive(skillFile) {
  const rootDir = dirname(skillFile);
  const rejector = join(rootDir, 'scripts', 'reject-htmdx-handoff.mjs');
  const fixtures = join(rootDir, 'test', 'fixtures', 'handoff');
  if (!existsSync(rejector) || !existsSync(fixtures)) return false;
  if (!statSync(rejector).isFile() || !statSync(fixtures).isDirectory()) {
    return false;
  }
  if (readdirSync(fixtures).length === 0) return false;
  const body = readFileSync(rejector, 'utf8');
  return /^#!/m.test(body) && /process\.exit/.test(body);
}

const hasPointer = /vs-htmdx\/SKILL\.md|\/vs-htmdx/.test(text);
const inheritOnly = /inherit/i.test(text) && hasPointer;
const owner =
  /first-screen/i.test(text) &&
  /shot failed/i.test(text) &&
  /openable URL|file:\/\//i.test(text);

if (looksLikeSkill) {
  if (wiredExclusive(files[0]) || owner || inheritOnly) {
    process.exit(0);
  }
  console.error('reject-htmdx-handoff: slogan-only skill');
  process.exit(1);
}

const hasUrl = /https?:\/\/\S+|file:\/\/\S+/.test(text);
const hasShot =
  /!\[[^\]]*\]\([^)]+\)/.test(text) ||
  /\bShot:\s*(?!failed).+/i.test(text);
const hasFail = /shot failed|screenshot failed/i.test(text);

if (!hasUrl) {
  console.error('reject-htmdx-handoff: HTMDX handoff has no URL');
  process.exit(1);
}
if (!hasShot && !hasFail) {
  console.error(
    'reject-htmdx-handoff: missing shot with no failure line',
  );
  process.exit(1);
}

process.exit(0);
