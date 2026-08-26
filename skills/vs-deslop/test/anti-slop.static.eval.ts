import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { describe, expect, it } from 'vitest';

const DIR = path.resolve(__dirname, '..');
const SKILL_RAW = fs.readFileSync(path.join(DIR, 'SKILL.md'), 'utf8');
const SKILL = SKILL_RAW.replace(/\s+/g, ' ');
const RUNNER = path.join(DIR, 'scripts', 'run-anti-slop.mjs');
const REJECT = path.join(DIR, 'scripts', 'reject-anti-slop.mjs');
const RUNNER_SRC = fs.readFileSync(RUNNER, 'utf8');
const FIXTURE_DIR = path.join(__dirname, 'fixtures');
const BAD = path.join(FIXTURE_DIR, 'anti-slop-bad.ts');
const GOOD = path.join(FIXTURE_DIR, 'anti-slop-good.ts');
const NOTE = path.join(FIXTURE_DIR, 'anti-slop-note.md');
const BAD_SRC = fs.readFileSync(BAD, 'utf8');
const GOOD_SRC = fs.readFileSync(GOOD, 'utf8');
const ROAST = path.resolve(DIR, '..', 'vs-roast-code', 'SKILL.md');
const BUILD = path.resolve(DIR, '..', 'vs-build-it', 'SKILL.md');
const HASH = '94bf653ff17050e581ef2669efbfe2fd8b5f84cb43c6c05d5a832fa6eff3e838';

function antiSlop(args: string[], cwd?: string) {
  return spawnSync(process.execPath, [RUNNER, ...args], {
    encoding: 'utf8',
    cwd,
  });
}

function reject(target: string) {
  return spawnSync(process.execPath, [REJECT, target], { encoding: 'utf8' });
}

describe('vs-deslop: on-demand anti-slop file pass', () => {
  it('pins exclusive from the rejector identity, not slogan AND-of-strings', () => {
    expect(SKILL).toMatch(/skills\/vs-deslop\/scripts\/run-anti-slop\.mjs/);
    expect(SKILL).toMatch(/skills\/vs-deslop\/scripts\/reject-anti-slop\.mjs/);
    expect(SKILL_RAW).toMatch(new RegExp(HASH, 'i'));
    expect(reject(path.join(DIR, 'SKILL.md')).status).toBe(0);
    expect(SKILL).not.toMatch(/\/anti-slop\b/);
    expect(SKILL).not.toMatch(/SLOGAN_ONLY_ANTISLOP_CANARY/);
    expect(SKILL).not.toMatch(/PARAGRAPH_PASTE_ANTISLOP_CANARY/);
    expect(SKILL).not.toMatch(/MENTION_ONLY_INHERIT_ANTISLOP_CANARY/);
    expect(SKILL).not.toMatch(/OXLINT_PROSE_ANTISLOP_CANARY/);
    expect(SKILL).not.toMatch(/WHOLE_TREE_ANTISLOP_CANARY/);
    expect(SKILL).not.toMatch(/NO_NAMES_ANTISLOP_CANARY/);
    expect(SKILL).not.toMatch(/CONSUMER_NPM_NPX_ANTISLOP_CANARY/);
    expect(SKILL).not.toMatch(/MD_ONLY_ANTISLOP_CANARY/);
  });

  it('rejects a chained assertion fixture and passes a typed file', () => {
    expect(BAD_SRC).toMatch(/as object as User/);
    expect(GOOD_SRC).not.toMatch(/ as /);
    const leftover = antiSlop([BAD]);
    expect(leftover.status).toBe(1);
    expect(`${leftover.stdout}${leftover.stderr}`).toMatch(
      /no-chained-type-assertions/,
    );
    expect(antiSlop([GOOD]).status).toBe(0);
  });

  it('fails no-args, a directory, zero JS names, and an MD-only run', () => {
    const none = antiSlop([]);
    expect(none.status).not.toBe(0);
    expect(`${none.stdout}${none.stderr}`).not.toMatch(/\bCLEAN\b/);
    const dir = antiSlop([FIXTURE_DIR]);
    expect(dir.status).not.toBe(0);
    expect(`${dir.stdout}${dir.stderr}`).not.toMatch(/\bCLEAN\b/);
    const md = antiSlop([NOTE]);
    expect(md.status).not.toBe(0);
    expect(`${md.stdout}${md.stderr}`).not.toMatch(/\bCLEAN\b/);
    const names = antiSlop([NOTE, path.join(FIXTURE_DIR, 'paragraph-paste-skill.md')]);
    expect(names.status).not.toBe(0);
    expect(`${names.stdout}${names.stderr}`).not.toMatch(/\bCLEAN\b/);
  });

  it('does not grow consumer cwd or spawn a consumer package CLI', () => {
    expect(RUNNER_SRC).not.toMatch(/spawnSync\(\s*['"]n['"]/);
    const consumer = fs.mkdtempSync(path.join(os.tmpdir(), 'vs-antislop-cwd-'));
    const bin = fs.mkdtempSync(path.join(os.tmpdir(), 'vs-antislop-bin-'));
    const marker = path.join(consumer, 'package-cli-ran');
    for (const name of ['n' + 'pm', 'n' + 'px']) {
      const stub = path.join(bin, name);
      fs.writeFileSync(stub, `#!/bin/sh\necho ran > "${marker}"\nexit 99\n`);
      fs.chmodSync(stub, 0o755);
    }
    const before = new Set(fs.readdirSync(consumer));
    const result = spawnSync(process.execPath, [RUNNER, GOOD], {
      encoding: 'utf8',
      cwd: consumer,
      env: { ...process.env, PATH: `${bin}${path.delimiter}${process.env.PATH ?? ''}` },
    });
    expect(result.status).toBe(0);
    expect(fs.existsSync(marker)).toBe(false);
    expect(fs.existsSync(path.join(consumer, 'oxlint.config'))).toBe(false);
    expect(fs.existsSync(path.join(consumer, 'oxlint.config.ts'))).toBe(false);
    expect(fs.existsSync(path.join(consumer, 'node_modules'))).toBe(false);
    expect(new Set(fs.readdirSync(consumer))).toEqual(before);
  });
});

describe('vs-deslop: exclusive fixtures fail slogan and mention-only inherit', () => {
  it('fails paragraph paste, oxlint prose, and mention-only inherit', () => {
    const paste = reject(path.join(FIXTURE_DIR, 'paragraph-paste-skill.md'));
    expect(paste.status).toBe(1);
    expect(paste.stderr).toMatch(/paragraph paste/);
    const oxlint = reject(path.join(FIXTURE_DIR, 'oxlint-prose-skill.md'));
    expect(oxlint.status).toBe(1);
    expect(oxlint.stderr).toMatch(/oxlint prose without named-file runner/);
    const mention = reject(path.join(FIXTURE_DIR, 'mention-only-inherit-skill.md'));
    expect(mention.status).toBe(1);
    expect(mention.stderr).toMatch(/mention-only inherit/);
  });

  it('fails whole-tree, no-names, and consumer package install fixtures', () => {
    const tree = reject(path.join(FIXTURE_DIR, 'whole-tree-skill.md'));
    expect(tree.status).toBe(1);
    expect(tree.stderr).toMatch(/whole-tree/);
    const names = reject(path.join(FIXTURE_DIR, 'no-names-skill.md'));
    expect(names.status).toBe(1);
    expect(names.stderr).toMatch(/no-names/);
    const consumer = reject(path.join(FIXTURE_DIR, 'consumer-pkg-skill.md'));
    expect(consumer.status).toBe(1);
    expect(consumer.stderr).toMatch(/consumer package install/);
  });
});

describe('vs-deslop: roast-code and build-it compose the file pass', () => {
  it('requires pointer plus named-file runner, not slogan inherit', () => {
    expect(reject(ROAST).status).toBe(0);
    expect(reject(BUILD).status).toBe(0);
    const roast = fs.readFileSync(ROAST, 'utf8');
    const build = fs.readFileSync(BUILD, 'utf8');
    expect(roast).toMatch(/run-anti-slop\.mjs/);
    expect(build).toMatch(/run-anti-slop\.mjs/);
    expect(roast).toMatch(/do not\s+report[\s\S]{0,20}`CLEAN`/i);
    expect(build).toMatch(/do not\s+report[\s\S]{0,20}`CLEAN`/i);
    expect(build).not.toMatch(/Load[\s\S]{0,40}vs-deslop\/SKILL\.md[\s\S]{0,80}only when/);
  });
});
