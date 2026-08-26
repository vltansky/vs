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
  it('confirms a current-head failure before announcing log inspection', () => {
    expect(SKILL).toMatch(/user's belief that the PR is red[\s\S]{0,120}not a failure event/i);
    expect(SKILL).toMatch(/confirm[\s\S]{0,80}exact current head[\s\S]{0,80}failing\s+check/i);
    expect(SKILL).toMatch(/Only then say[\s\S]{0,100}open the failed check logs/i);
  });

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

  it('keeps CI repair separate from unnecessary status comments', () => {
    expect(SKILL).toMatch(/standalone CI-status comment is unnecessary/);
    expect(SKILL).toMatch(/replies tied to accepted review feedback use address-mode authority/);
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
    expect(SKILL).toMatch(/address request carries standing repair authority/i);
    expect(SKILL).toMatch(/additional\s+bounded batches/i);
  });

  it('does not duplicate the baby-sit monitoring loop', () => {
    expect(SKILL).toMatch(/does not duplicate that skill's CI or review loop/i);
    expect(SKILL).toMatch(/new feedback belongs\s+only to `vs-baby-sit`/i);
    expect(SKILL).toMatch(/Do not ask the user to invoke either\s+skill again/i);
  });

  it('keeps inspect-only requests read-only and finite', () => {
    expect(SKILL).toMatch(/Inspect-only mode stops after its report and does not start `vs-baby-sit`/i);
  });
});
