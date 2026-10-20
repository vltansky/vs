import { SHIP_IT_SOURCE } from './ship-it-source';
import { expect, it } from 'vitest';

const skill = SHIP_IT_SOURCE;
it('merges results, behavior coverage and human gaps under Verification', () => {
  const template = skill.match(/\x60\x60\x60\x60markdown([\s\S]*?)\x60\x60\x60\x60/)?.[1] ?? '';
  expect(template).toMatch(/## Verification[\s\S]*Automated:[\s\S]*Coverage:[\s\S]*Not covered:/);
  expect(template).not.toMatch(/^## (Tests|Evidence|Review focus)$/m);
  expect(skill).toMatch(/come from the scoped diff only and add no runs/);
  expect(skill).toMatch(/List deleted tests too/);
  expect(skill).toMatch(/Never tick a box yourself/);
  expect(skill).toMatch(/never blocks PR creation, never asks the user/);
  for (const pattern of ['*.test.*', '*.spec.*', '*.eval.*', '__tests__/', 'evals/']) expect(skill).toContain(pattern);
});
