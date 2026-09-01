import { spawnSync } from 'node:child_process';
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
const RUNNER = path.join(ROOT, 'skills', 'vs-show-me', 'scripts', 'run-write-slop.mjs');
const FIX = path.join(__dirname, 'fixtures');
const MENTION = path.join(FIX, 'mention-only-write-slop-skill.md');
const TLDR_SLOP = path.join(FIX, 'tldr-slop.md');
const TLDR_CLEAN = path.join(FIX, 'tldr-clean.md');

function run(target: string) {
  return spawnSync(process.execPath, [RUNNER, target], { encoding: 'utf8' });
}

describe('vs-eli5 thin contract', () => {
  it('matches Claude eli5 plus vs-show-me', () => {
    expect(SKILL).toMatch(/^name: vs-eli5$/m);
    expect(SKILL).toMatch(/\/vs-eli5/);
    expect(SKILL).toMatch(/big pictures/i);
    expect(SKILL).toMatch(/few words/i);
    expect(SKILL).toMatch(/knows nothing/i);
    expect(SKILL).toMatch(/Topic: \$ARGUMENTS/);
    expect(SKILL).toMatch(/`\/vs-show-me`/);
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
  it('starts from the shared vs-show-me artifact', () => {
    expect(SKILL).toContain('../vs-show-me/assets/artifact.html');
  });

  it('always puts a chat TLDR of the page', () => {
    expect(SKILL).toMatch(/Always produce a chat TLDR of that page/);
    expect(SKILL).toMatch(/two to four short lines/);
    expect(SKILL).toMatch(/Composed: return those\s+2-4 lines to the caller as the single close item-1 TLDR/);
    expect(SKILL).toMatch(/write nothing else\s+to chat/);
    expect(SKILL).toMatch(/Do not call `\/vs-tldr`/);
  });
});

describe('vs-eli5: inherit htmdx write-slop, score the chat TLDR', () => {
  it('fails mention-only vs-write without a runner path', () => {
    const mention = run(MENTION);
    expect(mention.status).toBe(1);
    expect(mention.stderr).toMatch(/mention-only/);
    expect(SKILL).not.toMatch(/MENTION_ONLY_WRITE_SLOP_CANARY/);
  });

  it('passes pointer plus runner without pasting the write procedure', () => {
    expect(SKILL).toMatch(/inherit/i);
    expect(SKILL).toMatch(/vs-show-me/);
    expect(SKILL).toMatch(/run-write-slop\.mjs/);
    expect(SKILL).toMatch(/reject-slop\.mjs/);
    expect(SKILL).toMatch(/do not (?:report|pretend|claim)\s+`?READY_FOR_REVIEW/i);
    expect(SKILL).not.toMatch(/source-block paragraphs only/);
    expect(SKILL).not.toMatch(/check-verbosity\.mjs/);
    expect(SKILL).not.toMatch(/In conclusion/);
    expect(SKILL).not.toMatch(/hasNoChain/);
    expect(run(path.join(DIR, 'SKILL.md')).status).toBe(0);
  });

  it('fails a chat TLDR fixture with a locked tell and passes a clean TLDR', () => {
    const slop = fs.readFileSync(TLDR_SLOP, 'utf8');
    expect(slop).toMatch(/No fluff, no filler, no jargon/);
    expect(slop).toMatch(/TLDR_WRITE_SLOP_CANARY/);
    expect(run(TLDR_SLOP).status).toBe(1);
    expect(run(TLDR_CLEAN).status).toBe(0);
    expect(SKILL).not.toMatch(/TLDR_WRITE_SLOP_CANARY/);
    expect(SKILL).not.toMatch(/No fluff, no filler, no jargon/);
  });
});
