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
