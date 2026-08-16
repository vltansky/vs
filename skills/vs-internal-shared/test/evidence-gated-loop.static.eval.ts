import * as fs from 'fs';
import * as path from 'path';
import { describe, expect, it } from 'vitest';

const SKILLS = path.resolve(__dirname, '..', '..');
const read = (...segments: string[]) =>
  fs.readFileSync(path.resolve(SKILLS, ...segments), 'utf8');

const SHAPE_IT = read('vs-shape-it', 'SKILL.md');
const BUILD_IT = read('vs-build-it', 'SKILL.md');
const HANDOFF = read('vs-build-it', 'references', 'handoff.md');
const SHIP_IT = read('vs-ship-it', 'SKILL.md');
const COMMUNICATION = read('vs-internal-shared', 'references', 'communication.md');
const PREVIEW = read('vs-internal-shared', 'references', 'preview.md');

describe('shape-it names the evidence before building starts', () => {
  it('carries an Evidence plan line inside the Goal Contract template', () => {
    const contract = SHAPE_IT.slice(
      SHAPE_IT.indexOf('```markdown\n## Goal Contract'),
    ).slice(0, 600);
    expect(contract).toMatch(/- Evidence plan: <surface \+ route or command/);
    expect(contract).toMatch(/OPEN DECISION when no surface exists today/);
  });

  it('treats a missing surface as a strategic decision, not a build detail', () => {
    expect(SHAPE_IT).toMatch(
      /strategic open decision[\s\S]{0,200}closing interaction/i,
    );
    expect(SHAPE_IT).toMatch(/Do not defer it to build-it/);
    expect(SHAPE_IT).toMatch(
      /the Goal Contract names an Evidence plan, or marks it OPEN DECISION/,
    );
  });
});

describe('build-it may not claim an outcome it cannot show', () => {
  it('leads with the missing proof when a named surface produced no evidence', () => {
    expect(BUILD_IT).toMatch(/say in the first sentence that the result is not yet proven/);
    expect(BUILD_IT).toMatch(
      /Evidence plan named a surface and no evidence[\s\S]{0,160}was captured/,
    );
    expect(BUILD_IT).toMatch(/Implemented and\s+proven are different claims/);
  });

  it('keeps claim-to-proof evidence in the report and links it from chat', () => {
    expect(HANDOFF).toMatch(/full audit ledger lives in the report/);
    expect(HANDOFF).toMatch(/claim-to-proof evidence/);
    expect(HANDOFF).toMatch(/claim with\s+no proof is `UNPROVEN`/);
    expect(HANDOFF).toMatch(/~\/\.vs\/\$PROJECT_ID\/build-it\//);
    expect(BUILD_IT).toMatch(/build-it\/YYYY-MM-DD-<slug>\.html/);
  });

  it('reports progress at phase boundaries without asking anything', () => {
    expect(BUILD_IT).toMatch(/Build-it is autonomous, not silent/);
    expect(BUILD_IT).toMatch(/\[3\/7\] The first working slice is committed/);
    expect(BUILD_IT).toMatch(
      /phase start and phase end only — not per file edit/,
    );
  });

  it('refuses to delegate proof back to the user', () => {
    expect(BUILD_IT).toMatch(
      /"No browser path" is not an acceptable QA outcome/,
    );
    expect(BUILD_IT).toMatch(
      /Never ask the user to eyeball, click through, or screenshot the result/,
    );
  });
});

describe('an agent that starts a process owns its lifetime', () => {
  it('records the command, PID, port, and stop command', () => {
    expect(PREVIEW).toMatch(/the exact command/);
    expect(PREVIEW).toMatch(/the PID/);
    expect(PREVIEW).toMatch(/the port and URL/);
    expect(PREVIEW).toMatch(/the worktree it serves/);
    expect(PREVIEW).toMatch(/the stop command/);
  });

  it('prefers a deployed surface and reclaims a stale one before starting', () => {
    const order = ['Deployed preview', 'Already-running local surface', 'Ephemeral preview'];
    let cursor = -1;
    for (const step of order) {
      const next = PREVIEW.indexOf(step);
      expect(next).toBeGreaterThan(cursor);
      cursor = next;
    }
    expect(PREVIEW).toMatch(
      /reclaim a surface left by an\s+interrupted earlier run/,
    );
    expect(PREVIEW).toMatch(/Do not invent one/);
  });

  it('scopes a preview to its worktree instead of a fixed default port', () => {
    expect(PREVIEW).toContain('## One preview per worktree');
    expect(PREVIEW).toMatch(
      /A fixed default\s+port binds the first worktree and collides with every other one/,
    );
    expect(PREVIEW).toMatch(
      /\*\*Prefer the project's own per-worktree mechanism\.\*\*/,
    );
    expect(PREVIEW).toMatch(
      /\*\*Otherwise derive the port from the worktree path\*\*/,
    );
    expect(PREVIEW).toMatch(/git rev-parse --show-toplevel \| cksum/);
    expect(PREVIEW).not.toMatch(/PREVIEW_PORT:-4317/);
  });

  it('refuses to reclaim a listener owned by a different worktree', () => {
    expect(PREVIEW).toMatch(
      /serves different code; attaching to it\s+captures evidence for the wrong branch/,
    );
    expect(PREVIEW).toMatch(/-d cwd/);
    expect(PREVIEW).toMatch(
      /walk to the\s+next free port and start a fresh preview rather than assuming ownership/,
    );
  });

  it('makes build-it stop what it started and ship-it the stated exception', () => {
    expect(PREVIEW).toMatch(/stop every process they start/);
    expect(BUILD_IT).toMatch(
      /Stop every process this run started[\s\S]{0,200}verify the port is free/,
    );
    expect(BUILD_IT).toMatch(/Build-it leaves nothing running/);
    expect(PREVIEW).toMatch(
      /`vs-ship-it`\*\* is the deliberate exception[\s\S]{0,200}leaves it running/,
    );
  });
});

describe('ship-it creates the PR without rebuilding delivery evidence', () => {
  it('prepares available media but does not start preview or QA work', () => {
    expect(SHIP_IT).toContain('### Step 3: Prepare screenshots and video');
    expect(SHIP_IT).toMatch(/Reuse valid existing proof/);
    expect(SHIP_IT).toMatch(/Do not rerun QA or start a browser\/server solely/i);
    expect(SHIP_IT).toMatch(/If no valid media exists, continue without asking/i);
  });

  it('hands back the verified PR and concrete media state', () => {
    expect(SHIP_IT).toContain('## Handoff');
    expect(SHIP_IT).toContain('PR created and verified:');
    expect(SHIP_IT).toMatch(/Review: <reused \| ran with approval \| skipped/);
    expect(SHIP_IT).toMatch(/Media: <N screenshots, N videos attached/);
    expect(SHIP_IT).toMatch(/Do not describe CI, deployment, preview behavior, or production as verified/i);
  });

  it('stops after PR verification unless monitoring was requested', () => {
    expect(SHIP_IT).toMatch(/Return immediately after PR verification unless monitoring was requested/i);
    expect(SHIP_IT).toMatch(/Do not suggest reviewers, watch\s+CI, wait for automated review, start a preview, or run QA by default/i);
    expect(SHIP_IT).toMatch(/explicitly requested continued monitoring/);
  });
});

describe('reports reach the user', () => {
  it('opens artifacts with a platform-appropriate command', () => {
    expect(COMMUNICATION).toMatch(/Darwin\) open/);
    expect(COMMUNICATION).toMatch(/Linux\)\s+xdg-open/);
    expect(COMMUNICATION).toMatch(/MINGW\*\|MSYS\*\|CYGWIN\*\) start/);
    expect(COMMUNICATION).toMatch(/Do not claim the report was shown/);
  });

  it('treats a version bump alone as insufficient to change behavior', () => {
    expect(COMMUNICATION).toMatch(
      /A version bump alone does not update anyone's install/,
    );
    expect(COMMUNICATION).toMatch(/unproven claim until the installed\s+copy is verified/);
    expect(SHIP_IT).toMatch(
      /altered skill or plugin content[\s\S]{0,120}re-install command/,
    );
  });

  it('keeps chat as the index and the artifact as the content', () => {
    expect(COMMUNICATION).toMatch(/Chat is the index\. The artifact is the content\./);
    expect(COMMUNICATION).toMatch(
      /Never paste a wall of markdown that duplicates a file the user can open/,
    );
    expect(COMMUNICATION).toMatch(/Autonomous does not mean silent/);
  });
});
