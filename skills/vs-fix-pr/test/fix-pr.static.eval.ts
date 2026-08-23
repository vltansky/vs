import * as fs from 'fs';
import * as path from 'path';
import { describe, expect, it } from 'vitest';

const SKILL = fs.readFileSync(path.resolve(__dirname, '..', 'SKILL.md'), 'utf8');
const WATCHER = path.resolve(
  __dirname,
  '..',
  '..',
  'vs-baby-sit',
  'scripts',
  'watch_pr.py',
);

describe('vs-fix-pr async reviewer waiting', () => {
  it('waits with the shared PR watcher', () => {
    expect(SKILL).toContain('scripts/watch_pr.py');
    expect(SKILL).toMatch(/stays in one process and prints nothing until the state actually changes/);
    expect(SKILL).toMatch(/Exit `10` carries an `attention` event/);
    expect(SKILL).toMatch(/smallest output budget your runtime supports/);
  });

  it('bans busy-wait alternatives', () => {
    expect(SKILL).toMatch(/Do not wait with `gh pr checks \$PR_NUM --watch`/);
    expect(SKILL).toMatch(/a `sleep` poll loop, or a busy-poll on `--json name,state`/);
    expect(SKILL).toMatch(/dominant token cost of a long CI wait/);
  });

  it('points at a watcher that actually ships', () => {
    expect(fs.existsSync(WATCHER)).toBe(true);
  });
});

describe('vs-fix-pr CI ownership', () => {
  it('treats failing CI as address-mode work even without comments', () => {
    expect(SKILL).toMatch(/CI is a first-class input/);
    expect(SKILL).toMatch(/red required check is actionable work even when Step 2 finds no\s+comments/);
    expect(SKILL).toMatch(/Do not stop with "No PR comments to address" while a required check\s+is failing or still running/);
  });

  it('requires diagnosis, repair, and exact-head recheck', () => {
    expect(SKILL).toMatch(/Open the failed check logs/);
    expect(SKILL).toMatch(/Do not classify a failure as external merely because the reported file is not in\s+the diff/);
    expect(SKILL).toMatch(/diagnose, fix or re-run, push if needed, and re-fetch the exact HEAD\s+checks/);
  });

  it('keeps CI repair separate from reply approval', () => {
    expect(SKILL).toMatch(/CI fixes do not require the review-reply approval gate/);
    expect(SKILL).toMatch(/posting a PR\s+comment about the failure still does/);
  });

  it('blocks completion until required checks are green', () => {
    expect(SKILL).toMatch(/Required CI and automated reviewer checks are terminal and green after fixes/);
  });
});

describe('vs-fix-pr babysitting handoff', () => {
  it('hands an addressed PR to baby-sit by default', () => {
    expect(SKILL).toMatch(/hand the updated PR to\s+`vs-baby-sit`/i);
    expect(SKILL).toMatch(/unless the user explicitly says not to watch/i);
    expect(SKILL).toMatch(/visibly separate\s+babysitting phase/i);
  });

  it('does not duplicate the baby-sit monitoring loop', () => {
    expect(SKILL).toMatch(/does not duplicate that skill's CI or review loop/i);
  });

  it('keeps inspect-only requests read-only and finite', () => {
    expect(SKILL).toMatch(/Inspect-only mode stops after its report and does not start `vs-baby-sit`/i);
  });
});
