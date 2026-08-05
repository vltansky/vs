import * as fs from 'node:fs';
import * as path from 'node:path';
import { describe, expect, it } from 'vitest';

const SKILL = fs.readFileSync(path.resolve(__dirname, '..', 'SKILL.md'), 'utf8');

describe('shape-it: design quality', () => {
  it(
    'prioritizes problem, boundary, and kill-criterion questions without asking by rote',
    () => {
      const opening = SKILL.slice(
        SKILL.indexOf('### 1. Opening interaction'),
        SKILL.indexOf('### 2. Independent shaping'),
      );

      expect(opening).toMatch(/problem.*outcome/i);
      expect(opening).toMatch(/system boundary.*ownership/i);
      expect(opening).toMatch(/kill criterion.*not worth building/i);
      expect(opening).toMatch(/do not ask all three by rote/i);
    },
  );

  it('covers failure behavior when the design crosses a runtime boundary', () => {
    const design = SKILL.slice(
      SKILL.indexOf('#### Design\n'),
      SKILL.indexOf('#### Record the decision'),
    );

    expect(design).toMatch(
      /failure modes,\s+degradation\/recovery,\s+and ownership/i,
    );
    expect(design).toMatch(/runtime or operational boundar/i);
  });

  it('self-reviews the integrated design after pushback and before closing', () => {
    const strategy = SKILL.indexOf('#### Design the execution strategy');
    const pushback = SKILL.indexOf('#### Stress-test with pushback');
    const review = SKILL.indexOf('#### Self-review the design');
    const closing = SKILL.indexOf('### 3. Closing interaction');
    const reviewText = SKILL.slice(review, closing);

    expect(pushback).toBeGreaterThan(strategy);
    expect(review).toBeGreaterThan(pushback);
    expect(closing).toBeGreaterThan(review);
    expect(reviewText).toMatch(/TBD,\s+TODO,\s+placeholder/i);
    expect(reviewText).toMatch(/internal consistency/i);
    expect(reviewText).toMatch(/scope check/i);
    expect(reviewText).toMatch(/ambiguity check/i);
  });
});
