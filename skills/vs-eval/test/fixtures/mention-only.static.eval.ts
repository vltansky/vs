import { expect, it } from 'vitest';

// MENTION_ONLY_STATIC_EVAL_CANARY
// Bad CASE: slogan mentions only. A catalog pin must reject this shape.
it('mentions slogans', () => {
  expect('exclusive fixture self-audit').toMatch(/self-audit/);
  expect('exclusive fixture self-audit').toMatch(/exclusive/);
  expect('exclusive fixture self-audit').toMatch(/fixture/);
});
