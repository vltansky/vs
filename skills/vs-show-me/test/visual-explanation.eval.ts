import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { check, evaluate } from '@wix/pathgrade';
import { describe, expect, it } from 'vitest';
import { createAgent } from '../../vs-internal-shared/test/pathgrade-agent';
import { promptOnce } from '../../vs-internal-shared/test/pathgrade-v1';

const SKILL_DIR = path.resolve(__dirname, '..');
const EVAL_AGENT = (process.env.PATHGRADE_AGENT ?? 'codex') as 'claude' | 'codex';

function sourceBlock(workspace: string): string {
  const file = path.join(workspace, 'result.html');
  if (!fs.existsSync(file)) return '';
  const artifact = fs.readFileSync(file, 'utf8');
  return artifact.match(/<script\b[^>]*type="text\/htmdx"[^>]*>([\s\S]*?)<\/script>/)?.[1] ?? '';
}

describe('vs-show-me visual explanation behavior', () => {
  it('combines system structure with a purpose-built visual explanation', async () => {
    const workspace = fs.mkdtempSync(path.join(os.tmpdir(), 'vs-show-me-visual-'));
    const agent = await createAgent({
      agent: EVAL_AGENT,
      timeout: 600,
      skillDir: SKILL_DIR,
      workspace,
      copyFromHome: EVAL_AGENT === 'codex' ? ['.codex/auth.json'] : undefined,
    });

    try {
      await promptOnce(
        agent,
        'Use $vs-show-me to create result.html. Explain a background import job to a product manager. It moves from queued to running, then either succeeds or fails. The running example has completed 3 of 5 tasks. A failed job shows its error and can be retried. Make the lifecycle and each state visually easy to understand. Do not invent other metrics.',
      );

      const result = await evaluate(
        agent,
        [
          check('creates-portable-artifact', ({ workspace }) => {
            const file = path.join(workspace, 'result.html');
            return fs.existsSync(file) && sourceBlock(workspace).length > 0;
          }),
          check('shows-branching-relationship', ({ workspace }) =>
            /```mermaid|<(?:Sequence|Flow)\b/.test(sourceBlock(workspace)),
          ),
          check('composes-shadcn-primitives', ({ workspace }) => {
            const source = sourceBlock(workspace);
            const components = new Set(
              [...source.matchAll(/<(Card|Badge|Alert|Progress|Tooltip)\b/g)].map((match) => match[1]),
            );
            return components.size >= 2;
          }),
          check('creates-deliberate-visual-hierarchy', ({ workspace }) => {
            const source = sourceBlock(workspace);
            const shapedLayout = /(?:grid-cols-\[|col-span-|row-span-|absolute|relative[^"\n]*(?:z-|before:|after:)|rounded-full|data:image\/svg\+xml)/.test(source);
            const onlyUniformCards = /md:grid-cols-2/.test(source) && !shapedLayout;
            return shapedLayout && !onlyUniformCards;
          }),
          check('preserves-the-lifecycle-facts', ({ workspace }) => {
            const source = sourceBlock(workspace);
            return /queued/i.test(source) && /running/i.test(source) && /succeeds?|success/i.test(source) && /fails?|failed/i.test(source) && /3\s*(?:of|\/)\s*5/i.test(source);
          }),
          check('does-not-invent-metrics', ({ workspace }) =>
            !/\b\d+(?:\.\d+)?\s*(?:ms|%|req\/s|requests?|seconds?)\b/i.test(sourceBlock(workspace)),
          ),
        ],
        { failFast: false, onScorerError: 'zero' },
      );

      expect(result.score).toBe(1);
    } finally {
      await agent.dispose();
      fs.rmSync(workspace, { recursive: true, force: true });
    }
  });
});
