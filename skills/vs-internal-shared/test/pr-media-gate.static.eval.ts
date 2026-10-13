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
// Every ship-it body ends with a collapsed Walkthrough of logic pseudocode.
const WALKTHROUGH =
  '\n<details><summary>Walkthrough: 1 area, 1 file</summary>\n\n' +
  '### 🟢 Toggle · low risk\n```diff\n- toggle shows light theme\n+ toggle shows dark theme\n```\n' +
  '[toggle](https://github.com/o/r/blob/__HEAD__/toggle)\n\n</details>\n';
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

// Like repoWithChanges, but the first commit after the merge-base has `subject`.
function repoWithBranchFirst(subject: string) {
  const dir = repoWithChanges(['src/server/auth.ts']);
  git(dir, 'commit', '-q', '--amend', '-m', subject);
  fs.appendFileSync(path.join(dir, 'src/server/auth.ts'), 'more\n');
  git(dir, 'commit', '-qam', 'feat: follow-up');
  return dir;
}

// Bodies written for other duties get the Walkthrough appended as their last section, the
// way ship-it writes it; the Walkthrough cases below call rawGate to control it exactly.
function gate(cwd: string, body: string, ...flags: string[]) {
  return rawGate(cwd, /Walkthrough/.test(body) ? body : body + WALKTHROUGH, ...flags);
}

// Bodies written for other duties get the two-line TL;DR prepended, the way they get the
// Walkthrough appended. bareGate runs a body exactly as written (TL;DR tests).
const TLDR = '**TL;DR**\nReviewers of an auth PR get a clear before and after.\nThe gate passes when the proof is present.\n\n';
const withTldr = (body: string) => (/^\s*\*\*TL;DR\*\*/.test(body) ? body : TLDR + body);
function rawGate(cwd: string, body: string, ...flags: string[]) {
  return bareGate(cwd, withTldr(body), ...flags);
}

function bareGate(cwd: string, body: string, ...flags: string[]) {
  const bodyPath = path.join(cwd, 'pr-body.md');
  // Walkthrough links pin the exact head; fixtures write __HEAD__ and get the repo's real SHA.
  fs.writeFileSync(bodyPath, body.replaceAll('__HEAD__', git(cwd, 'rev-parse', 'HEAD')));
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

  it('does not count a merge-risk badge as proof: it shows the risk, not the change', () => {
    const cwd = repoWithBranch(['src/components/Toggle.tsx']);
    const badge =
      '<img alt="Two-way door: easy to revert" src="https://raw.githubusercontent.com/vltansky/vs/master/skills/vs-ship-it/assets/badge-two-way-door.svg">';
    const result = gate(cwd, `${BEFORE_AFTER}\n${badge}\n`);

    expect(result.status).toBe(1);
    expect(result.json).toMatchObject({ valid: false, images: 0 });
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
      `**Before** 401 on refresh\n\n**After** 200 on refresh\n\n${MERGE_DANGER}` +
        '\n## Tests\n\n- `Toggle.test.tsx` — proves the toggle keeps its state\n- **Not covered:** none\n',
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
      '**Before** 401\n\n**After** 200\n\n### Door\n\nTwo-way.\n\n### Blast radius\n\nOne route.\n' + WALKTHROUGH,
    );

    expect(result.status).toBe(0);
    expect(result.json.mergeDanger).toEqual({ door: true, blastRadius: true });
  });

  it('accepts the merge-risk badges themselves as the labels', () => {
    const cwd = repoWithBranch(['src/server/auth.ts']);
    const badge = (file: string) =>
      `<img alt="${file}" src="https://raw.githubusercontent.com/vltansky/vs/master/skills/vs-ship-it/assets/${file}">`;
    const result = gate(
      cwd,
      `**Before** 401\n\n**After** 200\n\n## Merge risk\n\n${badge('badge-one-way-door.svg')}\n\nThe token table is migrated.\n\n${badge('badge-narrow-blast.svg')}\n\nOne route.\n${WALKTHROUGH}`,
    );

    expect(result.status).toBe(0);
    expect(result.json.mergeDanger).toEqual({ door: true, blastRadius: true });
  });
});

describe('record-flow paces video for a human viewer', () => {
  // A recording that plays each step in under a second shows effects nobody can follow:
  // the caption must be readable before the action, the pointer must visibly travel, and
  // the result must stay on screen long enough to register.
  it('holds each caption long enough to read, then shows the pointer travel and the result', async () => {
    const { stepPacing } = await import('../scripts/record-pacing.mjs');
    const click = stepPacing({ caption: 'Click Turn off comments', click: '#off' }, { video: true });

    expect(click.leadMs).toBeGreaterThanOrEqual(1200);
    expect(click.travelMs).toBeGreaterThanOrEqual(500);
    expect(click.resultMs).toBeGreaterThanOrEqual(1200);
  });

  it('gives longer captions more reading time, capped so one step never stalls the clip', async () => {
    const { captionHoldMs } = await import('../scripts/record-pacing.mjs');
    const short = captionHoldMs('Open menu');
    const long = captionHoldMs(
      'The manager confirms the dialog and every viewer reloads without the comments button',
    );

    expect(long).toBeGreaterThan(short);
    expect(long).toBeLessThanOrEqual(4000);
  });

  it('keeps stills-only runs fast: nobody watches a --no-video capture', async () => {
    const { stepPacing } = await import('../scripts/record-pacing.mjs');
    const click = stepPacing({ caption: 'Click Turn off comments', click: '#off' }, { video: false });

    expect(click.leadMs + click.travelMs + click.resultMs).toBeLessThan(600);
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

// A backend PR proves itself the way a frontend one does: the reviewer sees the contract
// move. An endpoint change shows one request and both responses; a schema change shows the
// shape before and after. Prose like "the response now includes X" is an assertion, not proof.
const ENDPOINT_PROOF =
  '**Endpoint** `POST /v1/tokens/refresh`\n\n```diff\n {\n-  "token": "a"\n+  "token": "a",\n+  "expiresAt": 1\n }\n```\n';
const SCHEMA_PROOF =
  '**Schema** `tokens`\n\n```diff\n CREATE TABLE tokens (\n   id text,\n+  expires_at timestamptz\n );\n```\n';

describe('pr-media-gate requires contract proof for backend changes', () => {
  it('fails an endpoint change whose body has no request/response comparison', () => {
    const cwd = repoWithBranch(['src/api/tokens.ts']);
    const result = gate(cwd, BEFORE_AFTER);

    expect(result.status).toBe(1);
    expect(result.json).toMatchObject({
      valid: false,
      apiFiles: ['src/api/tokens.ts'],
      contract: { endpoint: false },
    });
    expect(result.stderr).toMatch(/\*\*Endpoint\*\*/);
    expect(result.stderr).toMatch(/same request/);
  });

  it('passes an endpoint change that shows the response diff for one request', () => {
    const cwd = repoWithBranch(['src/controllers/tokens.controller.ts']);
    const result = gate(cwd, `${BEFORE_AFTER}\n${ENDPOINT_PROOF}`);

    expect(result.status).toBe(0);
    expect(result.json.contract).toEqual({ endpoint: true, schema: true });
  });

  it('does not accept the Endpoint label without a code block under it', () => {
    const cwd = repoWithBranch(['src/api/tokens.ts']);
    const result = gate(cwd, `${BEFORE_AFTER}\n**Endpoint** POST /v1/tokens now returns expiresAt.\n`);

    expect(result.status).toBe(1);
    expect(result.json.contract.endpoint).toBe(false);
  });

  it('fails a schema change whose body has no before/after shape', () => {
    const cwd = repoWithBranch(['db/migrations/0042_add_expiry.sql']);
    const result = gate(cwd, BEFORE_AFTER);

    expect(result.status).toBe(1);
    expect(result.json).toMatchObject({
      schemaFiles: ['db/migrations/0042_add_expiry.sql'],
      contract: { schema: false },
    });
    expect(result.stderr).toMatch(/\*\*Schema\*\*/);
  });

  it('recognizes common schema sources', () => {
    const files = [
      'prisma/schema.prisma',
      'proto/tokens.proto',
      'api/openapi.yaml',
      'src/graphql/schema.graphql',
      'src/db/schema.ts',
    ];
    const cwd = repoWithBranch(files);
    const result = gate(cwd, `${BEFORE_AFTER}\n${SCHEMA_PROOF}`);

    expect(result.json.schemaFiles).toEqual(expect.arrayContaining(files));
    expect(result.json.contract.schema).toBe(true);
  });

  it('accepts an honest per-kind gap, but a frontend gap does not excuse the contract', () => {
    const cwd = repoWithBranch(['src/api/tokens.ts', 'db/migrations/0042.sql']);
    const stated = gate(
      cwd,
      `${BEFORE_AFTER}\nNo contract change: handler refactor, same responses.\n\nNo schema change: the migration only adds an index.\n`,
    );
    expect(stated.status).toBe(0);

    const unrelated = gate(cwd, `${BEFORE_AFTER}\n**Still unverified:** visual proof; no browser.\n`);
    expect(unrelated.status).toBe(1);
  });

  it('does not treat UI files or plain server code as an endpoint change', () => {
    const cwd = repoWithBranch(['src/api/TokenBadge.tsx', 'src/server/auth.ts']);
    const result = gate(cwd, `${BEFORE_AFTER}\n**Still unverified:** visual proof; no browser.\n`);

    expect(result.json.apiFiles).toEqual([]);
    expect(result.json.schemaFiles).toEqual([]);
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

  it('names the backend proof shapes and the prototype-sharing skills', () => {
    expect(SHIP_IT).toMatch(/\*\*Endpoint\*\*[^\n]*same\s+request/);
    expect(SHIP_IT).toMatch(/\*\*Schema\*\*[^\n]*`diff`/);
    expect(SHIP_IT).toMatch(/No contract change: <why>/);
    expect(SHIP_IT).toMatch(/No schema change: <why>/);
    expect(SHIP_IT).toMatch(/`using-wix-stash`/);
    expect(SHIP_IT).toMatch(/Claude\s+Artifact/);
    expect(SHIP_IT).toMatch(/- \[ \] Endpoint and schema changes/);
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

// Surfaces proof selectors: claim↔path asserts. Door/blast stay risk art; Surfaces
// name what the reviewer must prove, never new merge-risk SVGs.
const SURFACES = (line: string) => `## Surfaces\n\n${line}\n`;
const BODY_WITH = (surfaces: string, extra = '') =>
  `**Before** x\n\n**After** y\n\n${MERGE_DANGER}\n${SURFACES(surfaces)}${extra}`;

describe('pr-media-gate Surfaces claim↔path asserts', () => {
  it('fails migration-only when the body stamps UI', () => {
    const cwd = repoWithBranch(['db/migrations/0042_add_expiry.sql']);
    const result = gate(cwd, `${BODY_WITH('UI')}\n${SCHEMA_PROOF}`);

    expect(result.status).toBe(1);
    expect(result.stderr).toMatch(/migration-only|UI/i);
    expect(result.json.surfaces?.ok).toBe(false);
  });

  it('fails MCP-wrap-only when the body stamps Endpoint', () => {
    const cwd = repoWithBranch(['mcp/tools/tokens.ts', 'src/mcp/server.ts']);
    const result = gate(cwd, BODY_WITH('MCP · Endpoint'));

    expect(result.status).toBe(1);
    expect(result.stderr).toMatch(/MCP-wrap|Endpoint/i);
    expect(result.json.surfaces?.ok).toBe(false);
  });

  it('fails when Infra is stacked with a product surface', () => {
    const cwd = repoWithBranch([
      '.github/workflows/ci.yml',
      'src/components/Toggle.tsx',
    ]);
    const result = gate(
      cwd,
      `${BODY_WITH('Infra · UI')}\n**Still unverified:** visual proof; no browser.\n`,
    );

    expect(result.status).toBe(1);
    expect(result.stderr).toMatch(/Infra/i);
    expect(result.json.surfaces?.ok).toBe(false);
  });

  it('fails when the body stamps backend or DB as a surface name', () => {
    const cwd = repoWithBranch(['src/api/tokens.ts']);
    const backend = gate(cwd, `${BODY_WITH('backend')}\n${ENDPOINT_PROOF}`);
    expect(backend.status).toBe(1);
    expect(backend.stderr).toMatch(/backend|DB/i);

    const db = gate(cwd, `${BODY_WITH('DB · Endpoint')}\n${ENDPOINT_PROOF}`);
    expect(db.status).toBe(1);
    expect(db.stderr).toMatch(/backend|DB/i);
  });

  it('fails >3 product surfaces without matching path classes', () => {
    // Only UI + Endpoint paths; body stamps four product surfaces.
    const cwd = repoWithBranch([
      'src/components/Toggle.tsx',
      'src/api/tokens.ts',
    ]);
    const result = gate(
      cwd,
      `${BODY_WITH('UI · Endpoint · Schema · CLI')}\n${ENDPOINT_PROOF}\n**Still unverified:** visual proof; no browser.\n`,
    );

    expect(result.status).toBe(1);
    expect(result.stderr).toMatch(/>3|more than 3|without matching/i);
    expect(result.json.surfaces?.ok).toBe(false);
  });


  it('fails skill-only paths when the body stamps a product Surface', () => {
    // Skill / docs / gate / manifest only — no UI|Endpoint|Schema|CLI|MCP|Infra path class.
    const cwd = repoWithBranch([
      'skills/vs-ship-it/SKILL.md',
      'skills/vs-ship-it/test/ship-it.static.eval.ts',
      'package.json',
    ]);
    const result = gate(cwd, BODY_WITH('Schema'));

    expect(result.status).toBe(1);
    expect(result.json.surfaces?.ok).toBe(false);
    expect(result.json.surfaces?.claimed).toEqual(['Schema']);
    expect(result.stderr).toMatch(/unmatched|skill-only|Schema/i);
  });

  it('passes skill-only paths when Surfaces is omitted', () => {
    const cwd = repoWithBranch([
      'skills/vs-ship-it/SKILL.md',
      'skills/vs-internal-shared/scripts/pr-media-gate.mjs',
    ]);
    const result = gate(
      cwd,
      '**Before** x\n\n**After** y\n\n' + MERGE_DANGER,
    );

    expect(result.status).toBe(0);
    expect(result.json.surfaces).toMatchObject({ ok: true, claimed: [] });
  });

  it('passes a matching Surfaces line for the changed path classes', () => {
    const cwd = repoWithBranch(['src/api/tokens.ts', 'db/migrations/0042.sql']);
    const result = gate(cwd, `${BODY_WITH('Endpoint · Schema')}\n${ENDPOINT_PROOF}\n${SCHEMA_PROOF}`);

    expect(result.status).toBe(0);
    expect(result.json.surfaces).toMatchObject({
      ok: true,
      claimed: ['Endpoint', 'Schema'],
    });
  });


  it('passes Surfaces chips + module bullets for matching path classes', () => {
    const cwd = repoWithBranch([
      'src/api/tokens.ts',
      'db/migrations/0042.sql',
      'src/components/Toggle.tsx',
    ]);
    const chips = [
      '<img alt="Surface: Endpoint · 2 modules" src="https://raw.githubusercontent.com/vltansky/vs/master/skills/vs-ship-it/assets/badge-surface-endpoint-2.svg">',
      '<img alt="Surface: Schema · 1 module" src="https://raw.githubusercontent.com/vltansky/vs/master/skills/vs-ship-it/assets/badge-surface-schema-1.svg">',
      '<img alt="Surface: UI · 1 module" src="https://raw.githubusercontent.com/vltansky/vs/master/skills/vs-ship-it/assets/badge-surface-ui-1.svg">',
    ].join(' ');
    const bullets = [
      '- **Token API** (Endpoint) — refresh handler',
      '- **Hosting rewrite** (Endpoint) — /api/tokens',
      '- **tokens table** (Schema) — expiry column',
      '- **Toggle UI** — settings card',
    ].join('\n');
    const surfaces = `${chips}\n\n${bullets}`;
    const result = gate(
      cwd,
      `${BODY_WITH(surfaces)}\n${ENDPOINT_PROOF}\n${SCHEMA_PROOF}\n**Still unverified:** visual proof; no browser.\n`,
    );
    expect(result.status).toBe(0);
    expect(result.json.surfaces).toMatchObject({
      ok: true,
      claimed: expect.arrayContaining(['Endpoint', 'Schema', 'UI']),
    });
    // Surface chips are catalog art, not visual proof media.
    expect(result.json.images).toBe(0);
  });

  it('passes Infra alone on an infra-only PR', () => {
    const cwd = repoWithBranch(['.github/workflows/ci.yml', 'Dockerfile']);
    const result = gate(cwd, BODY_WITH('Infra'));

    expect(result.status).toBe(0);
    expect(result.json.surfaces).toMatchObject({
      ok: true,
      claimed: ['Infra'],
    });
  });
});

// Tests block and no-test flag. The gate reads which test/eval files the diff touched
// and the body text; it runs no tests. Missing Tests block fails; the no-test flag warns.
function repoWithChanges(changed: string[], deleted: string[] = []) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'vs-tests-gate-'));
  git(dir, 'init', '-q', '-b', 'main');
  git(dir, 'config', 'user.email', 'eval@example.com');
  git(dir, 'config', 'user.name', 'eval');
  fs.writeFileSync(path.join(dir, 'README.md'), 'base\n');
  for (const file of deleted) {
    fs.mkdirSync(path.dirname(path.join(dir, file)), { recursive: true });
    fs.writeFileSync(path.join(dir, file), `${file}\n`);
  }
  git(dir, 'add', '.');
  git(dir, 'commit', '-q', '-m', 'base');
  git(dir, 'checkout', '-q', '-b', 'feature');
  for (const file of deleted) fs.rmSync(path.join(dir, file));
  for (const file of changed) {
    fs.mkdirSync(path.dirname(path.join(dir, file)), { recursive: true });
    fs.writeFileSync(path.join(dir, file), `${file}\n`);
  }
  git(dir, 'add', '-A');
  git(dir, 'commit', '-q', '-m', 'change');
  return dir;
}

const BASE_BODY = `**Before** 401 on refresh\n\n**After** 200 on refresh\n\n${MERGE_DANGER}`;
const TESTS_BLOCK =
  '\n## Tests\n\n- `auth.test.ts` — proves an expired token refreshes once\n- **Not covered:** none\n';
const FLAG = '\n## Review focus\n\n- **No tests changed:** token refresh retry\n';

describe('pr-media-gate Tests block', () => {
  it('fails when a test file changed and the body has no ## Tests block', () => {
    const cwd = repoWithChanges(['src/server/auth.ts', 'src/server/auth.test.ts']);
    const result = gate(cwd, BASE_BODY);

    expect(result.status).toBe(1);
    expect(result.json.valid).toBe(false);
    expect(result.json.tests).toMatchObject({ files: ['src/server/auth.test.ts'], section: false });
    expect(result.stderr).toMatch(/## Tests/);
    expect(result.stderr).toMatch(/Do not run tests to fill it/);
  });

  it('passes with one behavior line per test and a Not covered line', () => {
    const cwd = repoWithChanges(['src/server/auth.ts', 'src/server/auth.test.ts']);
    const result = gate(cwd, `${BASE_BODY}${TESTS_BLOCK}`);

    expect(result.status).toBe(0);
    expect(result.json.tests).toMatchObject({ section: true, lines: 1, notCovered: true });
  });

  it('fails a Tests block with no Not covered line, and one with only Not covered', () => {
    const cwd = repoWithChanges(['src/server/auth.ts', 'src/server/auth.test.ts']);
    const noGap = gate(cwd, `${BASE_BODY}\n## Tests\n\n- \`auth.test.ts\` — proves refresh\n`);
    expect(noGap.status).toBe(1);
    expect(noGap.stderr).toMatch(/Not covered/);

    const onlyGap = gate(cwd, `${BASE_BODY}\n## Tests\n\n- **Not covered:** none\n`);
    expect(onlyGap.status).toBe(1);
    expect(onlyGap.stderr).toMatch(/one line per changed test/);
  });

  it('fails an empty Not covered line in every label shape', () => {
    const cwd = repoWithChanges(['src/server/auth.test.ts']);
    for (const empty of [
      '- **Not covered:**',
      '- **Not covered**',
      '- **Not covered:**   ',
      '- **Not covered**:',
      '- __Not covered:__',
      '- Not covered:',
      '- **Not covered:** **',
      '- **Not covered:** —',
    ]) {
      const result = gate(cwd, `${BASE_BODY}\n## Tests\n\n- \`auth.test.ts\` — proves refresh\n${empty}\n`);
      expect(result.status, JSON.stringify(empty)).toBe(1);
      expect(result.json.tests.notCovered, JSON.stringify(empty)).toBe(false);
      expect(result.json.tests.lines, JSON.stringify(empty)).toBe(1);
      expect(result.stderr).toMatch(/Not covered: .*`- \[ \] <check>`|checkboxes, not inline text/);
    }
  });

  it('passes Not covered: none, or the label followed by reviewer checkboxes', () => {
    const cwd = repoWithChanges(['src/server/auth.test.ts']);
    for (const ok of [
      '- **Not covered:** none',
      '- Not covered: none',
      '- **Not covered:**\n  - [ ] Log in, wait 15 minutes offline, reconnect: the session refreshes',
      '- **Not covered:**\n  - [ ] Open /settings on Safari\n  - [ ] Revoke a token in the admin panel',
    ]) {
      const result = gate(cwd, `${BASE_BODY}\n## Tests\n\n- \`auth.test.ts\` — proves refresh\n${ok}\n`);
      expect(result.status, JSON.stringify(ok)).toBe(0);
      expect(result.json.tests.notCovered, JSON.stringify(ok)).toBe(true);
      expect(result.json.tests.lines, JSON.stringify(ok)).toBe(1);
    }
  });

  it('fails inline Not covered prose, none with boxes, and empty boxes', () => {
    const cwd = repoWithChanges(['src/server/auth.test.ts']);
    for (const [bad, why] of [
      ['- **Not covered**: refresh after a network timeout', /checkboxes, not inline text/],
      ['- Not covered: refresh after a network timeout', /checkboxes, not inline text/],
      ['- **Not covered:** none\n  - [ ] Open /settings', /`none` with checkboxes/],
      ['- **Not covered:**\n  - [ ] ', /no `- \[ \] <check>` items/],
      ['- **Not covered:**\n  - Open /settings', /no `- \[ \] <check>` items/],
    ] as const) {
      const result = gate(cwd, `${BASE_BODY}\n## Tests\n\n- \`auth.test.ts\` — proves refresh\n${bad}\n`);
      expect(result.status, JSON.stringify(bad)).toBe(1);
      expect(result.stderr, JSON.stringify(bad)).toMatch(why);
    }
  });

  const problem = (extra: string) => `## What Problem This Solves\n\nUser refreshes → token expired → 401.\n${extra}\n${BASE_BODY}`;
  const ROOT = '\nRoot cause: the refresh timer used wall-clock time, so sleep skipped it.\n';

  it('--bugfix requires a real Root cause line under What Problem This Solves', () => {
    const cwd = repoWithChanges(['src/server/auth.ts']);
    const body = problem('');
    expect(gate(cwd, body).status).toBe(0);
    expect(gate(cwd, body, '--bugfix=false').status).toBe(0);
    for (const f of [['--bugfix'], ['--bugfix=true'], ['--bugfix=1'], ['--bugfix', 'true']]) {
      const r = gate(cwd, body, ...f);
      expect(r.status, f.join(' ')).toBe(1);
      expect(r.json.rootCause).toMatchObject({ bugfix: true, source: 'flag', present: false, problem: 'missing' });
      expect(r.stderr).toMatch(/Root cause: <mechanism/);
      expect(gate(cwd, problem(ROOT), ...f).status, f.join(' ')).toBe(0);
    }
    expect(gate(cwd, body + '\n## Notes\n\nRoot cause: the timer used wall-clock time\n', '--bugfix').status).toBe(1);
    expect(gate(cwd, body, '--bugfix=maybe').status).toBe(2);
  });

  it('rejects placeholder, TBD/TODO/unknown/N/A, and short Root cause lines', () => {
    const cwd = repoWithChanges(['src/server/auth.ts']);
    for (const [line, why] of [
      ['**Root cause:**', 'fewer than 4 words'],
      ['Root cause: <mechanism that made the bug happen>', 'a <placeholder>'],
      ['Root cause: TBD after the timer investigation', 'TBD/TODO/unknown/N/A'],
      ['Root cause: TODO find the real cause here', 'TBD/TODO/unknown/N/A'],
      ['Root cause: unknown', 'TBD/TODO/unknown/N/A'],
      ['Root cause: root cause unknown', 'TBD/TODO/unknown/N/A'],
      ['Root cause: Unknown root cause.', 'TBD/TODO/unknown/N/A'],
      ['Root cause: N/A', 'TBD/TODO/unknown/N/A'],
      ['Root cause: timer bug', 'fewer than 4 words'],
    ]) {
      const r = gate(cwd, problem(`\n${line}\n`), '--bugfix');
      expect(r.status, line).toBe(1);
      expect(r.json.rootCause.problem, line).toBe(why);
    }
  });

  it('auto-detects a bugfix from a fix/ branch or a fix: commit; --bugfix=false opts out', () => {
    const branchRepo = repoWithChanges(['src/server/auth.ts']);
    git(branchRepo, 'branch', '-m', 'fix/refresh-timer');
    const r = gate(branchRepo, problem(''));
    expect(r.status).toBe(1);
    expect(r.json.rootCause).toMatchObject({ bugfix: true, source: 'branch fix/refresh-timer' });
    expect(gate(branchRepo, problem(ROOT)).status).toBe(0);
    expect(gate(branchRepo, problem(''), '--bugfix=false').status).toBe(0);
    expect(gate(branchRepo, problem(''), '--bugfix', 'false').status).toBe(0);

    for (const b of ['hotfix/token-expiry', 'vlad/fix-refresh', 'fix-refresh']) {
      const hot = repoWithChanges(['src/server/auth.ts']);
      git(hot, 'branch', '-m', b);
      expect(gate(hot, problem('')).json.rootCause, b).toMatchObject({ bugfix: true, source: `branch ${b}` });
    }
    for (const subject of ['fix: refresh after sleep', 'fix(auth): refresh after sleep', 'fix!: drop stale token']) {
      const commitRepo = repoWithBranchFirst(subject);
      const c = gate(commitRepo, problem(''));
      expect(c.status, subject).toBe(1);
      expect(c.json.rootCause.source, subject).toBe(`first commit "${subject}"`);
    }
    for (const title of ['fix: refresh after sleep', 'fix(auth): stale token']) {
      const t = gate(repoWithChanges(['src/server/auth.ts']), problem(''), '--title', title);
      expect(t.json.rootCause, title).toMatchObject({ bugfix: true, source: `title "${title}"` });
    }
    expect(gate(repoWithChanges(['src/server/auth.ts']), problem(''), '--title=feat: new export').json.rootCause.bugfix).toBe(false);
    const plain = repoWithChanges(['src/server/auth.ts']);
    expect(gate(plain, problem('')).json.rootCause).toMatchObject({ bugfix: false, source: null });
    const prefix = repoWithChanges(['src/server/auth.ts']);
    git(prefix, 'branch', '-m', 'prefix-fixes');
    expect(gate(prefix, problem('')).json.rootCause.bugfix).toBe(false);
  });

  it('a feature PR with later fix: commits (CI repair, lint) is not a bugfix', () => {
    const cwd = repoWithChanges(['src/server/auth.ts']);
    for (const subject of ['fix: resolve CI failure in Validate', 'fix: lint after review']) {
      fs.appendFileSync(path.join(cwd, 'src/server/auth.ts'), `${subject}\n`);
      git(cwd, 'commit', '-qam', subject);
    }
    const r = gate(cwd, problem(''));
    expect(r.status).toBe(0);
    expect(r.json.rootCause).toMatchObject({ bugfix: false, source: null });
  });

  it('a real mechanism that mentions "unknown" passes', () => {
    const r = gate(repoWithChanges(['src/server/auth.ts']), problem('\nRoot cause: parser maps unknown locale to en silently\n'), '--bugfix');
    expect(r.status).toBe(0);
    expect(r.json.rootCause.present).toBe(true);
  });

  it('--bugfix <bool> after a space never eats the body path', () => {
    const cwd = repoWithChanges(['src/server/auth.ts']);
    const bodyPath = path.join(cwd, 'pr-body.md');
    fs.writeFileSync(bodyPath, withTldr(problem('') + WALKTHROUGH).replaceAll('__HEAD__', git(cwd, 'rev-parse', 'HEAD')));
    const run = (...a: string[]) => spawnSync(process.execPath, [GATE, ...a], { cwd, encoding: 'utf8' }).status;
    expect(run('--bugfix', bodyPath, '--base', 'main')).toBe(1);
    expect(run('--bugfix', 'false', bodyPath, '--base', 'main')).toBe(0);
    expect(run('--base', 'main', '--bugfix', 'true', bodyPath)).toBe(1);
  });

  it('fails a ticked Not covered box: the reviewer ticks it', () => {
    const cwd = repoWithChanges(['src/server/auth.test.ts']);
    const r = gate(cwd, `${BASE_BODY}\n## Tests\n\n- \`auth.test.ts\` — proves refresh\n- **Not covered:**\n  - [ ] Open /settings\n  - [x] Revoke a token in the admin panel\n`);
    expect(r.status).toBe(1);
    expect(r.stderr).toMatch(/ticked/);
  });

  it('does not count a Tests block that lives only in an HTML comment', () => {
    const cwd = repoWithChanges(['src/server/auth.test.ts']);
    const result = gate(cwd, `${BASE_BODY}\n## Tests\n\n<!--\n- \`a\` — b\n- **Not covered:** none\n-->\n`);
    expect(result.status).toBe(1);
  });

  it('ignores a ## Tests heading inside a fenced example', () => {
    const cwd = repoWithChanges(['src/server/auth.test.ts']);
    const fenced = '\n```markdown\n## Tests\n- `a` — b\n- **Not covered:** none\n```\n';
    const result = gate(cwd, `${BASE_BODY}${fenced}`);
    expect(result.status).toBe(1);
    expect(result.json.tests.section).toBe(false);

    const both = gate(cwd, `${BASE_BODY}${fenced}${TESTS_BLOCK}`);
    expect(both.status).toBe(0);
    expect(both.json.tests.lines).toBe(1);
  });

  it('requires the block for a deleted test too', () => {
    const cwd = repoWithChanges(['src/server/auth.ts'], ['src/server/auth.test.ts']);
    const result = gate(cwd, BASE_BODY);

    expect(result.status).toBe(1);
    expect(result.json.tests.files).toEqual(['src/server/auth.test.ts']);
  });

  it('recognizes common test and eval file shapes', () => {
    const files = [
      'src/a.test.ts',
      'src/b.spec.jsx',
      'src/__tests__/c.js',
      'tests/d.py',
      'test/e.rb',
      'skills/x/test/f.static.eval.ts',
      'evals/g.yaml',
      'pkg/h_test.go',
      'pkg/test_i.py',
      'spec/j_spec.rb',
    ];
    const cwd = repoWithChanges(files);
    const result = gate(cwd, BASE_BODY);
    expect(result.json.tests.files.sort()).toEqual([...files].sort());
    expect(result.json.tests.behaviorFiles).toEqual([]);
  });

  it('honors a repository convention passed as --tests <regex>', () => {
    const cwd = repoWithChanges(['src/server/auth.ts', 'checks/auth.check.ts']);
    const without = gate(cwd, BASE_BODY);
    expect(without.json.tests.files).toEqual([]);

    const withConvention = gate(cwd, BASE_BODY, '--tests', '^checks/');
    expect(withConvention.json.tests.files).toEqual(['checks/auth.check.ts']);
    expect(withConvention.status).toBe(1);
  });

  it('counts spec files and spec/ dirs only when they hold code', () => {
    const tests = ['src/a.spec.ts', 'spec/models/user_spec.rb', 'spec/support/helper.js'];
    const notTests = ['api.spec.yaml', 'docs/spec/design.md', 'respec/a.ts', 'specs/plan.md', 'src/inspector.ts'];
    const cwd = repoWithChanges([...tests, ...notTests]);
    const result = gate(cwd, BASE_BODY);
    expect(result.json.tests.files.sort()).toEqual([...tests].sort());
  });

  it('exits 2 with a clear message on an invalid --tests regex', () => {
    const cwd = repoWithChanges(['src/server/auth.ts']);
    const result = gate(cwd, BASE_BODY, '--tests', '(unclosed');
    expect(result.status).toBe(2);
    expect(result.stdout).toBe('');
    expect(result.stderr).toMatch(/not checked\. --tests is not a valid regex \(\(unclosed\)/);
  });

  it('exits 2 when --tests has no value, instead of ignoring it', () => {
    const cwd = repoWithChanges(['src/server/auth.ts']);
    const atEnd = gate(cwd, BASE_BODY, '--tests');
    expect(atEnd.status).toBe(2);
    expect(atEnd.stderr).toMatch(/--tests needs a value/);

    const beforeFlag = gate(cwd, BASE_BODY, '--tests', '--frontend', '^$');
    expect(beforeFlag.status).toBe(2);
    expect(beforeFlag.stderr).toMatch(/--tests needs a value/);
  });

  it('never reads a flag value as the body path', () => {
    const cwd = repoWithChanges(['src/server/auth.ts', 'checks/auth.check.ts']);
    const bodyPath = path.join(cwd, 'pr-body.md');
    fs.writeFileSync(bodyPath, withTldr(`${BASE_BODY}${TESTS_BLOCK}${WALKTHROUGH}`).replaceAll('__HEAD__', git(cwd, 'rev-parse', 'HEAD')));
    const result = spawnSync(process.execPath, [GATE, '--tests', '^checks/', bodyPath, '--base', 'main'], {
      cwd,
      encoding: 'utf8',
    });
    expect(result.status).toBe(0);
    expect(JSON.parse(result.stdout).tests.files).toEqual(['checks/auth.check.ts']);
  });

  it('requires the block on a test-only PR, with no no-test warning', () => {
    const cwd = repoWithChanges(['src/server/auth.test.ts']);
    const result = gate(cwd, `${BASE_BODY}${TESTS_BLOCK}`);

    expect(result.status).toBe(0);
    expect(result.json.tests.noTestFlag.needed).toBe(false);
    expect(result.stderr).not.toMatch(/warning/);
  });
});

describe('pr-media-gate no-test flag warns and never blocks', () => {
  it('warns on stderr, still exits 0, when behavior changed with no test and no flag', () => {
    const cwd = repoWithChanges(['src/server/auth.ts']);
    const result = gate(cwd, BASE_BODY);

    expect(result.status).toBe(0);
    expect(result.json.valid).toBe(true);
    expect(result.json.tests.noTestFlag).toEqual({ needed: true, present: false });
    expect(result.json.warnings).toBe(1);
    expect(result.stderr).toMatch(/warning \(does not block\)/);
    expect(result.stderr).toMatch(/No tests changed/);
    expect(result.stderr).toMatch(/Do not run tests/);
  });

  it('stays quiet when Review focus carries the No tests changed bullet', () => {
    const cwd = repoWithChanges(['src/server/auth.ts']);
    const result = gate(cwd, `${BASE_BODY}${FLAG}`);

    expect(result.status).toBe(0);
    expect(result.json.tests.noTestFlag).toEqual({ needed: true, present: true });
    expect(result.stderr).toBe('');
  });

  it('does not accept the flag outside Review focus', () => {
    const cwd = repoWithChanges(['src/server/auth.ts']);
    const result = gate(cwd, `${BASE_BODY}\n## Evidence\n\n- **No tests changed:** token refresh\n`);
    expect(result.json.tests.noTestFlag.present).toBe(false);
    expect(result.stderr).toMatch(/warning/);
  });

  it('treats a skill contract as behavior', () => {
    const cwd = repoWithChanges(['skills/vs-ship-it/SKILL.md']);
    const result = gate(cwd, BASE_BODY);
    expect(result.json.tests.noTestFlag.needed).toBe(true);
  });

  it('treats skill references and CONTEXT.md as behavior, not docs', () => {
    for (const file of ['skills/vs-ship-it/references/body.md', 'skills/vs-x/references/deep/ste.md', 'CONTEXT.md', 'docs/CONTEXT.md']) {
      const cwd = repoWithChanges([file]);
      const result = gate(cwd, BASE_BODY);
      expect(result.json.tests.behaviorFiles, file).toEqual([file]);
      expect(result.json.tests.noTestFlag.needed, file).toBe(true);
      expect(result.stderr, file).toMatch(/warning \(does not block\)/);
    }
  });

  for (const [kind, files] of [
    ['docs-only', ['docs/guide.md', 'README.md', 'adr/x.md']],
    ['copy/styling-only', ['src/theme.css', 'assets/logo.svg']],
    ['config/CI-only', ['.github/workflows/ci.yml', 'tsconfig.json', 'vite.config.ts', '.eslintrc']],
  ] as const) {
    it(`exempts ${kind} PRs`, () => {
      const cwd = repoWithChanges([...files]);
      const result = gate(cwd, BASE_BODY, '--frontend', '^$');
      expect(result.json.tests.behaviorFiles).toEqual([]);
      expect(result.json.tests.noTestFlag.needed).toBe(false);
      expect(result.stderr).not.toMatch(/warning/);
    });
  }
});

describe('pr-media-gate requires a last-section logic Walkthrough', () => {
  const link = '[g](https://github.com/o/r/blob/__HEAD__/g.mjs)';
  const wt = (groups: string, open = '<details><summary>Walkthrough: 2 areas, 3 files</summary>') =>
    `\n${open}\n\n${groups}\n</details>\n`;
  const base = '**Before** a\n\n**After** b\n\n## Merge risk\n\n**Door:** two-way.\n**Blast radius:** one skill.\n';
  const group = (heading: string, line: string) => `### ${heading}\n\`\`\`diff\n${line}\n\`\`\`\n${link}\n\n`;
  const good =
    group('🔴 Gate · high risk', '- if "Not covered" appears → pass\n+ if test files changed:\n+   require ## Tests with ≥1 line') +
    group('🟢 Version · low risk', '  1.19.2 → 1.20.0');
  const run = (body: string, ...flags: string[]) => rawGate(repoWithBranch(['skills/a/SKILL.md']), body, ...flags);
  const oneLine = (line: string) => run(base + wt(group('🔴 Gate · high risk', line)));

  it('passes a grouped pseudocode walkthrough, even on a one-file PR', () => {
    const result = run(base + wt(good));
    expect(result.status).toBe(0);
    expect(result.json.walkthrough.groups).toHaveLength(2);
    expect(result.json.walkthrough.warnings).toBe(0);
  });

  it('fails when the walkthrough is missing or not in <details>', () => {
    expect(run(base).status).toBe(1);
    expect(run(base + '## Walkthrough\n\n' + good).status).toBe(1);
  });

  it('accepts <details open> and a bold <summary>', () => {
    expect(run(base + wt(good, '<details open><summary>Walkthrough: 2 areas, 3 files</summary>')).status).toBe(0);
    expect(run(base + wt(good, '<details><summary><b>Walkthrough: 2 areas, 3 files</b></summary>')).status).toBe(0);
  });

  it('keeps a nested <details> inside a group within the walkthrough', () => {
    const nested = good.replace(link, `${link}\n\n<details><summary>more</summary>\n\nnote\n\n</details>\n`);
    const result = run(base + wt(nested));
    expect(result.status).toBe(0);
    expect(result.json.walkthrough.groups).toHaveLength(2);
  });

  it('ignores <details> and </details> written inside a pseudocode fence', () => {
    const result = run(base + wt(group('🔴 Gate · high risk', '+ require last section = <details> Walkthrough\n+ stop at </details>')));
    expect(result.status).toBe(0);
  });

  it('fails when the walkthrough is not the last section', () => {
    const result = run(base + wt(good) + '\n## Review focus\n\nRead the gate.\n');
    expect(result.status).toBe(1);
    expect(result.stderr).toMatch(/not the last section/);
  });

  it('fails groups out of risk order or without a marker', () => {
    const outOfOrder = group('🟢 Version · low risk', '  1.0 → 1.1') + group('🔴 Gate · high risk', '+ require tests');
    expect(run(base + wt(outOfOrder)).stderr).toMatch(/out of risk order/);
    expect(run(base + wt(group('Gate · high risk', '+ require tests'))).stderr).toMatch(/no 🔴\/🟡\/🟢 risk marker/);
  });

  it('fails a walkthrough with no area group or a group without a diff fence', () => {
    expect(run(base + wt('Nothing here.\n' + link)).stderr).toMatch(/no "### " area group/);
    expect(run(base + wt(`### 🟡 Skill · medium\nprose only\n${link}\n`)).stderr).toMatch(/no ```diff/);
  });

  it.each([
    ['hunk header', '@@ -1,3 +1,4 @@'],
    ['diff file header', 'diff --git a/x.ts b/x.ts'],
    ['index line', 'index 3f2a1b0..9c8d7e6 100644'],
  ])('fails hard on a real %s inside a group diff', (_name, line) => {
    const result = oneLine(line);
    expect(result.status).toBe(1);
    expect(result.stderr).toMatch(/real diff\/hunk headers/);
  });

  it.each([
    '+ self.retries += 1',
    '+ if resp.status_code == 401: raise AuthError(resp)',
    "+ UPDATE users SET plan = 'pro' WHERE id = $1",
    '+ user.plan = computePlan(invoice)',
    '+ err := db.Save(&row)',
  ])('warns, without blocking, on code-shaped line %s', (line) => {
    const result = oneLine(line);
    expect(result.status).toBe(0);
    expect(result.json.walkthrough.warnings).toBe(1);
    expect(result.stderr).toMatch(/warning — Walkthrough group .* looks like real code/);
  });

  it.each([
    '+ return 401 when token missing: no retry',
    '+ export: write CSV to S3 (daily)',
    '+ import rows (CSV) into staging',
    '+ class = premium when spend > 100',
    '+ async: queue the webhook (no wait)',
    '+ if token missing → reject;',
  ])('passes pseudocode line %s', (line) => {
    const result = oneLine(line);
    expect(result.status).toBe(0);
    expect(result.json.walkthrough.warnings).toBe(0);
  });

  it('fails branch-name links, short SHAs, and a SHA that is not the head', () => {
    const swap = (url: string) => run(base + wt(good.replaceAll('https://github.com/o/r/blob/__HEAD__/g.mjs', url)));
    expect(swap('https://github.com/o/r/blob/master/g.mjs').stderr).toMatch(/not pinned to a 40-hex head SHA/);
    expect(swap('https://github.com/o/r/blob/abc1234/g.mjs').stderr).toMatch(/not pinned to a 40-hex head SHA/);
    const stale = swap(`https://github.com/o/r/blob/${'a'.repeat(40)}/g.mjs`);
    expect(stale.status).toBe(1);
    expect(stale.stderr).toMatch(/not the current head/);
  });

  it('checks pins against --head when given', () => {
    const cwd = repoWithBranch(['skills/a/SKILL.md']);
    const result = rawGate(cwd, base + wt(good), '--head', 'main');
    expect(result.status).toBe(1);
    expect(result.stderr).toMatch(/not the current head/);
  });

  it('exits 2 (not checked) when --head cannot be resolved, even with a stale pin', () => {
    const cwd = repoWithBranch(['skills/a/SKILL.md']);
    const baseSha = git(cwd, 'rev-parse', 'main');
    const result = rawGate(cwd, base + wt(good.replaceAll('__HEAD__', baseSha)), '--head', 'nope');
    expect(result.status).toBe(2);
    expect(result.stderr).toMatch(/not checked[\s\S]*cannot resolve head "nope"/);
  });

  it('pin-checks <a href> and bare github blob/tree URLs', () => {
    const stale = `https://github.com/o/r/blob/${'a'.repeat(40)}/g.mjs`;
    const swapLinks = (links: string) =>
      run(base + wt(group('🔴 Gate · high risk', '+ require tests').replace(link, links)));
    expect(swapLinks(`<a href="${stale}">g</a>`).stderr).toMatch(/not the current head/);
    expect(swapLinks(`${link} · ${stale}`).stderr).toMatch(/not the current head/);
    expect(swapLinks(`${link} · https://github.com/o/r/tree/master/skills`).stderr).toMatch(/not pinned/);
    expect(swapLinks('<a href="https://github.com/o/r/blob/__HEAD__/g.mjs">g</a>').status).toBe(0);
  });

  it('fails relative file links and allows issue, PR, external, and other-repo links unpinned', () => {
    const swapLinks = (links: string) =>
      run(base + wt(group('🔴 Gate · high risk', '+ require tests').replace(link, links)));
    expect(swapLinks(`${link} · [g](skills/g.mjs)`).stderr).toMatch(/not pinned/);
    const cwd = repoWithBranch(['skills/a/SKILL.md']);
    git(cwd, 'remote', 'add', 'origin', 'https://github.com/o/r.git');
    const allowed =
      `${link} · [#88](https://github.com/o/r/pull/88) · [issue](https://github.com/o/r/issues/7) · ` +
      '[docs](https://vitest.dev/guide/) · [upstream](https://github.com/other/lib/blob/main/x.ts)';
    const result = rawGate(cwd, base + wt(group('🔴 Gate · high risk', '+ require tests').replace(link, allowed)));
    expect(result.status).toBe(0);
    expect(result.json.walkthrough.repo).toBe('o/r');
    const onlyExternal = rawGate(cwd, base + wt(group('🔴 Gate · high risk', '+ require tests').replace(link, '[docs](https://vitest.dev/)')));
    expect(onlyExternal.stderr).toMatch(/no file links pinned/);
  });

  it('accepts a www.github.com repo link and pin-checks it', () => {
    const cwd = repoWithBranch(['skills/a/SKILL.md']);
    git(cwd, 'remote', 'add', 'origin', 'https://github.com/o/r.git');
    const swap = (url: string) => rawGate(cwd, base + wt(group('🔴 Gate · high risk', '+ require tests').replace(link, `[g](${url})`)));
    expect(swap('https://www.github.com/o/r/blob/__HEAD__/g.mjs').status).toBe(0);
    expect(swap('https://www.github.com/o/r/blob/master/g.mjs').stderr).toMatch(/not pinned/);
    expect(swap(`https://www.github.com/o/r/blob/${'a'.repeat(40)}/g.mjs`).stderr).toMatch(/not the current head/);
  });

  it('parses Tests, Review focus, and Walkthrough in one body without crossing sections', () => {
    const cwd = repoWithChanges(['src/server/auth.ts']);
    const groups =
      group('🔴 Auth · high risk', '+ refresh expired token once') +
      '### 🟢 Notes · low risk\n```diff\n+ - **No tests changed:** fake flag in a group\n```\n' + link + '\n';
    const body = `${BASE_BODY}${TESTS_BLOCK}\n## Review focus\n\nRead auth.ts first.\n${wt(groups)}`;
    const result = rawGate(cwd, body);
    expect(result.status).toBe(0);
    expect(result.json.tests).toMatchObject({ section: true, lines: 1, notCovered: true });
    // The flag text lives only inside the Walkthrough, so Review focus must not see it.
    expect(result.json.tests.noTestFlag).toEqual({ needed: true, present: false });
    expect(result.json.walkthrough.groups).toHaveLength(2);
    expect(result.json.warnings).toBe(1);
    expect(result.stderr).toMatch(/warning \(does not block\)/);

    const withFlag = rawGate(cwd, body.replace('Read auth.ts first.', '- **No tests changed:** token refresh'));
    expect(withFlag.json.tests.noTestFlag.present).toBe(true);
    expect(withFlag.json.warnings).toBe(0);
  });

  it('stops the ## Surfaces parser at <details> and at headings inside it', () => {
    const body = `${base}## Surfaces\n\n- **gate** — checks bodies\n${wt('### 🔴 UI · high risk\n```diff\n+ x\n```\n' + link)}`;
    const result = run(body);
    expect(result.json.surfaces.claimed).toEqual([]);
  });
});

describe('pr-media-gate --template keeps the repo PR template headings', () => {
  const TEMPLATE = '## Description\n\n<!-- what and why -->\n\n## Type of change\n\n- [ ] Bug fix\n\n## Checklist\n\n- [ ] Docs updated\n';
  function withTemplate(cwd: string) {
    const file = path.join(cwd, 'tpl.md');
    fs.writeFileSync(file, TEMPLATE);
    return file;
  }
  const FILLED =
    '## Description\n\nToggle colors.\n\n## Type of change\n\n- [ ] Bug fix\n\n## Checklist\n\n- [ ] Docs updated\n\n';

  it('passes when every template heading survives, with vs sections appended', () => {
    const cwd = repoWithBranch(['docs/notes.md']);
    const result = gate(cwd, `${FILLED}${BEFORE_AFTER}`, '--template', withTemplate(cwd));
    expect(result.status).toBe(0);
    expect(result.json.template).toMatchObject({ headings: 3, missing: [], ok: true });
  });

  it('accepts a vs section between template headings and N/A under one', () => {
    const cwd = repoWithBranch(['docs/notes.md']);
    const body = `## Description\n\n${BEFORE_AFTER}\n## Type of change\n\nN/A\n\n- [ ] Bug fix\n\n## Checklist\n\n- [ ] Docs updated\n`;
    expect(gate(cwd, body, '--template', withTemplate(cwd)).status).toBe(0);
  });

  it('fails when a template section is deleted', () => {
    const cwd = repoWithBranch(['docs/notes.md']);
    const result = gate(cwd, `${FILLED.replace('## Checklist\n\n- [ ] Docs updated\n\n', '')}${BEFORE_AFTER}`, '--template', withTemplate(cwd));
    expect(result.status).toBe(1);
    expect(result.json.template.missing).toEqual(['checklist']);
    expect(result.stderr).toMatch(/Never delete a template section/);
  });

  it('fails when template headings are reordered', () => {
    const cwd = repoWithBranch(['docs/notes.md']);
    const body = `## Checklist\n\n- [ ] Docs updated\n\n## Description\n\nx\n\n## Type of change\n\nN/A\n\n${BEFORE_AFTER}`;
    const result = gate(cwd, body, '--template', withTemplate(cwd));
    expect(result.status).toBe(1);
    expect(result.json.template.missing).toEqual(['checklist (out of template order)']);
  });

  it('ignores headings inside template comments and fences', () => {
    const cwd = repoWithBranch(['docs/notes.md']);
    const file = path.join(cwd, 'tpl.md');
    fs.writeFileSync(file, '## Summary\n\n<!--\n## Hidden\n-->\n```md\n## Example\n```\n');
    expect(gate(cwd, `## Summary\n\nx\n\n${BEFORE_AFTER}`, '--template', file).status).toBe(0);
  });

  it('without --template, extra template headings never fail the gate', () => {
    const cwd = repoWithBranch(['docs/notes.md']);
    expect(gate(cwd, `${FILLED}${BEFORE_AFTER}`).status).toBe(0);
  });

  it('exits 2 on a missing --template file or value', () => {
    const cwd = repoWithBranch(['docs/notes.md']);
    expect(gate(cwd, BEFORE_AFTER, '--template', path.join(cwd, 'nope.md')).status).toBe(2);
    expect(gate(cwd, BEFORE_AFTER, '--template').status).toBe(2);
  });
});

describe('pr-media-gate --template: any heading level, bold labels, checklists', () => {
  const run = (tpl: string, body: string, ...extra: string[]) => {
    const cwd = repoWithBranch(['docs/notes.md']);
    const file = path.join(cwd, 'tpl.md');
    fs.writeFileSync(file, tpl);
    return gate(cwd, `${body}${BEFORE_AFTER}`, '--template', file, ...extra);
  };

  it.each([
    ['###', '### Summary\n\n### Risk\n'],
    ['#', '# Summary\n\n# Risk\n'],
    ['bold label', '**Summary:**\n\n**Risk:**\n'],
  ])('checks %s template sections', (_kind, tpl) => {
    expect(run(tpl, '## Summary\n\nx\n\n## Risk\n\nN/A\n\n').status).toBe(0);
    const dropped = run(tpl, '## Summary\n\nx\n\n');
    expect(dropped.status).toBe(1);
    expect(dropped.json.template.missing).toEqual(['risk']);
  });

  it('a body bold label with content counts for a template section', () => {
    expect(run('## Summary\n\n## Risk\n', '**Summary:** x\n\n**Risk:** N/A\n\n').status).toBe(0);
  });

  it('exits 2 (could not check) on a template with no sections', () => {
    const result = run('Please describe your change.\n\n- [ ] tested\n', '');
    expect(result.status).toBe(2);
    expect(result.stderr).toMatch(/could not check --template/);
  });

  it('ignores a leading emoji or symbol on headings', () => {
    expect(run('## 📝 Summary\n\n## ✅ Risk\n', '## Summary\n\nx\n\n## ⚠️ Risk\n\nN/A\n\n').status).toBe(0);
  });

  it('fails when a template checklist item is dropped; a ticked one still counts', () => {
    const tpl = '## Checklist\n\n- [ ] Docs updated\n- [ ] Tests added\n';
    expect(run(tpl, '## Checklist\n\n- [x] Docs updated\n- [ ] Tests added\n\n').status).toBe(0);
    const dropped = run(tpl, '## Checklist\n\n- [ ] Docs updated\n\n');
    expect(dropped.status).toBe(1);
    expect(dropped.json.template.missingChecks).toEqual(['tests added']);
  });

  it('accepts --template=path and rejects an empty --template=', () => {
    const cwd = repoWithBranch(['docs/notes.md']);
    const file = path.join(cwd, 'tpl.md');
    fs.writeFileSync(file, '## Summary\n');
    expect(gate(cwd, `## Summary\n\nx\n\n${BEFORE_AFTER}`, `--template=${file}`).json.template.ok).toBe(true);
    expect(gate(cwd, `${BEFORE_AFTER}`, `--template=${file}`).status).toBe(1);
    expect(gate(cwd, BEFORE_AFTER, '--template=').status).toBe(2);
  });
});

describe('pr-media-gate --flag=value form for every value flag', () => {
  it.each(['--base', '--frontend', '--api', '--schema', '--tests', '--head', '--template'])('%s=value parses and %s= exits 2', (name) => {
    const cwd = repoWithBranch(['docs/notes.md']);
    expect(gate(cwd, BEFORE_AFTER, `${name}=`).status).toBe(2);
    if (name === '--template') return;
    const value = name === '--base' ? 'main' : name === '--head' ? 'HEAD' : '^nomatch$';
    expect(gate(cwd, BEFORE_AFTER, `${name}=${value}`).status).toBe(0);
  });
  it('--head=nope exits 2', () => {
    const cwd = repoWithBranch(['docs/notes.md']);
    expect(gate(cwd, BEFORE_AFTER, '--head=nope').status).toBe(2);
  });
});

describe('pr-media-gate pins the spec link under What Problem This Solves', () => {
  const body = (ref: string) =>
    `## What Problem This Solves\n\nAgent → x → blocked.\n\nRefs #12 · [Spec](https://github.com/o/r/blob/${ref}/docs/spec.md)\n\n${BEFORE_AFTER}`;
  it('fails a main-branch spec link', () => {
    const cwd = repoWithBranch(['docs/notes.md']);
    const result = gate(cwd, body('main'));
    expect(result.status).toBe(1);
    expect(result.json.problemLinks.ok).toBe(false);
    expect(result.stderr).toMatch(/spec link\) is not pinned/);
  });
  it('fails a spec link pinned to an old SHA', () => {
    const cwd = repoWithBranch(['docs/notes.md']);
    const base = git(cwd, 'rev-parse', 'main');
    expect(gate(cwd, body(base)).status).toBe(1);
  });
  it('passes a spec link pinned to the head; issue links stay unpinned', () => {
    const cwd = repoWithBranch(['docs/notes.md']);
    const result = gate(cwd, body('__HEAD__').replace('Refs #12', 'Refs [#12](https://github.com/o/r/issues/12)'));
    expect(result.status).toBe(0);
    expect(result.json.problemLinks).toEqual({ ok: true, reasons: [] });
  });
});

describe('pr-media-gate requires a two-line TL;DR first', () => {
  const REST = `${BASE_BODY}${WALKTHROUGH}`;
  const L1 = 'Ship-it users get a short summary at the top of each PR.';
  const L2 = 'Reviewers see what the PR does before they read the details.';
  const run = (top: string, ...flags: string[]) => bareGate(repoWithChanges(['src/server/auth.ts']), `${top}${REST}`, ...flags);

  it('passes two plain lines first, with or without a lone **TL;DR** label', () => {
    for (const top of [`**TL;DR**\n${L1}\n${L2}\n\n`, `${L1}\n${L2}\n\n`, `\n\n**TL;DR**\n${L1}\n${L2}\n\n`]) {
      const r = run(top);
      expect(r.status, top).toBe(0);
      expect(r.json.tldr).toMatchObject({ ok: true, lines: 2 });
    }
  });

  it('fails a missing TL;DR or one that is not first', () => {
    for (const body of [REST, `## Merge risk\n\nx\n\n${L1}\n${L2}\n\n${REST}`, `## Summary\n\n${L1}\n${L2}\n\n${REST}`]) {
      const r = bareGate(repoWithChanges(['src/server/auth.ts']), body);
      expect(r.status).toBe(1);
      expect(r.stderr).toMatch(/TL;DR failed/);
      expect(r.json.tldr.ok).toBe(false);
    }
  });

  it('fails a TL;DR placed after the repo template heading', () => {
    const cwd = repoWithChanges(['src/server/auth.ts']);
    const tpl = path.join(cwd, 'tpl.md');
    fs.writeFileSync(tpl, '## Description\n');
    expect(bareGate(cwd, `## Description\n\n${L1}\n${L2}\n\n${REST}`, '--template', tpl).stderr).toMatch(/TL;DR failed[\s\S]*missing/);
    expect(bareGate(cwd, `${L1}\n${L2}\n\n## Description\n\nx\n\n${REST}`, '--template', tpl).status).toBe(0);
  });

  it('fails 1 line and 3+ lines', () => {
    for (const top of [`**TL;DR**\n${L1}\n\n`, `${L1}\n${L2}\nA third line.\n\n`, `**TL;DR**\n${L1}\n${L2}\nA third.\nA fourth.\n\n`]) {
      const r = run(top);
      expect(r.status, top).toBe(1);
      expect(r.stderr).toMatch(/write exactly 2/);
    }
  });

  it('fails links, code, badges, HTML, lists, and long lines', () => {
    for (const [line2, why] of [
      ['See [the spec](https://x.y/spec) for details.', /has a link/],
      ['Runs https://example.com on merge.', /has a link/],
      ['Adds a `--tldr` flag to the gate.', /has code/],
      ['<img alt="Two-way door" src="https://x/badge.svg">', /badge|link/],
      ['Status is <b>green</b> now.', /has HTML/],
      ['- Reviewers see the effect.', /list/],
      ['Docs live at github.com/vltansky/vs/blob/main/x.md now.', /has a link/],
      ['See docs.example.io/tldr for the rule.', /has a link/],
      ['Reviewers see **what** changed first.', /bold or italic/],
      ['Reviewers see _what_ changed first.', /bold or italic/],
      ['Reviewers see *what* changed first.', /bold or italic/],
      ['🚀 ✅', /0 word\(s\); write at least 3/],
      ['Faster reviews.', /2 word\(s\); write at least 3/],
      ['One two three four five six seven eight nine ten eleven twelve thirteen fourteen fifteen sixteen seventeen eighteen nineteen twenty twentyone.', /words/],
    ] as const) {
      const r = run(`${L1}\n${line2}\n\n`);
      expect(r.status, line2).toBe(1);
      expect(r.stderr, line2).toMatch(why);
    }
  });

  it('reports missing, not a line count, when the first block is not a TL;DR candidate', () => {
    for (const first of ['**Before** 401 on refresh', '**Door:** two-way', '## Merge risk', '- a list item', '<img alt="x" src="https://x/b.svg">', '_Note_ about the PR']) {
      const r = bareGate(repoWithChanges(['src/server/auth.ts']), `${first}\n\n${REST}`);
      expect(r.status, first).toBe(1);
      expect(r.json.tldr, first).toMatchObject({ ok: false, lines: 0 });
      expect(r.stderr, first).toMatch(/missing: the body must start/);
      expect(r.stderr, first).not.toMatch(/write exactly 2/);
    }
  });

  it('allows the lone **TL;DR** label and a plain version number', () => {
    expect(run(`**TL;DR**\n${L1}\n${L2}\n\n`).status).toBe(0);
    expect(run(`${L1}\nVersion 1.24.0 ships the rule to everyone.\n\n`).status).toBe(0);
  });

  it('fails a line 1 that only echoes the --title', () => {
    expect(run(`Add a two-line TLDR to ship-it\n${L2}\n\n`, '--title', 'feat(ship-it): add a two-line TLDR to ship-it').stderr).toMatch(/echoes the PR title/);
    expect(run(`${L1}\n${L2}\n\n`, '--title', 'feat(ship-it): add a two-line TLDR to ship-it').status).toBe(0);
  });
});
