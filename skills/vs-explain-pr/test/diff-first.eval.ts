import * as fs from 'node:fs';
import * as path from 'node:path';
import { execFileSync } from 'node:child_process';
import { check, evaluate } from '@wix/pathgrade';
import { describe, expect, it } from 'vitest';
import { createAgent } from '../../vs-internal-shared/test/pathgrade-agent';
import { promptOnce } from '../../vs-internal-shared/test/pathgrade-v1';

// Diff first, live: the PR body names one change (coupons work on their last
// day) and leaves out a second one the diff shows (login locks after 5 failed
// attempts). The old skill wrote the beats from the body only, so the lockout
// never reached the video. The skill must start from base...head and cover it.
// Opt-in (each run is a full agent session):
//   EXPLAIN_PR_DIFF_LIVE=1 [EXPLAIN_PR_DIFF_RUNS=3] [EXPLAIN_PR_SKILLS_ROOT=<master checkout>/skills]
//   npx vitest run skills/vs-explain-pr/test/diff-first.eval.ts

const EVAL_AGENT = (process.env.PATHGRADE_AGENT ?? 'codex') as 'claude' | 'codex';
const ROOT = path.resolve(process.env.EXPLAIN_PR_SKILLS_ROOT ?? path.resolve(__dirname, '..', '..'));
const RUNS = Number(process.env.EXPLAIN_PR_DIFF_RUNS ?? 3);

const BASE_FILES: Record<string, string> = {
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

const HEAD_FILES: Record<string, string> = {
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

const BODY = `Coupons now work on their last day.

## What problem

A shopper opens checkout on the day their coupon expires, after the exact
expiry time, and the coupon is rejected. Support gets about 40 tickets a week.

## What was done

- \`isValid\` compares against the end of the expiry day, not the exact time.

## Change and proof

**Before:** \`isValid({ active: true, expiresAt: <today 09:00> }, <today 15:00>)\` → \`false\`
**After:** the same call → \`true\`

## Review map

- Risk: low. Review focus: \`src/coupon.js\` time-zone handling.
- Still unverified: shoppers in other time zones.
`;

function writeTree(ws: string, files: Record<string, string>) {
  for (const [rel, text] of Object.entries(files)) {
    fs.mkdirSync(path.dirname(path.join(ws, rel)), { recursive: true });
    fs.writeFileSync(path.join(ws, rel), text);
  }
}

// A repo with main pushed to a local origin and a feature branch one commit ahead.
function buildRepo(ws: string) {
  const git = (...a: string[]) => execFileSync('git', a, { cwd: ws, encoding: 'utf8' }).trim();
  const remote = path.join(path.dirname(ws), 'origin.git');
  execFileSync('git', ['init', '-q', '--bare', '-b', 'main', remote]);
  git('init', '-q', '-b', 'main');
  git('config', 'user.name', 'Eval User');
  git('config', 'user.email', 'eval@example.com');
  git('config', 'commit.gpgsign', 'false');
  fs.appendFileSync(path.join(ws, '.git', 'info', 'exclude'), '.claude/\n.agents/\n.cursor/\nvideo-work/\npr-body.md\n');
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

// The skill calls its siblings' scripts (../vs-explain-video, ../vs-internal-shared).
function stageSiblings(ws: string) {
  for (const dir of ['.agents/skills', '.claude/skills']) {
    if (!fs.existsSync(path.join(ws, dir, 'vs-explain-pr'))) continue;
    for (const sib of ['vs-explain-video', 'vs-internal-shared', 'vs-write']) {
      fs.cpSync(path.join(ROOT, sib), path.join(ws, dir, sib), { recursive: true, filter: (src) => !/\/(test|node_modules)(\/|$)/.test(src) });
    }
  }
}

const beatsText = (ws: string) => {
  try {
    const script = JSON.parse(fs.readFileSync(path.join(ws, 'video-work', 'script.json'), 'utf8'));
    return (script.scenes ?? []).flatMap((s: { beats?: string[]; title?: string }) => [s.title ?? '', ...(s.beats ?? [])]).join('\n');
  } catch {
    return '';
  }
};

describe.skipIf(!process.env.EXPLAIN_PR_DIFF_LIVE)(`vs-explain-pr starts from the diff (${EVAL_AGENT}, ${ROOT})`, () => {
  for (let run = 1; run <= RUNS; run += 1) {
    it(`covers a change the PR body leaves out #${run}`, async () => {
      const agent = await createAgent({ agent: EVAL_AGENT, timeout: 900, skillDir: path.join(ROOT, 'vs-explain-pr') });
      try {
        const ws = agent.workspace;
        const sha = buildRepo(ws);
        stageSiblings(ws);
        fs.writeFileSync(path.join(ws, 'pr-body.md'), BODY);
        fs.mkdirSync(path.join(ws, 'video-work'), { recursive: true });
        await promptOnce(agent, `Use $vs-explain-pr for PR #42 in acme/shop (this repo, branch fix/coupon-last-day). Head SHA: ${sha}. Base ref: main. The final PR body is pr-body.md. The PR has no screenshots or recordings. Use ./video-work as the work dir. This machine has no voice, ffmpeg, or browser, and gh is offline, so make only the story: write video-work/script.json, run the skill's lint with --no-page until it passes, then stop and list the scenes. Do not narrate, render, or attach.`);
        const result = await evaluate(agent, [
          check('script-written', () => {
            try {
              return JSON.parse(fs.readFileSync(path.join(ws, 'video-work', 'script.json'), 'utf8')).scenes.length === 5;
            } catch {
              return false;
            }
          }),
          check('keeps-the-body-change', () => /coupon/i.test(beatsText(ws))),
          check('covers-the-diff-only-change', () => /lock|failed (?:login|sign.?in|attempt)|attempts?\b/i.test(beatsText(ws))),
        ], { failFast: false, onScorerError: 'zero' });
        fs.appendFileSync('/tmp/explain-pr-diff-first.jsonl', `${JSON.stringify({ root: ROOT, run, score: result.score, workspace: ws })}\n`);
        expect(result.score).toBe(1);
      } finally {
        await agent.dispose();
      }
    }, 1_000_000);
  }
});
