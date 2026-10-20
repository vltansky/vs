import { SHIP_IT_SOURCE } from './ship-it-source';
import { expect, it } from 'vitest';

const skill = SHIP_IT_SOURCE;
it('uses architectural boundaries for a conditional, collapsed, head-pinned tour', () => {
  expect(skill).toMatch(/Only include a Walkthrough when the change crosses multiple architectural areas/);
  expect(skill).toMatch(/Omit it for a single-area change; file count is not the trigger/);
  expect(skill).toContain('<details><summary>Walkthrough: N areas, M files</summary>');
  expect(skill).toMatch(/Grouped by area, not by file/);
  expect(skill).toMatch(/Order High groups, then Medium, then Low/);
  expect(skill).toMatch(/No real code, no hunks, no file\s+contents/);
  expect(skill).toContain('blob/<HEAD_SHA>/<path>');
  expect(skill).toMatch(/last block of the body, after Verification/);
  expect(skill).toMatch(/Refresh the links at every handoff where the head moved/);
});
