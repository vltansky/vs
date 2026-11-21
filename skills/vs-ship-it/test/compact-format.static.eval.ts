import { SHIP_IT_SOURCE } from './ship-it-source';
import { describe, expect, it } from 'vitest';

const skill = SHIP_IT_SOURCE;
const template = skill.match(/````markdown([\s\S]*?)````/)?.[1] ?? '';
const live = template.replace(/<!--[\s\S]*?-->/g, '');

describe('compact ship-it body', () => {
  it('keeps proof and risk outside one collapsed expander', () => {
    const [visible, details] = live.trim().split('<details>');
    expect(visible).toMatch(/^<one sentence[^\n]+>\n\n\| Before \| After \|/);
    expect(visible.trim()).toMatch(/\*\*Risk:\*\* [^\n]+$/);
    expect(visible.trim().split('**Risk:**')[1]).toMatch(/badge-one-way-door\.svg[^\n]+badge-narrow-blast\.svg/);
    expect(visible).not.toMatch(/^## /m);
    expect(details).toMatch(/<summary>[^<]+<\/summary>[\s\S]+## Verification[\s\S]+<\/details>/);
    expect(live.match(/<details>/g)).toHaveLength(1);
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
    expect(skill).toMatch(/Supporting tests, docs, ADRs, lockfiles and release metadata do not create an\s+architectural area/);
  });

  it('checks fact retention and avoids expanding a rewrite with boilerplate', () => {
    expect(skill).toMatch(/fact ledger/i);
    expect(skill).toMatch(/conditions, failure consequences, unchanged behavior/);
    expect(skill).toMatch(/real rejected alternatives/);
    expect(skill).toMatch(/Compare the full-body word count/);
    expect(skill).toMatch(/no longer than the source/);
    expect(skill).toMatch(/missing inputs are not reviewer tasks/);
    expect(skill).toMatch(/\*\*Coverage:\*\* Deleted/);
    expect(skill).toMatch(/`\*\*Before:\*\*` and `\*\*After:\*\*` outside code fences/);
    expect(skill).toMatch(/add `## Walkthrough` at the end of the existing expander/);
  });
});
