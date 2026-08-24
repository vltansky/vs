import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = path.resolve(__dirname, '..', '..', '..');
const reference = fs.readFileSync(
  path.join(ROOT, 'skills', 'vs-ponytail', 'references', 'contract.md'),
  'utf8',
);
const hooks = JSON.parse(
  fs.readFileSync(path.join(ROOT, 'hooks', 'hooks.json'), 'utf8'),
) as {
  hooks: Record<string, unknown>;
};
const compositionSkills = [
  'vs-shape-it',
  'vs-architect',
  'vs-build-it',
  'vs-prototype',
  'vs-bugfix',
  'vs-fix-pr',
  'vs-tdd',
  'vs-perf',
  'vs-improve',
  'vs-deslop',
  'vs-roast-code',
];

describe('minimum-solution guidance', () => {
  it('keeps the ordered ladder and safety floor', () => {
    expect(reference).toMatch(/repository's helper[\s\S]*standard library[\s\S]*native platform[\s\S]*installed dependency/);
    expect(reference).toMatch(/security, accessibility/);
    expect(reference).toMatch(/not merely\s+line count/);
  });

  it('loads for root sessions and subagents', () => {
    expect(hooks.hooks).toHaveProperty('SessionStart');
    expect(hooks.hooks).toHaveProperty('SubagentStart');

    // Claude auto-loads hooks/hooks.json; a manifest reference would register
    // the hooks twice (fc9ca60). Codex has no auto-load, so its manifest must
    // keep the reference.
    const claudePlugin = JSON.parse(
      fs.readFileSync(path.join(ROOT, '.claude-plugin', 'plugin.json'), 'utf8'),
    ) as { hooks?: string };
    expect(claudePlugin.hooks).toBeUndefined();
    const codexPlugin = JSON.parse(
      fs.readFileSync(path.join(ROOT, '.codex-plugin', 'plugin.json'), 'utf8'),
    ) as { hooks?: string };
    expect(codexPlugin.hooks).toBe('./hooks/hooks.json');
  });

  it('composes into every workflow where solution size is a decision', () => {
    for (const skill of compositionSkills) {
      const source = fs.readFileSync(
        path.join(ROOT, 'skills', skill, 'SKILL.md'),
        'utf8',
      );
      expect(source, skill).toMatch(/vs-ponytail\/SKILL\.md/);
    }

    expect(reference).toMatch(/never understanding, research,[\s\S]*evidence,[\s\S]*verification, safety/);
  });

  it('pins an unmodified pure-Ponytail comparison arm', () => {
    const baseline = fs.readFileSync(
      path.join(
        ROOT,
        'skills',
        'vs-build-it',
        'test',
        'baselines',
        'ponytail-full.md',
      ),
    );
    const source = JSON.parse(
      fs.readFileSync(
        path.join(
          ROOT,
          'skills',
          'vs-build-it',
          'test',
          'baselines',
          'ponytail-full.source.json',
        ),
        'utf8',
      ),
    ) as { commit: string; license: string };
    const license = fs.readFileSync(
      path.join(
        ROOT,
        'skills',
        'vs-build-it',
        'test',
        'baselines',
        'LICENSE.ponytail',
      ),
      'utf8',
    );

    expect(createHash('sha256').update(baseline).digest('hex')).toBe(
      '1316a2f3f95741d2300b116fe0c2d81ce4a9568656ed0a62643f54aaf09957f2',
    );
    expect(source).toEqual(
      expect.objectContaining({
        commit: '2ed6c52c9d7e5e56942508591085fd45dea277d3',
        license: 'MIT',
      }),
    );
    expect(license).toContain('Copyright (c) 2026 DietrichGebert');
    expect(license).toContain('MIT License');
  });

  it('emits concise context and supports an off switch', () => {
    const script = path.join(ROOT, 'hooks', 'ponytail.mjs');
    const enabled = execFileSync(process.execPath, [script], {
      encoding: 'utf8',
      env: { ...process.env, PLUGIN_ROOT: ROOT },
    });
    const disabled = execFileSync(process.execPath, [script], {
      encoding: 'utf8',
      env: { ...process.env, PLUGIN_ROOT: ROOT, VS_MINIMUM_SOLUTION: 'off' },
    });

    expect(enabled).toContain('Ponytail Minimum Solution Gate');
    expect(enabled.split(/\s+/).length).toBeLessThan(220);
    expect(disabled).toBe('');
  });
});
