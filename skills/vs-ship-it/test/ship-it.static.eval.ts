import * as fs from 'fs';
import * as path from 'path';
import { describe, expect, it } from 'vitest';

const SKILL = fs.readFileSync(path.resolve(__dirname, '..', 'SKILL.md'), 'utf8');

describe('vs-ship-it PR association handshake', () => {
  it('re-resolves complete PR identity after creation', () => {
    expect(SKILL).toContain(
      'gh pr view --json number,url,state,headRefName,headRefOid',
    );
    expect(SKILL).toMatch(/PR_NUM=.*\.number/);
    expect(SKILL).toMatch(/PR_URL=.*\.url/);
    expect(SKILL).toMatch(/REPO=.*gh repo view/);
  });

  it('verifies open state, branch, and HEAD before the turn ends', () => {
    expect(SKILL).toContain('.state == "OPEN"');
    expect(SKILL).toContain('.headRefName == $branch');
    expect(SKILL).toContain('.headRefOid == $head');
    expect(SKILL).toContain('Do not switch branches or end the turn');
  });

  it('uses the verified URL and stops on failed verification', () => {
    expect(SKILL).toContain('printf \'%s\\n\' "$PR_URL"');
    expect(SKILL).toMatch(/On failure,[\s\S]*report the mismatch, and stop/);
  });
});
