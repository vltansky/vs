import * as fs from 'fs';
import * as path from 'path';
import { describe, expect, it } from 'vitest';

const SKILL = fs.readFileSync(path.resolve(__dirname, '..', 'SKILL.md'), 'utf8');

describe('vs-baby-sit remote-first validation', () => {
  it('pushes a focused fix before broad local validation', () => {
    expect(SKILL).toMatch(/focused regression test pass/);
    expect(SKILL).toMatch(/push it immediately so CI and review start/);
    expect(SKILL).toMatch(/Run broad local validation after the push/);
    expect(SKILL).toMatch(
      /Do not wait for the full root gate, full unit suite, or E2E suite before pushing/,
    );
  });

  it('preserves merge-readiness and repository-policy gates', () => {
    expect(SKILL).toMatch(/not enough to declare merge readiness/);
    expect(SKILL).toMatch(/repository policy\s+requires pre-push validation/);
  });

  it('uses the same ordering for review and CI fixes', () => {
    expect(SKILL).toMatch(/Push immediately: `git push`/);
    expect(SKILL).toMatch(
      /Run broad local validation while the replacement CI run is active/,
    );
  });
});
