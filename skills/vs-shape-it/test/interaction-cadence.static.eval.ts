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

  it('requires explicit alignment before independent shaping', () => {
    const opening = SKILL.slice(
      SKILL.indexOf('### 1. Opening interaction'),
      SKILL.indexOf('### 2. Independent shaping'),
    );

    expect(opening).toMatch(/explicit alignment checkpoint/i);
    expect(opening).toMatch(/least-supported expensive-to-reverse assumption/i);
    expect(opening).toMatch(/explicitly asks for no questions/i);
    expect(opening).toMatch(/outcome,\s+boundary,\s+and proof of success/i);
  });

  it('distinguishes a guided interview from adversarial plan review', () => {
    const routing = SKILL.slice(
      SKILL.indexOf('## Route the input'),
      SKILL.indexOf('## Long-horizon shaping'),
    );
    const interview = SKILL.slice(
      SKILL.indexOf('#### Guided Explore interview'),
      SKILL.indexOf('```markdown'),
    );

    expect(routing).toMatch(/grill this plan.*Challenge/is);
    expect(routing).toMatch(/grill me.*question me.*Guided Explore/is);
    expect(interview).toMatch(/one consequential strategic question at a time/i);
    expect(interview).toMatch(/Accept `done`, `skip`, and `back`/i);
    expect(interview).toMatch(/agent supplies facts, code reading, and recommendations/i);
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
