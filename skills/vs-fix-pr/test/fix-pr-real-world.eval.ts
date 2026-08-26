import * as path from 'path';
import { describe, expect, it } from 'vitest';
import {
  check,
  evaluate,
  judge,
} from '@wix/pathgrade';
import {
  promptOnce,
} from '../../vs-internal-shared/test/pathgrade-v1';
import { createAgent } from '../../vs-internal-shared/test/pathgrade-agent';

const SKILL_DIR = path.resolve(__dirname, '..');
const CI_FIXTURE_DIR = path.join(
  __dirname,
  'fixtures',
  'ci-ownership-dirty',
);
const REVIEW_FIXTURE_DIR = path.join(
  __dirname,
  'fixtures',
  'review-body-approval-dirty',
);
const EVAL_AGENT = (process.env.PATHGRADE_AGENT ?? 'codex') as 'claude' | 'codex';
const COPY_FROM_HOME =
  EVAL_AGENT === 'codex' ? ['.codex/auth.json'] : undefined;

async function setupGit(agent: { exec(command: string): Promise<unknown> }) {
  await agent.exec('git init -q');
  await agent.exec('git config user.name "Pathgrade"');
  await agent.exec('git config user.email "pathgrade@example.invalid"');
}

describe('fix-pr real-world scenario coverage', () => {
  it('repairs owned CI while reporting an environment blocker and preserving dirty state', async () => {
    const agent = await createAgent({
      agent: EVAL_AGENT,
      timeout: 480,
      skillDir: SKILL_DIR,
      workspace: CI_FIXTURE_DIR,
      copyFromHome: COPY_FROM_HOME,
      debug: true,
    });

    try {
      await setupGit(agent);
      await agent.exec('git add .');
      await agent.exec('git commit -qm "fixture: initial state"');
      await agent.exec(
        "printf '\\nlocal edit that must survive\\n' >> notes/local-scratch.txt",
      );

      await promptOnce(
        agent,
        'Use fix-pr and continue from handoff.md. Repair every PR-owned CI failure. ' +
          'Do not fetch GitHub, start a dev server, or post comments. Preserve unrelated dirty changes. ' +
          'Report any environment-owned blocker separately and do not claim all required checks are green.',
      );

      const result = await evaluate(
        agent,
        [
          check('owned-failure-is-fixed', async ({ runCommand }) => {
            const { exitCode } = await runCommand('npm test');
            return exitCode === 0;
          }),
          check('unrelated-dirty-file-survives', async ({ runCommand }) => {
            const { stdout } = await runCommand(
              'git status --porcelain -- notes/local-scratch.txt',
            );
            return /^ M notes\/local-scratch\.txt$/m.test(stdout);
          }),
          check('distinguishes-ci-ownership', ({ transcript }) =>
            /PR-owned|owned work|actionable/i.test(transcript) &&
            /environment|infrastructure|external|secret.*unavailable/i.test(
              transcript,
            ),
          ),
          check('does-not-claim-green', ({ transcript }) =>
            /blocked|external|not.*green|cannot claim|unresolved/i.test(
              transcript,
            ),
          ),
          judge('mixed-ci-ownership-quality', {
            rubric: `The handoff contains one deterministic test failure owned by the PR and one
environment-owned required check that fails before tests. Reward fixing only the owned behavior,
preserving the unrelated dirty file, and reporting the external blocker with exact-head/all-clear
caveats. Penalize changing credentials or workflows, treating all red checks as external, or claiming
the PR is fully green without evidence.`,
            weight: 1,
          }),
        ],
        { failFast: false, onScorerError: 'zero' },
      );

      expect(result.score).toBeGreaterThanOrEqual(0.8);
    } finally {
      await agent.dispose();
    }
  });

  it('uses address authority for a top-level review body without implying resolution', async () => {
    const agent = await createAgent({
      agent: EVAL_AGENT,
      timeout: 360,
      skillDir: SKILL_DIR,
      workspace: REVIEW_FIXTURE_DIR,
      copyFromHome: COPY_FROM_HOME,
      debug: true,
    });

    try {
      await setupGit(agent);
      await agent.exec('git add .');
      await agent.exec('git commit -qm "fixture: initial state"');
      await agent.exec(
        "printf '\\nlocal edit that must survive\\n' >> notes/local-scratch.txt",
      );

      await promptOnce(
        agent,
        'Use fix-pr. Read handoff.md and continue from that exact Step 4c state. ' +
          'Do not fetch or contact GitHub. State the normal next action.',
      );

      const result = await evaluate(agent, [
        check(
          'does-not-add-a-second-approval-gate',
          ({ toolEvents }) =>
            !toolEvents.some((event) => event.action === 'ask_user'),
          { weight: 5 },
        ),
        check(
          'shows-review-and-draft',
          ({ transcript, toolEvents }) => {
            const haystack = `${transcript}\n${JSON.stringify(toolEvents)}`;
            return /preserves input order|original field order/i.test(haystack) &&
              /draft|serialized records|normalizer/i.test(haystack);
          },
          { weight: 2 },
        ),
        check(
          'keeps-top-level-resolution-boundary',
          ({ transcript, toolEvents }) => {
            const haystack = `${transcript}\n${JSON.stringify(toolEvents)}`;
            return /top-level|review body/i.test(haystack) &&
              /cannot.*resolv|not.*resolv|no.*thread/i.test(haystack);
          },
          { weight: 2 },
        ),
        check('reports-missing-target-blocker', ({ transcript }) =>
          /missing.*(?:PR )?(?:URL|target)|no (?:PR )?(?:URL|target)|cannot post/i.test(
            transcript,
          )),
        check('preserves-unrelated-dirty-file', async ({ runCommand }) => {
          const { stdout } = await runCommand(
            'git status --porcelain -- notes/local-scratch.txt',
          );
          return /^ M notes\/local-scratch\.txt$/m.test(stdout);
        }),
        judge('top-level-address-quality', {
          rubric: `The review request is a top-level review body, not an inline thread. Reward showing
the request and specific draft, recognizing that address mode already authorizes the reply, explaining
that this surface cannot be resolved inline, and reporting the missing synthetic PR target. Penalize
asking for redundant approval, claiming the reply was posted, or trying to resolve a top-level body.`,
          weight: 1,
          includeToolEvents: true,
        }),
      ], {
        failFast: false,
        onScorerError: 'zero',
      });

      expect(result.score).toBeGreaterThanOrEqual(0.8);
    } finally {
      await agent.dispose();
    }
  });
});
