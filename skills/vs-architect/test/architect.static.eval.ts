import * as fs from 'node:fs';
import * as path from 'node:path';
import { describe, expect, it } from 'vitest';

const SKILL_DIR = path.resolve(__dirname, '..');
const SKILL = fs.readFileSync(path.join(SKILL_DIR, 'SKILL.md'), 'utf8');
const PLAYBOOK = fs.readFileSync(
  path.join(SKILL_DIR, 'references', 'review-playbook.md'),
  'utf8',
);
const INTERFACES = fs.readFileSync(
  path.join(SKILL_DIR, 'references', 'interface-options.md'),
  'utf8',
);
const CLAUDE_PLUGIN = fs.readFileSync(
  path.resolve(SKILL_DIR, '..', '..', '.claude-plugin', 'plugin.json'),
  'utf8',
);
const README = fs.readFileSync(path.resolve(SKILL_DIR, '..', '..', 'README.md'), 'utf8');

describe('vs-architect contract', () => {
  it('is registered and discoverable', () => {
    expect(JSON.parse(CLAUDE_PLUGIN).skills).toContain('./skills/vs-architect');
    expect(README).toMatch(/`\/vs-architect`.*deepen/i);
  });

  it('reuses VS architecture and workflow contracts', () => {
    expect(SKILL).toMatch(/architecture-depth-dimension\.md/);
    expect(SKILL).toMatch(/context-docs\.md/);
    expect(SKILL).toMatch(/subagents\.md/);
    expect(SKILL).toMatch(/rich-artifacts\.md/);
    expect(SKILL).toMatch(/\/vs-shape-it/);
    expect(SKILL).toMatch(/Phase Boundaries/);
  });

  it('keeps discovery read-only and candidate-gated', () => {
    expect(SKILL).toMatch(/Do not modify source code, tests, configuration, `CONTEXT\.md`, or ADRs/);
    expect(SKILL).toMatch(/Do not propose a new interface until the user selects a candidate/);
    expect(SKILL).toMatch(/Which candidate would you like to shape\?/);
    expect(SKILL).toMatch(/Do not create bespoke Tailwind\/CDN report code/);
  });

  it('requires evidence-backed deepening rather than refactor vibes', () => {
    for (const field of [
      'Dissolves',
      'Files/modules',
      'Problem',
      'Evidence',
      'Suggested deepening',
      'Test surface',
      'Locality/leverage',
      'Deletion test',
      'Dependencies',
      'Dependency direction',
      'ADR',
      'Confidence',
    ]) {
      expect(PLAYBOOK).toContain(`- ${field}:`);
    }
    expect(PLAYBOOK).toMatch(/two callers/i);
    expect(PLAYBOOK).toMatch(/rename, move, wrap, or invert code/i);
    expect(PLAYBOOK).toMatch(/One adapter is a hypothetical seam/);
  });

  it('uses a change-together lens with hidden, needless, surplus, and special cases', () => {
    expect(SKILL).toMatch(/should these change together\?/i);
    expect(SKILL).toMatch(/\*\*Hidden links\*\*/);
    expect(SKILL).toMatch(/\*\*Needless links\*\*/);
    expect(SKILL).toMatch(/\*\*Surplus\*\*/);
    expect(SKILL).toMatch(/hand-synced lists/);
    expect(SKILL).toMatch(/split ownership/);
    expect(SKILL).toMatch(/importable internals/);
    expect(SKILL).toMatch(/two supported ways to do one task/);
    expect(SKILL).toMatch(/one-value `if`/);
    expect(SKILL).toMatch(/swallowed exception/);
    expect(SKILL).toMatch(/disabled test/);
    expect(SKILL).toMatch(/Stay read-only: list them as candidate evidence/);
  });

  it('requires git co-change counts for always-change-together claims', () => {
    expect(PLAYBOOK).toMatch(/## Co-change evidence/);
    expect(PLAYBOOK).toMatch(/git log --since=/);
    expect(PLAYBOOK).toMatch(/N\/M commits that touched A also touched B/);
    expect(SKILL).toMatch(/cite git co-change counts/);
  });

  it('groups file:line problems under one dissolving deepening', () => {
    expect(PLAYBOOK).toMatch(/Group several file:line problems/);
    expect(PLAYBOOK).toContain('- Dissolves:');
    expect(PLAYBOOK).toMatch(/`path\/a\.ts:12`/);
  });

  it('checks dependency direction: nothing imports more volatile code', () => {
    expect(PLAYBOOK).toMatch(/## Dependency direction/);
    expect(PLAYBOOK).toMatch(
      /nothing imports anything more volatile than itself/,
    );
    expect(SKILL).toMatch(
      /nothing imports anything more\s+volatile than itself/,
    );
  });

  it('compares interfaces only after selection and within shared budgets', () => {
    expect(INTERFACES).toMatch(/only after the user selects/i);
    expect(INTERFACES).toMatch(/two or three structurally different options/i);
    expect(INTERFACES).toMatch(/parent\s+always\s+owns\s+one\s+option/i);
    expect(INTERFACES).toMatch(/return the comparison to `\/vs-shape-it`/i);
  });
});
