#!/usr/bin/env node
// Score a verify skill.md or a path/end-state run fixture.
//
//   node reject-verify-path.mjs <skill.md|run-dir|result.md>
//
// Exit 0 clean. Exit 1 reject. Exit 2 cannot check. Treat 2 as not a pass.
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, isAbsolute, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const SELF = fileURLToPath(import.meta.url);

const target = process.argv[2];
if (!target) {
  console.error('Usage: node reject-verify-path.mjs <skill.md|run-dir|result.md>');
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
for (const file of files) {
  if (/\.(png|webp|jpe?g)$/i.test(file)) continue;
  text += `\n${read(file)}`;
}

const runRoot = resolve(stat.isDirectory() ? target : dirname(target));

const looksLikeSkill =
  files.length === 1 &&
  !stat.isDirectory() &&
  /^name:\s*/m.test(text) &&
  /^# /m.test(text);

function sha256(buf) {
  return createHash('sha256').update(buf).digest('hex');
}
function identityBytes(buf) {
  return Buffer.from(
    String(buf)
      .replace(/const PUBLISHED_REJECTOR_SHA256 = '[a-f0-9]*'/, "const PUBLISHED_REJECTOR_SHA256 = ''")
      .replace(/const PUBLISHED_SKILL_SHA256 = '[a-f0-9]*'/, "const PUBLISHED_SKILL_SHA256 = ''"),
  );
}
const PUBLISHED_REJECTOR_SHA256 = '42a13da27b9235e8e98e2e3609ba1c616b08f155833b0f58673bc366fe65f1c6';
const PUBLISHED_SKILL_SHA256 = '9a416f5f8cbbab30aaca513836ef402d3acf5485ee6c1fc759cb6bd8c3bf6f3d';
function repoSkillPath() {
  let dir = dirname(SELF);
  for (let i = 0; i < 10; i++) {
    const pkgPath = join(dir, 'package.json');
    if (existsSync(pkgPath)) {
      try {
        const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));
        if (pkg.name === 'vs') {
          const skillName = dirname(dirname(SELF)).split(/[\\\\/]/).filter(Boolean).pop();
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
  const rejector = join(dirname(skillFile), 'scripts', SELF.split(/[\\\\/]/).pop());
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


const BAD = [
  'slogan-only-skill.md',
  'copy-phrases-skill.md',
  'stub-rejector',
  'structure-paste',
  'phrase-complete-beside',
  'magic-only-png',
  'magic-only-jpeg',
  'command-xx',
  'bad-clean-no-path',
  'bad-clean-no-end-state',
  'four-word-path',
  'ui-no-baseline-verify',
  'verify-pass-no-command',
  'md-image-no-file',
  'baseline-path-only',
  'clean-path-end-state',
  'clean-path-end-baseline',
];
const CLEAN = ['clean-command-shot', 'clean-no-visual'];

function wiredExclusive(skillFile) {
  if (process.env.VS_PATH_WIRED_CHECK === '1') return false;
  const root = dirname(skillFile);
  const rejector = join(root, 'scripts', 'reject-verify-path.mjs');
  const fixtures = join(root, 'test', 'fixtures', 'path-end-state');
  if (!existsSync(rejector) || !existsSync(fixtures)) return false;
  if (!statSync(rejector).isFile() || !statSync(fixtures).isDirectory()) return false;
  let selfBytes;
  let siblingBytes;
  try {
    selfBytes = readFileSync(SELF);
    siblingBytes = readFileSync(rejector);
  } catch {
    return false;
  }
  if (selfBytes.length === 0 || !selfBytes.equals(siblingBytes)) return false;
  for (const name of BAD) {
    const item = join(fixtures, name);
    if (!existsSync(item)) return false;
    const child = spawnSync(process.execPath, [SELF, item], {
      encoding: 'utf8',
      env: { ...process.env, VS_PATH_WIRED_CHECK: '1' },
    });
    if (child.status !== 1) return false;
  }
  for (const name of CLEAN) {
    const item = join(fixtures, name);
    if (!existsSync(item)) return false;
    const child = spawnSync(process.execPath, [SELF, item], {
      encoding: 'utf8',
      env: { ...process.env, VS_PATH_WIRED_CHECK: '1' },
    });
    if (child.status !== 0) return false;
  }
  return true;
}

if (looksLikeSkill) {
  if (!wiredExclusive(files[0]) || !isLiveOrPublished(files[0])) {
    console.error('reject-verify-path: slogan-only skill');
    process.exit(1);
  }
  process.exit(0);
}

function field(body, name) {
  const colon = body.match(
    new RegExp(
      '(?:^|[\\n*\\-])\\s*(?:\\*\\*)?' + name + '(?:\\*\\*)?\\s*:\\s*([^\\n]+)',
      'i',
    ),
  );
  if (colon) return colon[1].trim();
  const table = body.match(
    new RegExp(
      '^\\|\\s*(?:\\*\\*)?' + name + '(?:\\*\\*)?\\s*\\|\\s*([^|\\n]+)\\s*\\|',
      'im',
    ),
  );
  return table ? table[1].trim() : '';
}

function realValue(value) {
  if (!value) return false;
  if (/^(none|n\/a|—|-|yes|recorded|present|ok|done|tbd|todo|\.\.\.)$/i.test(value)) {
    return false;
  }
  if (/^<[^>]+>$/.test(value)) return false;
  if (/^\{[^}]+\}$/.test(value)) return false;
  if (/^\[\[[^\]]+\]\]$/.test(value)) return false;
  return true;
}

function hasUserPath(body) {
  const value = field(body, 'User path');
  if (!realValue(value)) return false;
  if (/click\/type sequence a person would do/i.test(value) && value.length < 60) {
    return false;
  }
  return /click|type|tap|open|navigate|press|select|visit|enter|goto/i.test(value);
}

function hasEndState(body) {
  const value = field(body, 'Observable end state');
  if (!realValue(value)) return false;
  if (/^what they see or have$/i.test(value)) return false;
  return true;
}

function insideRun(candidate) {
  const rel = relative(runRoot, resolve(candidate));
  return rel !== '' && !rel.startsWith('..') && !isAbsolute(rel);
}

function isRealPng(buf) {
  if (buf.length < 24) return false;
  if (buf[0] !== 0x89 || buf[1] !== 0x50 || buf[2] !== 0x4e || buf[3] !== 0x47) return false;
  if (buf[4] !== 0x0d || buf[5] !== 0x0a || buf[6] !== 0x1a || buf[7] !== 0x0a) return false;
  if (buf.subarray(12, 16).toString('ascii') !== 'IHDR') return false;
  return buf.readUInt32BE(16) > 0 && buf.readUInt32BE(20) > 0;
}
function isRealJpeg(buf) {
  if (buf.length < 24) return false;
  if (buf[0] !== 0xff || buf[1] !== 0xd8 || buf[2] !== 0xff) return false;
  for (let i = 2; i < buf.length - 8; i++) {
    if (buf[i] === 0xff && (buf[i + 1] === 0xc0 || buf[i + 1] === 0xc1 || buf[i + 1] === 0xc2)) return true;
  }
  return false;
}
function isRealWebp(buf) {
  if (buf.length < 20) return false;
  if (buf.subarray(0, 4).toString('ascii') !== 'RIFF') return false;
  if (buf.subarray(8, 12).toString('ascii') !== 'WEBP') return false;
  const fourcc = buf.subarray(12, 16).toString('ascii');
  return fourcc === 'VP8 ' || fourcc === 'VP8L' || fourcc === 'VP8X';
}
function hasRealImage(buf, pathOnly) {
  if (/\.png$/i.test(pathOnly)) return isRealPng(buf);
  if (/\.jpe?g$/i.test(pathOnly)) return isRealJpeg(buf);
  if (/\.webp$/i.test(pathOnly)) return isRealWebp(buf);
  return false;
}

function resolveExisting(raw) {
  const cleaned = raw.replace(/^["'<\[]+|["'>\]]+$/g, '').replace(/^`+|`+$/g, '');
  if (!/\.(png|webp|jpe?g|json)\b/i.test(cleaned)) return '';
  const pathOnly = cleaned.replace(/^.*?\s+(?=\S+\.(?:png|webp|jpe?g|json)\b)/i, '').split(/\s/)[0];
  if (!/\.(png|webp|jpe?g|json)\b/i.test(pathOnly)) return '';
  if (pathOnly.startsWith('~/') || isAbsolute(pathOnly)) return '';
  if (pathOnly.split(/[\\/]/).includes('..')) return '';
  const candidate = join(runRoot, pathOnly);
  if (!insideRun(candidate)) return '';
  try {
    const info = statSync(candidate);
    if (!info.isFile() || info.size === 0) return '';
    const buf = readFileSync(candidate);
    if (/\.(png|webp|jpe?g)$/i.test(pathOnly)) {
      return hasRealImage(buf, pathOnly) ? candidate : '';
    }
    JSON.parse(buf.toString('utf8'));
    return candidate;
  } catch {
    return '';
  }
}


function hasShotOrBaseline(body) {
  const paths = [];
  const baseline = field(body, 'Visual baseline');
  if (realValue(baseline)) paths.push(baseline);
  for (const match of body.matchAll(/!\[[^\]]*\]\(([^)\s]+)/g)) paths.push(match[1]);
  for (const match of body.matchAll(
    /(?:^|[\s`:(])((?:\.\/)?[\w.\/-]+\.(?:png|webp|jpe?g|json))\b/gi,
  )) {
    paths.push(match[1]);
  }
  return paths.some((item) => resolveExisting(item));
}

function visualInScope(body) {
  const flagged = field(body, 'Visual in scope');
  if (/^no\b/i.test(flagged)) return false;
  if (/^yes\b/i.test(flagged)) return true;
  if (/visual in scope\s*:\s*no\b/i.test(body)) return false;
  if (/visual in scope\s*:\s*yes\b/i.test(body)) return true;
  return /visual|screenshot|layout|frozen baseline|checkout ui|billing page/i.test(body);
}

function claimsPass(body) {
  const status = field(body, 'Status');
  if (/^(fail|warn|blocked)$/i.test(status)) return false;
  if (/^(pass|clean)$/i.test(status)) return true;
  return /\b(?:qa|verify)\s+pass\b/i.test(body) || /\ball tests passed\b/i.test(body);
}

function isNamedCommand(value) {
  const token = value.trim();
  if (!token || token.length < 3) return false;
  if (/^(pass|warn|fail|blocked|clean|proven|pending)$/i.test(token)) return false;
  if (/^\/vs-/.test(token)) return false;
  if (!/[A-Za-z]{2,}/.test(token)) return false;
  return /^[A-Za-z0-9_./-]/.test(token);
}

function hasNamedCommand(body) {
  const command = field(body, 'Command');
  if (realValue(command) && isNamedCommand(command)) return true;
  for (const match of body.matchAll(/`([^`\n]+)`/g)) {
    if (isNamedCommand(match[1])) return true;
  }
  return false;
}


if (!hasUserPath(text) || !hasEndState(text)) {
  console.error('reject-verify-path: missing user path or observable end state');
  process.exit(1);
}

if (claimsPass(text) && !hasNamedCommand(text)) {
  console.error('reject-verify-path: pass with no named command');
  process.exit(1);
}

if (claimsPass(text) && visualInScope(text) && !hasShotOrBaseline(text)) {
  console.error('reject-verify-path: pass with no shot or baseline file');
  process.exit(1);
}

process.exit(0);
