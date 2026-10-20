import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';

// The PR video explainer is narration over the PR, not proof. pr-media-gate must
// not count a video inside the marked block as a Before/After or functional video.

const GATE = path.resolve(__dirname, '..', 'scripts', 'pr-media-gate.mjs');
const git = (cwd: string, ...args: string[]) => execFileSync('git', args, { cwd, encoding: 'utf8' }).trim();

function repo(files: string[]) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'vs-video-gate-'));
  git(dir, 'init', '-q', '-b', 'main');
  git(dir, 'config', 'user.email', 'eval@example.com');
  git(dir, 'config', 'user.name', 'eval');
  fs.writeFileSync(path.join(dir, 'README.md'), 'base\n');
  git(dir, 'add', '.');
  git(dir, 'commit', '-q', '-m', 'base');
  git(dir, 'checkout', '-q', '-b', 'feature');
  for (const file of files) {
    fs.mkdirSync(path.dirname(path.join(dir, file)), { recursive: true });
    fs.writeFileSync(path.join(dir, file), `${file}\n`);
  }
  git(dir, 'add', '.');
  git(dir, 'commit', '-q', '-m', 'change');
  return dir;
}

function gate(cwd: string, body: string, ...flags: string[]) {
  const file = path.join(cwd, 'pr-body.md');
  fs.writeFileSync(file, body);
  const r = spawnSync(process.execPath, [GATE, file, '--base', 'main', '--title', 'feat: checkout retry', ...flags], { cwd, encoding: 'utf8' });
  return { ...r, json: r.stdout ? JSON.parse(r.stdout) : null };
}

const IMAGES = '![Before: spinner](https://github.com/user-attachments/assets/before-image)\n\n![After: inline error](https://github.com/user-attachments/assets/after-image)';
const VIDEOS = 'https://github.com/user-attachments/assets/before-video\n\nhttps://github.com/user-attachments/assets/after-video';
const EXPLAINER = '<!-- vs:video -->\n<details>\n<summary>Video explainer (61 s)</summary>\n\nMade for `abc1234`; not reviewed by fresh eyes.\n\nhttps://github.com/user-attachments/assets/explainer-video\n\n**Before** narrated, **After** narrated\n\n</details>\n<!-- /vs:video -->\n';
const body = (proof: string, extra = '') => `**TL;DR**\nCustomers see an inline error at checkout.\nThey can remove the coupon and retry.\n\n## Review map\n\n**Door:** two-way\n**Blast radius:** checkout only\n\n## Change and proof\n\n**Before** spinner\n\n**After** inline error\n\n${proof}\n\n## Verification\n\n- **Coverage:** checkout test proves retry after removing an expired coupon\n- **Not covered:** none\n\n${extra}`;

describe('pr-media-gate ignores the video explainer block', () => {
  it('does not let the explainer stand in for a functional video', () => {
    const cwd = repo(['src/components/Checkout.tsx', 'src/checkout.test.ts']);
    const withExplainer = gate(cwd, body(`${IMAGES}\nhttps://github.com/user-attachments/assets/after-video`, EXPLAINER), '--functional');
    expect(withExplainer.status).toBe(1);
    expect(withExplainer.json.videos).toBe(1);
    expect(withExplainer.json.explainer).toMatchObject({ present: true, videos: 1, ok: true });
  });

  it('does not take Before/After markers from the explainer', () => {
    const cwd = repo(['docs/notes.md']);
    const noPair = `**TL;DR**\nThe notes page gets a new section today.\nReaders find the setup steps faster.\n\n## Review map\n\n**Door:** two-way\n**Blast radius:** docs only\n\n## Change and proof\n\nNew section.\n\n${EXPLAINER}`;
    const r = gate(cwd, noPair);
    expect(r.json.beforeAfter).toEqual({ before: false, after: false });
  });

  it('ignores a marker quoted in prose, so it cannot swallow Verification', () => {
    const cwd = repo(['src/components/Checkout.tsx', 'src/checkout.test.ts']);
    const quoted = body(IMAGES.replace('**Before**', '**Before**'), EXPLAINER).replace('**After** inline error', '**After** inline error; the video lands in a `<!-- vs:video -->` block');
    const r = gate(cwd, quoted);
    expect(r.json.explainer).toMatchObject({ present: true, videos: 1, ok: true });
    expect(r.json.tests.section).toBe(true);
  });

  it('passes the same body as without the explainer when real proof is there', () => {
    const cwd = repo(['src/components/Checkout.tsx', 'src/checkout.test.ts']);
    const plain = gate(cwd, body(`${IMAGES}\n${VIDEOS}`), '--functional');
    const withExplainer = gate(cwd, body(`${IMAGES}\n${VIDEOS}`, EXPLAINER), '--functional');
    expect(plain.status, plain.stdout).toBe(0);
    expect(withExplainer.status, withExplainer.stdout).toBe(0);
    expect(withExplainer.json.videos).toBe(2);
  });

  it('reports a block that is not collapsed or comes after the Walkthrough', () => {
    const cwd = repo(['src/components/Checkout.tsx', 'src/checkout.test.ts']);
    const open = EXPLAINER.replace('<details>\n<summary>Video explainer (61 s)</summary>\n', '').replace('</details>\n', '');
    const r = gate(cwd, body(`${IMAGES}\n${VIDEOS}`, open), '--functional');
    expect(r.status).toBe(1);
    expect(r.stdout).toMatch(/Video explainer block must be one collapsed <details>/);
  });
});
