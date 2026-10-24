import * as fs from 'node:fs';
import * as path from 'node:path';
import { execFileSync } from 'node:child_process';

// The shop repo the diff-first live evals share: main has coupon.js and
// login.js; branch fix/coupon-last-day fixes coupons on their last day AND adds
// a login lockout (5 failed attempts), plus a version bump and a test. The
// prompt (or PR body) names only the coupon fix; the lockout is in the diff only.

export const BASE_FILES: Record<string, string> = {
  'package.json': '{\n  "name": "shop",\n  "version": "1.4.0",\n  "type": "module"\n}\n',
  'src/coupon.js': [
    '// A coupon is valid until its expiry time.',
    'export function isValid(coupon, now = Date.now()) {',
    '  return coupon.active && coupon.expiresAt > now;',
    '}',
    '',
  ].join('\n'),
  'src/login.js': [
    "import { checkPassword } from './passwords.js';",
    '',
    'export function login(user, password) {',
    "  if (!checkPassword(user, password)) return { ok: false, error: 'bad password' };",
    '  return { ok: true };',
    '}',
    '',
  ].join('\n'),
  'src/passwords.js': 'export const checkPassword = (user, pw) => user.password === pw;\n',
};

export const HEAD_FILES: Record<string, string> = {
  'package.json': BASE_FILES['package.json'].replace('1.4.0', '1.5.0'),
  'src/coupon.js': [
    '// A coupon is valid through the end of its expiry day.',
    'export function isValid(coupon, now = Date.now()) {',
    '  const endOfDay = new Date(coupon.expiresAt);',
    '  endOfDay.setHours(23, 59, 59, 999);',
    '  return coupon.active && now <= endOfDay.getTime();',
    '}',
    '',
  ].join('\n'),
  'src/login.js': [
    "import { checkPassword } from './passwords.js';",
    '',
    'const MAX_ATTEMPTS = 5;',
    'const LOCK_MS = 15 * 60 * 1000;',
    'const failures = new Map();',
    '',
    'export function login(user, password, now = Date.now()) {',
    '  const entry = failures.get(user.id) ?? { count: 0, lockedUntil: 0 };',
    "  if (entry.lockedUntil > now) return { ok: false, error: 'locked', retryAt: entry.lockedUntil };",
    '  if (!checkPassword(user, password)) {',
    '    entry.count += 1;',
    '    if (entry.count >= MAX_ATTEMPTS) entry.lockedUntil = now + LOCK_MS;',
    '    failures.set(user.id, entry);',
    "    return { ok: false, error: 'bad password' };",
    '  }',
    '  failures.delete(user.id);',
    '  return { ok: true };',
    '}',
    '',
  ].join('\n'),
  'test/coupon.test.js': "import { test } from 'node:test';\ntest('valid on the last day', () => {});\n",
};

export function writeTree(ws: string, files: Record<string, string>) {
  for (const [rel, text] of Object.entries(files)) {
    fs.mkdirSync(path.dirname(path.join(ws, rel)), { recursive: true });
    fs.writeFileSync(path.join(ws, rel), text);
  }
}

// A repo with main pushed to a local origin and a feature branch one commit ahead.
export function buildRepo(ws: string, ignore: string[] = ['video-work/']) {
  const git = (...a: string[]) => execFileSync('git', a, { cwd: ws, encoding: 'utf8' }).trim();
  const remote = path.join(path.dirname(ws), 'origin.git');
  execFileSync('git', ['init', '-q', '--bare', '-b', 'main', remote]);
  git('init', '-q', '-b', 'main');
  git('config', 'user.name', 'Eval User');
  git('config', 'user.email', 'eval@example.com');
  git('config', 'commit.gpgsign', 'false');
  fs.appendFileSync(path.join(ws, '.git', 'info', 'exclude'), `${['.claude/', '.agents/', '.cursor/', ...ignore].join('\n')}\n`);
  writeTree(ws, BASE_FILES);
  git('add', '-A');
  git('commit', '-qm', 'chore: shop');
  git('remote', 'add', 'origin', remote);
  git('push', '-q', '-u', 'origin', 'main');
  git('checkout', '-qb', 'fix/coupon-last-day');
  writeTree(ws, HEAD_FILES);
  git('add', '-A');
  git('commit', '-qm', 'fix: coupons work on their last day');
  return git('rev-parse', 'HEAD');
}

