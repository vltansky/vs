#!/usr/bin/env node
// Score a qa skill.md or a path/end-state run fixture.
//
//   node reject-qa-path.mjs <skill.md|run-dir|result.md>
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
  console.error('Usage: node reject-qa-path.mjs <skill.md|run-dir|result.md>');
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
  return Buffer.from(String(buf).replace(/[a-f0-9]{64}/g, ''));
}
const PUBLISHED_REJECTOR_SHA256 = '319e48014bd28e18085563c86d914c4536e06f6776a9cbf43f0a1eceabc739e2';
const PUBLISHED_SKILL_SHA256 = '81a69289c959cc9ba2bde78f580954a974f4d1eeaffba1dd73d73a5248c955ee';
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
  'sof-only-jpeg',
  'vp8x-stub',
  'ihdr-no-idat',
  'empty-json-baseline',
  'sos-no-scan',
  'vp8-1byte',
  'array-json-baseline',
  'command-xx',
  'bad-clean-no-path',
  'four-word-path',
  'bad-pass-no-shot',
  'ui-no-baseline-verify',
  'verify-pass-no-command',
  'md-image-no-file',
  'baseline-path-only',
  'clean-path-end-shot',
  'clean-path-end-baseline',
  'clean-expo-shot',
];
const CLEAN = ['clean-table-shot', 'clean-expo-file', 'clean-no-visual', 'published-pair/SKILL.md'];

function wiredExclusive(skillFile) {
  if (process.env.VS_PATH_WIRED_CHECK === '1') return false;
  const root = dirname(skillFile);
  const rejector = join(root, 'scripts', 'reject-qa-path.mjs');
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
  if (!isPublishedPair(files[0])) {
    console.error('reject-qa-path: slogan-only skill');
    process.exit(1);
  }
  const fixtureRoot = join(dirname(files[0]), 'test', 'fixtures', 'path-end-state');
  if (existsSync(fixtureRoot) && !wiredExclusive(files[0])) {
    console.error('reject-qa-path: slogan-only skill');
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
  if (!(buf.readUInt32BE(16) > 0 && buf.readUInt32BE(20) > 0)) return false;
  let off = 8;
  while (off + 8 <= buf.length) {
    const len = buf.readUInt32BE(off);
    if (!Number.isFinite(len) || len < 0 || off + 12 + len > buf.length) return false;
    const type = buf.subarray(off + 4, off + 8).toString('ascii');
    if (type === 'IDAT' && len > 0) return true;
    off += 12 + len;
  }
  return false;
}
function isRealJpeg(buf) {
  if (buf.length < 24) return false;
  if (buf[0] !== 0xff || buf[1] !== 0xd8) return false;
  let i = 2;
  let sof = false;
  while (i < buf.length) {
    if (buf[i] !== 0xff) return false;
    while (i < buf.length && buf[i] === 0xff) i++;
    if (i >= buf.length) return false;
    const marker = buf[i++];
    if (marker === 0xd9) return false;
    if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
      continue;
    }
    if (i + 1 >= buf.length) return false;
    const len = buf.readUInt16BE(i);
    if (len < 2 || i + len > buf.length) return false;
    if (marker === 0xc0 || marker === 0xc1 || marker === 0xc2) sof = true;
    if (marker === 0xda) {
      let entropy = 0;
      let j = i + len;
      while (j < buf.length) {
        if (buf[j] === 0xff) {
          const nxt = j + 1 < buf.length ? buf[j + 1] : -1;
          if (nxt === 0x00 || (nxt >= 0xd0 && nxt <= 0xd7)) {
            entropy += 2;
            j += 2;
            continue;
          }
          break;
        }
        entropy++;
        j++;
      }
      return sof && entropy > 0;
    }
    i += len;
  }
  return false;
}
function isRealWebp(buf) {
  if (buf.length < 20) return false;
  if (buf.subarray(0, 4).toString('ascii') !== 'RIFF') return false;
  if (buf.subarray(8, 12).toString('ascii') !== 'WEBP') return false;
  let off = 12;
  let payload = false;
  while (off + 8 <= buf.length) {
    const type = buf.subarray(off, off + 4).toString('ascii');
    const size = buf.readUInt32LE(off + 4);
    if (!Number.isFinite(size) || size < 0 || off + 8 + size > buf.length) return false;
    if (type === 'VP8 ') {
      if (size < 10) return false;
      if (buf[off + 11] !== 0x9d || buf[off + 12] !== 0x01 || buf[off + 13] !== 0x2a) {
        return false;
      }
      payload = true;
    } else if (type === 'VP8L') {
      if (size < 5) return false;
      if (buf[off + 8] !== 0x2f) return false;
      payload = true;
    }
    off += 8 + size + (size & 1);
  }
  return payload;
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
    const parsed = JSON.parse(buf.toString('utf8'));
    if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return '';
    }
    if (Object.keys(parsed).length === 0) return '';
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
  console.error('reject-qa-path: missing user path or observable end state');
  process.exit(1);
}

if (claimsPass(text) && !hasNamedCommand(text)) {
  console.error('reject-qa-path: pass with no named command');
  process.exit(1);
}

if (claimsPass(text) && visualInScope(text) && !hasShotOrBaseline(text)) {
  console.error('reject-qa-path: pass with no shot or baseline file');
  process.exit(1);
}

process.exit(0);
