import * as path from 'path';
import { check, evaluate, judge } from '@wix/pathgrade';
import { describe, expect, it } from 'vitest';
import { promptOnce } from '../../vs-internal-shared/test/pathgrade-v1';

import { createAgent } from '../../vs-internal-shared/test/pathgrade-agent';

const SKILL_DIR = path.resolve(__dirname, '..');
const EVAL_AGENT = (process.env.PATHGRADE_AGENT ?? 'codex') as 'claude' | 'codex';

async function run(message: string) {
  const agent = await createAgent({
    agent: EVAL_AGENT,
    timeout: 300,
    skillDir: SKILL_DIR,
    copyFromHome: EVAL_AGENT === 'codex' ? ['.codex/auth.json'] : undefined,
  });
  await promptOnce(agent, message);
  return agent;
}

describe('vs-pr-walkthrough behavior', () => {
  it('skips a small PR instead of manufacturing an artifact', async () => {
    const agent = await run(`Use $vs-pr-walkthrough. PR https://github.com/owner/repo/pull/12 changes exactly three small files. This metadata is authoritative; do not fetch GitHub. The user asks: "make this PR easier to read." Explain the correct outcome only.`);
    try {
      const result = await evaluate(agent, [
        check('small-pr-status', ({ transcript }) => /SKIPPED_SMALL_PR/i.test(transcript)),
        check('routes-to-native-diff', ({ transcript }) => /GitHub.{0,50}(native|diff|clearer)|native.{0,50}GitHub/is.test(transcript)),
        check('does-not-claim-artifact', ({ transcript }) => !/READY_FOR_REVIEW|Saved:\s*\S+\.html/i.test(transcript)),
      ]);
      expect(result.score).toBe(1);
    } finally {
      await agent.dispose();
    }
  });

  it('maps a large PR by execution story rather than directory', async () => {
    const agent = await run(`Use $vs-pr-walkthrough in planning-only mode. A 12-file job-retry PR contains these representative files in GitHub's alphabetical order:
- api/routes/jobs.ts
- api/routes/jobs.spec.ts
- generated/openapi.json
- package-lock.json
- persistence/job-repository.ts
- persistence/job-repository.spec.ts
- src/retry-policy.ts
- src/retry-policy.spec.ts
- ui/RetryBanner.tsx
- ui/RetryBanner.spec.tsx
- workers/job-runner.ts
- workers/job-runner.spec.ts

The behavior is: retry-policy defines terminal attempts; job-runner enforces it; repository persists attempts; API exposes state; RetryBanner renders it. Draft only the ordered section map and one-sentence rationale per section. Do not fetch, render, or claim completion.`);
    try {
      const result = await evaluate(agent, [
        judge('behavioral-reading-order', {
          rubric: `Score whether the proposed section map follows the supplied execution story rather than alphabetical or directory order.

1.0: policy comes first, then enforcement and persistence in a defensible dependency order, then API and UI, with tests adjacent to the behavior they verify; generated/openapi and package-lock are in a final plumbing/asides section.
0.5: mostly behavioral, but one major stage is misplaced or tests are all separated into a directory-style section.
0.0: grouped primarily by directories/file types or alphabetical order.`,
          weight: 3,
        }),
        check('plumbing-last', ({ transcript }) => /Aside.{0,20}Plumbing|Plumbing|generated.{0,100}package-lock/is.test(transcript)),
        check('does-not-claim-completion', ({ transcript }) => !/READY_FOR_REVIEW|Saved:\s*\S+\.html/i.test(transcript)),
      ], { failFast: false, onScorerError: 'zero' });
      expect(result.score).toBeGreaterThanOrEqual(0.8);
    } finally {
      await agent.dispose();
    }
  });
});
