import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = path.resolve(__dirname, '..', '..', '..');
const SKILL_DIR = path.resolve(__dirname, '..');

describe('vs-ponytail contract', () => {
  it('is a discoverable implicit building block with one canonical contract', () => {
    const skill = fs.readFileSync(path.join(SKILL_DIR, 'SKILL.md'), 'utf8');
    const config = fs.readFileSync(
      path.join(SKILL_DIR, 'agents', 'openai.yaml'),
      'utf8',
    );
    const contract = fs.readFileSync(
      path.join(SKILL_DIR, 'references', 'contract.md'),
      'utf8',
    );

    expect(skill).toMatch(/Kind:\*\* Building block/);
    expect(skill).toMatch(/ponytail|YAGNI|do less/i);
    expect(skill).toMatch(/Standalone/);
    expect(skill).toMatch(/Composed/);
    expect(config).toMatch(/allow_implicit_invocation:\s+true/);
    expect(contract).toMatch(
      /repository's helper[\s\S]*standard library[\s\S]*native platform[\s\S]*installed dependency/,
    );
    expect(contract).toMatch(/security, accessibility/);
    expect(contract).toMatch(/not merely\s+line count/);
    expect(contract).toMatch(
      /inventory\s+the\s+target\s+file's\s+sibling\s+modules[\s\S]*searching\s+only\s+for\s+the\s+requested\s+function\s+name\s+is\s+not\s+a\s+repository-reuse\s+check/,
    );
  });

  it('delivers the canonical contract through Codex and Claude plugin roots', () => {
    const hooks = JSON.parse(
      fs.readFileSync(path.join(ROOT, 'hooks', 'hooks.json'), 'utf8'),
    ) as {
      hooks: Record<string, Array<{ hooks: Array<{ command: string }> }>>;
    };
    const command = hooks.hooks.SessionStart[0].hooks[0].command;

    expect(hooks.hooks).toHaveProperty('SessionStart');
    expect(hooks.hooks).toHaveProperty('SubagentStart');
    expect(command).toMatch(/PLUGIN_ROOT/);
    expect(command).toMatch(/CLAUDE_PLUGIN_ROOT/);

    for (const env of [
      { PLUGIN_ROOT: ROOT, CLAUDE_PLUGIN_ROOT: '' },
      { PLUGIN_ROOT: '', CLAUDE_PLUGIN_ROOT: ROOT },
    ]) {
      const output = execFileSync('/bin/sh', ['-c', command], {
        cwd: ROOT,
        encoding: 'utf8',
        env: { ...process.env, ...env },
      });
      expect(output).toContain('Ponytail Minimum Solution Gate');
      expect(output.split(/\s+/).length).toBeLessThan(220);
    }
  });

  it('supports the new off switch and the compatibility alias', () => {
    const script = path.join(ROOT, 'hooks', 'ponytail.mjs');
    for (const disabled of [
      { VS_PONYTAIL: 'off' },
      { VS_MINIMUM_SOLUTION: 'off' },
    ]) {
      const output = execFileSync(process.execPath, [script], {
        encoding: 'utf8',
        env: { ...process.env, PLUGIN_ROOT: ROOT, ...disabled },
      });
      expect(output).toBe('');
    }
  });

  it('is composed at shape, pushback, build, and review decision points', () => {
    const shape = fs.readFileSync(
      path.join(ROOT, 'skills', 'vs-shape-it', 'SKILL.md'),
      'utf8',
    );
    const build = fs.readFileSync(
      path.join(ROOT, 'skills', 'vs-build-it', 'SKILL.md'),
      'utf8',
    );
    const pushback = fs.readFileSync(
      path.join(ROOT, 'skills', 'vs-pushback', 'SKILL.md'),
      'utf8',
    );
    const review = fs.readFileSync(
      path.join(ROOT, 'skills', 'vs-roast-code', 'SKILL.md'),
      'utf8',
    );

    expect(shape).toMatch(/vs-ponytail\/SKILL\.md/);
    expect(shape).toMatch(/Ponytail cut/);
    expect(pushback).toMatch(/vs-ponytail\/SKILL\.md/);
    expect(pushback).toMatch(/smaller complete alternative/i);
    expect(build).toMatch(/vs-ponytail\/SKILL\.md/);
    expect(build).toMatch(/Ponytail decision/);
    expect(build).toMatch(/final Ponytail pass/i);
    expect(build).toMatch(/inventory sibling[\s\S]*exports\/helpers/);
    expect(review).toMatch(/vs-ponytail\/SKILL\.md/);
    expect(review).toMatch(/Ponytail pass/);
    expect(review).toMatch(/dependency[\s\S]*wrapper[\s\S]*branch|wrapper[\s\S]*dependency[\s\S]*branch/i);
  });

  it('registers the skill in every plugin and in the shared kind catalog', () => {
    const claude = JSON.parse(
      fs.readFileSync(path.join(ROOT, '.claude-plugin', 'plugin.json'), 'utf8'),
    ) as { skills: string[] };
    const shared = fs.readFileSync(
      path.join(ROOT, 'skills', 'vs-internal-shared', 'SKILL.md'),
      'utf8',
    );

    expect(claude.skills).toContain('./skills/vs-ponytail');
    expect(shared).toMatch(/Building block[^\n]+vs-ponytail/);
  });
});
