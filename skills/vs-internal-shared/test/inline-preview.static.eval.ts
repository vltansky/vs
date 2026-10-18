import { readFileSync } from 'node:fs';
import * as path from 'node:path';
import { describe, expect, it } from 'vitest';

const skills = path.resolve(__dirname, '../..');
const read = (name: string) => readFileSync(path.join(skills, name), 'utf8');

describe('optional inline previews', () => {
  it.each(['vs-prototype', 'vs-show-me'])('%s routes before its file workflow', (skill) => {
    const source = read(`${skill}/SKILL.md`);
    const route = source.indexOf('references/inline-preview.md');
    expect(route).toBeGreaterThan(0);
    expect(route).toBeLessThan(source.indexOf(skill === 'vs-prototype' ? '## Choose the easiest seam' : '## Load the guidance'));
    expect(source).toMatch(/inline[\s\S]{0,120}(?:return|stop)/i);
  });

  it('requires host capability and delegates the rendering contract', () => {
    const guide = read('vs-internal-shared/references/inline-preview.md');
    expect(guide).toMatch(/available[\s\S]{0,100}`visualize`/);
    expect(guide).toMatch(/read[\s\S]{0,100}SKILL\.md/i);
    expect(guide).toMatch(/Do not vendor/);
    expect(guide).toMatch(/unavailable[\s\S]{0,160}(?:existing|fallback)/i);
    expect(guide).toMatch(/no network requests/i);
  });

  it('keeps explicit deliverables and real app work on existing paths', () => {
    const guide = read('vs-internal-shared/references/inline-preview.md');
    expect(guide).toMatch(/explicit[\s\S]{0,100}(?:file|HTMDX)/i);
    expect(guide).toMatch(/complex[\s\S]{0,100}(?:report|proposal)/i);
    expect(guide).toMatch(/real app[\s\S]{0,140}(?:existing|browser)/i);
    expect(guide).toMatch(/Do not (?:wrap|embed)[\s\S]{0,100}HTMDX/);
  });

  it('makes the inline handoff distinct from a portable artifact', () => {
    const guide = read('vs-internal-shared/references/inline-preview.md');
    expect(guide).toMatch(/final response/);
    expect(guide).toMatch(/absolute[\s\S]{0,50}path/i);
    expect(guide).toMatch(/does not require[\s\S]{0,120}(?:server|URL)/i);
    expect(guide).toMatch(/fallback[\s\S]{0,140}(?:URL|shot)/i);
  });
});
