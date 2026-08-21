import * as fs from 'fs';
import * as path from 'path';
import { describe, it, expect } from 'vitest';
import {
  check,
  judge,
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

  it('routes action requests through approval-gated fixes', () => {
    expect(SKILL).toContain('**Address PR:**');
    expect(SKILL).toMatch(/approval\s+gates before posting replies or resolving/);
  });
});

const APPROVAL_GATE_RUBRIC = `Evaluate whether the agent handled the Step 4c approval gate correctly.

Correct gate (0-0.5):
- Did it stay in the approval-gate phase rather than jumping back to fetching PR state?
- Did it present the existing reviewer comment and drafted reply before asking?
- Did it ask what to do after posting rather than deciding itself?

Tool-first interaction (0-0.3):
- Did it use the host's ask-user question tool for the choice instead of relying on plain chat options alone?
- Were the choices scoped to the real Step 4c options?

Decision quality (0-0.2):
- Did it preserve the difference between "reply and resolve" vs "reply only" vs "edit first"?
- Did it avoid implying resolution without approval?`;

const UNSURE_GATE_RUBRIC = `Evaluate whether the agent handled the Step 4b unsure-path escalation correctly.

Correct escalation (0-0.45):
- Did it explain the ambiguity briefly and accurately?
- Did it ask the user to choose between implement vs decline instead of silently deciding?

Tool-first interaction (0-0.35):
- Did it use the host's ask-user question tool for the choice instead of relying on plain chat options alone?
- Were the offered choices scoped to the real unsure-path options?

Boundary discipline (0-0.2):
- Did it avoid pretending certainty?
- Did it avoid posting or resolving anything before approval?`;

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
        'Use fix-pr and continue from handoff.md. Fix every PR-owned CI failure and actionable feedback already recorded there. Do not fetch GitHub again, do not start a dev server, and do not post or resolve feedback without approval.',
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
          check('preserves-reply-approval', ({ transcript, toolEvents }) =>
            hasAskUserEvent(toolEvents, /reply|resolve|post|approval/i) ||
            /approval.*(reply|resolve|post)|(reply|resolve|post).*approval/i.test(
              transcript,
            ),
          ),
        ],
        { failFast: false, onScorerError: 'zero' },
      );

      expect(result.score).toBeGreaterThanOrEqual(5 / 6);
    } finally {
      await agent.dispose();
    }
  });

  it('uses ask-user tool for the inline-thread reply approval gate', async () => {
    const agent = await createFixPrAgent(360);

    try {
      await promptAllowingAskUserInterrupt(
        agent,
        'Use fix-pr. Read docs/reply-approval.md and continue from that exact state. ' +
          'Do not fetch PR data again. Do not post anything yet. I want the normal approval gate for this drafted reply.',
      );

      const result = await evaluate(agent, [
        check(
          'uses-ask-user-tool-for-approval-gate',
          ({ toolEvents }) =>
            hasAskUserEvent(
              toolEvents,
              /post reply and resolve|post reply only|edit reply first|resolve/i,
            ),
          { weight: 5 },
        ),
        check(
          'mentions-step-4c-options',
          ({ transcript, toolEvents }) => {
            const haystack = `${transcript}\n${getAskUserPayload(toolEvents)}`;
            return (
              /post.*resolve/i.test(haystack) &&
              /post.*only/i.test(haystack) &&
              /edit/i.test(haystack)
            );
          },
          { weight: 2 },
        ),
        check(
          'shows-comment-and-draft-reply',
          ({ transcript, toolEvents }) => {
            const haystack = `${transcript}\n${getAskUserPayload(toolEvents)}`;
            return (
              /include root hooks config in sparse checkout/i.test(haystack) &&
              /draft reply/i.test(haystack) &&
              /fixed in d508598/i.test(haystack)
            );
          },
          { weight: 2 },
        ),
        judge('approval-gate-quality', {
          rubric: APPROVAL_GATE_RUBRIC,
          weight: 0.5,
          includeToolEvents: true,
        }),
        toolUsage('approval-gate-tooling', [
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
          ({ toolEvents }) => {
            const payload = getAskUserPayload(toolEvents);
            return (
              /retry/i.test(payload) &&
              /caller|call site|ownership boundary|shared backoff/i.test(payload)
            );
          },
          { weight: 2 },
        ),
        judge('unsure-path-quality', {
          rubric: UNSURE_GATE_RUBRIC,
          weight: 0.5,
          includeToolEvents: true,
        }),
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
