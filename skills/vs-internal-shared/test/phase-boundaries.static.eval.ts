import * as fs from 'fs';
import * as path from 'path';
import { describe, expect, it } from 'vitest';

const SKILLS_DIR = path.resolve(__dirname, '..', '..');
const PHASE_BOUNDARIES = fs.readFileSync(
  path.resolve(__dirname, '..', 'references', 'phase-boundaries.md'),
  'utf8',
);
const VS_NEXT = fs.readFileSync(
  path.join(SKILLS_DIR, 'vs-next', 'SKILL.md'),
  'utf8',
);
const VS_NEXT_OPENAI = fs.readFileSync(
  path.join(SKILLS_DIR, 'vs-next', 'agents', 'openai.yaml'),
  'utf8',
);
const SHAPE_IT = fs.readFileSync(
  path.join(SKILLS_DIR, 'vs-shape-it', 'SKILL.md'),
  'utf8',
);
const CLAUDE_PLUGIN = fs.readFileSync(
  path.resolve(SKILLS_DIR, '..', '.claude-plugin', 'plugin.json'),
  'utf8',
);

const WORKFLOWS = [
  'vs-shape-it',
  'vs-improve',
  'vs-build-it',
  'vs-ship-it',
  'vs-bugfix',
  'vs-fix-pr',
  'vs-baby-sit',
  'vs-orchestrate',
];

describe('phase-boundary routing', () => {
  it('separates the semantic next workflow from session treatment', () => {
    expect(PHASE_BOUNDARIES).toMatch(/semantic route/i);
    expect(PHASE_BOUNDARIES).toMatch(/session action/i);

    for (const route of [
      'continue',
      'subagent',
      'handoff',
      'compact',
      'clear',
      'stop',
    ]) {
      expect(PHASE_BOUNDARIES).toMatch(new RegExp(`\\b${route}\\b`, 'i'));
    }
  });

  it('keeps subagents orthogonal to context cleanup', () => {
    expect(PHASE_BOUNDARIES).toMatch(/subagent[\s\S]{0,160}not a context/i);
    expect(PHASE_BOUNDARIES).toMatch(/parent\s+continues/i);
  });

  it('makes every workflow consult the shared contract at handoff', () => {
    for (const workflow of WORKFLOWS) {
      const skill = fs.readFileSync(
        path.join(SKILLS_DIR, workflow, 'SKILL.md'),
        'utf8',
      );
      expect(skill, workflow).toContain(
        '../vs-internal-shared/references/phase-boundaries.md',
      );
    }
  });

  it('exposes vs-next for implicit model routing without duplicating policy', () => {
    expect(VS_NEXT).not.toMatch(/disable-model-invocation:\s*true/);
    expect(VS_NEXT_OPENAI).toMatch(/allow_implicit_invocation:\s*true/);
    expect(VS_NEXT).toContain(
      '../vs-internal-shared/references/phase-boundaries.md',
    );
    expect(VS_NEXT).toMatch(/exactly one recommendation/i);
    expect(CLAUDE_PLUGIN).toContain('./skills/vs-next');
  });

  it('keeps long-horizon shaping inside shape-it', () => {
    expect(SHAPE_IT).toMatch(/long-horizon shaping/i);
    expect(SHAPE_IT).toMatch(/Status:\s*SHAPING/i);
    expect(SHAPE_IT).toMatch(/Open decisions/i);
    expect(SHAPE_IT).toMatch(/resume.*spec/is);
    expect(SHAPE_IT).not.toMatch(/wayfinder/i);
  });
});
