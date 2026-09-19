import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { spawnSync } from 'child_process';
import { describe, expect, it } from 'vitest';

// A frontend PR with no picture is the common quiet failure of the shipping
// flow: the code lands, the body reads well, and the reviewer never sees what
// changed. The gate below runs on the body file before `gh pr create` and
// costs no model context: it reads git and the body, never the media.

const ROOT = path.resolve(__dirname, '..', '..', '..');
const SHARED_DIR = path.join(ROOT, 'skills', 'vs-internal-shared');
const GATE = path.join(SHARED_DIR, 'scripts', 'pr-media-gate.mjs');
const RECORD = path.join(SHARED_DIR, 'scripts', 'record-flow.mjs');
const SHIP_IT = fs.readFileSync(
  path.join(ROOT, 'skills', 'vs-ship-it', 'SKILL.md'),
  'utf8',
);
const RECORDING = fs.readFileSync(
  path.join(SHARED_DIR, 'references', 'recording.md'),
  'utf8',
);

const HOSTED_IMAGE =
  '![After: toggle is dark](https://github.com/user-attachments/assets/0f0e1c2a-1111-4c3b-9d8e-abcdefabcdef)';
const HOSTED_VIDEO =
  'https://github.com/user-attachments/assets/1a2b3c4d-2222-4c3b-9d8e-abcdefabcdef';
// Every body the gate should pass carries both sides and its merge danger; media is the
// third, narrower duty.
const MERGE_DANGER =
  '## Merge risk\n\n**Door:** two-way — a revert restores the old styling.\n' +
  '**Blast radius:** the toggle only; no API or schema change.\n';
const BEFORE_AFTER = `**Before** toggle is light\n\n**After** toggle is dark\n\n${MERGE_DANGER}`;

function git(cwd: string, ...args: string[]) {
  const result = spawnSync('git', args, { cwd, encoding: 'utf8' });
  if (result.status !== 0) throw new Error(result.stderr);
  return result.stdout.trim();
}

// A repository with a `main` branch and a feature branch that changed `files`.
function repoWithBranch(files: string[]) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'vs-media-gate-'));
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
  const bodyPath = path.join(cwd, 'pr-body.md');
  fs.writeFileSync(bodyPath, body);
  const result = spawnSync(
    process.execPath,
    [GATE, bodyPath, '--base', 'main', ...flags],
    { cwd, encoding: 'utf8' },
  );
  return { ...result, json: result.stdout ? JSON.parse(result.stdout) : null };
}

describe('pr-media-gate blocks a frontend PR body that shows nothing', () => {
  it('fails when frontend files changed and the body carries no hosted media', () => {
    const cwd = repoWithBranch(['src/components/Toggle.tsx', 'src/toggle.css']);
    const result = gate(cwd, '## What Problem This Solves\n\n**Before** x\n\n**After** y\n');

    expect(result.status).toBe(1);
    expect(result.json).toMatchObject({
      valid: false,
      images: 0,
      videos: 0,
      gapStated: null,
    });
    expect(result.json.frontendFiles).toEqual([
      'src/components/Toggle.tsx',
      'src/toggle.css',
    ]);
    // The failure text says what to do next instead of only what is wrong.
    expect(result.stderr).toMatch(/record-flow\.mjs/);
    expect(result.stderr).toMatch(/Still unverified/);
  });

  it('passes when the body embeds a hosted image or a bare video URL', () => {
    const cwd = repoWithBranch(['src/components/Toggle.tsx']);

    const withImage = gate(cwd, `${BEFORE_AFTER}\n${HOSTED_IMAGE}\n`);
    expect(withImage.status).toBe(0);
    expect(withImage.json).toMatchObject({ valid: true, images: 1, videos: 0 });

    const withVideo = gate(cwd, `${BEFORE_AFTER}\n${HOSTED_VIDEO}\n`);
    expect(withVideo.status).toBe(0);
    expect(withVideo.json).toMatchObject({ valid: true, images: 0, videos: 1 });
  });

  it('does not count a local path as proof: the reviewer cannot open it', () => {
    const cwd = repoWithBranch(['src/components/Toggle.tsx']);
    const result = gate(cwd, `${BEFORE_AFTER}\n![after](/tmp/after.png)\n`);

    expect(result.status).toBe(1);
    expect(result.json).toMatchObject({ valid: false, images: 0 });
    expect(result.stderr).toMatch(/local path/i);
  });

  it('passes an honest stated gap instead of forcing fabricated media', () => {
    const cwd = repoWithBranch(['src/components/Toggle.tsx']);
    const result = gate(
      cwd,
      `${BEFORE_AFTER}\n## Evidence\n\n- **Still unverified:** visual proof; no runnable preview on this machine\n`,
    );

    expect(result.status).toBe(0);
    expect(result.json.valid).toBe(true);
    expect(result.json.gapStated).toMatch(/Still unverified/);
  });

  it('passes a frontend refactor that states observable behavior is unchanged', () => {
    const cwd = repoWithBranch(['src/components/Toggle.tsx']);
    const result = gate(
      cwd,
      `${BEFORE_AFTER}\n## User Impact\n\nNo visual change: the toggle renders the same markup.\n`,
    );

    expect(result.status).toBe(0);
    expect(result.json.gapStated).toMatch(/No visual change/);
  });

  it('stays quiet about media for a branch that touched no frontend path', () => {
    const cwd = repoWithBranch(['src/server/auth.ts', 'src/components/Toggle.test.tsx']);
    const result = gate(
      cwd,
      `**Before** 401 on refresh\n\n**After** 200 on refresh\n\n${MERGE_DANGER}`,
    );

    expect(result.status).toBe(0);
    expect(result.json).toMatchObject({ valid: true, frontendFiles: [] });
  });

  it('reports not-checked rather than pass when git cannot resolve the base', () => {
    const cwd = repoWithBranch(['src/components/Toggle.tsx']);
    const bodyPath = path.join(cwd, 'pr-body.md');
    fs.writeFileSync(bodyPath, 'x\n');
    const result = spawnSync(
      process.execPath,
      [GATE, bodyPath, '--base', 'no-such-branch'],
      { cwd, encoding: 'utf8' },
    );

    expect(result.status).toBe(2);
    expect(result.stderr).toMatch(/not checked/i);
  });
});

// A PR that never says what it was like before is the wider version of the same
// quiet failure: the reviewer reads an assertion instead of a comparison. The
// pair is required on every PR, not only the ones that touch a component.
describe('pr-media-gate requires Before and After on every PR', () => {
  it('fails a backend PR whose body asserts the new behavior with nothing to compare', () => {
    const cwd = repoWithBranch(['src/server/auth.ts']);
    const result = gate(cwd, '## What Problem This Solves\n\nRefresh tokens now rotate.\n');

    expect(result.status).toBe(1);
    expect(result.json).toMatchObject({
      valid: false,
      frontendFiles: [],
      beforeAfter: { before: false, after: false },
    });
    expect(result.stderr).toMatch(/Before and After/);
    // The failure says how to build the pair, not merely that it is missing.
    expect(result.stderr).toMatch(/same actor, input, and precondition/);
  });

  it('names only the side that is missing', () => {
    const cwd = repoWithBranch(['src/server/auth.ts']);
    const result = gate(cwd, '**After** the token rotates on every refresh\n');

    expect(result.status).toBe(1);
    expect(result.json.beforeAfter).toEqual({ before: false, after: true });
    expect(result.stderr).toMatch(/no Before marker/);
  });

  it('does not accept the words inside a prose sentence as the comparison', () => {
    const cwd = repoWithBranch(['src/server/auth.ts']);
    const result = gate(
      cwd,
      'Before this change the token leaked, and after the fix it does not.\n',
    );

    expect(result.status).toBe(1);
    expect(result.json.beforeAfter).toEqual({ before: false, after: false });
  });

  it('accepts a heading pair and a comparison-table header as the labels', () => {
    const cwd = repoWithBranch(['src/server/auth.ts']);

    const headings = gate(
      cwd,
      `## Before\n\n401 on refresh\n\n## After\n\n200 on refresh\n\n${MERGE_DANGER}`,
    );
    expect(headings.status).toBe(0);
    expect(headings.json.beforeAfter).toEqual({ before: true, after: true });

    const table = gate(
      cwd,
      `| | Before | After |\n| --- | --- | --- |\n| refresh latency | 240 ms | 90 ms |\n\n${MERGE_DANGER}`,
    );
    expect(table.status).toBe(0);
    expect(table.json.beforeAfter).toEqual({ before: true, after: true });
  });

  it('reports both duties at once when the body omits the pair and the media', () => {
    const cwd = repoWithBranch(['src/components/Toggle.tsx']);
    const result = gate(cwd, '## What Problem This Solves\n\nThe toggle is dark now.\n');

    expect(result.status).toBe(1);
    expect(result.stderr).toMatch(/Before and After/);
    expect(result.stderr).toMatch(/embeds no hosted media/);
  });
});

// A reviewer's attention is the scarce resource. An unclassified PR reads as safe by
// default, so a migration and a copy tweak get the same skim.
describe('pr-media-gate requires a merge-risk classification', () => {
  it('fails a body that compares both sides but never says how dangerous the merge is', () => {
    const cwd = repoWithBranch(['src/server/auth.ts']);
    const result = gate(cwd, '**Before** 401 on refresh\n\n**After** 200 on refresh\n');

    expect(result.status).toBe(1);
    expect(result.json).toMatchObject({
      valid: false,
      beforeAfter: { before: true, after: true },
      mergeDanger: { door: false, blastRadius: false },
    });
    expect(result.stderr).toMatch(/Door and Blast radius/);
    // The failure teaches the classification instead of only naming the missing line.
    expect(result.stderr).toMatch(/migration, backfill, destructive write/);
  });

  it('names only the missing half of the classification', () => {
    const cwd = repoWithBranch(['src/server/auth.ts']);
    const result = gate(
      cwd,
      '**Before** 401\n\n**After** 200\n\n**Door:** one-way — the token table is migrated.\n',
    );

    expect(result.status).toBe(1);
    expect(result.json.mergeDanger).toEqual({ door: true, blastRadius: false });
    expect(result.stderr).toMatch(/no Blast radius line/);
  });

  it('does not accept the words inside a prose sentence as the classification', () => {
    const cwd = repoWithBranch(['src/server/auth.ts']);
    const result = gate(
      cwd,
      '**Before** 401\n\n**After** 200\n\nThis is a two-way door with a small blast radius.\n',
    );

    expect(result.status).toBe(1);
    expect(result.json.mergeDanger).toEqual({ door: false, blastRadius: false });
  });

  it('accepts headings as the labels', () => {
    const cwd = repoWithBranch(['src/server/auth.ts']);
    const result = gate(
      cwd,
      '**Before** 401\n\n**After** 200\n\n### Door\n\nTwo-way.\n\n### Blast radius\n\nOne route.\n',
    );

    expect(result.status).toBe(0);
    expect(result.json.mergeDanger).toEqual({ door: true, blastRadius: true });
  });
});

describe('record-flow keeps captions as data and pixels on disk', () => {
  it('rejects a flow whose step has no action, still, or caption', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'vs-record-flow-'));
    const flowPath = path.join(dir, 'flow.json');
    fs.writeFileSync(
      flowPath,
      JSON.stringify({ url: 'http://localhost:1', steps: [{ wait: 100 }, { nope: true }] }),
    );
    const result = spawnSync(process.execPath, [RECORD, flowPath, '--out', dir], {
      cwd: dir,
      encoding: 'utf8',
      env: { ...process.env, PLAYWRIGHT_MODULE: '' },
    });

    expect(result.status).toBe(2);
    expect(result.stderr).toMatch(/step 2/);
  });

  it('names the fix when Playwright is not resolvable from the working directory', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'vs-record-flow-'));
    const flowPath = path.join(dir, 'flow.json');
    fs.writeFileSync(
      flowPath,
      JSON.stringify({
        url: 'http://localhost:1',
        steps: [{ caption: 'Initial state', still: '01-initial' }],
      }),
    );
    const result = spawnSync(process.execPath, [RECORD, flowPath, '--out', dir], {
      cwd: dir,
      encoding: 'utf8',
      env: { ...process.env, PLAYWRIGHT_MODULE: '' },
    });

    expect(result.status).toBe(2);
    expect(result.stderr).toMatch(/PLAYWRIGHT_MODULE/);
  });
});

describe('vs-ship-it runs the gate and never reads the pixels', () => {
  const STEP_3 = SHIP_IT.split('### Step 3')[1]?.split('### Step 4')[0] ?? '';

  it('captures frontend proof through record-flow with captions authored as data', () => {
    expect(STEP_3).toMatch(/record-flow\.mjs/);
    expect(STEP_3).toMatch(/caption/i);
    expect(STEP_3).toMatch(/manifest/i);
    expect(STEP_3).toMatch(/Do not (?:Read|read|open|view)\s+(?:the\s+)?(?:captured\s+)?(?:image|screenshot|frame|pixel)/i);
    expect(RECORDING).toMatch(/record-flow\.mjs/);
  });

  it('states the Before/After requirement as unconditional and checks it in the contract', () => {
    expect(SHIP_IT).toMatch(/Every PR description must include \*\*Before\*\* and \*\*After\*\*/);
    expect(SHIP_IT).toMatch(/- \[ \] Every PR has a concrete Before\/After comparison/);
  });

  it('classifies merge risk from the diff and reports it in the handoff', () => {
    expect(SHIP_IT).toContain('## Merge risk');
    expect(SHIP_IT).toMatch(/\*\*Merge risk\*\* is not\s+droppable/);
    expect(SHIP_IT).toMatch(/Classify merge risk from the scoped diff, never from/);
    expect(SHIP_IT).toMatch(/Schema migration, data backfill, destructive write, deletion \| One-way/);
    expect(SHIP_IT).toMatch(/Behavior behind a flag, internal refactor, copy, styling, tests \| Two-way/);
    expect(SHIP_IT).toMatch(/adjacent surfaces the change does \*\*not\*\* touch/);
    expect(SHIP_IT).toMatch(/- Merge risk: <two-way \| one-way> door/);
    expect(SHIP_IT).toMatch(/- \[ \] Every PR classifies merge risk/);
  });

  it('gates the body file on hosted media before gh pr create', () => {
    expect(STEP_3).toMatch(/pr-media-gate\.mjs/);
    expect(STEP_3.indexOf('pr-media-gate.mjs')).toBeGreaterThan(
      STEP_3.indexOf('record-flow.mjs'),
    );
    expect(SHIP_IT.indexOf('pr-media-gate.mjs')).toBeLessThan(
      SHIP_IT.indexOf('gh pr create --title'),
    );
    expect(SHIP_IT).toMatch(/- \[ \] .*pr-media-gate/);
  });
});
