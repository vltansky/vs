import * as fs from 'node:fs';
import * as path from 'node:path';
import { describe, expect, it } from 'vitest';

const SKILL = fs.readFileSync(path.resolve(__dirname, '..', 'SKILL.md'), 'utf8');

describe('shape-it: interaction cadence', () => {
  it('runs interaction, independent shaping, then interaction', () => {
    const opening = SKILL.indexOf('### 1. Opening interaction');
    const independent = SKILL.indexOf('### 2. Independent shaping');
    const closing = SKILL.indexOf('### 3. Closing interaction');

    expect(opening).toBeGreaterThan(-1);
    expect(independent).toBeGreaterThan(opening);
    expect(closing).toBeGreaterThan(independent);
  });

  it('expects the user early and protects the independent middle from question drip', () => {
    expect(SKILL).toMatch(/assume the user is available and engaged/i);
    expect(SKILL).toMatch(/assume the user may be away until the closing\s+interaction/i);
    expect(SKILL).toMatch(/do not\s+drip follow-up questions/i);
  });

  it('returns for approval with completed work and explicit strategic uncertainty', () => {
    expect(SKILL).toMatch(/return with the complete recommendation/i);
    expect(SKILL).toMatch(/unresolved strategic/i);
    expect(SKILL).toMatch(/approval/i);
  });

  it('discovers operational context and keeps routing metadata subordinate to the design', () => {
    expect(SKILL).toMatch(/discover the active workspace, repository, and existing artifacts/i);
    expect(SKILL).toMatch(/ordinary navigation is not a strategic question/i);
    expect(SKILL).toMatch(/does not replace or\s+suppress the closing design/i);
  });
});
