import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

const DIR = path.resolve(__dirname, '..');
const SKILL = fs.readFileSync(path.join(DIR, 'SKILL.md'), 'utf8').replace(/\s+/g, ' ');
const ARTIFACTS = path.join(DIR, 'scripts', 'vs-artifacts.sh');
const OLD = new Date(Date.now() - 90 * 86400e3);

let tmp = '';
afterEach(() => {
  if (tmp) fs.rmSync(tmp, { recursive: true, force: true });
  tmp = '';
});

// Builds a fake ~/.vs plus a `trash` stub that moves into <tmp>/trashed, so nothing real is touched.
function fixture() {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'vs-disk-cleanup-'));
  const vs = path.join(tmp, 'vs');
  const put = (rel: string, old: boolean) => {
    const p = path.join(vs, rel);
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.writeFileSync(p, 'x');
    if (old) fs.utimesSync(p, OLD, OLD);
  };
  put('acme-app/videos/2026-01-01-old.mp4', true);
  put('acme-app/videos/2026-10-01-new.mp4', false);
  put('acme-app/qa-reports/baseline.json', true);
  put('acme-app/specs/2026-01-01-design.md', true);
  put('acme-app/sessions/2026-01-01-handoff.md', true);
  put('acme-app/pr-12/notes.md', true);
  put('loose/page.html', true);
  const bin = path.join(tmp, 'bin');
  fs.mkdirSync(bin);
  fs.mkdirSync(path.join(tmp, 'trashed'));
  fs.writeFileSync(path.join(bin, 'trash'), `#!/bin/sh\nmv "$1" "${tmp}/trashed/"\n`, { mode: 0o755 });
  const env = { ...process.env, VS_HOME: vs, DAYS: '30', PATH: `${bin}:${process.env.PATH}` };
  return { vs, env };
}

function rows(stdout: string) {
  return new Map(
    stdout.trim().split('\n').slice(1).map((l) => {
      const [status, , , p] = l.split('\t');
      return [p, status] as const;
    }),
  );
}

describe('vs-artifacts.sh', () => {
  it('classifies ~/.vs entries by kind and age', () => {
    const { vs, env } = fixture();
    const r = spawnSync('bash', [ARTIFACTS], { env, encoding: 'utf8' });
    expect(r.status, r.stderr).toBe(0);
    const got = rows(r.stdout);
    const at = (rel: string) => got.get(path.join(vs, rel));
    expect(at('acme-app/videos/2026-01-01-old.mp4')).toBe('STALE');
    expect(at('acme-app/videos/2026-10-01-new.mp4')).toBe('RECENT');
    expect(at('acme-app/qa-reports/baseline.json')).toBe('KEEP');
    expect(at('acme-app/specs')).toBe('KEEP');
    expect(at('acme-app/sessions')).toBe('REVIEW');
    expect(at('acme-app/pr-12')).toBe('STALE');
    expect(at('loose/page.html')).toBe('REVIEW');
  });

  it('trashes only STALE paths under ~/.vs and prunes emptied dirs', () => {
    const { vs, env } = fixture();
    const outside = path.join(tmp, 'outside.txt');
    fs.writeFileSync(outside, 'x');
    fs.utimesSync(outside, OLD, OLD);
    const input = [
      'acme-app/videos/2026-01-01-old.mp4',
      'acme-app/videos/2026-10-01-new.mp4',
      'acme-app/specs',
      'acme-app/qa-reports',
      'acme-app/pr-12',
    ].map((rel) => path.join(vs, rel)).concat(outside).join('\n');
    const r = spawnSync('bash', [ARTIFACTS, '--remove'], { env, input, encoding: 'utf8' });
    expect(r.status, r.stderr).toBe(0);
    expect(fs.readdirSync(path.join(tmp, 'trashed')).sort()).toEqual(['2026-01-01-old.mp4', 'pr-12']);
    expect(fs.existsSync(path.join(vs, 'acme-app/videos/2026-10-01-new.mp4'))).toBe(true);
    expect(fs.existsSync(path.join(vs, 'acme-app/specs/2026-01-01-design.md'))).toBe(true);
    expect(fs.existsSync(path.join(vs, 'acme-app/qa-reports/baseline.json'))).toBe(true);
    expect(fs.existsSync(outside)).toBe(true);
    expect(r.stdout).toMatch(/SKIP .*qa-reports \(kind dir; pass its entries\)/);
    expect(r.stdout).toMatch(/SKIP .*outside\.txt \(not under/);
    expect(r.stdout).toMatch(/moved 2 entries .* to Trash; space frees after Trash is emptied/);
  });
});

// Main repo with a pushed main branch plus one worktree whose commit is old and pushed,
// so the worktree's state comes only from what each test does to it.
function gitFixture() {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'vs-disk-cleanup-git-'));
  const old = new Date(OLD).toISOString();
  const env = { ...process.env, GIT_AUTHOR_DATE: old, GIT_COMMITTER_DATE: old, GIT_CONFIG_GLOBAL: '/dev/null',
    GIT_AUTHOR_NAME: 't', GIT_AUTHOR_EMAIL: 't@t', GIT_COMMITTER_NAME: 't', GIT_COMMITTER_EMAIL: 't@t' };
  const git = (cwd: string, ...args: string[]) => {
    const r = spawnSync('git', args, { cwd, env, encoding: 'utf8' });
    if (r.status !== 0) throw new Error(`git ${args.join(' ')}: ${r.stderr}`);
    return r.stdout.trim();
  };
  const origin = path.join(tmp, 'origin.git');
  const main = path.join(tmp, 'main');
  const wt = path.join(tmp, 'wts', 'feature');
  git(tmp, 'init', '-q', '--bare', '-b', 'main', origin);
  git(tmp, 'clone', '-q', origin, main);
  fs.writeFileSync(path.join(main, 'app.txt'), 'v1\n');
  git(main, 'add', '.');
  git(main, 'commit', '-qm', 'init');
  git(main, 'push', '-q', 'origin', 'main');
  git(main, 'worktree', 'add', '-q', '-b', 'feature', wt, 'origin/main');
  const age = (p: string) => fs.utimesSync(p, OLD, OLD);
  return { main, wt, git, age, roots: path.join(tmp, 'wts') };
}

function inventory(roots: string) {
  const r = spawnSync('bash', [path.join(DIR, 'scripts', 'inventory.sh')], {
    env: { ...process.env, WT_ROOTS: roots, DAYS: '7' }, encoding: 'utf8',
  });
  expect(r.status, r.stderr).toBe(0);
  return r.stdout.trim().split('\n').slice(1).map((l) => l.split('\t'));
}

describe('worktree scripts', () => {
  it('ignores a freshly touched worktree root when its work is old', () => {
    const { wt, age, roots } = gitFixture();
    fs.writeFileSync(path.join(wt, 'app.txt'), 'v2\n');
    age(path.join(wt, 'app.txt'));
    // Any tool writing at the root bumps its mtime; that is not activity in the worktree.
    fs.utimesSync(wt, new Date(), new Date());
    const [row] = inventory(roots);
    expect(row[0], row.join(' | ')).toBe('DECIDE');
    expect(row[4]).toMatch(/uncommitted=1/);
  });

  it('still treats a recently edited file as RECENT', () => {
    const { wt, roots } = gitFixture();
    fs.writeFileSync(path.join(wt, 'app.txt'), 'v2\n');
    expect(inventory(roots)[0][0]).toBe('RECENT');
  });

  it('--backup saves uncommitted work, removes the worktree and keeps its branch', () => {
    const { main, wt, git, age } = gitFixture();
    fs.writeFileSync(path.join(wt, 'app.txt'), 'v2\n');
    fs.writeFileSync(path.join(wt, 'notes.md'), 'idea\n');
    fs.writeFileSync(path.join(wt, '.env'), 'TOKEN=1\n');
    fs.writeFileSync(path.join(main, '.gitignore'), '.env\n');
    fs.copyFileSync(path.join(main, '.gitignore'), path.join(wt, '.gitignore'));
    for (const f of ['app.txt', 'notes.md', '.env', '.gitignore']) age(path.join(wt, f));
    age(wt);
    const backup = path.join(tmp, 'backup');
    const r = spawnSync('bash', [path.join(DIR, 'scripts', 'remove.sh'), '--backup', backup], { input: wt + '\n', encoding: 'utf8' });
    expect(r.status, r.stderr).toBe(0);
    expect(r.stdout).toMatch(/removed .*feature \(backed up to /);
    expect(fs.existsSync(wt)).toBe(false);
    expect(git(main, 'branch', '--list', 'feature')).toMatch(/feature/);
    const files = fs.readdirSync(backup);
    const patch = files.find((f) => f.endsWith('.patch'));
    expect(fs.readFileSync(path.join(backup, patch!), 'utf8')).toMatch(/\+v2/);
    const tgz = files.find((f) => f.endsWith('.files.tgz'));
    const listed = spawnSync('tar', ['-tzf', path.join(backup, tgz!)], { encoding: 'utf8' }).stdout;
    expect(listed).toMatch(/notes\.md/);
    expect(listed).toMatch(/\.env/);
  });

  it('without --backup leaves DECIDE worktrees in place', () => {
    const { wt, age } = gitFixture();
    fs.writeFileSync(path.join(wt, 'app.txt'), 'v2\n');
    age(path.join(wt, 'app.txt'));
    age(wt);
    const r = spawnSync('bash', [path.join(DIR, 'scripts', 'remove.sh')], { input: wt + '\n', encoding: 'utf8' });
    expect(r.stdout).toMatch(/SKIP .*DECIDE/);
    expect(fs.existsSync(wt)).toBe(true);
  });
});

describe('vs-disk-cleanup contract', () => {
  it('limits implied consent to provably safe rows', () => {
    expect(SKILL).toMatch(/counts as consent for `SAFE` rows only/);
    expect(SKILL).toMatch(/counts as consent for `STALE` rows only/);
    expect(SKILL).toMatch(/Never delete `KEEP` rows/);
    expect(SKILL).toMatch(/never empty Trash yourself/);
  });

  it('routes ~/.vs cleanup through vs-artifacts.sh, never a whole-dir delete', () => {
    expect(SKILL).toMatch(/vs-artifacts\.sh" --remove/);
    const scan = fs.readFileSync(path.join(DIR, 'scripts/disk-report/scan.mts'), 'utf8');
    expect(scan).toMatch(/id: 'vs-artifacts'[\s\S]*?VS_ARTIFACTS\)\} --remove/);
  });

  it('offers the stale parts of package caches and Codex leftovers, not whole caches', () => {
    const scan = fs.readFileSync(path.join(DIR, 'scripts/disk-report/scan.mts'), 'utf8');
    expect(scan).toMatch(/active && !it\.prune \? 'active'/);
    for (const id of ['pnpm-store', 'uv-cache', 'npx-stale', 'yarn-stale-zips', 'gradle-stale-versions', 'codex-leftovers']) {
      expect(scan, id).toMatch(new RegExp(`id: '${id}', prune: true`));
    }
    expect(scan).toMatch(/realpathSync\.native/);
    expect(SKILL).toMatch(/Prune items, offered even while active/);
    expect(SKILL).toMatch(/remove\.sh" --backup <dir>/);
  });

  it('ships no machine-specific paths', () => {
    const files = ['scan.mts', 'cleanup.mts', 'cleanup-script.mjs', 'template.html']
      .map((f) => path.join(DIR, 'scripts/disk-report', f));
    for (const f of files) {
      expect(fs.readFileSync(f, 'utf8'), path.basename(f)).not.toMatch(/\.agents\/skills|worktree-cleanup|my-wix-repos|vbrain|reportan|kyber/);
    }
  });
});
