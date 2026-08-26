import * as fs from 'fs';
import * as path from 'path';
import { describe, it, expect } from 'vitest';
import {
  check,
  toolUsage,
  evaluate,
} from '@wix/pathgrade';
import {
  hasAskUserEvent,
  promptAllowingAskUserInterrupt,
  promptOnce,
} from '../../vs-internal-shared/test/pathgrade-v1';
import { createAgent } from '../../vs-internal-shared/test/pathgrade-agent';

const SKILL_DIR = path.resolve(__dirname, '..');
const FIXTURE_DIR = path.join(__dirname, 'fixtures', 'review-thread-gates');
const CI_REVIEW_FIXTURE_DIR = path.join(
  __dirname,
  'fixtures',
  'ci-and-review',
);
const EVAL_AGENT = (process.env.PATHGRADE_AGENT ?? 'codex') as 'claude' | 'codex';
const COPY_FROM_HOME =
  EVAL_AGENT === 'codex' ? ['.codex/auth.json'] : undefined;
const SKILL = fs.readFileSync(path.join(SKILL_DIR, 'SKILL.md'), 'utf8');
const OPENAI_CONFIG = fs.readFileSync(
  path.join(SKILL_DIR, 'agents', 'openai.yaml'),
  'utf8',
);

describe('fix-pr routing', () => {
  it('allows implicit invocation for PR comment requests', () => {
    expect(SKILL).not.toContain('disable-model-invocation: true');
    expect(SKILL).toMatch(/see, check, review, address, or fix a PR/);
    expect(SKILL).toMatch(/comments or feedback, or its failing CI/);
    expect(OPENAI_CONFIG).toContain('allow_implicit_invocation: true');
  });

  it('keeps see-comments requests read-only', () => {
    expect(SKILL).toContain('**Inspect only:**');
    expect(SKILL).toMatch(
      /Do\s+not edit, commit, push, rerun CI, reply, or resolve threads/,
    );
    expect(SKILL).toMatch(/Stop after the\s+report\./);
  });

  it('uses address mode as reply-and-resolve authority for accepted feedback', () => {
    expect(SKILL).toContain('**Address PR:**');
    expect(SKILL).toMatch(
      /initial address request authorizes[^.]*posting[^.]*repl(?:y|ies)[^.]*resolving[^.]*accepted[^.]*inline\s+threads/i,
    );
    expect(SKILL).toMatch(/Do not ask for a second approval/i);
    expect(SKILL).toMatch(
      /Ambiguous or\s+declined feedback[^.]*user decision[^.]*remain open/i,
    );
  });
});

function createFixPrAgent(timeout: number) {
  return createAgent({
    agent: EVAL_AGENT,
    timeout,
    skillDir: SKILL_DIR,
    workspace: FIXTURE_DIR,
    copyFromHome: COPY_FROM_HOME,
    debug: true,
  });
}

function getAskUserPayload(toolEvents: Array<{ action: string; arguments?: Record<string, unknown> }>) {
  const askEvent = toolEvents.find((event) => event.action === 'ask_user');
  return JSON.stringify(askEvent?.arguments ?? {});
}

describe('fix-pr', () => {
  it('hands completed address-mode work to baby-sit', async () => {
    const agent = await createFixPrAgent(240);

    try {
      await promptOnce(
        agent,
        'Use fix-pr. Read docs/post-fix-handoff.md and continue from that exact state. ' +
          'Do not fetch GitHub or repeat the repair. Perform the normal next workflow action.',
      );

      const result = await evaluate(agent, [
        check('starts-baby-sit', ({ transcript }) =>
          /(?:start|hand|transition|compose).*(?:vs-baby-sit|babysit|baby-sit)/is.test(
            transcript,
          )),
        check('does-not-rediscover-or-repeat-repair', ({ transcript }) =>
          /(?:do not|did not|won't|without).*(?:fetch|discover)/is.test(transcript) &&
          /(?:do not|did not|won't|without).*(?:repeat|re-run).*repair/is.test(
            transcript,
          )),
      ], {
        failFast: false,
        onScorerError: 'zero',
      });

      expect(result.score).toBe(1);
    } finally {
      await agent.dispose();
    }
  });

  it('repairs PR-owned CI and review-body feedback in one cycle', async () => {
    const agent = await createAgent({
      agent: EVAL_AGENT,
      timeout: 480,
      skillDir: SKILL_DIR,
      workspace: CI_REVIEW_FIXTURE_DIR,
      copyFromHome: COPY_FROM_HOME,
      debug: true,
    });

    try {
      await agent.exec('git init -q');
      await agent.exec('git config user.name "Pathgrade"');
      await agent.exec('git config user.email "pathgrade@example.invalid"');
      await agent.exec('git add .');
      await agent.exec('git commit -qm "fixture: initial state"');

      await promptOnce(
        agent,
        'Use fix-pr and continue from handoff.md. Fix every PR-owned CI failure and actionable feedback already recorded there. Do not fetch GitHub again, do not start a dev server, and do not post or resolve feedback in this fixture.',
      );

      const result = await evaluate(
        agent,
        [
          check('focused-tests-pass', async ({ runCommand }) => {
            const { exitCode } = await runCommand('npm test');
            return exitCode === 0;
          }),
          check('fallback-is-implemented', async ({ runCommand }) => {
            const { stdout } = await runCommand('node -e "import(\'./src/slug.js\').then(({slugify}) => console.log(slugify(\'!!!\')))"');
            return stdout.trim() === 'untitled';
          }),
          check('review-body-is-addressed', ({ workspace }) => {
            const docs = fs.readFileSync(
              path.join(workspace, 'docs', 'behavior.md'),
              'utf8',
            );
            return /punctuation|empty|fallback/i.test(docs) &&
              /untitled/i.test(docs);
          }),
          check('does-not-add-a-dependency', async ({ runCommand }) => {
            const { stdout } = await runCommand(
              'git diff HEAD -- package.json package-lock.json',
            );
            return stdout.trim() === '';
          }),
          check('recognizes-both-work-surfaces', ({ transcript }) =>
            /CI|unit|test failure/i.test(transcript) &&
            /review (submission )?body|feedback|document/i.test(transcript),
          ),
          check('respects-explicit-no-post-boundary', ({ transcript }) =>
            /do not post|won't post|not post|without.*post/i.test(transcript),
          ),
        ],
        { failFast: false, onScorerError: 'zero' },
      );

      expect(result.score).toBeGreaterThanOrEqual(5 / 6);
    } finally {
      await agent.dispose();
    }
  });

  it('uses address authority to reply and resolve an accepted inline thread', async () => {
    const agent = await createFixPrAgent(360);

    try {
      await promptOnce(
        agent,
        'Use fix-pr. Read docs/reply-resolve-authority.md and continue from that exact state. ' +
          'Do not fetch PR data or contact GitHub. State the normal next actions.',
      );

      const result = await evaluate(agent, [
        check(
          'does-not-add-a-second-approval-gate',
          ({ toolEvents }) =>
            !hasAskUserEvent(toolEvents),
          { weight: 5 },
        ),
        check(
          'proceeds-to-reply-and-resolve',
          ({ transcript }) =>
            /(?:post|send).*repl(?:y|ies)/is.test(transcript) &&
            /resolv.*thread/is.test(transcript),
          { weight: 2 },
        ),
        check(
          'uses-the-prepared-thread-specific-reply',
          ({ transcript }) =>
            /draft(?:ed)? reply|prepared reply/i.test(transcript) &&
            /accepted (?:inline )?thread/i.test(transcript),
          { weight: 2 },
        ),
      ], {
        failFast: false,
        onScorerError: 'zero',
      });

      expect(result.score).toBeGreaterThanOrEqual(0.85);
    } finally {
      await agent.dispose();
    }
  });

  it('uses ask-user tool when an inline review thread is ambiguous', async () => {
    const agent = await createFixPrAgent(360);

    try {
      await promptAllowingAskUserInterrupt(
        agent,
        'Use fix-pr. Read docs/ambiguous-thread.md and continue from that exact state. ' +
          'Do not fetch PR data again. Do not post anything yet. I want the normal unsure-path escalation for this thread.',
      );

      const result = await evaluate(agent, [
        check(
          'uses-ask-user-tool-for-unsure-path',
          ({ toolEvents }) =>
            hasAskUserEvent(
              toolEvents,
              /implement it|decline with rationale|edit my draft reply first|what should we do/i,
            ),
          { weight: 5 },
        ),
        check(
          'mentions-unsure-path-options',
          ({ toolEvents }) => {
            const payload = getAskUserPayload(toolEvents);
            return (
              /implement it/i.test(payload) &&
              /decline with rationale/i.test(payload) &&
              /edit.*(draft|reply)|edit first/i.test(payload)
            );
          },
          { weight: 2 },
        ),
        check(
          'explains-the-ambiguity',
          ({ transcript, toolEvents }) => {
            const haystack = `${transcript}\n${getAskUserPayload(toolEvents)}`;
            return /retry/i.test(haystack) &&
              /caller|call site|ownership boundary|shared backoff|wrapper/i.test(
                haystack,
              );
          },
          { weight: 2 },
        ),
        toolUsage('unsure-path-tooling', [
          { action: 'read_file', min: 1, weight: 0.2 },
          { action: 'ask_user', min: 1, weight: 0.8 },
        ]),
      ], {
        failFast: false,
        onScorerError: 'zero',
      });

      expect(result.score).toBeGreaterThanOrEqual(0.85);
    } finally {
      await agent.dispose();
    }
  });
});
