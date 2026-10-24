import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';

// Diff first: chat context gets compacted and a PR body is written from that
// chat, so either can lose a change. diff.mjs lists every changed file from
// base...head; quiz.mjs (explain-video) and lint.mjs (explain-pr) refuse a
// script that leaves a changed file out or covers a file the diff does not touch,
// and quiz.mjs refuses a missing diff.json unless script.json says why.

const SKILL_DIR = path.resolve(__dirname, '..');
const SKILLS = path.resolve(SKILL_DIR, '..');
const DIFF = path.join(SKILL_DIR, 'scripts', 'diff.mjs');
const QUIZ = path.join(SKILL_DIR, 'scripts', 'quiz.mjs');
const PR_LINT = path.join(SKILLS, 'vs-explain-pr', 'scripts', 'lint.mjs');
const flat = (text: string) => text.replace(/\s+/g, ' ');
const read = (rel: string) => flat(fs.readFileSync(path.join(SKILLS, rel), 'utf8'));
const section = (text: string, from: string, to: string) => text.slice(text.indexOf(from), text.indexOf(to, text.indexOf(from)));
const lib = async () => import(DIFF);
const PIN = 'a'.repeat(40); // the PR head a saved patch is for
const node = (args: string[], cwd?: string) => spawnSync(process.execPath, args, { encoding: 'utf8', cwd });

const PATCH = [
  'diff --git a/src/coupon.js b/src/coupon.js',
  'index 1..2 100644',
  '--- a/src/coupon.js',
  '+++ b/src/coupon.js',
  '@@ -1,3 +1,3 @@',
  ' export function valid(c, now) {',
  '-  return c.expires > now;',
  '+  return c.expires >= now;',
  '--- not a header: a removed line that starts with dashes',
  'diff --git a/src/login.js b/src/login.js',
  '--- a/src/login.js',
  '+++ b/src/login.js',
  '@@ -1 +1,2 @@',
  '+const MAX_ATTEMPTS = 5;',
  ' export function login() {}',
  'diff --git a/package.json b/package.json',
  '--- a/package.json',
  '+++ b/package.json',
  '@@ -2 +2 @@',
  '-  "version": "1.0.0",',
  '+  "version": "1.1.0",',
  'diff --git a/test/login.test.js b/test/login.test.js',
  '--- /dev/null',
  '+++ b/test/login.test.js',
  '@@ -0,0 +1 @@',
  "+test('locks', () => {});",
  'diff --git a/package-lock.json b/package-lock.json',
  '--- a/package-lock.json',
  '+++ b/package-lock.json',
  '@@ -1 +1 @@',
  '-a',
  '+b',
].join('\n');

const scriptWith = (scenes: any[], extra: Record<string, unknown> = {}) => ({
  title: 't',
  scenes: scenes.map((s, i) => ({ id: `s${i}`, beats: ['One sentence here.'], ...s })),
  quiz: [{ q: 'a?', a: 'a' }, { q: 'b?', a: 'b' }, { q: 'c?', a: 'c' }],
  ...extra,
});

describe('diff.mjs reads the change, not the chat', () => {
  it('counts lines per file from hunks only and marks tests, locks, and version bumps minor', async () => {
    const { parsePatch, summarize } = await lib();
    const files = summarize(parsePatch(PATCH));
    expect(files.map((f: any) => [f.path, f.added, f.deleted, f.minor])).toEqual([
      ['src/coupon.js', 1, 2, false],
      ['src/login.js', 1, 0, false],
      ['package.json', 1, 1, true],
      ['test/login.test.js', 1, 0, true],
      ['package-lock.json', 1, 1, true],
    ]);
  });

  it('keeps a manifest that changes more than the version', async () => {
    const { isMinor } = await lib();
    expect(isMinor({ path: 'package.json', lines: ['"version": "2.0.0",', '"left-pad": "^1.3.0",'] })).toBe(false);
  });

  it('flags an uncovered change, a claim the diff does not show, and a skip with a short reason', async () => {
    const { parsePatch, summarize, coverageIssues } = await lib();
    const diff = { files: summarize(parsePatch(PATCH)) };
    const only = coverageIssues(scriptWith([{ covers: ['src/coupon.js'] }]), diff).join('\n');
    expect(only).toMatch(/"src\/login\.js" changed \(\+1 -0\) but no scene covers it/);
    expect(only).not.toMatch(/package|test\/login/);
    expect(coverageIssues(scriptWith([{ covers: ['src/coupon.js', 'src/cart.js'] }], { skip: { 'src/login.js': 'only a constant moves' } }), diff).join('\n'))
      .toMatch(/covers "src\/cart\.js", which is not a changed file/);
    expect(coverageIssues(scriptWith([{ covers: ['src/coupon.js'] }], { skip: { 'src/login.js': ' ' } }), diff).join('\n')).toMatch(/needs a reason of 3 or more words/);
    expect(coverageIssues(scriptWith([{ covers: ['src/coupon.js'] }], { skip: { 'src/login.js': 'later' } }), diff).join('\n')).toMatch(/needs a reason/);
    expect(coverageIssues(scriptWith([{ covers: ['src/coupon.js'] }], { skip: { 'src/login.js': 'only a constant moves' } }), diff)).toEqual([]);
  });

  it('takes covers and skip by exact path only: a directory covers nothing', async () => {
    const { parsePatch, summarize, coverageIssues } = await lib();
    const diff = { files: summarize(parsePatch(PATCH)) };
    const dir = coverageIssues(scriptWith([{ covers: ['src/'] }]), diff).join('\n');
    expect(dir).toMatch(/covers "src\/", which is not a changed file/);
    expect(dir).toMatch(/"src\/coupon\.js" changed/);
    expect(coverageIssues(scriptWith([{ covers: ['src/coupon.js'] }], { skip: { 'src/': 'the rest is small stuff' } }), diff).join('\n'))
      .toMatch(/skip "src\/" is not a changed file/);
  });

  it('works minor out from the path, never from a minor flag in diff.json', async () => {
    const { coverageIssues } = await lib();
    const forged = { files: [{ path: 'src/login.js', added: 9, deleted: 0, minor: true }, { path: 'package.json', added: 2, deleted: 0, minor: true, lines: ['"version": "2.0.0",', '"postinstall": "curl x | sh",'] }] };
    const issues = coverageIssues(scriptWith([{}]), forged).join('\n');
    expect(issues).toMatch(/"src\/login\.js" changed/);
    expect(issues).toMatch(/"package\.json" changed/);
  });

  it('marks build output minor only at a root, fixtures only under a test dir, and keeps *.eval.ts', async () => {
    const { isMinor } = await lib();
    const minor = (p: string) => isMinor({ path: p });
    expect(['dist/app.js', 'packages/ui/dist/x.js', 'apps/web/out/i.html', 'test/fixtures/a.json', 'src/__tests__/a.ts', 'CHANGELOG.md', 'a.min.js', 'src/a.test.ts', 'tests/test_x.py'].filter((p) => !minor(p))).toEqual([]);
    expect(['src/build/compile.ts', 'tools/out/main.ts', 'src/vendor/patch.ts', 'fixtures/prod-config.json', 'skills/x/test/live.eval.ts'.replace('/test/', '/evals/'), 'src/generated-names.ts'].filter(minor)).toEqual([]);
  });

  it('finds the merge-base with the default branch in a real repo and writes diff.json', () => {
    const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'vs-diff-'));
    const git = (...a: string[]) => execFileSync('git', a, { cwd: repo, encoding: 'utf8' });
    git('init', '-q', '-b', 'main');
    git('config', 'user.email', 't@t'); git('config', 'user.name', 't');
    fs.mkdirSync(path.join(repo, 'src'));
    fs.writeFileSync(path.join(repo, 'src', 'coupon.js'), 'export const a = 1;\n');
    git('add', '.'); git('commit', '-qm', 'base');
    git('checkout', '-qb', 'feature');
    fs.writeFileSync(path.join(repo, 'src', 'coupon.js'), 'export const a = 2;\n');
    fs.writeFileSync(path.join(repo, 'src', 'login.js'), 'export const MAX = 5;\n');
    git('add', '.'); git('commit', '-qm', 'feature');
    git('checkout', '-q', 'main');
    fs.writeFileSync(path.join(repo, 'later.js'), 'x\n');
    git('add', '.'); git('commit', '-qm', 'main moved on');
    git('checkout', '-q', 'feature');
    const work = path.join(repo, '.work');
    const r = node([DIFF, work], repo);
    expect(r.status, r.stderr + r.stdout).toBe(0);
    const diff = JSON.parse(fs.readFileSync(path.join(work, 'diff.json'), 'utf8'));
    expect(diff.base).toBe('main');
    expect(diff.files.map((f: any) => f.path).sort()).toEqual(['src/coupon.js', 'src/login.js']);
    fs.writeFileSync(path.join(work, 'script.json'), JSON.stringify(scriptWith([{ covers: ['src/coupon.js'] }])));
    const check = node([DIFF, 'check', work], repo);
    expect(check.status).toBe(1);
    expect(check.stdout).toMatch(/src\/login\.js/);
    expect(node([DIFF, 'check', path.join(repo, 'none')], repo).status).toBe(2);
  });

  it('reads a saved `gh pr diff` with --patch', () => {
    const work = fs.mkdtempSync(path.join(os.tmpdir(), 'vs-diff-patch-'));
    fs.writeFileSync(path.join(work, 'pr.diff'), PATCH);
    const r = node([DIFF, work, '--patch', path.join(work, 'pr.diff'), '--head', PIN], os.tmpdir());
    expect(r.status, r.stderr).toBe(0);
    expect(JSON.parse(r.stdout).changed).toEqual(['src/coupon.js +1 -2', 'src/login.js +1 -0']);
  });
});


const PATHS_PATCH = [
  'diff --git "a/src/\\327\\236\\327\\241\\327\\236\\327\\232.ts" "b/src/\\327\\236\\327\\241\\327\\236\\327\\232.ts"',
  'new file mode 100644',
  '--- /dev/null',
  '+++ "b/src/\\327\\236\\327\\241\\327\\236\\327\\232.ts"',
  '@@ -0,0 +1 @@',
  '+export const doc = 1;',
  'diff --git a/docs/a b/c.md b/docs/a b/c.md',
  '--- a/docs/a b/c.md\t',
  '+++ b/docs/a b/c.md\t',
  '@@ -1 +1 @@',
  '-old',
  '+new',
  'diff --git a/src/old.js b/src/new.js',
  'similarity index 90%',
  'rename from src/old.js',
  'rename to src/new.js',
  '--- a/src/old.js',
  '+++ b/src/new.js',
  '@@ -1 +1 @@',
  '-a',
  '+b',
  'diff --git a/src/gone.js b/src/gone.js',
  'deleted file mode 100644',
  '--- a/src/gone.js',
  '+++ /dev/null',
  '@@ -1 +0,0 @@',
  '-bye',
  'diff --git a/img/logo.png b/img/logo.png',
  'index 1..2 100644',
  'Binary files a/img/logo.png and b/img/logo.png differ',
  'diff --git a/src/pure rename.js b/src/moved.js',
  'similarity index 100%',
  'rename from src/pure rename.js',
  'rename to src/moved.js',
].join('\n');

describe('diff.mjs keeps exact file names', () => {
  it('reads quoted non-ASCII, spaced, " b/", renamed, deleted, and binary paths from a patch', async () => {
    const { parsePatch } = await lib();
    expect(parsePatch(PATHS_PATCH).map((f: any) => [f.path, f.status, f.added, f.deleted, f.binary, f.oldPath ?? ''])).toEqual([
      ['src/מסמך.ts', 'added', 1, 0, false, ''],
      ['docs/a b/c.md', 'modified', 1, 1, false, ''],
      ['src/new.js', 'renamed', 1, 1, false, 'src/old.js'],
      ['src/gone.js', 'deleted', 0, 1, false, ''],
      ['img/logo.png', 'modified', 0, 0, true, ''],
      ['src/moved.js', 'renamed', 0, 0, false, 'src/pure rename.js'],
    ]);
  });

  it('undoes C-style quoting with octal escapes', async () => {
    const { unquote } = await lib();
    expect(unquote('"a\\tb\\"c\\\\d"')).toBe('a\tb"c\\d');
    expect(unquote('"\\327\\236.ts"')).toBe('מ.ts');
    expect(unquote('plain b/x')).toBe('plain b/x');
  });

  it('lists exact names from a real repo: non-ASCII, " b/", rename, delete, binary', () => {
    const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'vs-diff-names-'));
    const git = (...a: string[]) => execFileSync('git', a, { cwd: repo, encoding: 'utf8' });
    git('init', '-q', '-b', 'main');
    git('config', 'user.email', 't@t'); git('config', 'user.name', 't');
    fs.mkdirSync(path.join(repo, 'src'));
    fs.mkdirSync(path.join(repo, 'docs', 'a b'), { recursive: true });
    fs.writeFileSync(path.join(repo, 'src', 'old.js'), Array.from({ length: 20 }, (_, i) => `line ${i}`).join('\n') + '\n');
    fs.writeFileSync(path.join(repo, 'src', 'gone.js'), 'bye\n');
    fs.writeFileSync(path.join(repo, 'docs', 'a b', 'c.md'), 'old\n');
    git('add', '.'); git('commit', '-qm', 'base');
    git('checkout', '-qb', 'feature');
    git('mv', 'src/old.js', 'src/new.js');
    fs.appendFileSync(path.join(repo, 'src', 'new.js'), 'one more\n');
    git('rm', '-q', 'src/gone.js');
    fs.writeFileSync(path.join(repo, 'src', 'מסמך.ts'), 'export const doc = 1;\n');
    fs.writeFileSync(path.join(repo, 'docs', 'a b', 'c.md'), 'new\n');
    fs.writeFileSync(path.join(repo, 'logo.png'), Buffer.from([0, 1, 2, 0, 255, 0]));
    git('add', '-A'); git('commit', '-qm', 'feature');
    const work = path.join(repo, '.work');
    const r = node([DIFF, work, '--base', 'main'], repo);
    expect(r.status, r.stderr + r.stdout).toBe(0);
    const files = JSON.parse(fs.readFileSync(path.join(work, 'diff.json'), 'utf8')).files;
    const byPath = Object.fromEntries(files.map((f: any) => [f.path, f]));
    expect(Object.keys(byPath).sort()).toEqual(['docs/a b/c.md', 'logo.png', 'src/gone.js', 'src/new.js', 'src/מסמך.ts'].sort());
    expect(byPath['src/new.js']).toMatchObject({ status: 'renamed', oldPath: 'src/old.js', added: 1 });
    expect(byPath['src/gone.js']).toMatchObject({ deleted: 1 });
    expect(byPath['logo.png']).toMatchObject({ binary: true });
  });
});

describe('an empty diff blocks, it never passes', () => {
  it('blocks an empty patch file and a patch with no file diffs', () => {
    const work = fs.mkdtempSync(path.join(os.tmpdir(), 'vs-diff-empty-'));
    fs.writeFileSync(path.join(work, 'empty.diff'), '');
    fs.writeFileSync(path.join(work, 'junk.diff'), 'HTTP 406: diff too large\n');
    for (const file of ['empty.diff', 'junk.diff']) {
      const r = node([DIFF, work, '--patch', path.join(work, file), '--head', PIN]);
      expect(r.status, file).toBe(2);
      expect(r.stdout).toMatch(/Blocked, not a pass/);
      expect(r.stdout).not.toMatch(/Only minor/);
    }
    expect(fs.existsSync(path.join(work, 'diff.json'))).toBe(false);
  });

  it('blocks when head is the merge-base (no commits on the branch)', () => {
    const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'vs-diff-same-'));
    const git = (...a: string[]) => execFileSync('git', a, { cwd: repo, encoding: 'utf8' });
    git('init', '-q', '-b', 'main');
    git('config', 'user.email', 't@t'); git('config', 'user.name', 't');
    fs.writeFileSync(path.join(repo, 'a.js'), 'x\n');
    git('add', '.'); git('commit', '-qm', 'base');
    git('checkout', '-qb', 'feature');
    const r = node([DIFF, path.join(repo, '.work'), '--base', 'main'], repo);
    expect(r.status).toBe(2);
    expect(r.stdout).toMatch(/empty diff/);
  });

  it('says "only minor" only when there are files and all are minor', () => {
    const work = fs.mkdtempSync(path.join(os.tmpdir(), 'vs-diff-minor-'));
    fs.writeFileSync(path.join(work, 'p.diff'), ['diff --git a/test/a.test.js b/test/a.test.js', '--- a/test/a.test.js', '+++ b/test/a.test.js', '@@ -1 +1 @@', '-a', '+b'].join('\n'));
    const r = node([DIFF, work, '--patch', path.join(work, 'p.diff'), '--head', PIN]);
    expect(r.status).toBe(0);
    expect(JSON.parse(r.stdout)).toMatchObject({ changed: [], minor: ['test/a.test.js'] });
    expect(r.stdout).toMatch(/Only minor/);
  });
});

describe('diff.mjs picks the base from the remote default branch', () => {
  const setup = () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'vs-diff-base-'));
    const sh = (cwd: string, ...a: string[]) => execFileSync('git', a, { cwd, encoding: 'utf8' });
    const src = path.join(root, 'src');
    fs.mkdirSync(src);
    sh(src, 'init', '-q', '-b', 'trunk');
    sh(src, 'config', 'user.email', 't@t'); sh(src, 'config', 'user.name', 't');
    fs.writeFileSync(path.join(src, 'a.js'), 'x\n');
    sh(src, 'add', '.'); sh(src, 'commit', '-qm', 'base');
    const clone = path.join(root, 'clone');
    sh(root, 'clone', '-q', src, clone);
    sh(clone, 'config', 'user.email', 't@t'); sh(clone, 'config', 'user.name', 't');
    sh(clone, 'checkout', '-qb', 'feature');
    fs.writeFileSync(path.join(clone, 'b.js'), 'y\n');
    sh(clone, 'add', '.'); sh(clone, 'commit', '-qm', 'feature');
    return { root, src, clone, sh };
  };

  it('uses upstream/HEAD before origin/HEAD (a fork)', () => {
    const { root, src, clone, sh } = setup();
    const up = path.join(root, 'up');
    sh(root, 'clone', '-q', '--bare', src, up);
    sh(clone, 'remote', 'add', 'upstream', up);
    sh(clone, 'fetch', '-q', 'upstream');
    sh(clone, 'remote', 'set-head', 'upstream', 'trunk');
    const r = node([DIFF, path.join(clone, '.work')], clone);
    expect(r.status, r.stdout + r.stderr).toBe(0);
    expect(JSON.parse(r.stdout).base).toBe('upstream/trunk');
  });

  it('uses origin/HEAD, and warns when only a local branch is left', () => {
    const { clone, sh } = setup();
    expect(JSON.parse(node([DIFF, path.join(clone, '.work')], clone).stdout).base).toBe('origin/trunk');
    sh(clone, 'remote', 'remove', 'origin');
    sh(clone, 'branch', '-q', 'main', 'feature~1');
    const r = node([DIFF, path.join(clone, '.work')], clone);
    expect(r.status).toBe(0);
    expect(JSON.parse(r.stdout)).toMatchObject({ base: 'main' });
    expect(JSON.parse(r.stdout).warning).toMatch(/can be stale/);
  });
});


describe('diff.json is for the current head, never a stale run', () => {
  const repoOn = () => {
    const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'vs-diff-stale-'));
    const git = (...a: string[]) => execFileSync('git', a, { cwd: repo, encoding: 'utf8' }).trim();
    git('init', '-q', '-b', 'main');
    git('config', 'user.email', 't@t'); git('config', 'user.name', 't');
    fs.writeFileSync(path.join(repo, 'a.js'), 'x\n');
    git('add', '.'); git('commit', '-qm', 'base');
    git('checkout', '-qb', 'feature');
    fs.writeFileSync(path.join(repo, 'a.js'), 'y\n');
    git('add', '.'); git('commit', '-qm', 'feature');
    return { repo, git };
  };

  it('a blocked run deletes the last diff.json before it exits', () => {
    const work = fs.mkdtempSync(path.join(os.tmpdir(), 'vs-diff-del-'));
    fs.writeFileSync(path.join(work, 'pr.diff'), PATCH);
    expect(node([DIFF, work, '--patch', path.join(work, 'pr.diff'), '--head', PIN]).status).toBe(0);
    expect(fs.existsSync(path.join(work, 'diff.json'))).toBe(true);
    fs.writeFileSync(path.join(work, 'empty.diff'), '');
    expect(node([DIFF, work, '--patch', path.join(work, 'empty.diff'), '--head', 'b'.repeat(40)]).status).toBe(2);
    expect(fs.existsSync(path.join(work, 'diff.json'))).toBe(false);
    expect(node([DIFF, work, '--patch', path.join(work, 'pr.diff'), '--head', PIN]).status).toBe(0);
    expect(node([DIFF, work, '--base', 'nope'], os.tmpdir()).status).toBe(2); // not a repo
    expect(fs.existsSync(path.join(work, 'diff.json'))).toBe(false);
  });

  it('--patch needs --head, and diff.json records the head SHA and ref', () => {
    const work = fs.mkdtempSync(path.join(os.tmpdir(), 'vs-diff-pin-'));
    fs.writeFileSync(path.join(work, 'pr.diff'), PATCH);
    const r = node([DIFF, work, '--patch', path.join(work, 'pr.diff')], os.tmpdir());
    expect(r.status).toBe(2);
    expect(r.stdout).toMatch(/--patch needs --head <sha>/);
    const { repo, git } = repoOn();
    expect(node([DIFF, path.join(repo, '.w'), '--base', 'main'], repo).status).toBe(0);
    expect(JSON.parse(fs.readFileSync(path.join(repo, '.w', 'diff.json'), 'utf8'))).toMatchObject({ head: git('rev-parse', 'HEAD'), headRef: 'HEAD' });
  });

  it('quiz.mjs and check fail when the branch moved on after diff.mjs', () => {
    const { repo, git } = repoOn();
    const work = path.join(repo, '.w');
    expect(node([DIFF, work, '--base', 'main'], repo).status).toBe(0);
    fs.writeFileSync(path.join(work, 'script.json'), JSON.stringify(scriptWith([{ covers: ['a.js'] }])));
    expect(node([DIFF, 'check', work], repo).status).toBe(0);
    fs.writeFileSync(path.join(repo, 'b.js'), 'new\n');
    git('add', 'b.js'); git('commit', '-qm', 'more');
    const check = node([DIFF, 'check', work], repo);
    expect(check.status).toBe(1);
    expect(check.stdout).toMatch(/it is stale/);
    const quiz = node([QUIZ, work], repo);
    expect(quiz.status).toBe(1);
    expect(quiz.stdout).toMatch(/it is stale/);
    expect(fs.existsSync(path.join(work, 'quiz', 'BRIEF.md'))).toBe(false);
    expect(node([QUIZ, work, '--head', 'HEAD~1'], repo).status).toBe(0);
  });

  it('explain-pr lint.mjs fails a diff.json for another head, or with no head', () => {
    const roles = ['problem', 'before', 'change', 'after', 'risk'];
    const script = { title: 't', scenes: roles.map((role) => ({ id: role, role, beats: ['One short sentence.'], covers: role === 'change' ? ['src/coupon.js', 'src/login.js'] : [] })) };
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'vs-diff-prhead-'));
    fs.writeFileSync(path.join(dir, 'pr.diff'), PATCH);
    expect(node([DIFF, dir, '--patch', path.join(dir, 'pr.diff'), '--head', PIN]).status).toBe(0);
    fs.writeFileSync(path.join(dir, 'script.json'), JSON.stringify(script));
    expect(node([PR_LINT, dir, '--no-page', '--head', PIN]).status).toBe(0);
    const other = node([PR_LINT, dir, '--no-page', '--head', 'c'.repeat(40)]);
    expect(other.status).toBe(1);
    expect(JSON.parse(other.stdout).problems.join('\n')).toMatch(/diff\.json is for aaaaaaaaaaaa, but the head is cccccccccccc: it is stale/);
    fs.writeFileSync(path.join(dir, 'diff.json'), JSON.stringify({ files: [] }));
    const headless = node([PR_LINT, dir, '--no-page', '--head', PIN]);
    expect(headless.status).toBe(1);
    expect(JSON.parse(headless.stdout).problems.join('\n')).toMatch(/diff\.json has no head SHA/);
  });
});

describe('diff.mjs reads CRLF patches and blank context lines', () => {
  it('strips \r and keeps counting after a blank context line', async () => {
    const { parsePatch } = await lib();
    const patch = [
      'diff --git a/src/a.js b/src/a.js',
      '--- a/src/a.js',
      '+++ b/src/a.js',
      '@@ -1,4 +1,4 @@',
      ' const a = 1;',
      '',
      '-const b = 2;',
      '+const b = 3;',
      ' export { a, b };',
      'diff --git a/src/b.js b/src/b.js',
      '--- a/src/b.js',
      '+++ b/src/b.js',
      '@@ -1 +1 @@',
      '-x',
      '+y',
    ];
    const lf = parsePatch(patch.join('\n')).map((f: any) => [f.path, f.added, f.deleted]);
    expect(lf).toEqual([['src/a.js', 1, 1], ['src/b.js', 1, 1]]);
    expect(parsePatch(patch.join('\r\n')).map((f: any) => [f.path, f.added, f.deleted])).toEqual(lf);
    expect(parsePatch(patch.join('\r\n')).every((f: any) => !/\r/.test(f.path + f.lines.join('')))).toBe(true);
  });
});

describe('the scripts refuse a script that skips the diff', () => {
  const work = () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'vs-diff-gate-'));
    fs.writeFileSync(path.join(dir, 'pr.diff'), PATCH);
    expect(node([DIFF, dir, '--patch', path.join(dir, 'pr.diff'), '--head', PIN]).status).toBe(0);
    return dir;
  };

  it('explain-video quiz.mjs stops before the brief when a change has no scene', () => {
    const dir = work();
    fs.writeFileSync(path.join(dir, 'script.json'), JSON.stringify(scriptWith([{ covers: ['src/coupon.js'] }])));
    const bad = node([QUIZ, dir]);
    expect(bad.status).toBe(1);
    expect(bad.stdout).toMatch(/src\/login\.js/);
    expect(fs.existsSync(path.join(dir, 'quiz', 'BRIEF.md'))).toBe(false);
    fs.writeFileSync(path.join(dir, 'script.json'), JSON.stringify(scriptWith([{ covers: ['src/coupon.js'] }, { covers: ['src/login.js'] }])));
    const ok = node([QUIZ, dir]);
    expect(ok.status).toBe(0);
    expect(JSON.parse(ok.stdout).minor).toEqual(['package.json', 'test/login.test.js', 'package-lock.json']);
  });

  it('explain-video quiz.mjs stops with no diff.json unless script.json says why', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'vs-diff-topic-'));
    fs.writeFileSync(path.join(dir, 'script.json'), JSON.stringify(scriptWith([{}])));
    const bare = node([QUIZ, dir]);
    expect(bare.status).toBe(1);
    expect(bare.stdout).toMatch(/diff\.json is missing/);
    expect(fs.existsSync(path.join(dir, 'quiz', 'BRIEF.md'))).toBe(false);
    fs.writeFileSync(path.join(dir, 'script.json'), JSON.stringify(scriptWith([{}], { diff: { none: 'n/a' } })));
    expect(node([QUIZ, dir]).stdout).toMatch(/4 or more words/);
    fs.writeFileSync(path.join(dir, 'script.json'), JSON.stringify(scriptWith([{}], { diff: { none: 'explains how the retry loop works today' } })));
    expect(node([QUIZ, dir]).status).toBe(0);
  });

  it('explain-video quiz.mjs refuses "diff": {"none"} when diff.json exists', () => {
    const dir = work();
    fs.writeFileSync(path.join(dir, 'script.json'), JSON.stringify(scriptWith([{ covers: ['src/coupon.js'] }, { covers: ['src/login.js'] }], { diff: { none: 'explains how the code works today' } })));
    const r = node([QUIZ, dir]);
    expect(r.status).toBe(1);
    expect(r.stdout).toMatch(/this topic is a change/);
  });

  it('explain-pr lint.mjs needs diff.json and checks coverage', () => {
    const roles = ['problem', 'before', 'change', 'after', 'risk'];
    const pr = (covers: Record<string, string[]>) => ({ title: 't', scenes: roles.map((role) => ({ id: role, role, beats: ['One short sentence.'], covers: covers[role] ?? [] })) });
    const bare = fs.mkdtempSync(path.join(os.tmpdir(), 'vs-diff-pr-'));
    fs.writeFileSync(path.join(bare, 'script.json'), JSON.stringify(pr({ change: ['src/coupon.js'] })));
    const missing = node([PR_LINT, bare, '--no-page']);
    expect(missing.status).toBe(1);
    expect(missing.stdout).toMatch(/diff\.json is missing/);
    const dir = work();
    fs.writeFileSync(path.join(dir, 'script.json'), JSON.stringify(pr({ change: ['src/coupon.js'] })));
    const gap = node([PR_LINT, dir, '--no-page', '--head', PIN]);
    expect(gap.status).toBe(1);
    expect(JSON.parse(gap.stdout).problems.join('\n')).toMatch(/"src\/login\.js" changed/);
    fs.writeFileSync(path.join(dir, 'script.json'), JSON.stringify(pr({ change: ['src/coupon.js'], risk: ['src/login.js'] })));
    const ok = node([PR_LINT, dir, '--no-page', '--head', PIN]);
    expect(ok.status, ok.stdout).toBe(0);
  });
});

describe('both skills start from the diff', () => {
  const pr = read('vs-explain-pr/SKILL.md');
  const step3 = section(pr, '## 3. Write the beats', '## 4. Narrate');
  const video = read('vs-explain-video/SKILL.md');
  const step2 = section(video, '## 2. Read the diff', '## 3. Scaffold');

  it('explain-pr runs diff.mjs before it reads the body, and never the conversation', () => {
    expect(step3).toMatch(/^## 3\. Write the beats from the diff, then the PR body/);
    const diffAt = step3.indexOf('diff.mjs "$WORK" --base origin/<base> --head <head SHA>');
    expect(diffAt).toBeGreaterThan(-1);
    expect(diffAt).toBeLessThan(step3.indexOf('Then read the body file'));
    expect(step3).toMatch(/gh pr diff <N> --repo <owner\/name>.*--patch <file>/);
    expect(step3).toMatch(/Do not read the conversation/);
    expect(step3).toMatch(/The body must not contradict the diff/);
    expect(step3).toMatch(/A change the diff shows and the body does not name gets a beat/);
    expect(step3).toMatch(/Never claim more than the diff and the body prove: cut a beat the diff does not show/);
    expect(step3).toMatch(/Carry `Still unverified` into `risk`/);
    expect(step3).toMatch(/by the exact path in `diff\.json` \(no directories\)/);
    expect(step3).toMatch(/reason of 3 or more words/);
    expect(step3).toMatch(/An empty diff blocks \(exit 2\)/);
    expect(step3).toMatch(/lint\.mjs "\$WORK" --no-page --head <head SHA>`\. It also checks `diff\.json`: it must be for that head/);
    expect(step3).toMatch(/--patch <file>` \(keep `--head <head SHA>`\)\. A blocked run deletes `diff\.json`/);
    expect(step3).not.toMatch(/Do not read the diff/);
    expect(step3).not.toMatch(/from the PR body, not from the diff/);
  });

  it('explain-pr inputs name the diff and exclude the chat', () => {
    expect(pr).toMatch(/base ref \(the diff is `<base>\.\.\.<head>`\).*Nothing else: no conversation/);
  });

  it('explain-video reads the diff before it states the question, and reads code for other topics', () => {
    expect(step2).not.toBe('');
    expect(step2.indexOf('diff.mjs <work-dir>')).toBeLessThan(step2.indexOf('`question`'));
    expect(step2).toMatch(/Other topics: read the named code; set `"diff": \{"none": "<why>"\}`/);
    expect(step2).toMatch(/an empty diff blocks/);
    expect(step2).toMatch(/gives only the why/);
    expect(step2).toMatch(/A behaviour change the chat never named gets a beat; `skip` is only for edits that change no behaviour/);
    expect(video).toMatch(/for a branch or PR, its `base\.\.\.head` diff/);
    expect(video).not.toMatch(/plus enough context to answer/);
  });

  it('scenarist and ship-it agree: covers and skip, narrated from the diff and the body', () => {
    const scen = read('vs-explain-video/references/scenarist.md');
    expect(scen).toMatch(/start from the diff/);
    expect(scen).toMatch(/"covers": \[/);
    expect(scen).toMatch(/"skip": \{/);
    expect(scen).toMatch(/by the exact path in `diff\.json` \(no directories\)/);
    expect(scen).toMatch(/"diff": \{ "none": /);
    expect(scen).toMatch(/A behaviour change the user never named, even one that looks unrelated, gets a beat/);
    expect(scen).toMatch(/`quiz\.mjs` stops when `diff\.json` is missing/);
    expect(read('vs-ship-it/SKILL.md')).toMatch(/narrated from the diff and the PR body/);
  });
});
