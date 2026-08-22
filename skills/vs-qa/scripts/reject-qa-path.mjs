#!/usr/bin/env node
// Score a qa skill.md or a path/end-state run fixture.
//
//   node reject-qa-path.mjs <skill.md|run-dir|result.md>
//
// Exit 0 clean. Exit 1 reject. Exit 2 cannot check. Treat 2 as not a pass.
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';

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
for (const file of files) text += `\n${read(file)}`;

const looksLikeSkill =
  files.length === 1 &&
  !stat.isDirectory() &&
  /^name:\s*/m.test(text) &&
  /^# /m.test(text);

const slogans = /user path/i.test(text) && /observable end state/i.test(text);

function wiredExclusive(skillFile) {
  const root = dirname(skillFile);
  const rejector = join(root, 'scripts', 'reject-qa-path.mjs');
  const fixtures = join(root, 'test', 'fixtures', 'path-end-state');
  if (!existsSync(rejector) || !existsSync(fixtures)) return false;
  if (!statSync(rejector).isFile() || !statSync(fixtures).isDirectory()) return false;
  if (readdirSync(fixtures).length === 0) return false;
  const body = readFileSync(rejector, 'utf8');
  return /^#!/m.test(body) && /process\.exit/.test(body);
}

if (looksLikeSkill) {
  if (!wiredExclusive(files[0]) || !slogans) {
    console.error('reject-qa-path: slogan-only skill');
    process.exit(1);
  }
  process.exit(0);
}

function field(body, name) {
  const re = new RegExp(
    '(?:^|[\\n*\\-])\\s*(?:\\*\\*)?' + name + '(?:\\*\\*)?\\s*:\\s*([^\\n]+)',
    'i',
  );
  const match = body.match(re);
  return match ? match[1].trim() : '';
}

function realValue(value) {
  if (!value) return false;
  if (/^(none|n\/a|—|-|yes|recorded|present|ok|done|tbd|todo|\.\.\.)$/i.test(value)) {
    return false;
  }
  if (/^<[^>]+>$/.test(value)) return false;
  return true;
}

function hasUserPath(body) {
  const value = field(body, 'User path');
  if (!realValue(value)) return false;
  if (/click\/type sequence a person would do/i.test(value) && value.length < 60) {
    return false;
  }
  return /click|type|tap|open|navigate|press|select|visit|enter|goto/i.test(value)
    || value.split(/\s+/).length >= 4;
}

function hasEndState(body) {
  const value = field(body, 'Observable end state');
  if (!realValue(value)) return false;
  if (/^what they see or have$/i.test(value)) return false;
  return true;
}

function hasShotOrBaseline(body) {
  const baseline = field(body, 'Visual baseline');
  if (realValue(baseline) && /\.(png|webp|jpe?g|json)\b/i.test(baseline)) return true;
  if (/!\[[^\]]*\]\([^)]+\)/.test(body)) return true;
  if (/screenshots\/[\w./-]+\.(png|webp|jpe?g)/i.test(body)) return true;
  if (/consumed[^\n]*(expo|device)[^\n]*\.(png|webp|jpe?g)/i.test(body)) return true;
  return false;
}

function visualInScope(body) {
  if (/visual in scope\s*:\s*no\b/i.test(body)) return false;
  if (/visual in scope\s*:\s*yes\b/i.test(body)) return true;
  return /visual|screenshot|layout|frozen baseline|checkout ui|billing page/i.test(body);
}

function claimsPass(body) {
  if (/\bstatus\s*:\s*(fail|warn|blocked)\b/i.test(body)) return false;
  return /\bstatus\s*:\s*(pass|clean)\b/i.test(body)
    || /\bqa\s+pass\b/i.test(body)
    || /\ball tests passed\b/i.test(body);
}

if (!hasUserPath(text) || !hasEndState(text)) {
  console.error('reject-qa-path: missing user path or observable end state');
  process.exit(1);
}

if (claimsPass(text) && visualInScope(text) && !hasShotOrBaseline(text)) {
  console.error('reject-qa-path: pass with no shot or baseline');
  process.exit(1);
}

process.exit(0);
