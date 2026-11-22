import { describe, expect, it } from 'vitest';
import { SHIP_IT_SOURCE } from './ship-it-source';

describe('ship-it proof-first opener', () => {
  it('opens with one sentence about the change and immediately shows Before/After', () => {
    expect(SHIP_IT_SOURCE).toMatch(/Write one plain sentence that says what changes and for whom,\s+then show the primary Before\/After proof/);
    expect(SHIP_IT_SOURCE).toMatch(/Do not echo the PR title/);
    expect(SHIP_IT_SOURCE).toMatch(/<one sentence that says what changes and for whom>\n\n\| Before \| After \|/);
    expect(SHIP_IT_SOURCE).toMatch(/pr-media-gate\.mjs [^\n]+ --proof-first/);
  });

  it('puts a required merge action first and keeps legacy body refreshes valid', () => {
    expect(SHIP_IT_SOURCE).toMatch(/risk line when it names a merge blocker/);
    expect(SHIP_IT_SOURCE).toMatch(/Retain the invisible format marker/);
    expect(SHIP_IT_SOURCE).toMatch(/Existing bodies with the old format still validate\s+under its original rules/);
  });
});
