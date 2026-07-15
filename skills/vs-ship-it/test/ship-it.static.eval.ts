import * as fs from 'fs';
import * as path from 'path';
import { describe, expect, it } from 'vitest';

const SKILL = fs.readFileSync(path.resolve(__dirname, '..', 'SKILL.md'), 'utf8');
const OPENAI_CONFIG = fs.readFileSync(
  path.resolve(__dirname, '..', 'agents', 'openai.yaml'),
  'utf8',
);

describe('vs-ship-it routing', () => {
  it('allows implicit invocation for commit, push, and PR requests', () => {
    expect(SKILL).not.toContain('disable-model-invocation: true');
    expect(SKILL).toMatch(/commit and push/);
    expect(SKILL).toMatch(/push to main\/master/);
    expect(OPENAI_CONFIG).toContain('allow_implicit_invocation: true');
  });

  it('keeps explicit direct pushes out of the PR workflow', () => {
    expect(SKILL).toContain('### Direct-push path');
    expect(SKILL).toContain(
      'Do not create a feature branch or PR in direct-push mode.',
    );
    expect(SKILL).toMatch(/verify the local and remote SHAs\s+match/);
  });

  it('does not silently map a missing destination branch', () => {
    expect(SKILL).toMatch(/does not exist,[\s\S]*do not silently create or map/);
  });
});

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
