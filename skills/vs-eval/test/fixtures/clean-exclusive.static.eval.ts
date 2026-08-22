import { expect, it } from 'vitest';

// CLEAN_EXCLUSIVE_STATIC_EVAL_CANARY
// Exclusive CASE: negative matcher plus the alternative a slogan-only skill fails.
it('requires the exclusive alternative', () => {
  expect('copied slogan').not.toMatch(/self-audit/);
  expect('copied slogan').not.toMatch(/exclusive/);
  expect('copied slogan').not.toMatch(/fixture/);
  expect('ship reject-mention-only.mjs').toMatch(/reject-[\w.-]+\.mjs/);
  expect('name the exclusive alternative').toMatch(/exclusive alternative/);
});
