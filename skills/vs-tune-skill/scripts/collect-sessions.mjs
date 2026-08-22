#!/usr/bin/env node
// Inventory repo skills and local sessions whose cwd is that repo.
// Writes only under --out. Never uploads.
import { mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';

const args = parseArgs(process.argv.slice(2));
if (!args.out) {
  console.error(
    'Usage: node collect-sessions.mjs --out <dir> --skill NAME [--repo PATH] [--days N] [--max-sessions N] [--skills-dir PATH] [--cursor-export PATH] [--grok-jsonl PATH] [--claude-home PATH] [--codex-home PATH]',
  );
  process.exit(2);
}
if (!String(args.skill || '').trim()) {
  console.error(
    'collect-sessions: --skill NAME is required. If the user did not name a skill, emit NEED_SKILL and stop. Do not inventory every skill.',
  );
  process.exit(2);
}

const repo = resolve(args.repo || process.cwd());
const outDir = resolve(args.out);
const days = Number(args.days ?? 45);
const maxSessions = Number(args.maxSessions ?? 12);
const since = Date.now() - days * 24 * 60 * 60 * 1000;
const skillDirs = (args.skillsDir || []).concat([join(repo, 'skills')]);
const skillFilter = args.skill || '';
const claudeHome = resolve(args.claudeHome || join(homeDir(), '.claude'));
const codexHome = resolve(args.codexHome || join(homeDir(), '.codex'));

mkdirSync(outDir, { recursive: true });
mkdirSync(join(outDir, 'transcripts'), { recursive: true });

const skills = [];
for (const dir of unique(skillDirs)) {
  skills.push(...discoverSkills(dir));
}
if (skillFilter) {
  const kept = skills.filter((s) => s.name === skillFilter);
  skills.length = 0;
  skills.push(...kept);
}

const sessions = [];
sessions.push(...collectClaude(claudeHome, repo, since));
sessions.push(...collectCodex(codexHome, repo, since));
if (args.cursorExport) sessions.push(...collectNamedFile(args.cursorExport, 'cursor-markdown', repo, since));
if (args.grokJsonl) sessions.push(...collectNamedFile(args.grokJsonl, 'grok-jsonl', repo, since));

sessions.sort((a, b) => (b.mtimeMs || 0) - (a.mtimeMs || 0));
const sampled = sessions.slice(0, maxSessions);
for (const session of sampled) {
  const dest = join(outDir, 'transcripts', safeName(session.id) + extOf(session.path));
  try {
    writeFileSync(dest, readFileSync(session.path));
    session.local_copy = dest;
  } catch (error) {
    session.copy_error = error.code ?? error.message;
  }
}

const inventory = {
  repo,
  generated_at: new Date().toISOString(),
  window_days: days,
  skills_found: skills.length,
  sessions_scanned: sessions.length,
  sessions_sampled: sampled.length,
  skills,
  sessions: sampled.map(({ preview, ...rest }) => rest),
};
writeFileSync(join(outDir, 'inventory.json'), JSON.stringify(inventory, null, 2) + '\n');
process.stdout.write(JSON.stringify({ out: outDir, skills_found: skills.length, sessions_sampled: sampled.length }) + '\n');

function parseArgs(argv) {
  const out = { skillsDir: [] };
  for (let i = 0; i < argv.length; i += 1) {
    const key = argv[i];
    const val = argv[i + 1];
    if (key === '--out') out.out = val;
    else if (key === '--repo') out.repo = val;
    else if (key === '--days') out.days = val;
    else if (key === '--max-sessions') out.maxSessions = val;
    else if (key === '--skills-dir') out.skillsDir.push(val);
    else if (key === '--cursor-export') out.cursorExport = val;
    else if (key === '--grok-jsonl') out.grokJsonl = val;
    else if (key === '--claude-home') out.claudeHome = val;
    else if (key === '--codex-home') out.codexHome = val;
    else if (key === '--skill') out.skill = val;
    else continue;
    i += 1;
  }
  return out;
}

function homeDir() {
  return process.env.HOME || process.env.USERPROFILE || '/tmp';
}

function unique(items) {
  return [...new Set(items.map((item) => resolve(item)))];
}

function discoverSkills(root) {
  const found = [];
  walk(root, (file) => {
    if (!file.endsWith('SKILL.md')) return;
    const text = readFileSync(file, 'utf8');
    const name = (text.match(/^name:\s*["']?([a-z0-9-]+)/m) || [])[1] || dirname(file).split('/').pop();
    found.push({ name, path: file, dir: dirname(file) });
  });
  return found;
}

function walk(dir, visit) {
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name === '.git' || entry.name === 'fixtures') continue;
      walk(full, visit);
    } else if (entry.isFile()) {
      visit(full);
    }
  }
}

function collectClaude(claudeHome, repo, since) {
  const projects = join(claudeHome, 'projects');
  const out = [];
  walk(projects, (file) => {
    if (!file.endsWith('.jsonl')) return;
    const st = safeStat(file);
    if (!st || st.mtimeMs < since) return;
    const cwd = extractCwd(file, 40);
    if (!cwdMatches(cwd, repo)) return;
    out.push({
      id: `claude-${safeName(file)}`,
      harness: 'claude-code',
      path: file,
      cwd: cwd || repo,
      mtimeMs: st.mtimeMs,
    });
  });
  return out;
}

function collectCodex(codexHome, repo, since) {
  const sessionsRoot = join(codexHome, 'sessions');
  const out = [];
  walk(sessionsRoot, (file) => {
    if (!/rollout-.*\.jsonl$/.test(file) && !file.endsWith('.jsonl')) return;
    const st = safeStat(file);
    if (!st || st.mtimeMs < since) return;
    const cwd = extractCwd(file, 40);
    if (!cwdMatches(cwd, repo)) return;
    out.push({
      id: `codex-${safeName(file)}`,
      harness: 'codex',
      path: file,
      cwd: cwd || repo,
      mtimeMs: st.mtimeMs,
    });
  });
  return out;
}

function collectNamedFile(pathValue, harness, repo, since) {
  const file = resolve(pathValue);
  const st = safeStat(file);
  if (!st) return [];
  if (st.mtimeMs < since) return [];
  const cwd = extractCwd(file, 80) || repo;
  if (harness !== 'cursor-markdown' && !cwdMatches(cwd, repo) && cwd !== repo) return [];
  return [{ id: `${harness}-${safeName(file)}`, harness, path: file, cwd, mtimeMs: st.mtimeMs }];
}

function extractCwd(file, maxLines) {
  let text;
  try {
    text = readFileSync(file, 'utf8');
  } catch {
    return '';
  }
  const lines = text.split(/\r?\n/).slice(0, maxLines);
  for (const line of lines) {
    try {
      const rec = JSON.parse(line);
      const cwd =
        rec.cwd ||
        rec.payload?.cwd ||
        rec.session_meta?.payload?.cwd ||
        rec.message?.cwd ||
        rec.workspace ||
        rec.payload?.workspace;
      if (typeof cwd === 'string' && cwd) return cwd;
    } catch {
      const md = line.match(/cwd:\s*(\/\S+)/);
      if (md) return md[1];
    }
  }
  const whole = text.match(/"cwd"\s*:\s*"([^"]+)"/);
  return whole ? whole[1] : '';
}

function cwdMatches(cwd, repo) {
  if (!cwd) return false;
  const a = resolve(cwd);
  const b = resolve(repo);
  return a === b || a.startsWith(b + '/');
}

function safeStat(file) {
  try {
    return statSync(file);
  } catch {
    return null;
  }
}

function safeName(value) {
  return String(value).replace(/[^a-zA-Z0-9._-]+/g, '-').slice(-120);
}

function extOf(file) {
  return file.endsWith('.md') ? '.md' : '.jsonl';
}
