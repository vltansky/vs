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

describe('vs-teach-back understanding check', () => {
  it('is a teach-back slash that rewrites the user explanation as a proposal', () => {
    expect(SKILL).toMatch(/^name: vs-teach-back$/m);
    expect(SKILL).not.toContain('disable-model-invocation');
    expect(SKILL).toMatch(/`\/vs-teach-back`/);
    expect(SKILL).toMatch(/messy/i);
    expect(SKILL).toMatch(/multi-message|mixed formats/i);
    expect(SKILL).toMatch(/proposal in the agent's voice/i);
    expect(SKILL).toMatch(/as if you were proposing/i);
    expect(OPENAI_CONFIG).toContain('allow_implicit_invocation: true');
  });

  it('always ends with clarifying questions and never edits code', () => {
    expect(SKILL).toMatch(/Always end with clarifying questions/i);
    expect(SKILL).toMatch(/Do not edit code/);
    expect(SKILL).toMatch(/never edits code/i);
    expect(SKILL).toMatch(/Do not invent requirements/i);
  });

  it('does not replace wdym/tldr comprehension repair', () => {
    expect(SKILL).toMatch(/does not replace `\/vs-wdym`/i);
    expect(SKILL).toMatch(/user did not follow the agent/i);
    expect(SKILL).toMatch(/`\/vs-tldr`/);
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
    expect(SKILL).toMatch(
      /## Workflow[\s\S]+\*\*Prev:\*\*[\s\S]+\*\*Next:\*\*[\s\S]+\*\*Relevant:\*\*/,
    );
    expect(shared).toContain('`vs-teach-back`');
    expect(manifest.skills).toContain('./skills/vs-teach-back');
    expect(readme).toMatch(/\| `\/vs-teach-back` \|/);
  });
});
