import * as path from 'path';
import { describe, it, expect } from 'vitest';
import {
  createAgent,
  check,
  judge,
  toolUsage,
  evaluate,
} from '@wix/pathgrade';
const SKILL_DIR = path.resolve(__dirname, '..');
const FIXTURE_DIR = path.join(__dirname, 'fixtures', 'review-thread-gates');
const EVAL_AGENT = (process.env.PATHGRADE_AGENT ?? 'claude') as 'claude' | 'codex';
const COPY_FROM_HOME = EVAL_AGENT === 'codex' ? ['.codex'] : undefined;

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

async function promptAllowingQuestionToolInterrupt(
  agent: Awaited<ReturnType<typeof createAgent>>,
  prompt: string,
) {
  try {
    await agent.prompt(prompt);
  } catch {
    // In Pathgrade, AskUserQuestion often terminates the one-shot prompt with a
    // non-zero exit even though the tool call is already recorded in the log.
    // These evals score the recorded tool event, so keep going.
  }
}

function hasAskUserEvent(toolEvents: Array<{ action: string; summary: string; arguments?: Record<string, unknown> }>, pattern: RegExp) {
  return toolEvents.some((event) => {
    if (event.action !== 'ask_user') return false;
    const haystack = `${event.summary} ${JSON.stringify(event.arguments ?? {})}`;
    return pattern.test(haystack);
  });
}

function getAskUserPayload(toolEvents: Array<{ action: string; arguments?: Record<string, unknown> }>) {
  const askEvent = toolEvents.find((event) => event.action === 'ask_user');
  return JSON.stringify(askEvent?.arguments ?? {});
}

describe('fix-pr', () => {
  it('uses ask-user tool for the inline-thread reply approval gate', async () => {
    const agent = await createFixPrAgent(360);

    try {
      await promptAllowingQuestionToolInterrupt(
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
      await promptAllowingQuestionToolInterrupt(
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
