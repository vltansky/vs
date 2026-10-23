import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';

// Diff first: chat context gets compacted and a PR body is written from that
// chat, so either can lose a change. diff.mjs lists every changed file from
// base...head; quiz.mjs (explain-video) and lint.mjs (explain-pr) refuse a
// script that leaves a changed file out or covers a file the diff does not touch.

const SKILL_DIR = path.resolve(__dirname, '..');
const SKILLS = path.resolve(SKILL_DIR, '..');
const DIFF = path.join(SKILL_DIR, 'scripts', 'diff.mjs');
const QUIZ = path.join(SKILL_DIR, 'scripts', 'quiz.mjs');
const PR_LINT = path.join(SKILLS, 'vs-explain-pr', 'scripts', 'lint.mjs');
const flat = (text: string) => text.replace(/\s+/g, ' ');
const read = (rel: string) => flat(fs.readFileSync(path.join(SKILLS, rel), 'utf8'));
const section = (text: string, from: string, to: string) => text.slice(text.indexOf(from), text.indexOf(to, text.indexOf(from)));
const lib = async () => import(DIFF);
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

  it('flags an uncovered change, a claim the diff does not show, and a skip with no reason', async () => {
    const { parsePatch, summarize, coverageIssues } = await lib();
    const diff = { files: summarize(parsePatch(PATCH)) };
    const only = coverageIssues(scriptWith([{ covers: ['src/coupon.js'] }]), diff).join('\n');
    expect(only).toMatch(/"src\/login\.js" changed \(\+1 -0\) but no scene covers it/);
    expect(only).not.toMatch(/package|test\/login/);
    expect(coverageIssues(scriptWith([{ covers: ['src/coupon.js', 'src/cart.js'] }], { skip: { 'src/login.js': 'later' } }), diff).join('\n'))
      .toMatch(/covers "src\/cart\.js", which the diff does not change/);
    expect(coverageIssues(scriptWith([{ covers: ['src/coupon.js'] }], { skip: { 'src/login.js': ' ' } }), diff).join('\n')).toMatch(/no reason/);
    expect(coverageIssues(scriptWith([{ covers: ['src/'] }]), diff)).toEqual([]);
    expect(coverageIssues(scriptWith([{ covers: ['src/coupon.js'] }], { skip: { 'src/login.js': 'constant only' } }), diff)).toEqual([]);
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
    const r = node([DIFF, work, '--patch', path.join(work, 'pr.diff')], os.tmpdir());
    expect(r.status, r.stderr).toBe(0);
    expect(JSON.parse(r.stdout).changed).toEqual(['src/coupon.js +1 -2', 'src/login.js +1 -0']);
  });
});

describe('the scripts refuse a script that skips the diff', () => {
  const work = () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'vs-diff-gate-'));
    fs.writeFileSync(path.join(dir, 'pr.diff'), PATCH);
    expect(node([DIFF, dir, '--patch', path.join(dir, 'pr.diff')]).status).toBe(0);
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
    expect(node([QUIZ, dir]).status).toBe(0);
  });

  it('explain-video quiz.mjs needs no diff for a topic that is not a change', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'vs-diff-topic-'));
    fs.writeFileSync(path.join(dir, 'script.json'), JSON.stringify(scriptWith([{}])));
    expect(node([QUIZ, dir]).status).toBe(0);
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
    const gap = node([PR_LINT, dir, '--no-page']);
    expect(gap.status).toBe(1);
    expect(JSON.parse(gap.stdout).problems.join('\n')).toMatch(/"src\/login\.js" changed/);
    fs.writeFileSync(path.join(dir, 'script.json'), JSON.stringify(pr({ change: ['src/coupon.js'], risk: ['src/login.js'] })));
    const ok = node([PR_LINT, dir, '--no-page']);
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
    expect(step3).toMatch(/lint\.mjs "\$WORK" --no-page`\. It also checks `diff\.json`/);
    expect(step3).not.toMatch(/Do not read the diff/);
    expect(step3).not.toMatch(/from the PR body, not from the diff/);
  });

  it('explain-pr inputs name the diff and exclude the chat', () => {
    expect(pr).toMatch(/base ref \(the diff is `<base>\.\.\.<head>`\).*Nothing else: no conversation/);
  });

  it('explain-video reads the diff before it states the question, and reads code for other topics', () => {
    expect(step2).not.toBe('');
    expect(step2.indexOf('diff.mjs <work-dir>')).toBeLessThan(step2.indexOf('`question`'));
    expect(step2).toMatch(/Other topics: read the named code/);
    expect(step2).toMatch(/gives only the why/);
    expect(video).toMatch(/for a branch or PR, its `base\.\.\.head` diff/);
    expect(video).not.toMatch(/plus enough context to answer/);
  });

  it('scenarist and ship-it agree: covers and skip, narrated from the diff and the body', () => {
    const scen = read('vs-explain-video/references/scenarist.md');
    expect(scen).toMatch(/start from the diff/);
    expect(scen).toMatch(/"covers": \[/);
    expect(scen).toMatch(/"skip": \{/);
    expect(read('vs-ship-it/SKILL.md')).toMatch(/narrated from the diff and the PR body/);
  });
});
