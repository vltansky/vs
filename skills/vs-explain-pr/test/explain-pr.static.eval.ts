import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { spawnSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';
import { SHIP_IT_SOURCE } from '../../vs-ship-it/test/ship-it-source';

// Static contract for the PR video explainer: ship-it decides up front whether a
// video is worth asking for, opens the PR exactly as before, and a background
// agent adds the video later by patching one marked block of the body.

const SKILL_DIR = path.resolve(__dirname, '..');
const ROOT = path.resolve(SKILL_DIR, '..', '..');
const flat = (text: string) => text.replace(/\s+/g, ' ');
const SKILL = flat(fs.readFileSync(path.join(SKILL_DIR, 'SKILL.md'), 'utf8'));
const SHIP = SHIP_IT_SOURCE;
const SCRIPTS = path.join(SKILL_DIR, 'scripts');
const LIB = path.join(SCRIPTS, 'pr-video.mjs');
const hasFfmpeg = spawnSync('/bin/sh', ['-c', 'command -v ffmpeg && command -v ffprobe']).status === 0;

const lib = async () => import(LIB);
const section = (text: string, heading: string) => {
  const at = text.indexOf(heading);
  if (at === -1) return '';
  const next = text.slice(at + heading.length).search(/\n## /);
  return next === -1 ? text.slice(at) : text.slice(at, at + heading.length + next);
};

describe('ship-it decides up front whether to offer a video', () => {
  const gate = flat(section(SHIP, '## Video explainer check'));

  it('runs the check at the very start, before any branch or PR work', () => {
    expect(gate).not.toBe('');
    const at = SHIP.indexOf('## Video explainer check');
    expect(at).toBeLessThan(SHIP.indexOf('## Nothing built yet'));
    expect(at).toBeLessThan(SHIP.indexOf('### Step 1: Inspect and prepare the branch'));
    expect(at).toBeLessThan(SHIP.indexOf('gh pr create --title'));
  });

  it('states a concrete rubric: size, type, and user impact', () => {
    expect(gate).toMatch(/git diff --shortstat/);
    expect(gate).toMatch(/Skip silently/);
    expect(gate).toMatch(/docs, skill text, comments, tests, config, or dependency/i);
    expect(gate).toMatch(/typo|rename/i);
    expect(gate).toMatch(/fewer than 150 changed lines/);
    expect(gate).toMatch(/Offer/);
    expect(gate).toMatch(/user-facing flow/i);
    expect(gate).toMatch(/300 or more changed lines/);
    expect(gate).toMatch(/two or more Surfaces/);
  });

  it('asks one yes/no question when warranted and never when not', () => {
    expect(gate).toMatch(/Want a video explainer for this PR\? \(yes\/no\)/);
    expect(gate).toMatch(/Ask it once, before Step 1/);
    expect(gate).toMatch(/do not mention the video/i);
    expect(gate).toMatch(/Direct-push mode never makes a video/);
  });

  it('lets an explicit user word override the classifier without a question', () => {
    expect(gate).toMatch(/with video/);
    expect(gate).toMatch(/no video/);
    expect(gate).toMatch(/overrides the rubric/i);
    expect(gate).toMatch(/Do not ask/);
  });
});

describe('ship-it opens the PR first and adds the video later', () => {
  const late = flat(section(SHIP, '### Step 4b: Start the video explainer'));

  it('starts the video only after the PR is created and verified', () => {
    expect(late).not.toBe('');
    expect(SHIP.indexOf('### Step 4b: Start the video explainer')).toBeGreaterThan(SHIP.indexOf('gh pr create --title'));
    expect(SHIP.indexOf('### Step 4b: Start the video explainer')).toBeGreaterThan(SHIP.indexOf("'.state == \"OPEN\""));
    expect(SHIP.indexOf('### Step 4b: Start the video explainer')).toBeLessThan(SHIP.indexOf('### Step 5: Start babysitting'));
  });

  it('hands one fresh-context background agent the body, manifest, and head SHA, and does not wait', () => {
    expect(late).toMatch(/one fresh-context background agent/);
    expect(late).toMatch(/vs-explain-pr/);
    expect(late).toMatch(/body file/);
    expect(late).toMatch(/manifest/);
    expect(late).toMatch(/head SHA/);
    expect(late).toMatch(/Do not wait for it/);
    expect(late).toMatch(/Start babysitting in the same turn/);
    expect(SHIP).toMatch(/- Video: <rendering in the background \| none>/);
  });

  it('never makes or uploads the video before gh pr create', () => {
    const before = SHIP.slice(0, SHIP.indexOf('gh pr create --title'));
    expect(before).not.toMatch(/vs-explain-pr\/scripts|attach\.mjs/);
    expect(flat(SHIP)).toMatch(/keep the `<!-- vs:video -->` block as it is/);
  });
});

describe('the explain-pr skill', () => {
  it('reuses explain-video scripts in place and adds no TTS or caption engine', () => {
    for (const script of ['preflight.mjs', 'init.mjs', 'narrate.mjs', 'render.mjs', 'check.mjs'])
      expect(SKILL).toContain(`../vs-explain-video/scripts/${script}`);
    for (const file of fs.readdirSync(SCRIPTS)) expect(file).not.toMatch(/narrate|tts|captions|render\.mjs/);
  });

  it('orders the scenes problem, before, change, after, risk', () => {
    expect(SKILL).toMatch(/`problem` → `before` → `change` → `after` → `risk`/);
    expect(SKILL).toMatch(/1-2 beats/);
    expect(SKILL).toMatch(/not from the diff/i);
  });

  it('caps length and size, and says when nobody reviewed it', () => {
    expect(SKILL).toMatch(/75 seconds/);
    expect(SKILL).toMatch(/1280x720/);
    expect(SKILL).toMatch(/10 MB/);
    expect(SKILL).toMatch(/not reviewed by fresh eyes/);
    expect(SKILL).toMatch(/no voice audition/i);
    expect(SKILL).toMatch(/words not checked/);
  });

  it('edits the PR body only through the marked block and REST', () => {
    expect(SKILL).toMatch(/attach\.mjs/);
    expect(SKILL).toMatch(/Never use `gh pr edit`/);
    const attach = fs.readFileSync(path.join(SCRIPTS, 'attach.mjs'), 'utf8');
    expect(attach).toMatch(/'-X', 'PATCH'/);
    expect(attach).not.toMatch(/'pr', 'edit'/);
    expect(attach).toMatch(/pr-media-gate\.mjs/);
  });
});

describe('pr-video.mjs helpers', () => {
  it('exports the caps', async () => {
    const m = await lib();
    expect(m.MAX_SECONDS).toBe(75);
    expect(m.MAX_BYTES).toBe(10 * 1024 * 1024);
    expect(m.ROLES).toEqual(['problem', 'before', 'change', 'after', 'risk']);
  });

  it('inserts the block before the Walkthrough, replaces only the block, and is idempotent', async () => {
    const { upsertVideoBlock, videoBlock, VIDEO_START, VIDEO_END } = await lib();
    const walk = '<details>\n<summary>Walkthrough</summary>\n\nx\n</details>\n';
    const body = `**TL;DR**\na\nb\n\n## Verification\n\n- ok\n\n${walk}`;
    const block = videoBlock({ url: 'https://github.com/user-attachments/assets/v1', sha: 'abc1234def', seconds: 61.2, reviewed: false, wordsChecked: false });
    const once = upsertVideoBlock(body, block);
    expect(once.indexOf(VIDEO_START)).toBeLessThan(once.indexOf('<summary>Walkthrough'));
    expect(once).toContain('made for `abc1234`');
    expect(once).toContain('not reviewed by fresh eyes');
    expect(once).toContain('words not checked');
    expect(once).toMatch(/<summary>Video explainer/);
    expect(upsertVideoBlock(once, block)).toBe(once);
    const edited = once.replace('- ok', '- ok, edited by babysit');
    const next = upsertVideoBlock(edited, videoBlock({ url: 'https://github.com/user-attachments/assets/v2', sha: 'fff0000aaa', seconds: 60, reviewed: true, wordsChecked: true }));
    expect(next).toContain('- ok, edited by babysit');
    expect(next).toContain('assets/v2');
    expect(next).not.toContain('assets/v1');
    expect(next.split(VIDEO_START).length).toBe(2);
    expect(next.split(VIDEO_END).length).toBe(2);
    const noWalk = upsertVideoBlock('**TL;DR**\na\nb\n', block);
    expect(noWalk.trimEnd().endsWith(VIDEO_END)).toBe(true);
  });

  const good = {
    title: 'Review saved reports',
    scenes: [
      { id: 'problem', role: 'problem', beats: ['Inspectors lose the review result when they refresh.'] },
      { id: 'before', role: 'before', still: 'media/before.png', beats: ['Before, the toolbar has no Review action.', 'A toast shows the result once.'] },
      { id: 'change', role: 'change', beats: ['Now Review saves first, then a worker checks the report.'] },
      { id: 'after', role: 'after', clip: 'media/clip.mp4', beats: ['After, the panel keeps the result.', 'Apply fixes the typo and survives a refresh.'] },
      { id: 'risk', role: 'risk', beats: ['Review the save order and the provider boundary first.'] },
    ],
  };

  it('accepts the five roles in order', async () => {
    const { lintScript } = await lib();
    expect(lintScript(good).problems).toEqual([]);
  });

  it('rejects a reordered, long, or media-less script', async () => {
    const { lintScript } = await lib();
    const swapped = { ...good, scenes: [good.scenes[1], good.scenes[0], ...good.scenes.slice(2)] };
    expect(lintScript(swapped).problems.join(' ')).toMatch(/order/);
    const longProblem = { ...good, scenes: [{ ...good.scenes[0], beats: ['One.', 'Two.', 'Three.'] }, ...good.scenes.slice(1)] };
    expect(lintScript(longProblem).problems.join(' ')).toMatch(/problem.*1-2 beats/);
    const words = Array.from({ length: 40 }, () => 'word').join(' ');
    const long = { ...good, scenes: good.scenes.map((s) => ({ ...s, beats: [...s.beats, `${words}.`, `${words}.`] })) };
    expect(lintScript(long).problems.join(' ')).toMatch(/75 s/);
    const bare = { ...good, scenes: good.scenes.map(({ still, clip, ...s }: any) => s) };
    expect(lintScript(bare, { media: ['media/before.png'] }).problems.join(' ')).toMatch(/media/);
  });

  it('splits the size budget so a long video still fits 10 MB', async () => {
    const { videoBitrate } = await lib();
    const kbps = videoBitrate(75);
    expect(kbps * 1000 * 75 / 8 + 128_000 * 75 / 8).toBeLessThan(10 * 1024 * 1024 * 0.95);
    expect(kbps).toBeGreaterThan(400);
  });
});

describe.skipIf(!hasFfmpeg)('finish.mjs on a real file', () => {
  it('splices a clip into its slot and writes a 1280x720 mp4 under 10 MB', () => {
    const work = fs.mkdtempSync(path.join(os.tmpdir(), 'vs-explain-pr-'));
    const raw = path.join(work, 'raw.mp4');
    const clipFile = path.join(work, 'clip.mp4');
    expect(spawnSync('ffmpeg', ['-y', '-v', 'error', '-f', 'lavfi', '-i', 'color=c=black:size=1920x1080:rate=30:duration=6', '-f', 'lavfi', '-i', 'sine=d=6',
      '-pix_fmt', 'yuv420p', '-shortest', raw]).status).toBe(0);
    expect(spawnSync('ffmpeg', ['-y', '-v', 'error', '-f', 'lavfi', '-i', 'color=c=red:size=960x540:rate=8:duration=1.5', '-pix_fmt', 'yuv420p', clipFile]).status).toBe(0);
    fs.writeFileSync(path.join(work, 'clips.json'), JSON.stringify([{ src: clipFile, x: 400, y: 200, w: 960, h: 540, from: 1, to: 5 }]));
    const out = path.join(work, 'final.mp4');
    const run = spawnSync(process.execPath, [path.join(SCRIPTS, 'finish.mjs'), work, raw, '--out', out, '--clips', path.join(work, 'clips.json')], { encoding: 'utf8' });
    expect(run.status, run.stderr + run.stdout).toBe(0);
    const res = JSON.parse(run.stdout);
    expect(res.width).toBe(1280);
    expect(res.height).toBe(720);
    expect(res.bytes).toBeLessThan(10 * 1024 * 1024);
    expect(res.clips[0].rate).toBeLessThan(1);
    const probe = spawnSync('ffmpeg', ['-v', 'error', '-ss', '3', '-i', out, '-frames:v', '1', '-vf', 'crop=10:10:500:250', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-'], { encoding: 'buffer' });
    expect(probe.stdout[0]).toBeGreaterThan(150);
    const outside = spawnSync('ffmpeg', ['-v', 'error', '-ss', '3', '-i', out, '-frames:v', '1', '-vf', 'crop=10:10:20:20', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-'], { encoding: 'buffer' });
    expect(outside.stdout[0]).toBeLessThan(40);
  });

  it('refuses a video over 75 seconds', () => {
    const work = fs.mkdtempSync(path.join(os.tmpdir(), 'vs-explain-pr-'));
    const raw = path.join(work, 'raw.mp4');
    expect(spawnSync('ffmpeg', ['-y', '-v', 'error', '-f', 'lavfi', '-i', 'color=c=black:size=320x180:rate=5:duration=80', '-pix_fmt', 'yuv420p', raw]).status).toBe(0);
    const run = spawnSync(process.execPath, [path.join(SCRIPTS, 'finish.mjs'), work, raw, '--out', path.join(work, 'f.mp4')], { encoding: 'utf8' });
    expect(run.status).toBe(1);
    expect(run.stdout + run.stderr).toMatch(/75/);
  });
});

describe('registration', () => {
  it('is listed in the plugin manifest and the README', () => {
    expect(fs.readFileSync(path.join(ROOT, '.claude-plugin', 'plugin.json'), 'utf8')).toContain('./skills/vs-explain-pr');
    expect(fs.readFileSync(path.join(ROOT, 'README.md'), 'utf8')).toContain('`/vs-explain-pr`');
  });
});

describe('attach.mjs against an offline gh', () => {
  const MOCK = path.join(ROOT, 'skills', 'vs-ship-it', 'test', 'ab', 'mock-gh.mjs');
  const git = (cwd: string, ...a: string[]) => spawnSync('git', a, { cwd, encoding: 'utf8' }).stdout.trim();
  const BODY = '**TL;DR**\nReaders of the notes page get a setup section.\nThey find the install steps faster.\n\n## Review map\n\n**Door:** two-way\n**Blast radius:** docs only\n\n## Change and proof\n\n**Before** the page has no setup steps\n\n**After** the page lists the setup steps\n\n## Verification\n\n- **Not covered:** none\n';

  function setup() {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'vs-attach-'));
    const repo = path.join(dir, 'repo');
    fs.mkdirSync(repo);
    git(repo, 'init', '-q', '-b', 'main');
    git(repo, 'config', 'user.email', 'eval@example.com');
    git(repo, 'config', 'user.name', 'eval');
    fs.writeFileSync(path.join(repo, 'README.md'), 'base\n');
    git(repo, 'add', '.');
    git(repo, 'commit', '-q', '-m', 'base');
    git(repo, 'checkout', '-q', '-b', 'feature');
    fs.mkdirSync(path.join(repo, 'docs'));
    fs.writeFileSync(path.join(repo, 'docs', 'notes.md'), 'setup steps\n');
    git(repo, 'add', '.');
    git(repo, 'commit', '-q', '-m', 'docs: setup steps');
    const sha = git(repo, 'rev-parse', 'HEAD');
    const bin = path.join(dir, 'bin');
    fs.mkdirSync(bin);
    fs.writeFileSync(path.join(bin, 'gh'), `#!/bin/sh\nexec "${process.execPath}" "${MOCK}" "$@"\n`, { mode: 0o755 });
    fs.writeFileSync(path.join(dir, 'state.json'), JSON.stringify({ prs: [{ number: 101, title: 'docs: setup steps', body: BODY, headRefName: 'feature', headRefOid: sha, baseRefName: 'main', isDraft: false, createdAt: 0, headPushedAt: 0 }] }));
    const video = path.join(dir, 'final.mp4');
    fs.writeFileSync(video, Buffer.alloc(2048));
    return { dir, repo, sha, video, env: { ...process.env, PATH: `${bin}:${process.env.PATH}`, MOCK_GH_DIR: dir } };
  }
  const calls = (dir: string) => fs.readFileSync(path.join(dir, 'calls.jsonl'), 'utf8').trim().split('\n').map((l) => JSON.parse(l).args as string[]);
  const attach = (s: ReturnType<typeof setup>, ...extra: string[]) => spawnSync(process.execPath,
    [path.join(SCRIPTS, 'attach.mjs'), '--repo', 'acme/shop', '--pr', '101', '--sha', s.sha, '--video', s.video, '--base', 'main', ...extra],
    { cwd: s.repo, env: s.env, encoding: 'utf8' });

  it('uploads, reads the body, gates, and PATCHes only the marked block over REST', () => {
    const s = setup();
    const r = attach(s, '--words-unchecked');
    expect(r.status, r.stdout + r.stderr).toBe(0);
    expect(JSON.parse(r.stdout).status).toBe('ATTACHED');
    const list = calls(s.dir);
    const upload = list.findIndex((a) => a.some((x) => x.startsWith('https://uploads.github.com/user-attachments/assets?')));
    const patch = list.findIndex((a) => a.includes('PATCH'));
    expect(upload).toBeGreaterThan(-1);
    expect(patch).toBeGreaterThan(upload);
    expect(list.some((a) => a[0] === 'pr' && a[1] === 'edit')).toBe(false);
    const body = JSON.parse(fs.readFileSync(path.join(s.dir, 'state.json'), 'utf8')).prs[0].body as string;
    expect(body.startsWith(BODY.trimEnd())).toBe(true);
    expect(body).toMatch(/<!-- vs:video -->[\s\S]*Video explainer[\s\S]*made for `[0-9a-f]{7}`[\s\S]*words not checked[\s\S]*<!-- \/vs:video -->/);
  });

  it('reads child output from files, because the Codex sandbox drops piped output', () => {
    const src = fs.readFileSync(path.join(SCRIPTS, 'attach.mjs'), 'utf8');
    expect(src).toMatch(/stdio: \['ignore', \.\.\.fds\]/);
    expect(src).not.toMatch(/encoding: 'utf8'[^)]*\)/);
  });

  it('does not patch when the gate refuses the new body', () => {
    const s = setup();
    const state = JSON.parse(fs.readFileSync(path.join(s.dir, 'state.json'), 'utf8'));
    state.prs[0].body = BODY.replace('**Before** the page has no setup steps\n\n', '');
    fs.writeFileSync(path.join(s.dir, 'state.json'), JSON.stringify(state));
    const r = attach(s);
    expect(r.status).toBe(1);
    expect(JSON.parse(r.stdout).status).toBe('GATE_FAILED');
    expect(calls(s.dir).some((a) => a.includes('PATCH'))).toBe(false);
  });
});
