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
  it('heads the handoff UNPROVEN when a named surface produced no evidence', () => {
    expect(BUILD_IT).toMatch(/## Build It — UNPROVEN/);
    expect(BUILD_IT).toMatch(
      /Evidence plan named a surface and no evidence[\s\S]{0,160}was captured/,
    );
    expect(BUILD_IT).toMatch(/Implemented and\s+proven are different claims/);
  });

  it('requires an evidence table and links the run report in the handoff', () => {
    expect(HANDOFF).toContain('### Evidence');
    expect(HANDOFF).toMatch(/\| Claim \| Surface \| Proof \| Status \|/);
    expect(HANDOFF).toMatch(/proven \/ UNPROVEN/);
    expect(HANDOFF).toMatch(/~\/\.vs\/\$PROJECT_ID\/build-it\//);
    expect(BUILD_IT).toMatch(/build-it\/YYYY-MM-DD-<slug>\.html/);
  });

  it('reports progress at phase boundaries without asking anything', () => {
    expect(BUILD_IT).toMatch(/Build-it is autonomous, not silent/);
    expect(BUILD_IT).toMatch(/\[3\/7\] Execute/);
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

describe('ship-it hands the user something to try', () => {
  it('always resolves one of preview URL, running local server, or blocker', () => {
    expect(SHIP_IT).toContain('### Resolve a try-it surface');
    expect(SHIP_IT).toMatch(/Never with none of\s+the three/);
    expect(SHIP_IT).toMatch(/\*\*A deployed preview URL\*\*/);
    expect(SHIP_IT).toMatch(
      /\*\*A local server ship-it starts and deliberately leaves running\.\*\*/,
    );
    expect(SHIP_IT).toMatch(/\*\*The precise blocker\*\*/);
    expect(SHIP_IT).toMatch(/Not "no preview available"/);
  });

  it('opens the QA report and lists what was exercised', () => {
    expect(SHIP_IT).toContain('### Open the QA report');
    expect(SHIP_IT).toMatch(/\| Route \| Action \| Result \| Screenshot \|/);
    expect(SHIP_IT).toMatch(
      /"tested" is a list the user can read rather\s+than a claim/,
    );
    expect(SHIP_IT).toMatch(
      /When QA did not run, replace that table with the blocker/,
    );
    expect(SHIP_IT).toMatch(/Ship-it never re-runs QA/);
  });

  it('emits the handback facts across their applicable zones', () => {
    const block = SHIP_IT.slice(SHIP_IT.indexOf('## Handed back to you'));
    for (const fact of [
      '━━━ **YOU DO**',
      '**try it**',
      '1. ▶',
      '━━━ **DONE**',
      '**shipped**',
      '**tested**',
      '**if it\'s wrong**',
      '━━━ **NOT PROVEN**',
    ]) {
      expect(block, `handback ${fact}`).toContain(fact);
    }
    expect(block).toMatch(/stop: kill <pid>/);
    expect(block).toMatch(
      /▶ \*\*if it's wrong\*\* Run <the one command or revert that undoes it>/i,
    );
    expect(block).toMatch(/exact blocker/);
    expect(block).toMatch(/Omit that list when every check was automated/);
    expect(block).toMatch(
      /Do not repeat a manual check under `NOT PROVEN`/i,
    );
    expect(block).toMatch(/Omit the entire `NOT PROVEN` zone when/i);
    expect(SHIP_IT).toMatch(
      /every required fact across its\s+applicable zones, and every user action sits in `YOU DO`/i,
    );
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
