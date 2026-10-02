import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = path.resolve(__dirname, '..', '..', '..');
const CHECK = path.join(ROOT, 'skills', 'vs-write', 'scripts', 'check-ste.mjs');
const REFERENCE = path.join(ROOT, 'skills', 'vs-internal-shared', 'references', 'ste-writing.md');
const read = (...parts: string[]) =>
  fs.readFileSync(path.join(ROOT, ...parts), 'utf8').replace(/\s+/g, ' ');

function check(content: string, ext = '.md') {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ste-'));
  const file = path.join(dir, `draft${ext}`);
  fs.writeFileSync(file, content);
  return spawnSync(process.execPath, [CHECK, file], { encoding: 'utf8' });
}

describe('check-ste.mjs', () => {
  it('passes the reference it enforces', () => {
    const run = spawnSync(process.execPath, [CHECK, REFERENCE], { encoding: 'utf8' });
    expect(run.status, run.stdout).toBe(0);
  });

  it('holds numbered steps to 20 words and prose to 25', () => {
    const step = `1. ${'word '.repeat(21).trim()}.\n`;
    expect(check(step).status).toBe(1);
    expect(check(`${'word '.repeat(21).trim()}.\n`).status).toBe(0);
    expect(check(`${'word '.repeat(26).trim()}.\n`).status).toBe(1);
  });

  it('rejects inflated words and names the replacement', () => {
    const run = check('We utilize the cache in order to save time.\n');
    expect(run.status).toBe(1);
    expect(run.stdout).toMatch(/"utilize" -> use "use"/);
    expect(run.stdout).toMatch(/"in order to" -> use "to"/);
  });

  it('ignores code, tables, and comments; warns on passive voice without failing', () => {
    const run = check(
      [
        '```bash',
        `${'echo '.repeat(40)}`,
        '```',
        `| ${'cell '.repeat(40)} |`,
        `<!-- ${'note '.repeat(40)} -->`,
        'The config was updated by the bot.',
        '',
      ].join('\n'),
    );
    expect(run.status, run.stdout).toBe(0);
    expect(run.stdout).toMatch(/WARN .*passive/);
  });

  it('checks only HTMDX source prose in an artifact and exits 2 when it cannot check', () => {
    const page = `<html><head></head><body><script type="text/htmdx">\nWe leverage caching.\n</script></body></html>`;
    expect(check(page, '.html').status).toBe(1);
    expect(check('<html><body><p>x</p></body></html>', '.html').status).toBe(2);
    expect(
      spawnSync(process.execPath, [CHECK, '/nonexistent/draft.md'], { encoding: 'utf8' }).status,
    ).toBe(2);
  });
});

describe('STE mode wiring', () => {
  it('vs-write owns the rules and keeps fidelity above the word limit', () => {
    const skill = read('skills', 'vs-write', 'SKILL.md');
    const ref = read('skills', 'vs-internal-shared', 'references', 'ste-writing.md');
    expect(skill).toMatch(/### STE mode/);
    expect(skill).toMatch(/strict ASD-STE100 only when the user asks/i);
    expect(skill).toMatch(/Never drop a fact, condition, or warning/);
    expect(ref).toMatch(/80% of the way/);
    expect(ref).toMatch(/Technical names are allowed/);
    expect(ref).toMatch(/Do not paste these rules into another skill/);
  });

  it.each([
    ['vs-eli5', /saved page/],
    ['vs-ship-it', /"\$BODY_FILE"/],
  ])('%s points at the STE reference and runs the checker', (skill, target) => {
    const text = read('skills', skill, 'SKILL.md');
    expect(text).toContain('../vs-internal-shared/references/ste-writing.md');
    expect(text).toMatch(/check-ste\.mjs/);
    expect(text).toMatch(target);
    expect(text).toMatch(/Pointer only/);
    // Pointer only: the rule list lives in vs-write, not here.
    expect(text).not.toMatch(/One instruction per sentence\.\*\*/);
  });
});
