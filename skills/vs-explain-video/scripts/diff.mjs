#!/usr/bin/env node
// The diff is the source of WHAT changed. Chat context gets compacted and a PR
// body is written from that chat, so either can lose a change. This lists every
// changed file from base...head, and checks that script.json covers each one.
//
//   node diff.mjs <work-dir> [--base <ref>] [--head <ref>] [--patch <file>]
//   node diff.mjs check <work-dir>
//
// List: with no --base, the base is origin's default branch (origin/HEAD, then
// origin/main, origin/master, main, master). Runs `git diff <base>...<head>`
// (merge-base to head) in the current repo, or reads --patch (for an open PR
// with no checkout: `gh pr diff <N> > pr.diff`). Writes <work-dir>/diff.json and
// prints the files. Tests, lockfiles, version-only bumps, changelogs, snapshots
// and generated files are "minor": they need no scene.
//
// Check: every file that is not minor is in a scene's "covers" (a path, or a
// directory ending in "/") or in the top-level "skip" with a reason. A "covers"
// entry that matches no changed file is a claim the diff does not show.
//
// Exit codes: 0 pass; 1 problems; 2 blocked (no repo, no base, no script).
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const LOCKS = /(^|\/)(package-lock\.json|npm-shrinkwrap\.json|yarn\.lock|pnpm-lock\.yaml|bun\.lockb?|Cargo\.lock|go\.sum|poetry\.lock|uv\.lock|Gemfile\.lock|composer\.lock|Podfile\.lock)$/;
const TESTS = /(^|\/)(tests?|__tests__|__snapshots__|fixtures)\/|\.(test|spec|eval)\.[cm]?[jt]sx?$|_test\.(go|py)$|(^|\/)test_[^/]+\.py$|\.snap$/;
const GENERATED = /(^|\/)(dist|build|out|generated|vendor)\/|\.min\.(js|css)$|\.generated\.|(^|\/)CHANGELOG(\.md)?$/i;
const VERSION_LINE = /^\s*"?version"?\s*[:=]/;

// Parses a unified diff into [{ path, added, deleted, lines }], one per file.
export function parsePatch(text) {
  const files = [];
  let file = null;
  let inHunk = false;
  for (const line of String(text).split('\n')) {
    const head = line.match(/^diff --git a\/(.+) b\/(.+)$/);
    if (head) {
      file = { path: head[2], added: 0, deleted: 0, lines: [] };
      files.push(file);
      inHunk = false;
      continue;
    }
    if (!file) continue;
    if (line.startsWith('@@')) { inHunk = true; continue; }
    if (!inHunk) continue;
    if (line.startsWith('+')) { file.added += 1; file.lines.push(line.slice(1)); }
    else if (line.startsWith('-')) { file.deleted += 1; file.lines.push(line.slice(1)); }
  }
  return files;
}

export function isMinor(file) {
  if (LOCKS.test(file.path) || TESTS.test(file.path) || GENERATED.test(file.path)) return true;
  // A manifest whose only changed lines are the version: a version bump.
  return /(^|\/)(package|plugin|composer|manifest)\.json$|(^|\/)(Cargo|pyproject)\.toml$/.test(file.path)
    && file.lines.length > 0 && file.lines.every((l) => VERSION_LINE.test(l));
}

export function summarize(files) {
  return files.map(({ path: p, added, deleted, lines }) => ({ path: p, added, deleted, minor: isMinor({ path: p, lines }) }));
}

const matches = (entry, file) => (entry.endsWith('/') ? file.startsWith(entry) : file === entry);

// Problems with how script.json covers the diff: a changed file no scene covers
// and no "skip" names, a skip with no reason, and a "covers" entry the diff does
// not change.
export function coverageIssues(script, diff) {
  const problems = [];
  const changed = (diff.files ?? []).map((f) => f.path);
  const skip = script.skip && typeof script.skip === 'object' ? script.skip : {};
  const covers = (script.scenes ?? []).flatMap((scene) => (Array.isArray(scene.covers) ? scene.covers : []).map((entry) => ({ scene: scene.id, entry: String(entry) })));
  for (const [entry, reason] of Object.entries(skip)) {
    if (!String(reason ?? '').trim()) problems.push(`skip "${entry}" has no reason; say why the video leaves it out.`);
    if (!changed.some((f) => matches(entry, f))) problems.push(`skip "${entry}" matches no changed file; drop it.`);
  }
  for (const { scene, entry } of covers) {
    if (!changed.some((f) => matches(entry, f))) problems.push(`scene "${scene}" covers "${entry}", which the diff does not change: drop that claim or fix the path.`);
  }
  for (const f of diff.files ?? []) {
    if (f.minor) continue;
    if (covers.some((c) => matches(c.entry, f.path)) || Object.keys(skip).some((e) => matches(e, f.path))) continue;
    problems.push(`"${f.path}" changed (+${f.added} -${f.deleted}) but no scene covers it: add it to a scene's "covers", or to "skip" with a reason.`);
  }
  return problems;
}

const git = (args) => execFileSync('git', args, { encoding: 'utf8', maxBuffer: 256 * 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe'] }).trim();
const tryGit = (args) => { try { return git(args); } catch { return ''; } };

export function defaultBase() {
  const head = tryGit(['symbolic-ref', '--quiet', '--short', 'refs/remotes/origin/HEAD']);
  if (head) return head;
  return ['origin/main', 'origin/master', 'main', 'master'].find((ref) => tryGit(['rev-parse', '--verify', '--quiet', `${ref}^{commit}`])) ?? '';
}

function out(obj, code) {
  process.stdout.write(`${JSON.stringify(obj, null, 2)}\n`);
  process.exit(code);
}

function main(argv) {
  const opt = (name) => { const i = argv.indexOf(name); return i === -1 ? undefined : argv[i + 1]; };
  const flagValues = new Set(['--base', '--head', '--patch'].map(opt).filter(Boolean));
  const plain = argv.filter((a) => !a.startsWith('--') && !flagValues.has(a));
  if (plain[0] === 'check') {
    const work = plain[1] && path.resolve(plain[1]);
    if (!work) out({ error: 'Usage: node diff.mjs check <work-dir>' }, 2);
    const diffFile = path.join(work, 'diff.json');
    const scriptFile = path.join(work, 'script.json');
    if (!existsSync(diffFile)) out({ error: `${diffFile} is missing`, next: 'Run diff.mjs <work-dir> in the repo first.' }, 2);
    if (!existsSync(scriptFile)) out({ error: `${scriptFile} is missing`, next: 'Write the beats first.' }, 2);
    const problems = coverageIssues(JSON.parse(readFileSync(scriptFile, 'utf8')), JSON.parse(readFileSync(diffFile, 'utf8')));
    out({ problems, next: problems.length ? 'Fix "covers" and "skip" in script.json (add a scene or a beat for each uncovered change), then rerun.' : 'Every changed file is covered or skipped.' }, problems.length ? 1 : 0);
  }
  const work = plain[0] && path.resolve(plain[0]);
  if (!work) out({ error: 'Usage: node diff.mjs <work-dir> [--base <ref>] [--head <ref>] [--patch <file>]' }, 2);
  let patch;
  let base = opt('--base');
  let head = opt('--head') ?? 'HEAD';
  let mergeBase = '';
  if (opt('--patch')) {
    patch = readFileSync(path.resolve(opt('--patch')), 'utf8');
    base = base ?? '(patch)';
  } else {
    if (!tryGit(['rev-parse', '--git-dir'])) out({ error: 'not in a git repo', next: 'Run diff.mjs inside the repo, or pass --patch <file> from `gh pr diff <N>`.' }, 2);
    base = base ?? defaultBase();
    if (!base) out({ error: 'no base branch found', next: 'Pass --base origin/<base>.' }, 2);
    mergeBase = tryGit(['merge-base', base, head]);
    if (!mergeBase) out({ error: `no merge-base for ${base} and ${head}`, next: `Run git fetch origin, or pass --base.` }, 2);
    head = tryGit(['rev-parse', head]) || head;
    patch = git(['diff', '--no-color', '--no-ext-diff', '-M', `${mergeBase}..${head}`]);
  }
  const files = summarize(parsePatch(patch));
  mkdirSync(work, { recursive: true });
  const diff = { base, mergeBase, head, files };
  writeFileSync(path.join(work, 'diff.json'), `${JSON.stringify(diff, null, 2)}\n`);
  const main = files.filter((f) => !f.minor);
  out({
    diff: path.join(work, 'diff.json'),
    base, mergeBase, head,
    changed: main.map((f) => `${f.path} +${f.added} -${f.deleted}`),
    minor: files.filter((f) => f.minor).map((f) => f.path),
    next: main.length
      ? `Read the diff of each changed file (git diff ${mergeBase ? `${mergeBase.slice(0, 12)}..${String(head).slice(0, 12)}` : '<base>...<head>'} -- <file>) and list what each one changes. Write the beats from that list; then put each file in a scene's "covers" or in "skip" with a reason.`
      : 'Only minor files changed (tests, lockfiles, version, generated). Say so; a video may not be worth it.',
  }, 0);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main(process.argv.slice(2));
