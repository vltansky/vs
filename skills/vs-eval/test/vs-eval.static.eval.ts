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
const MENTION_ONLY = fs.readFileSync(
  path.join(__dirname, 'fixtures', 'mention-only.static.eval.ts'),
  'utf8',
);
const SLOGAN_ONLY = fs.readFileSync(
  path.join(__dirname, 'fixtures', 'slogan-only-skill.md'),
  'utf8',
);

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
    expect(OPENAI_CONFIG).toContain('allow_implicit_invocation: true');
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
});

describe('vs-eval exclusive split', () => {
  it('names both runners and forbids crossing the static/live boundary', () => {
    expect(SKILL).toMatch(/npm run eval:static/);
    expect(SKILL).toMatch(/npm\s+run\s+eval(?!:)/);
    expect(SKILL).toMatch(
      /do not write a live CASE for a phrase that SKILL\.md can\s+assert/i,
    );
    expect(SKILL).toMatch(
      /Do not write a static pin for a first-turn question,\s+a tool call, or a\s+transcript shape/,
    );
    expect(SKILL).toMatch(/\*\.static\.eval\.ts/);
    expect(SKILL).toMatch(/\*\.eval\.ts/);
  });
});

describe('vs-eval exclusive wording', () => {
  it('requires not.toMatch plus an exclusive alternative, not slogan mentions', () => {
    expect(SKILL).toMatch(/pair every copied slogan with\s+`?not\.toMatch`?/);
    expect(SKILL).toMatch(/exclusive alternative that a\s+slogan-only skill fails/);
    expect(SKILL).toMatch(/toMatch\(\/self-audit\/\)/);
    expect(SKILL).toMatch(/That is not\s+a contract/);
    expect(SKILL).toMatch(
      /Do not treat a mention of exclusive, fixture, or self-audit as\s+enough/,
    );
    expect(SKILL).toMatch(/Match text across wraps with\s+`?\\s\+`?/);
    expect(SKILL).toMatch(/Do not relax an assertion to make it pass/);
  });
});

describe('vs-eval fixture-backed reject', () => {
  it('teaches that the shipped samples fail the catalog', () => {
    expect(SKILL).toMatch(/mention-only\.static\.eval\.ts[\s\S]{0,80}fails the catalog/);
    expect(SKILL).toMatch(/slogan-only-skill\.md[\s\S]{0,80}fails the catalog/);
    expect(SKILL).toMatch(
      /skill text must not contain the fixture canaries/,
    );
    expect(SKILL).toMatch(
      /Put the bad tell in the fixture; put the reject rule and the\s+`?not\.toMatch`? in the CASE/,
    );
  });

  it('keeps fixture canaries out of the skill', () => {
    expect(SKILL_RAW).not.toMatch(/MENTION_ONLY_STATIC_EVAL_CANARY/);
    expect(SKILL_RAW).not.toMatch(/SLOGAN_ONLY_SKILL_CANARY/);
  });

  it('loads the mention-only fixture and shows it fails the exclusive contract', () => {
    expect(MENTION_ONLY).toMatch(/MENTION_ONLY_STATIC_EVAL_CANARY/);
    expect(MENTION_ONLY).toMatch(/toMatch\(\/self-audit\/\)/);
    expect(MENTION_ONLY).toMatch(/toMatch\(\/exclusive\/\)/);
    expect(MENTION_ONLY).toMatch(/toMatch\(\/fixture\/\)/);
    expect(MENTION_ONLY).not.toMatch(/not\.toMatch/);
    expect(MENTION_ONLY).not.toMatch(/exclusive alternative/i);
  });

  it('loads the slogan-only skill and shows it is mention-only', () => {
    expect(SLOGAN_ONLY).toMatch(/SLOGAN_ONLY_SKILL_CANARY/);
    expect(SLOGAN_ONLY).toMatch(/exclusive/);
    expect(SLOGAN_ONLY).toMatch(/fixture/);
    expect(SLOGAN_ONLY).toMatch(/self-audit/);
    expect(SLOGAN_ONLY).not.toMatch(/not\.toMatch/);
    expect(SLOGAN_ONLY).not.toMatch(/exclusive alternative/i);
  });
});

describe('vs-eval PathGrade commands', () => {
  it('pins the three scripts and forbids editing PathGrade', () => {
    expect(SKILL).toMatch(/npm run eval:static/);
    expect(SKILL).toMatch(/npm\s+run\s+eval(?!:)/);
    expect(SKILL).toMatch(/npm run eval:preview/);
    expect(SKILL).toMatch(/Do not edit PathGrade/);
    expect(SKILL).toMatch(/@wix\/pathgrade/);
    expect(SKILL).toMatch(/wix-private\/pathgrade/);
    expect(SKILL).toMatch(/Do not invent a new PathGrade runner/);
    expect(SKILL).toMatch(/npm run eval\*/);
  });

  it('teaches existing line ceilings without inventing one', () => {
    expect(SKILL).toMatch(/toBeLessThanOrEqual\(N\)/);
    expect(SKILL).toMatch(/\/vs-write`? uses 240/);
    expect(SKILL).toMatch(
      /Do not invent a ceiling a skill does not already pin/,
    );
  });
});
