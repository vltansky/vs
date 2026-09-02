import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { check, evaluate, judge } from '@wix/pathgrade';
import { describe, expect, it } from 'vitest';
import { createAgent } from '../../vs-internal-shared/test/pathgrade-agent';

const SKILL_DIR = path.resolve(__dirname, '..');
const SKILLS_DIR = path.resolve(SKILL_DIR, '..');
const EVAL_AGENT = (process.env.PATHGRADE_AGENT ?? 'codex') as
  | 'claude'
  | 'codex';

function stageWorkspaceWithSiblingSkills() {
  const workspace = fs.mkdtempSync(path.join(os.tmpdir(), 'vs-eli5-'));
  for (const convention of ['.agents', '.claude']) {
    for (const skill of ['vs-show-me', 'vs-write', 'vs-internal-shared']) {
      fs.cpSync(
        path.join(SKILLS_DIR, skill),
        path.join(workspace, convention, 'skills', skill),
        {
          recursive: true,
          filter: (source) => !source.split(path.sep).includes('test'),
        },
      );
    }
  }
  return workspace;
}

function artifact(workspace: string) {
  const file = path.join(workspace, 'result.html');
  return fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '';
}

function source(workspace: string): string {
  return (
    artifact(workspace).match(
      /<script\b[^>]*type="text\/htmdx"[^>]*>([\s\S]*?)<\/script>/,
    )?.[1] ?? ''
  );
}

describe('vs-eli5 teaching behavior', () => {
  it('builds one beginner mental model with a retrieval check', async () => {
    const workspace = stageWorkspaceWithSiblingSkills();
    const agent = await createAgent({
      agent: EVAL_AGENT,
      timeout: 600,
      skillDir: SKILL_DIR,
      workspace,
      transport: EVAL_AGENT === 'codex' ? 'exec' : undefined,
      debug: true,
    });

    try {
      await agent.prompt(
        'Use $vs-eli5 to create result.html. Explain browser caching to a new product manager who needs to understand why a changed logo can still look old. Keep the explanation to that one mental model.',
      );

      const result = await evaluate(agent, [
        check(
          'creates-visual-explanation',
          ({ workspace }) => source(workspace).length > 0,
        ),
        check('uses-and-maps-a-familiar-analogy', ({ workspace }) => {
          const page = source(workspace);
          return (
            /\b(?:like|imagine|think of)\b/i.test(page) &&
            /\b(?:browser|cache|server|logo)\b/i.test(page)
          );
        }),
        check('explains-the-observed-cause', ({ workspace }) => {
          const page = source(workspace);
          const changedSite =
            /(?:website|file|logo).{0,100}(?:new|updated|changed)|(?:new|updated|changed).{0,100}(?:website|file|logo)/is.test(
              page,
            );
          const reusedCopy =
            /browser.{0,160}(?:reuse|using|show|hand).{0,80}(?:saved|cached|old|local).{0,40}(?:copy|logo)|(?:saved|cached|old|local).{0,80}(?:copy|logo).{0,160}browser/is.test(
              page,
            );
          return changedSite && reusedCopy;
        }),
        check('includes-retrieval-and-feedback', ({ workspace }) => {
          const page = source(workspace);
          return (
            /\b(?:predict(?:ion)?|recall|what happens|try it)\b/i.test(page) &&
            /\b(?:answer|because|why)\b/i.test(page)
          );
        }),
        judge('beginner-teaching-quality', {
          input: ({ workspace }) => ({ 'result.html': artifact(workspace) }),
          rubric: `Evaluate the visible explanation in result.html:
- It teaches one coherent mental model without assuming technical vocabulary. (0-0.4)
- The analogy is explicitly mapped to browser caching rather than left decorative. (0-0.3)
- The prediction prompt and answer help the learner apply that model. (0-0.3)`,
          weight: 0.3,
        }),
      ], {
        failFast: false,
        onScorerError: 'skip',
      });

      expect(result.score).toBeGreaterThanOrEqual(0.9);
    } finally {
      await agent.dispose();
      fs.rmSync(workspace, { recursive: true, force: true });
    }
  }, 660_000);
});
