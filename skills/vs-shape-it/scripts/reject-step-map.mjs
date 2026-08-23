#!/usr/bin/env node
// Score a skill.md or a phase-boundary chat fixture.
//
//   node reject-step-map.mjs <skill.md|chat.md|dir>
//
// Exit 0 clean. Exit 1 reject. Exit 2 cannot check. Treat 2 as not a pass.
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';

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

function wiredExclusive(skillFile) {
  const rootDir = dirname(skillFile);
  const rejector = join(rootDir, 'scripts', 'reject-step-map.mjs');
  const fixtures = join(rootDir, 'test', 'fixtures', 'step-map');
  if (!existsSync(rejector) || !existsSync(fixtures)) return false;
  if (!statSync(rejector).isFile() || !statSync(fixtures).isDirectory()) {
    return false;
  }
  if (readdirSync(fixtures).length === 0) return false;
  const body = readFileSync(rejector, 'utf8');
  return /^#!/m.test(body) && /process\.exit/.test(body);
}

const hasPointer = /communication\.md/i.test(text) && /step map/i.test(text);
const hasYou = /you-are-here|you are here/i.test(text);
const hasRemaining = /\bremaining\b/i.test(text);
const hasNext = /next decision/i.test(text);
const hasProcedure = hasYou && hasRemaining && hasNext;
const inheritOnly = /inherit/i.test(text) && hasPointer;
const four =
  /\balign\b/i.test(text) &&
  /i shape/i.test(text) &&
  /you decide/i.test(text) &&
  /\bhandoff\b/i.test(text);

if (looksLikeSkill) {
  if (wiredExclusive(files[0]) || (hasPointer && hasProcedure) || inheritOnly) {
    process.exit(0);
  }
  console.error('reject-step-map: slogan-only skill');
  process.exit(1);
}

if (!four || !hasProcedure) {
  console.error(
    'reject-step-map: phase-boundary chat line omits you-are-here / remaining / next decision',
  );
  process.exit(1);
}

process.exit(0);
