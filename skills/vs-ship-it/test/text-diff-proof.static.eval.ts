import { SHIP_IT_SOURCE } from './ship-it-source';
import { describe, expect, it } from 'vitest';

const skill = SHIP_IT_SOURCE;
const textDiffs = skill.split('**Text diffs.**')[1]?.split('Prefer a compact comparison table')[0] ?? '';

describe('text before/after renders as one diff', () => {
  it('routes commands, args, config and snippets to one diff block', () => {
    expect(skill).toMatch(/\| A command, flags or args, config, or a small code snippet \| One fenced `diff`, never separate Before and After blocks/);
    expect(textDiffs).toMatch(/one flag, arg or key per\s+line, flag and value together/);
    expect(textDiffs).toMatch(/trailing\s+`\\` or JSON comma, mark that neighbor line too/);
    expect(textDiffs).toMatch(/`-`\/`\+` mark\s+only what changed/);
  });

  it('keeps both gate labels on one line above the diff', () => {
    expect(textDiffs).toContain('`**Before** <old> **After** <new>` on one line');
    expect(textDiffs).toMatch(/gate\s+needs both labels/);
    expect(textDiffs).toMatch(/Put \*\*Source-derived\*\* after the diff, never inside the Before\/After label/);
    expect(textDiffs).toMatch(/^\*\*Before\*\* .+ \*\*After\*\* .+\n\n```diff/m);
  });

  it('shows a split command with only the changed flag marked', () => {
    const block = textDiffs.match(/```diff\n([\s\S]*?)```/)?.[1] ?? '';
    const lines = block.trimEnd().split('\n');
    expect(lines.filter((l) => /^[-+]/.test(l))).toEqual(['-  --setting-sources user,project \\', '+  --setting-sources user \\']);
    expect(lines.filter((l) => l.startsWith(' ')).length).toBeGreaterThanOrEqual(2);
  });

  it('keeps separate Before and After proof for UI and user-visible output', () => {
    expect(textDiffs).toMatch(/UI and user-visible output keep\s+the separate Before and After proof/);
    expect(skill).toMatch(/matched Before\/After screenshots are required/);
  });
});
