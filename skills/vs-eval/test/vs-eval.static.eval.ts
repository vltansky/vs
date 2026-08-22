import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { describe, expect, it } from 'vitest';

const DIR = path.resolve(__dirname, '..');
const ROOT = path.resolve(DIR, '..', '..');
const SKILL_RAW = fs.readFileSync(path.join(DIR, 'SKILL.md'), 'utf8');
const SKILL = SKILL_RAW.replace(/\s+/g, ' ');
const OPENAI_CONFIG = fs.readFileSync(
  path.join(DIR, 'agents', 'openai.yaml'),
  'utf8',
);
const REJECT = path.join(DIR, 'scripts', 'reject-mention-only.mjs');
const FIXTURES = path.join(__dirname, 'fixtures');
const SLOGAN_SKILL = path.join(FIXTURES, 'slogan-only-skill.md');
const MENTION_CASE = path.join(FIXTURES, 'mention-only.static.eval.ts');
const CLEAN_SKILL = path.join(FIXTURES, 'clean-skill.md');
const CLEAN_CASE = path.join(FIXTURES, 'clean-exclusive.static.eval.ts');

function rejectPair(skillFile: string, caseFile: string) {
  return spawnSync(process.execPath, [REJECT, skillFile, caseFile], {
    encoding: 'utf8',
  });
}

describe('vs-eval thin contract', () => {
  it('matches frontmatter, trigger, kind, and implicit invocation', () => {
    expect(SKILL_RAW).toMatch(/^name: vs-eval$/m);
    expect(SKILL).toMatch(/\/vs-eval/);
    expect(SKILL).toMatch(/\*\*Kind:\*\* Building block/);
    expect(SKILL).toContain('vs-internal-shared/references/output-style.md');
    expect(SKILL_RAW).toMatch(
      /## Workflow[\s\S]+\*\*Prev:\*\*[\s\S]+\*\*Next:\*\*[\s\S]+\*\*Relevant:\*\*/,
    );
    expect(SKILL_RAW).not.toContain('disable-model-invocation');
    expect(OPENAI_CONFIG).toContain('allow_implicit_invocation: false');
  });

  it('is wired into the shared VS catalogs', () => {
    const shared = fs.readFileSync(
      path.join(ROOT, 'skills', 'vs-internal-shared', 'SKILL.md'),
      'utf8',
    );
    const manifest = JSON.parse(
      fs.readFileSync(path.join(ROOT, '.claude-plugin', 'plugin.json'), 'utf8'),
    ) as { skills: string[] };
    const readme = fs.readFileSync(path.join(ROOT, 'README.md'), 'utf8');

    expect(shared).toContain('`vs-eval`');
    expect(manifest.skills).toContain('./skills/vs-eval');
    expect(readme).toMatch(/\| `\/vs-eval` \|/);
  });

  it('keeps fixture canaries out of the skill', () => {
    expect(SKILL_RAW).not.toMatch(/MENTION_ONLY_STATIC_EVAL_CANARY/);
    expect(SKILL_RAW).not.toMatch(/SLOGAN_ONLY_SKILL_CANARY/);
    expect(SKILL_RAW).not.toMatch(/CLEAN_EXCLUSIVE_STATIC_EVAL_CANARY/);
  });
});

describe('vs-eval workspace scorer', () => {
  it('rejects slogan-only skill plus mention-only CASE', () => {
    const result = rejectPair(SLOGAN_SKILL, MENTION_CASE);
    expect(result.status).toBe(1);
  });

  it('accepts a clean exclusive CASE with a non-slogan skill', () => {
    const result = rejectPair(CLEAN_SKILL, CLEAN_CASE);
    expect(result.status).toBe(0);
  });
});
