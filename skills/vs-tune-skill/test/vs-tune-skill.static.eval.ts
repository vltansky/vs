import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
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
const REJECT = path.join(DIR, 'scripts', 'reject-tune-run.mjs');
const COLLECT = path.join(DIR, 'scripts', 'collect-sessions.mjs');
const FIXTURES = path.join(__dirname, 'fixtures');
const SLOGAN_SKILL = path.join(FIXTURES, 'slogan-only-skill.md');
const CLEAN_SKILL = path.join(FIXTURES, 'clean-tune-skill.md');
const GOOD_RUN = path.join(FIXTURES, 'good-run');
const NEED_SKILL_RUN = path.join(FIXTURES, 'need-skill-ask');
const BAD_ALL = path.join(FIXTURES, 'bad-grades-all');
const BAD_MENTION = path.join(FIXTURES, 'bad-mention-only');
const BAD_MUTATE = path.join(FIXTURES, 'bad-mutates-repo');
const BAD_UPLOAD = path.join(FIXTURES, 'bad-uploads');
const SESSION_HOMES = path.join(FIXTURES, 'session-homes');

function reject(target: string) {
  return spawnSync(process.execPath, [REJECT, target], { encoding: 'utf8' });
}

describe('vs-tune-skill thin contract', () => {
  it('matches frontmatter, trigger, kind, and implicit invocation', () => {
    expect(SKILL_RAW).toMatch(/^name: vs-tune-skill$/m);
    expect(SKILL).toMatch(/\/vs-tune-skill/);
    expect(SKILL).toMatch(/\*\*Kind:\*\* Building block/);
    expect(SKILL).toContain('vs-internal-shared/references/output-style.md');
    expect(SKILL_RAW).toMatch(
      /## Workflow[\s\S]+\*\*Prev:\*\*[\s\S]+\*\*Next:\*\*[\s\S]+\*\*Relevant:\*\*/,
    );
    expect(SKILL).toMatch(/`\/vs-eval`\s*\|\s*`\/vs-htmdx`\s*\|\s*`\/vs-search-threads`/);
    expect(SKILL_RAW).not.toContain('disable-model-invocation');
    expect(OPENAI_CONFIG).toContain('allow_implicit_invocation: false');
    expect(SKILL).not.toMatch(/\/vs-skill-doctor|tune-skills/);
    expect(SKILL).toMatch(/Inspired by Warp's skill-doctor idea/);
  });

  it('keeps the exclusive one-skill contract, not a slogan list', () => {
    expect(SKILL).toMatch(/exactly one skill|one required skill/);
    expect(SKILL).toMatch(/NEED_SKILL/);
    expect(SKILL).toMatch(/Never grade the whole set/);
    expect(SKILL).toMatch(/ASK which/);
    expect(SKILL).toMatch(/skills\//);
    expect(SKILL).toMatch(/Claude Code|project-history JSONL/i);
    expect(SKILL).toMatch(/Codex|rollouts/i);
    expect(SKILL).toMatch(/mktemp/);
    expect(SKILL).toMatch(/never upload/i);
    expect(SKILL).toMatch(/zero sessions/i);
    expect(SKILL).toMatch(/creating skills is the finding/i);
    expect(SKILL).toMatch(/fire[d]? and follow|fired and was followed/i);
    expect(SKILL).toMatch(/layout:\s*default/);
    expect(SKILL).toMatch(/never use\s+`layout:\s*vs`|Never use\s+`layout:\s*vs`/i);
    expect(SKILL).toMatch(/Ask whether to apply/i);
    expect(SKILL).toMatch(/not `\/vs-improve`/);
    expect(SKILL).toMatch(/not `\/vs-search-threads`/);
    expect(SKILL).not.toMatch(/warp\.dev\/factories/i);
    expect(SKILL).not.toMatch(/Do not edit PathGrade[\s\S]{0,40}except/i);
    expect(SKILL).toMatch(/Do not edit PathGrade/);
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

    expect(shared).toContain('`vs-tune-skill`');
    expect(manifest.skills).toContain('./skills/vs-tune-skill');
    expect(readme).toMatch(/\| `\/vs-tune-skill` \|/);
    expect(shared).not.toContain('`vs-skill-doctor`');
    expect(manifest.skills).not.toContain('./skills/vs-skill-doctor');
  });

  it('keeps fixture canaries out of the skill', () => {
    expect(SKILL_RAW).not.toMatch(/SLOGAN_ONLY_SKILL_CANARY/);
    expect(SKILL_RAW).not.toMatch(/CLEAN_TUNE_SKILL_CANARY/);
    expect(SKILL_RAW).not.toMatch(/CLEAN_DOCTOR_SKILL_CANARY/);
    expect(SKILL_RAW).not.toMatch(/GOOD_TUNE_RUN_CANARY/);
    expect(SKILL_RAW).not.toMatch(/NEED_SKILL_ASK_CANARY/);
    expect(SKILL_RAW).not.toMatch(/BAD_GRADES_ALL_CANARY/);
    expect(SKILL_RAW).not.toMatch(/BAD_MENTION_ONLY_CANARY/);
    expect(SKILL_RAW).not.toMatch(/BAD_MUTATES_REPO_CANARY/);
    expect(SKILL_RAW).not.toMatch(/BAD_UPLOADS_TRANSCRIPT_CANARY/);
  });
});

describe('vs-tune-skill workspace scorer', () => {
  it('rejects a slogan-only skill', () => {
    const result = reject(SLOGAN_SKILL);
    expect(result.status).toBe(1);
  });

  it('accepts a real tune-skill and this skill file', () => {
    expect(reject(CLEAN_SKILL).status).toBe(0);
    expect(reject(path.join(DIR, 'SKILL.md')).status).toBe(0);
  });

  it('accepts a named-skill run and a NEED_SKILL ask', () => {
    expect(reject(GOOD_RUN).status).toBe(0);
    expect(reject(NEED_SKILL_RUN).status).toBe(0);
  });

  it('rejects a run that grades all skills with no picker', () => {
    expect(reject(BAD_ALL).status).toBe(1);
  });

  it('rejects mention-only, repo mutation, and transcript upload runs', () => {
    expect(reject(BAD_MENTION).status).toBe(1);
    expect(reject(BAD_MUTATE).status).toBe(1);
    expect(reject(BAD_UPLOAD).status).toBe(1);
  });

  it('exits 2 when a target is missing', () => {
    expect(reject(path.join(FIXTURES, 'missing-run.md')).status).toBe(2);
  });
});

describe('vs-tune-skill local collector', () => {
  it('inventories repo skills and cwd-matching local sessions without uploading', () => {
    const out = fs.mkdtempSync(path.join(os.tmpdir(), 'vs-tune-skill-eval-'));
    const repo = path.join(SESSION_HOMES, 'repo');
    const result = spawnSync(
      process.execPath,
      [
        COLLECT,
        '--repo',
        repo,
        '--out',
        out,
        '--days',
        '45',
        '--skill',
        'demo-skill',
        '--claude-home',
        path.join(SESSION_HOMES, 'claude'),
        '--codex-home',
        path.join(SESSION_HOMES, 'codex'),
      ],
      { encoding: 'utf8' },
    );
    expect(result.status).toBe(0);
    const inventory = JSON.parse(
      fs.readFileSync(path.join(out, 'inventory.json'), 'utf8'),
    ) as {
      skills_found: number;
      sessions_sampled: number;
      skills: { name: string }[];
      sessions: { harness: string }[];
    };
    expect(inventory.skills_found).toBeGreaterThan(0);
    expect(inventory.skills.every((skill) => skill.name === 'demo-skill')).toBe(
      true,
    );
    expect(inventory.sessions_sampled).toBeGreaterThan(0);
    expect(inventory.sessions.some((session) => session.harness === 'claude-code')).toBe(
      true,
    );
    expect(inventory.sessions.some((session) => session.harness === 'codex')).toBe(
      true,
    );
    const copies = fs.readdirSync(path.join(out, 'transcripts'));
    expect(copies.length).toBeGreaterThan(0);
  });
});
