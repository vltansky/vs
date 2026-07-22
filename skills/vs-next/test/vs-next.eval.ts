import * as path from 'path';
import { check, createAgent, evaluate } from '@wix/pathgrade';
import { describe, expect, it } from 'vitest';

const SKILL_DIR = path.resolve(__dirname, '..');
const EVAL_AGENT = (process.env.PATHGRADE_AGENT ?? 'claude') as
  | 'claude'
  | 'codex';

const CASES = [
  {
    name: 'continue',
    expected: /Recommendation:\s*continue/i,
    prompt:
      'We finished choosing the API shape and I want to write its tests and implementation next. The decisions are only in this conversation, the context is still clear, and it is the same small feature. What should happen now? Recommend only; do not change files.',
  },
  {
    name: 'subagent',
    expected: /Recommendation:\s*use a subagent/i,
    prompt:
      'I am continuing the main implementation here. An independent check of the official compatibility docs can run in parallel, will not edit the same files, and I can integrate the result. What should happen now? Recommend only; do not change files.',
  },
  {
    name: 'handoff',
    expected: /Recommendation:\s*hand off/i,
    prompt:
      'I am halfway through debugging locally but the next work must move to a remote workspace. The key hypotheses and failed experiments exist only in this conversation, not in a durable artifact. What should happen now? Recommend only; do not write the artifact yet.',
  },
  {
    name: 'compact',
    expected: /Recommendation:\s*\/compact/i,
    prompt:
      'The research phase is complete and its findings are saved in a cited report. I want to write the RFC next in this same conversation, but the verbatim research history is large and no longer needed. What should happen now? Recommend only.',
  },
  {
    name: 'clear',
    expected: /Recommendation:\s*\/clear/i,
    prompt:
      'The approved spec and implementation tickets now contain every decision and constraint. The next ticket can start entirely from those artifacts, and the exploratory conversation is disposable. What should happen now? Recommend only.',
  },
  {
    name: 'stop',
    expected: /Recommendation:\s*stop/i,
    prompt:
      'The requested audit is complete. Deployment would be new scope, is not authorized, and requires an explicit production approval. What should happen now? Recommend only.',
  },
] as const;

describe('vs-next behavior', () => {
  for (const scenario of CASES) {
    it(`chooses ${scenario.name} without offering a menu`, async () => {
      const agent = await createAgent({
        agent: EVAL_AGENT,
        timeout: 300,
        skillDir: SKILL_DIR,
      });

      await agent.prompt(scenario.prompt);

      const result = await evaluate(
        agent,
        [
          check(`${scenario.name}-route`, ({ transcript }) =>
            scenario.expected.test(transcript),
          ),
          check('one-recommendation', ({ transcript }) => {
            const recommendations = transcript.match(/^Recommendation:/gim) ?? [];
            return recommendations.length === 1;
          }),
          check('includes-reason-and-next', ({ transcript }) =>
            /^Why:.+\nNext:.+/im.test(transcript),
          ),
        ],
        { failFast: false, onScorerError: 'zero' },
      );

      expect(result.score).toBe(1);
      await agent.dispose();
    });
  }
});
