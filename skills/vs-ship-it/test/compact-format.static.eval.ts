import { SHIP_IT_SOURCE } from './ship-it-source';
import { describe, expect, it } from 'vitest';

const skill = SHIP_IT_SOURCE;
const template = skill.match(/````markdown([\s\S]*?)````/)?.[1] ?? '';
const live = template.replace(/<!--[\s\S]*?-->/g, '');

describe('compact ship-it body', () => {
  it('gives each fact one home in three sections', () => {
    expect([...live.matchAll(/^## (.+)$/gm)].map(m => m[1])).toEqual([
      'Review map', 'Change and proof', 'Verification',
    ]);
    expect(skill).toMatch(/60 visible lines/);
    expect(skill).toMatch(/Replace stale verification history/);
  });

  it('keeps risk and surface badges together', () => {
    const review = live.split('## Review map')[1]?.split('## Change and proof')[0] ?? '';
    expect(review).toContain('badge-two-way-door.svg');
    expect(review).toContain('badge-narrow-blast.svg');
    expect(review).toContain('badge-surface-endpoint-2.svg');
  });

  it('keeps both screenshot and functional-video pairs mandatory', () => {
    expect(skill).toMatch(/matched Before\/After screenshots are required/);
    expect(skill).toMatch(/functional UI behavior changes require matched Before\/After videos/);
    expect(skill).toContain('--functional');
    expect(skill).toMatch(/Screenshots do not replace videos/);
  });

  it('uses architectural boundaries rather than file count for the walkthrough', () => {
    expect(skill).toMatch(/Only include a Walkthrough when the change crosses multiple architectural areas/);
    expect(skill).toMatch(/Omit it for a single-area change/);
  });
});
