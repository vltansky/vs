#!/usr/bin/env node
// The diff is the source of WHAT changed. Chat context gets compacted and a PR
// body is written from that chat, so either can lose a change. This lists every
// changed file from base...head, and checks that script.json covers each one.
//
//   node diff.mjs <work-dir> [--base <ref>] [--head <ref>] [--patch <file>]
//   node diff.mjs check <work-dir>
//
// List: with no --base, the base is the default branch of the `upstream`
// remote (a fork), else of `origin` (<remote>/HEAD, then gh, then
// <remote>/main or master); a local main or master is the last resort and
// prints a warning. File names come from `git diff --numstat -z -M` from the
// merge-base to head, so quoted, spaced, and renamed paths stay exact. --patch
// reads a saved `gh pr diff <N>` (for an open PR with no checkout) and takes
// names from the ---/+++ and rename headers. An empty diff is blocked, never a
// pass. Writes <work-dir>/diff.json and prints the files. Tests, lockfiles,
// version-only bumps, changelogs, snapshots, and top-level build output are
// "minor": they need no scene.
//
// Check: every file that is not minor is in a scene's "covers" or in the
// top-level "skip" with a reason of 3 or more words, by its exact path. A
// "covers" entry that is not a changed file is a claim the diff does not show.
// "minor" is worked out again from the path, never read from diff.json.
//
// Exit codes: 0 pass; 1 problems; 2 blocked (no repo, no base, empty diff, no script).
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const LOCKS = /(^|\/)(package-lock\.json|npm-shrinkwrap\.json|yarn\.lock|pnpm-lock\.yaml|bun\.lockb?|Cargo\.lock|go\.sum|poetry\.lock|uv\.lock|Gemfile\.lock|composer\.lock|Podfile\.lock)$/;
// Test files and the fixtures and snapshots under a test dir. An *.eval.ts
// outside a test dir is not minor: in a skills repo it can be the deliverable.
const TESTS = /(^|\/)(tests?|__tests__|__snapshots__)\/|\.(test|spec)\.[cm]?[jt]sx?$|_test\.(go|py)$|(^|\/)test_[^/]+\.py$|\.snap$/;
// Build output only at the repo root or a package root, never src/build/.
const GENERATED = /^((packages|apps|libs)\/[^/]+\/)?(dist|out|generated)\/|\.min\.(js|css)$|\.generated\.|(^|\/)CHANGELOG(\.md)?$/i;
const MANIFEST = /(^|\/)(package|plugin|composer|manifest)\.json$|(^|\/)(Cargo|pyproject)\.toml$/;
const VERSION_LINE = /^\s*"?version"?\s*[:=]/;
const MIN_REASON_WORDS = 3;

// Undoes git's C-style path quoting: "a/src/\327\236.ts" -> a/src/מ.ts.
export function unquote(text) {
  if (!text.startsWith('"')) return text;
  const bytes = [];
  const body = text.slice(1, text.lastIndexOf('"'));
  const named = { n: 10, t: 9, r: 13, b: 8, f: 12, v: 11, a: 7, '\\': 92, '"': 34 };
  for (let i = 0; i < body.length; i += 1) {
    const c = body[i];
    if (c !== '\\') { bytes.push(...Buffer.from(c, 'utf8')); continue; }
    const next = body[i + 1];
    if (/[0-7]/.test(next)) { bytes.push(parseInt(body.slice(i + 1, i + 4), 8)); i += 3; continue; }
    bytes.push(named[next] ?? next.charCodeAt(0));
    i += 1;
  }
  return Buffer.from(bytes).toString('utf8');
}

const stripSide = (name) => name.replace(/^[ab]\//, '');
// A header path: a quoted token, or the rest of the line (minus a tab-trailer).
const headerPath = (rest) => (rest.startsWith('"') ? unquote(rest) : rest.replace(/\t.*$/, ''));

// Parses a unified diff (`gh pr diff`, `git diff`) into one entry per file:
// { path, oldPath?, status, added, deleted, binary, lines }.
export function parsePatch(text) {
  const files = [];
  let file = null;
  let inHunk = false;
  for (const line of String(text).split('\n')) {
    if (line.startsWith('diff --git ')) {
      file = { path: '', status: 'modified', added: 0, deleted: 0, binary: false, lines: [], header: line.slice(11) };
      files.push(file);
      inHunk = false;
      continue;
    }
    if (!file) continue;
    if (line.startsWith('@@')) { inHunk = true; continue; }
    if (inHunk && (line.startsWith('+') || line.startsWith('-'))) {
      if (line.startsWith('+')) file.added += 1; else file.deleted += 1;
      file.lines.push(line.slice(1));
      continue;
    }
    if (inHunk && !line.startsWith(' ') && !line.startsWith('\\')) inHunk = false;
    if (inHunk) continue;
    if (line.startsWith('new file mode')) file.status = 'added';
    else if (line.startsWith('deleted file mode')) file.status = 'deleted';
    else if (line.startsWith('rename from ')) { file.status = 'renamed'; file.oldPath = headerPath(line.slice(12)); }
    else if (line.startsWith('rename to ')) file.path = headerPath(line.slice(10));
    else if (line.startsWith('copy to ')) file.path = headerPath(line.slice(8));
    else if (line.startsWith('+++ ') && !file.path) {
      const name = headerPath(line.slice(4));
      if (name !== '/dev/null') file.path = stripSide(name);
    } else if (line.startsWith('--- ') && file.status === 'deleted') {
      file.deletedFrom = stripSide(headerPath(line.slice(4)));
    } else if (line.startsWith('Binary files ') || line === 'GIT binary patch') file.binary = true;
  }
  for (const f of files) {
    if (!f.path && f.deletedFrom) f.path = f.deletedFrom;
    if (!f.path) f.path = headerSamePath(f.header);
    delete f.header;
    delete f.deletedFrom;
  }
  return files.filter((f) => f.path);
}

// No ---/+++ (a binary file, a mode change): the header is `a/X b/X` with the
// same X on both sides, so split it in the middle, or read two quoted tokens.
function headerSamePath(header) {
  if (header.startsWith('"')) {
    const m = header.match(/^("(?:[^"\\]|\\.)*")\s+("(?:[^"\\]|\\.)*"|\S.*)$/);
    return m ? stripSide(headerPath(m[2])) : '';
  }
  const len = (header.length - 5) / 2;
  if (!Number.isInteger(len) || len < 1) return '';
  const name = header.slice(2, 2 + len);
  return header === `a/${name} b/${name}` ? name : '';
}

// Parses `git diff --numstat -z -M`: "add\tdel\tpath\0", or for a rename
// "add\tdel\t\0old\0new\0". Binary files show "-\t-".
export function parseNumstatZ(text) {
  const parts = String(text).split('\0');
  const files = [];
  for (let i = 0; i < parts.length; i += 1) {
    const m = parts[i].match(/^(-|\d+)\t(-|\d+)\t(.*)$/s);
    if (!m) continue;
    const binary = m[1] === '-';
    const entry = { path: m[3], status: 'modified', added: binary ? 0 : Number(m[1]), deleted: binary ? 0 : Number(m[2]), binary };
    if (m[3] === '') {
      entry.oldPath = parts[i + 1];
      entry.path = parts[i + 2];
      entry.status = 'renamed';
      i += 2;
    }
    files.push(entry);
  }
  return files;
}

export function isMinor(file) {
  if (LOCKS.test(file.path) || TESTS.test(file.path) || GENERATED.test(file.path)) return true;
  const lines = file.lines ?? [];
  // A manifest whose only changed lines are the version: a version bump.
  return MANIFEST.test(file.path) && lines.length > 0 && lines.every((l) => VERSION_LINE.test(l));
}

// Keeps the changed lines only where minor needs them (manifests), so check
// can work minor out again.
export function summarize(files) {
  return files.map((f) => {
    const entry = { path: f.path, ...(f.oldPath ? { oldPath: f.oldPath } : {}), status: f.status, added: f.added, deleted: f.deleted, binary: !!f.binary };
    if (MANIFEST.test(f.path)) entry.lines = f.lines ?? [];
    return { ...entry, minor: isMinor({ path: f.path, lines: f.lines }) };
  });
}

const words = (text) => String(text).split(/\s+/).filter(Boolean).length;

// Reads script.json "covers", "skip", and "diff" once, as plain values.
export function readCoverage(script) {
  const scenes = Array.isArray(script.scenes) ? script.scenes : [];
  const covers = scenes.flatMap((scene) => (Array.isArray(scene.covers) ? scene.covers : []).map((entry) => ({ scene: scene.id, entry: String(entry) })));
  const skip = Object.entries(Object(script.skip ?? {})).map(([entry, reason]) => ({ entry, reason: String(reason ?? '') }));
  const none = String(Object(script.diff ?? {}).none ?? '').trim();
  return { covers, skip, none };
}

// Problems with how script.json covers the diff, by exact path: a changed file
// no scene covers and no "skip" names, a skip with a short reason, and a
// "covers" entry that is not a changed file.
export function coverageIssues(script, diff) {
  const problems = [];
  const files = Array.isArray(diff.files) ? diff.files : [];
  const changed = new Set(files.map((f) => f.path));
  const { covers, skip, none } = readCoverage(script);
  if (none) problems.push('script.json says "diff": {"none": ...}, but diff.json exists: this topic is a change. Remove "diff" and cover the files.');
  for (const { entry, reason } of skip) {
    if (words(reason) < MIN_REASON_WORDS) problems.push(`skip "${entry}" needs a reason of ${MIN_REASON_WORDS} or more words: say why the video leaves it out.`);
    if (!changed.has(entry)) problems.push(`skip "${entry}" is not a changed file (use the exact path from diff.json); drop it.`);
  }
  for (const { scene, entry } of covers) {
    if (!changed.has(entry)) problems.push(`scene "${scene}" covers "${entry}", which is not a changed file: drop that claim, or use the exact path from diff.json.`);
  }
  for (const f of files) {
    if (isMinor(f)) continue;
    if (covers.some((c) => c.entry === f.path) || skip.some((s) => s.entry === f.path)) continue;
    problems.push(`"${f.path}" changed (+${f.added} -${f.deleted}) but no scene covers it: add it to a scene's "covers", or to "skip" with a reason.`);
  }
  return problems;
}

// For a topic that is not a change: script.json must say so, with a reason.
export function noDiffIssues(script) {
  const { none } = readCoverage(script);
  if (!none) return ['diff.json is missing. For a branch or PR, run diff.mjs <work-dir> first. For a topic that is not a change, set "diff": {"none": "<why>"} in script.json.'];
  if (words(none) < 4) return ['"diff": {"none": ...} needs a reason of 4 or more words (for example "explains how the retry loop works today").'];
  return [];
}

const git = (args) => execFileSync('git', args, { encoding: 'utf8', maxBuffer: 256 * 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe'] });
const tryGit = (args) => { try { return git(args).trim(); } catch { return ''; } };
const refExists = (ref) => !!tryGit(['rev-parse', '--verify', '--quiet', `${ref}^{commit}`]);

// The default branch of upstream (a fork) or origin; a local branch only with a warning.
export function defaultBase() {
  const remotes = tryGit(['remote']).split('\n').filter(Boolean);
  for (const remote of ['upstream', 'origin'].filter((r) => remotes.includes(r))) {
    const head = tryGit(['symbolic-ref', '--quiet', '--short', `refs/remotes/${remote}/HEAD`]);
    if (head) return { base: head };
    let name = '';
    try {
      name = execFileSync('gh', ['repo', 'view', '--json', 'defaultBranchRef', '-q', '.defaultBranchRef.name'], { encoding: 'utf8', timeout: 8000, stdio: ['ignore', 'pipe', 'ignore'] }).trim();
    } catch { /* gh missing or offline */ }
    for (const branch of [name, 'main', 'master'].filter(Boolean)) if (refExists(`${remote}/${branch}`)) return { base: `${remote}/${branch}` };
  }
  const local = ['main', 'master'].find(refExists);
  return local ? { base: local, warning: `no remote default branch found; using local ${local}, which can be stale. Pass --base <remote>/<branch> to be sure.` } : { base: '' };
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
    if (!existsSync(scriptFile)) out({ error: `${scriptFile} is missing`, next: 'Write the beats first.' }, 2);
    const script = JSON.parse(readFileSync(scriptFile, 'utf8'));
    const diff = existsSync(diffFile) ? JSON.parse(readFileSync(diffFile, 'utf8')) : null;
    const problems = diff ? coverageIssues(script, diff) : noDiffIssues(script);
    const minor = (diff?.files ?? []).filter(isMinor).map((f) => f.path);
    out({ problems, minor, next: problems.length ? 'Fix "covers" and "skip" in script.json (add a beat for each uncovered change), then rerun.' : 'Every changed file is covered or skipped.' }, problems.length ? 1 : 0);
  }
  const work = plain[0] && path.resolve(plain[0]);
  if (!work) out({ error: 'Usage: node diff.mjs <work-dir> [--base <ref>] [--head <ref>] [--patch <file>]' }, 2);
  let files;
  let base = opt('--base');
  let head = opt('--head') ?? 'HEAD';
  let mergeBase = '';
  let warning;
  if (opt('--patch')) {
    const patch = readFileSync(path.resolve(opt('--patch')), 'utf8');
    base = base ?? '(patch)';
    files = parsePatch(patch);
    if (!files.length) {
      out({
        error: patch.trim() ? `${opt('--patch')} has no file diffs git can read` : `${opt('--patch')} is empty`,
        next: 'Blocked, not a pass. `gh pr diff <N> > pr.diff` leaves an empty file when gh fails (auth, diff too large): rerun it and check its exit code, or use a checkout and --base.',
      }, 2);
    }
  } else {
    if (!tryGit(['rev-parse', '--git-dir'])) out({ error: 'not in a git repo', next: 'Run diff.mjs inside the repo, or pass --patch <file> from `gh pr diff <N>`.' }, 2);
    if (!base) ({ base, warning } = defaultBase());
    if (!base) out({ error: 'no base branch found', next: 'Pass --base <remote>/<base>.' }, 2);
    mergeBase = tryGit(['merge-base', base, head]);
    if (!mergeBase) {
      const shallow = tryGit(['rev-parse', '--is-shallow-repository']) === 'true';
      out({
        error: `no merge-base for ${base} and ${head}`,
        next: shallow
          ? `This clone is shallow: run git fetch --deepen=200 (or git fetch --unshallow), then rerun.`
          : `Fetch the base (git fetch ${base.split('/')[0]}), or pass --base.`,
      }, 2);
    }
    head = tryGit(['rev-parse', head]) || head;
    files = parseNumstatZ(git(['-c', 'core.quotePath=false', 'diff', '--numstat', '-z', '-M', `${mergeBase}..${head}`]));
    for (const f of files) {
      if (!MANIFEST.test(f.path)) continue;
      f.lines = parsePatch(git(['diff', '--no-color', '--no-ext-diff', `${mergeBase}..${head}`, '--', f.path]))[0]?.lines ?? [];
    }
    if (!files.length) {
      out({ error: `empty diff: ${head.slice(0, 12)} has no changes since the merge-base with ${base}`, next: 'Blocked, not a pass. Check out the branch with the change, or pass --head <sha> (after a merge, use the PR head SHA).' }, 2);
    }
  }
  const listed = summarize(files);
  mkdirSync(work, { recursive: true });
  writeFileSync(path.join(work, 'diff.json'), `${JSON.stringify({ base, mergeBase, head, files: listed }, null, 2)}\n`);
  const main = listed.filter((f) => !f.minor);
  out({
    diff: path.join(work, 'diff.json'),
    base, mergeBase, head,
    ...(warning ? { warning } : {}),
    changed: main.map((f) => `${f.path} +${f.added} -${f.deleted}${f.oldPath ? ` (renamed from ${f.oldPath})` : ''}${f.binary ? ' (binary)' : ''}`),
    minor: listed.filter((f) => f.minor).map((f) => f.path),
    next: main.length
      ? `Read the diff of each changed file (git diff ${mergeBase ? `${mergeBase.slice(0, 12)}..${String(head).slice(0, 12)}` : '<base>...<head>'} -- <file>) and list what each one changes. Write the beats from that list; then put each file's exact path in a scene's "covers" or in "skip" with a reason.`
      : 'Only minor files changed (tests, lockfiles, version, generated). Say so; a video may not be worth it.',
  }, 0);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main(process.argv.slice(2));
