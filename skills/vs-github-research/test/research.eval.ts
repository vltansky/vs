import * as fs from 'fs';
import * as path from 'path';
import { describe, expect, it } from 'vitest';
import { check, createAgent, evaluate } from '@wix/pathgrade';

const SKILL_DIR = path.resolve(__dirname, '..');
const SKILL = fs.readFileSync(path.join(SKILL_DIR, 'SKILL.md'), 'utf8');

describe('github-research', () => {
  it.skip('has a runnable behavior-eval scaffold for future octocode-backed broad search fixtures', async () => {
    const agent = await createAgent({ agent: 'codex', timeout: 300, skillDir: SKILL_DIR });
    const result = await evaluate(agent, [check('placeholder', () => true)]);
    expect(result.score).toBe(1);
  });

  it('is framed as broad external GitHub research rather than local code tracing', () => {
    expect(SKILL).toMatch(/GitHub-backed prior art/i);
    expect(SKILL).toMatch(/looking outward at real GitHub projects/i);
    expect(SKILL).toMatch(/not a local call-graph tracer/i);
    expect(SKILL).toMatch(/rename blast-radius checker/i);
  });

  it('requires project discovery, representative inspection, and pattern synthesis', () => {
    expect(SKILL).toMatch(/Discover candidate projects/i);
    expect(SKILL).toMatch(/Inspect representative examples/i);
    expect(SKILL).toMatch(/Group findings by pattern/i);
    expect(SKILL).toMatch(/3-5 candidate projects/i);
  });

  it('keeps evidence GitHub-cited and separates nearby skills', () => {
    expect(SKILL).toMatch(/full GitHub URLs with line numbers/i);
    expect(SKILL).toMatch(/Separate direct evidence from inference/i);
    expect(SKILL).toMatch(/\/vs-steal/);
    expect(SKILL).toMatch(/\/vs-rfc-research/);
    expect(SKILL).toMatch(/\/vs-shape-it/);
  });

  it('keeps compact prior art in Markdown and renders dense landscapes as one HTMDX artifact', () => {
    expect(SKILL).toMatch(/prior-art answer[\s\S]{0,180}Markdown/i);
    expect(SKILL).toMatch(/YYYY-MM-DD-landscape\.html/);
    expect(SKILL).toMatch(/HTMDX/);
    expect(SKILL).toMatch(/no Markdown twin/i);
  });
});
