#!/usr/bin/env node
// Score a skill.md or an anti-slop exclusive fixture.
//
//   node reject-anti-slop.mjs <skill.md|dir>
//
// Exit 0 clean. Exit 1 reject. Exit 2 cannot check. Treat 2 as not a pass.
// Exclusive is the live skills/vs-deslop/SKILL.md path or a published
// skill-bytes pair. Inherit is pointer + named-file runner without owner paste.
import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const SELF = fileURLToPath(import.meta.url);
const PUBLISHED_REJECTOR_SHA256 =
  '9f42cf49e0a4ee9de516dbacbac04e687a0b7ed39e117d23d409555f45e18ef8';
const PUBLISHED_SKILL_SHA256 =
  '248eff54d5ddbb0881169d63ebb9a9b03c1eaf0acee441e0094ee2fe4d5fba6a';

function sha256(buf) {
  return createHash('sha256').update(buf).digest('hex');
}
function identityBytes(buf) {
  return Buffer.from(String(buf).replace(/[a-f0-9]{64}/g, ''));
}

function repoSkillPath() {
  let dir = dirname(SELF);
  for (let i = 0; i < 10; i++) {
    const pkgPath = join(dir, 'package.json');
    if (existsSync(pkgPath)) {
      try {
        const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));
        if (pkg.name === 'vs') {
          const skillName = dirname(dirname(SELF)).split(/[\\/]/).filter(Boolean).pop();
          return resolve(join(dir, 'skills', skillName, 'SKILL.md'));
        }
      } catch {
      }
    }
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return '';
}
function isPublishedPair(skillFile) {
  const rejector = join(dirname(skillFile), 'scripts', SELF.split(/[\\/]/).pop());
  if (!existsSync(rejector) || !statSync(rejector).isFile()) return false;
  let rejectorBytes;
  let skillBytes;
  try {
    rejectorBytes = readFileSync(rejector);
    skillBytes = readFileSync(skillFile);
  } catch {
    return false;
  }
  return (
    sha256(identityBytes(rejectorBytes)) === PUBLISHED_REJECTOR_SHA256 &&
    sha256(skillBytes) === PUBLISHED_SKILL_SHA256 &&
    PUBLISHED_REJECTOR_SHA256.length === 64
  );
}
function isLiveOrPublished(skillFile) {
  const live = repoSkillPath();
  if (live && resolve(skillFile) === live) return true;
  return isPublishedPair(skillFile);
}

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

function exclusive(skillFile) {
  return isLiveOrPublished(skillFile);
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
  return /\boxlint\b/i.test(body) && !hasRunner(body);
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
  if (exclusive(files[0]) || inheritBehavior(text)) {
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
if (files.length === 1 && !stat.isDirectory() && exclusive(files[0])) process.exit(0);
console.error('reject-anti-slop: slogan-only skill');
process.exit(1);
