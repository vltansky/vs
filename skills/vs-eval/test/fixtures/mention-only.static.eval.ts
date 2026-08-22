import { expect, it } from 'vitest';

// MENTION_ONLY_STATIC_EVAL_CANARY
// INPUT to reject-mention-only.mjs, not a CI scorer.
it('mentions slogans', () => {
  expect('exclusive fixture self-audit').toMatch(/self-audit|exclusive|fixture/);
});
