#!/usr/bin/env node
// Score a verify skill.md or a path/end-state run fixture.
//
//   node reject-verify-path.mjs <skill.md|run-dir|result.md>
//
// Exit 0 clean. Exit 1 reject. Exit 2 cannot check. Treat 2 as not a pass.
import { spawnSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, isAbsolute, join } from 'node:path';
import { homedir } from 'node:os';

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

const runRoot = stat.isDirectory() ? target : dirname(target);

const looksLikeSkill =
  files.length === 1 &&
  !stat.isDirectory() &&
  /^name:\s*/m.test(text) &&
  /^# /m.test(text);

const slogans = /user path/i.test(text) && /observable end state/i.test(text);

function wiredExclusive(skillFile) {
  const root = dirname(skillFile);
  const rejector = join(root, 'scripts', 'reject-verify-path.mjs');
  const fixtures = join(root, 'test', 'fixtures', 'path-end-state');
  if (!existsSync(rejector) || !existsSync(fixtures)) return false;
  if (!statSync(rejector).isFile() || !statSync(fixtures).isDirectory()) return false;
  const names = readdirSync(fixtures);
  if (names.length === 0) return false;
  // A shebang plus process.exit is not exclusive: a stub that always
  // exits 0 satisfies that and still accepts every run.
  if (process.env.VS_PATH_WIRED_CHECK === '1') return false;
  let rejected = 0;
  for (const name of names) {
    const child = spawnSync(process.execPath, [rejector, join(fixtures, name)], {
      encoding: 'utf8',
      env: { ...process.env, VS_PATH_WIRED_CHECK: '1' },
    });
    if (child.status === 1) rejected += 1;
  }
  return rejected > 0;
}

if (looksLikeSkill) {
  if (!wiredExclusive(files[0]) || !slogans) {
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

function resolveExisting(raw) {
  const cleaned = raw.replace(/^["'<\[]+|["'>\]]+$/g, '').replace(/^`+|`+$/g, '');
  if (!cleaned || /[\s*]/.test(cleaned) && !/\.(png|webp|jpe?g|json)$/i.test(cleaned)) {
    if (!/\.(png|webp|jpe?g|json)\b/i.test(cleaned)) return '';
  }
  const pathOnly = cleaned.replace(/^.*?\s+(?=\S+\.(?:png|webp|jpe?g|json)\b)/i, '').split(/\s/)[0];
  if (!/\.(png|webp|jpe?g|json)\b/i.test(pathOnly)) return '';
  const candidates = [];
  if (pathOnly.startsWith('~/')) candidates.push(join(homedir(), pathOnly.slice(2)));
  if (isAbsolute(pathOnly)) candidates.push(pathOnly);
  candidates.push(join(runRoot, pathOnly));
  for (const candidate of candidates) {
    try {
      const info = statSync(candidate);
      if (info.isFile() && info.size > 0) return candidate;
    } catch {
      // try next
    }
  }
  return '';
}

function hasShotOrBaseline(body) {
  const paths = [];
  const baseline = field(body, 'Visual baseline');
  if (realValue(baseline)) paths.push(baseline);
  for (const match of body.matchAll(/!\[[^\]]*\]\(([^)\s]+)/g)) paths.push(match[1]);
  for (const match of body.matchAll(
    /(?:^|[\s`:(])((?:~\/|\/|\.\/)?[\w./~-]+\.(?:png|webp|jpe?g|json))\b/gi,
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

function hasNamedCommand(body) {
  const command = field(body, 'Command');
  if (realValue(command)) return true;
  const skip = /^(pass|warn|fail|blocked|clean|proven|pending)$/i;
  for (const match of body.matchAll(/`([^`\n]+)`/g)) {
    const inner = match[1].trim();
    if (!inner || skip.test(inner) || /^\/vs-/.test(inner)) continue;
    if (/^[A-Za-z0-9_./-]+/.test(inner)) return true;
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
