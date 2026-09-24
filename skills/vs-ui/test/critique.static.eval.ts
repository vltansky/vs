import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { expect, it } from 'vitest';

const read = (path: string) => readFileSync(resolve(__dirname, '..', path), 'utf8');

it('critique names the primary job before scoring', () => {
  const critique = read('references/critique.md');
  expect(critique).toMatch(/\*\*Primary job\*\*:\s+before\s+scoring\s+anything/);
  expect(critique).toMatch(/Return:\s+primary\s+job,/);
});

it('critique proposes structural directions with a conditional pick', () => {
  const critique = read('references/critique.md');
  expect(critique).toMatch(/#### Structural Directions/);
  expect(critique).toMatch(/\*\*2-3\s+structural\s+directions\*\*\s+before\s+the\s+Priority\s+Issues/);
  expect(critique).toMatch(/differ\s+in\s+topology\s+or\s+density/);
  expect(critique).toMatch(/\*\*one\s+pick\*\*,\s+tied\s+to\s+its\s+condition/);
  expect(critique).toMatch(/cross-cutting\s+improvement/);
});

it('critique mocks directions only with native image generation', () => {
  const critique = read('references/critique.md');
  expect(critique).toMatch(/Visualize\s+each\s+direction\s+when\s+the\s+harness\s+has\s+native\s+image\s+generation/);
  expect(critique).toMatch(/screenshot\s+of\s+the\s+current\s+surface\s+as\s+the\s+reference/);
  expect(critique).toMatch(/state\s+in\s+one\s+line\s+that\s+mocks\s+are\s+skipped/);
  expect(critique).toMatch(/do\s+not\s+ask\s+the\s+user\s+to\s+install\s+tooling/);
});

it('critique does not escalate findings caused by seeded data', () => {
  const critique = read('references/critique.md');
  expect(critique).toMatch(/\*\*Seeded data\*\*/);
  expect(critique).toMatch(/is\s+not\s+a\s+P0,\s+and\s+the\s+seed\s+is\s+what\s+needs\s+fixing/);
});

it('shape allows direction probes for structural redesigns of existing surfaces', () => {
  expect(read('references/shape.md')).toMatch(/structural\s+redesign\s+of\s+an\s+existing\s+surface/);
});

it('skill points at its real source path', () => {
  const skill = read('SKILL.md');
  expect(skill).not.toMatch(/plugins\/vs\/skills\/vs-ui/);
  expect(skill).toMatch(/source\s+path\s+is\s+`skills\/vs-ui`/);
});
