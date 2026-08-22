import * as fs from 'fs';
import * as path from 'path';
import { describe, expect, it } from 'vitest';

const DIR = path.resolve(__dirname, '..');
const ROOT = path.resolve(DIR, '..', '..');
const SKILL = fs.readFileSync(path.join(DIR, 'SKILL.md'), 'utf8');
const OPENAI_CONFIG = fs.readFileSync(
  path.join(DIR, 'agents', 'openai.yaml'),
  'utf8',
);

describe('vs-tldr compression contract', () => {
  it('is an explicit-only comprehension repair', () => {
    expect(SKILL).toMatch(/^name: vs-tldr$/m);
    expect(SKILL).toContain('disable-model-invocation: true');
    expect(SKILL).toMatch(/`\/vs-tldr`/);
    expect(SKILL).toMatch(/materially shorter/i);
    expect(SKILL).toMatch(/missing premise/i);
    expect(SKILL).toMatch(/plain English/i);
    expect(OPENAI_CONFIG).toContain('allow_implicit_invocation: false');
  });

  it('preserves meaning while repairing the current explanation', () => {
    expect(SKILL).toMatch(/Re-pitch \*\*that\*\*/);
    expect(SKILL).toMatch(/technical accuracy/i);
    expect(SKILL).toMatch(/Do not start a new task/);
    expect(SKILL).toMatch(/genuinely ambiguous/i);
    expect(SKILL).toMatch(/second `\/vs-tldr`/);
    expect(SKILL).toMatch(/propose `\/vs-eli5`/);
    expect(SKILL).toMatch(/Do not run it/);
    expect(SKILL).toMatch(/prose-only/);
  });

  it('is wired into the shared VS contracts', () => {
    const shared = fs.readFileSync(
      path.join(ROOT, 'skills', 'vs-internal-shared', 'SKILL.md'),
      'utf8',
    );
    const manifest = JSON.parse(
      fs.readFileSync(path.join(ROOT, '.claude-plugin', 'plugin.json'), 'utf8'),
    ) as { skills: string[] };
    const readme = fs.readFileSync(path.join(ROOT, 'README.md'), 'utf8');

    expect(SKILL).toContain('vs-internal-shared/references/output-style.md');
    expect(SKILL).toMatch(/## Workflow[\s\S]+\*\*Prev:\*\*[\s\S]+\*\*Next:\*\*[\s\S]+\*\*Relevant:\*\*/);
    expect(shared).toContain('`vs-tldr`');
    expect(manifest.skills).toContain('./skills/vs-tldr');
    expect(readme).toMatch(/\| `\/vs-tldr` \|/);
  });
});
