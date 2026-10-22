import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { SHIP_IT_SOURCE } from './ship-it-source';

const REF = fs.readFileSync(path.resolve(__dirname, '../references/prod-verify.md'), 'utf8');
const WATCHER = path.resolve(__dirname, '../../vs-baby-sit/scripts/watch_pr.py');
const FULL = "Want me to tell you when it's merged and deployed, and check it on production? Reply yes.";
const SHORT = "Want me to tell you when it's merged? Reply yes.";

function replay(snapshots: object[], ...args: string[]) {
  const file = path.join(os.tmpdir(), `prod-verify-${process.pid}-${Math.random()}.jsonl`);
  fs.writeFileSync(file, snapshots.map((s) => JSON.stringify(s)).join('\n') + '\n');
  const result = spawnSync('python3', [WATCHER, '--replay', file, ...args], { encoding: 'utf8' });
  fs.unlinkSync(file);
  return { status: result.status, events: result.stdout.trim().split('\n').filter(Boolean).map((l) => JSON.parse(l)), stderr: result.stderr };
}

const open = { state: 'open', merged: false, headSha: 'abc', mergeable: true, reviewDecision: 'REVIEW_REQUIRED', unresolvedThreads: 0, ciState: 'SUCCESS', failures: [] };
const merged = (deploy: object) => ({ state: 'closed', merged: true, mergeSha: 'm1', deploy });

describe('ship-it production check offer', () => {
  it('puts one non-blocking offer before the closing link', () => {
    const offer = SHIP_IT_SOURCE.split('### Production check offer')[1]?.split('### Closing link')[0] ?? '';
    expect(offer).toMatch(/never blocks or\s+waits/);
    expect(offer).toMatch(/copied word for word \(it ends with `Reply yes.`\)/);
    expect(offer).toMatch(/nothing for a PR with no runtime change/);
    expect(offer).toContain('references/prod-verify.md');
    expect(SHIP_IT_SOURCE).toMatch(/- Production check: <offered \| merge-only offer \| watching \| none>/);
  });

  it('picks the offer from a found deploy signal and never guesses', () => {
    expect(REF).toContain(FULL);
    expect(REF).toContain(SHORT);
    expect(REF).toMatch(/No offer, and no lookup,\*\* when the PR has no runtime change/);
    expect(REF).toMatch(/CI config that touches none of\s+the repo's deploy workflows\. A deploy signal never overrides this/);
    expect(REF).toMatch(/names the\s+deploy signal \(environment or workflow name\), shows the exact watcher command/);
    expect(REF).toMatch(/A change to a listed deploy workflow gets the offer/);
    expect(REF).toMatch(/Never guess a deploy path/);
    expect(REF).toMatch(/watch_pr\.py --repo <owner\/name> --discover-deploy/);
    expect(REF).toMatch(/watcher's own definition/);
  });

  it('reuses the baby-sit watcher and the Step 4b background agent', () => {
    expect(REF).toMatch(/--until deployed/);
    expect(REF).toMatch(/--until merged --passive/);
    expect(REF).toMatch(/never a\s+`sleep` loop/);
    expect(REF).toMatch(/same way as Step 4b/);
    expect(REF).toMatch(/background task in\s+Claude Code/);
    expect(REF).toMatch(/background terminal with notify on exit in Cursor/);
    expect(REF).toMatch(/fresh-context watcher in `vs-baby-sit` for Codex/);
    expect(REF).toMatch(/never merges/);
  });

  it('verifies production read-only from the After proof and reports evidence', () => {
    expect(REF).toMatch(/record-flow\.mjs/);
    expect(REF).toMatch(/only when it is GET or HEAD/);
    expect(REF).not.toMatch(/idempotent/);
    expect(REF).toMatch(/run only a read-only\s+command/);
    expect(REF).not.toMatch(/run the After command/);
    expect(REF).toMatch(/deploy-stalled/);
    expect(REF).toMatch(/Never send a write, payment, or message on production/);
    expect(REF).toMatch(/- Merged: .*\n.*- Deployed: .*\n.*- Production: verified/);
    expect(REF).toMatch(/does not claim the change is live/);
  });
});

describe('watch_pr.py --until deployed', () => {
  it('stays passive through review approval and reports the deploy', () => {
    const r = replay([open, merged({ state: 'pending' }), merged({ state: 'success', source: 'workflow', sha: 'm1' })], '--until', 'deployed');
    expect(r.status).toBe(0);
    expect(r.events.map((e) => e.event)).toEqual(['baseline', 'change', 'terminal']);
    expect(r.events.at(-1).reason).toBe('deployed');
  });

  it('reports a failed deploy and a missing deploy signal', () => {
    expect(replay([merged({ state: 'failure' })], '--until', 'deployed').events[0].reason).toBe('deploy-failed');
    expect(replay([merged({ state: 'timeout' })], '--until', 'deployed').events[0].reason).toBe('no-deploy-signal');
  });

  it('keeps babysitting stops unless --passive', () => {
    expect(replay([open], '--until', 'merged').status).toBe(10);
    const passive = replay([open, { ...open, state: 'closed', merged: true }], '--until', 'merged', '--passive');
    expect(passive.status).toBe(0);
    expect(passive.events.at(-1).reason).toBe('merged');
  });
});
