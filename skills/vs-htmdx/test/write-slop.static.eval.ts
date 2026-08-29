import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { describe, expect, it } from 'vitest';

const DIR = path.resolve(__dirname, '..');
const ROOT = path.resolve(DIR, '..', '..');
const SKILL_PATH = path.join(DIR, 'SKILL.md');
const SKILL_RAW = fs.readFileSync(SKILL_PATH, 'utf8');
const SKILL = SKILL_RAW.replace(/\s+/g, ' ');
const RUNNER = path.join(DIR, 'scripts', 'run-write-slop.mjs');
const FIX = path.join(__dirname, 'fixtures', 'write-slop');
const SLOP = path.join(FIX, 'slop-paragraph.html');
const CLEAN = path.join(FIX, 'clean-artifact.html');
const CLEAN_PROPOSAL = path.join(FIX, 'clean-proposal.html');
const NAME_FM = path.join(FIX, 'name-frontmatter.html');
const SLOP_PROPOSAL = path.join(FIX, 'slop-proposal.html');
const EXEMPT = path.join(FIX, 'exempt-non-prose.html');
const SLOGAN = path.join(FIX, 'slogan-only-skill.md');
const MENTION = path.join(FIX, 'mention-only-skill.md');
const RUNNER_ONLY = path.join(FIX, 'runner-only-skill.md');
const PUBLISHED = path.join(FIX, 'published-pair', 'SKILL.md');
const SLASH_ONLY = path.join(FIX, 'slash-only-skill.md');
const DEAD_SLASH = path.join(FIX, 'dead-slash-skill.md');

function run(target: string) {
  return spawnSync(process.execPath, [RUNNER, target], { encoding: 'utf8' });
}

describe('vs-htmdx: write-slop runner scores extracted paragraph prose', () => {
  it('fails a source-block paragraph with a locked no-chain tell', () => {
    const html = fs.readFileSync(SLOP, 'utf8');
    expect(html).toMatch(/No fluff, no filler, no jargon/);
    expect(html).toMatch(/WRITE_SLOP_NOCHAIN_CANARY/);
    expect(html).toMatch(/type="text\/htmdx"/);
    const result = run(SLOP);
    expect(result.status).toBe(1);
    expect(`${result.stdout}${result.stderr}`).toMatch(/reject-slop|no-chain/i);
    expect(SKILL).not.toMatch(/WRITE_SLOP_NOCHAIN_CANARY/);
    expect(SKILL).not.toMatch(/No fluff, no filler, no jargon/);
  });

  it('passes a clean artifact paragraph and a clean proposal paragraph', () => {
    expect(run(CLEAN).status).toBe(0);
    expect(run(CLEAN_PROPOSAL).status).toBe(0);
    expect(run(NAME_FM).status).toBe(0);
    expect(fs.readFileSync(NAME_FM, 'utf8')).toMatch(/^name:\s/m);
    expect(fs.readFileSync(CLEAN_PROPOSAL, 'utf8')).toMatch(
      /^layout: vs-proposal$/m,
    );
  });

  it('does not score frontmatter, headings, lists, tables, code, or component bodies', () => {
    const html = fs.readFileSync(EXEMPT, 'utf8');
    expect(html).toMatch(/No fluff, no filler, no jargon/);
    expect(run(EXEMPT).status).toBe(0);
  });

  it('invokes reject-slop instead of copying tell regexes', () => {
    const src = fs.readFileSync(RUNNER, 'utf8');
    expect(src).toMatch(/reject-slop\.mjs/);
    expect(src).toMatch(/spawnSync|execFileSync/);
    expect(src).not.toMatch(/In conclusion/);
    expect(src).not.toMatch(/the future looks bright/);
    expect(src).not.toMatch(/No fluff, no filler/);
    expect(src).not.toMatch(/hasNoChain|hasDontVerbIt|hasSitWith/);
  });
});

describe('vs-htmdx: write-slop exclusive is live path or published pair', () => {
  it('names the runner after verbosity and refuses READY_FOR_REVIEW without it', () => {
    expect(SKILL).toMatch(/assets\/check-verbosity\.mjs/);
    expect(SKILL).toMatch(/scripts\/run-write-slop\.mjs/);
    expect(SKILL).toMatch(/reject-slop\.mjs/);
    expect(SKILL).toMatch(/do not (?:report|pretend|claim)\s+`?READY_FOR_REVIEW/i);
    const verify = SKILL_RAW.slice(
      SKILL_RAW.indexOf('## Verify'),
      SKILL_RAW.indexOf('## Handoff'),
    );
    const verbosityAt = verify.search(/check-verbosity\.mjs/);
    const slopAt = verify.search(/run-write-slop\.mjs/);
    expect(verbosityAt).toBeGreaterThan(-1);
    expect(slopAt).toBeGreaterThan(verbosityAt);
  });

  it('fails slogan-only, mention-only vs-write, and runner-without-exclusive', () => {
    expect(run(SLOGAN).status).toBe(1);
    expect(run(SLOGAN).stderr).toMatch(/slogan-only skill/);
    expect(run(MENTION).status).toBe(1);
    expect(run(MENTION).stderr).toMatch(/mention-only/);
    expect(run(RUNNER_ONLY).status).toBe(1);
    expect(run(RUNNER_ONLY).stderr).toMatch(/slogan-only skill/);
    expect(SKILL).not.toMatch(/SLOGAN_ONLY_WRITE_SLOP_CANARY/);
    expect(SKILL).not.toMatch(/MENTION_ONLY_WRITE_SLOP_CANARY/);
    expect(SKILL).not.toMatch(/RUNNER_ONLY_WRITE_SLOP_CANARY/);
  });

  it('accepts /vs-show-me slash-only inherit and fails a dead /vs-htmdx slash', () => {
    expect(fs.readFileSync(SLASH_ONLY, 'utf8')).toMatch(/`\/vs-show-me`/);
    expect(fs.readFileSync(SLASH_ONLY, 'utf8')).not.toMatch(/vs-htmdx\/SKILL\.md/);
    expect(run(SLASH_ONLY).status).toBe(0);
    expect(fs.readFileSync(DEAD_SLASH, 'utf8')).toMatch(/`\/vs-htmdx`/);
    expect(fs.readFileSync(DEAD_SLASH, 'utf8')).not.toMatch(/vs-htmdx\/SKILL\.md/);
    expect(run(DEAD_SLASH).status).toBe(1);
    expect(SKILL).not.toMatch(/SLASH_ONLY_POINTER_CANARY/);
    expect(SKILL).not.toMatch(/DEAD_SLASH_POINTER_CANARY/);
  });

  it('accepts the live skill and a published skill-bytes pair', () => {
    expect(run(SKILL_PATH).status).toBe(0);
    expect(run(PUBLISHED).status).toBe(0);
    expect(SKILL).toMatch(/live `?skills\/vs-htmdx\/SKILL\.md/);
    expect(SKILL).toMatch(/published skill-bytes pair/);
  });

  it('exits 2 when a target is missing', () => {
    expect(run(path.join(FIX, 'missing-run.html')).status).toBe(2);
  });
});

describe('vs-htmdx: proposal copy is the same HTMDX write-slop pass', () => {
  it('names proposal.html / vs-proposal as covered by the runner', () => {
    expect(SKILL).toMatch(/assets\/proposal\.html/);
    expect(SKILL).toMatch(/layout: vs-proposal/);
    expect(SKILL).toMatch(
      /vs-proposal[\s\S]{0,160}run-write-slop|same runner covers proposal/i,
    );
  });

  it('fails a proposal-shaped fixture with a locked tell', () => {
    const html = fs.readFileSync(SLOP_PROPOSAL, 'utf8');
    expect(html).toMatch(/^layout: vs-proposal$/m);
    expect(html).toMatch(/No fluff, no filler, no jargon/);
    expect(html).toMatch(/WRITE_SLOP_PROPOSAL_CANARY/);
    expect(run(SLOP_PROPOSAL).status).toBe(1);
    expect(SKILL).not.toMatch(/WRITE_SLOP_PROPOSAL_CANARY/);
  });
});

describe('vs-htmdx: no new skill and no copied write procedure elsewhere', () => {
  it('does not add a slash skill for write-slop', () => {
    expect(fs.existsSync(path.join(ROOT, 'skills', 'vs-write-slop'))).toBe(
      false,
    );
    const manifest = JSON.parse(
      fs.readFileSync(path.join(ROOT, '.claude-plugin', 'plugin.json'), 'utf8'),
    ) as { skills: string[] };
    expect(manifest.skills).not.toContain('./skills/vs-write-slop');
  });
});
