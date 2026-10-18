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

  it('ships no machine-specific paths', () => {
    const files = ['scan.mts', 'cleanup.mts', 'cleanup-script.mjs', 'template.html']
      .map((f) => path.join(DIR, 'scripts/disk-report', f));
    for (const f of files) {
      expect(fs.readFileSync(f, 'utf8'), path.basename(f)).not.toMatch(/\.agents\/skills|worktree-cleanup|my-wix-repos|vbrain|reportan|kyber/);
    }
  });
});
