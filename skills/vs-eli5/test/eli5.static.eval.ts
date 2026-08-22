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
const TLDR = fs.readFileSync(
  path.join(ROOT, 'skills', 'vs-tldr', 'SKILL.md'),
  'utf8',
);

describe('vs-eli5 thin contract', () => {
  it('matches Claude eli5 plus vs-htmdx', () => {
    expect(SKILL).toMatch(/^name: vs-eli5$/m);
    expect(SKILL).toMatch(/\/vs-eli5/);
    expect(SKILL).toMatch(/big pictures/i);
    expect(SKILL).toMatch(/few words/i);
    expect(SKILL).toMatch(/knows nothing/i);
    expect(SKILL).toMatch(/Topic: \$ARGUMENTS/);
    expect(SKILL).toMatch(/`\/vs-htmdx`/);
    expect(SKILL).not.toContain('disable-model-invocation');
    expect(OPENAI_CONFIG).toContain('allow_implicit_invocation: true');
  });

  it('does not replace tldr', () => {
    expect(TLDR).toContain('disable-model-invocation: true');
    expect(TLDR).toMatch(/Compress and simplify/);
    expect(SKILL).not.toMatch(/compress the last explanation/i);
    expect(SKILL).not.toMatch(/Re-pitch \*\*that\*\*/);
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
    expect(shared).toContain('`vs-eli5`');
    expect(manifest.skills).toContain('./skills/vs-eli5');
    expect(readme).toMatch(/\| `\/vs-eli5` \|/);
  });
});


describe('vs-eli5 rendering', () => {
  it('starts from the shared vs-htmdx artifact', () => {
    expect(SKILL).toContain('../vs-htmdx/assets/artifact.html');
  });

  it('always puts a chat TLDR of the page', () => {
    expect(SKILL).toMatch(/Always produce a chat TLDR of that page/);
    expect(SKILL).toMatch(/two to four short lines/);
    expect(SKILL).toMatch(/Composed: return those\s+2-4 lines to the caller as the single close item-1 TLDR/);
    expect(SKILL).toMatch(/write nothing else\s+to chat/);
    expect(SKILL).toMatch(/Do not call `\/vs-tldr`/);
  });
});
