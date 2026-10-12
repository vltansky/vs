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
      '**Before** 401\n\n**After** 200\n\n### Door\n\nTwo-way.\n\n### Blast radius\n\nOne route.\n',
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
      `**Before** 401\n\n**After** 200\n\n## Merge risk\n\n${badge('badge-one-way-door.svg')}\n\nThe token table is migrated.\n\n${badge('badge-narrow-blast.svg')}\n\nOne route.\n`,
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
      expect(result.stderr).toMatch(/`none` or a named behavior/);
    }
  });

  it('passes a Not covered line that says none or names a behavior', () => {
    const cwd = repoWithChanges(['src/server/auth.test.ts']);
    for (const ok of [
      '- **Not covered:** none',
      '- **Not covered**: refresh after a network timeout',
      '- Not covered: refresh after a network timeout',
    ]) {
      const result = gate(cwd, `${BASE_BODY}\n## Tests\n\n- \`auth.test.ts\` — proves refresh\n${ok}\n`);
      expect(result.status, JSON.stringify(ok)).toBe(0);
      expect(result.json.tests.notCovered, JSON.stringify(ok)).toBe(true);
    }
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
    fs.writeFileSync(bodyPath, `${BASE_BODY}${TESTS_BLOCK}`);
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
