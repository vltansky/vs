import * as path from 'path';
import { describe, it, expect } from 'vitest';
import { createAgent, check, judge, evaluate } from '@wix/pathgrade';
import {
  askedClarifyingQuestion,
  CONVERSE_ASK_USER_DEFAULTS,
  promptAllowingAskUserInterrupt,
  withAskUserSupport,
} from '../../vs-internal-shared/test/pathgrade-v1';

// Grounded in a real prompt from the author's Codex history:
//   "lets start brainstorming auto update functionality for user scope.
//    Start from brainstorm and adr writing. i think hooks can be useful,
//    we can auto update once in a day - maybe not silent.."
// Distinctive traits: terse, explore-first intent, explicitly wants an ADR for
// the durable mechanism decision. Exercises shape-it's explore mode AND the
// ADR-recommendation behavior.

const SKILL_DIR = path.resolve(__dirname, '..');
const FIXTURE_DIR = path.join(__dirname, 'fixtures', 'auto-update-project');
const EVAL_AGENT = (process.env.PATHGRADE_AGENT ?? 'claude') as 'claude' | 'codex';

const REAL_PROMPT =
  'lets start brainstorming auto update functionality for user scope. ' +
  'Start from brainstorm and adr writing. i think hooks can be useful, ' +
  'we can auto update once in a day - maybe not silent..';

const REAL_ORCHESTRATOR_PROMPT =
  'right now we have a Slack integration that uses serverless then runs BCA. ' +
  'I want it to use our orchestrator agent instead. Shape it.';

describe('shape-it (real prompt)', () => {
  it('explore-mode: asks before designing, does not jump to code', async () => {
    const agent = await createAgent({
      agent: EVAL_AGENT,
      timeout: 300,
      skillDir: SKILL_DIR,
      workspace: FIXTURE_DIR,
      debug: true,
    });

    await promptAllowingAskUserInterrupt(agent, REAL_PROMPT);

    const result = await evaluate(
      agent,
      [
        check(
          'asks-via-tool-or-markdown',
          (ctx) => askedClarifyingQuestion(ctx),
          { weight: 2 },
        ),
        judge('asks-before-acting', {
          rubric: `The user prompt is a loose brainstorm request about an auto-update feature.

Look at the FIRST agent response and any ask_user / AskUserQuestion tool events.

Score 1.0: The agent asked at least one blocking/strategic clarifying question (e.g. update channel, opt-in vs silent, which scope, failure behavior) BEFORE proposing a concrete solution or writing code. Structured ask_user tool calls count.
Score 0.5: It asked a question but also drafted a full solution/implementation in the same turn.
Score 0.0: It skipped questions and jumped straight to a design dump or code.`,
          weight: 3,
          includeToolEvents: true,
        }),
        check(
          'no-implementation',
          ({ transcript }) =>
            !/```(ts|js|tsx|bash|json)\n[\s\S]*(function |const |=>|npm install)/i.test(
              transcript,
            ),
          { weight: 1 },
        ),
      ],
      { failFast: false, onScorerError: 'skip' },
    );

    expect(result.score).toBeGreaterThan(0.5);
    await agent.dispose();
  });

  it('explore-mode: checks the runtime boundary before shaping a migration', async () => {
    const agent = await createAgent({
      agent: EVAL_AGENT,
      timeout: 300,
      skillDir: SKILL_DIR,
      workspace: FIXTURE_DIR,
      debug: true,
    });

    await promptAllowingAskUserInterrupt(agent, REAL_ORCHESTRATOR_PROMPT);

    const result = await evaluate(
      agent,
      [
        check(
          'asks-via-tool-or-markdown',
          (ctx) => askedClarifyingQuestion(ctx),
          { weight: 2 },
        ),
        judge('aligns-before-migration-design', {
          rubric: `The user wants to replace a one-shot Slack -> serverless -> BCA path with an orchestrator agent, but has not said whether they want a new conversational session, a one-shot preset, generic tasks, or only the existing automation scope.

Look at the FIRST agent response and any ask_user / AskUserQuestion tool events.

Score 1.0: Before proposing a concrete migration, the agent asks at least one strategic question that distinguishes the intended runtime or scope (for example conversational session vs one-shot invocation, bidirectional Slack replies, generic tasks vs automation-only, or which Slack path is in scope).
Score 0.5: It asks a relevant question but also commits to a concrete architecture in the same response.
Score 0.0: It silently picks an interpretation and starts research or presents a design without an alignment question.`,
          weight: 3,
          includeToolEvents: true,
        }),
      ],
      { failFast: false, onScorerError: 'skip' },
    );

    expect(result.score).toBeGreaterThan(0.5);
    await agent.dispose();
  });

  it('recommends capturing the durable decision as an ADR', async () => {
    // The user explicitly said "adr writing". After answering the blocking
    // questions, the design should recommend an ADR for the update mechanism.
    const REACTIONS = withAskUserSupport([
      {
        when: /silent|opt.?in|prompt|ask.*user|notify|background/i,
        unless: /^##\s/m,
        reply: 'Not silent — notify once a day, user can opt out.',
        once: true,
      },
      {
        when: /channel|source|where.*update|registry|github|npm/i,
        unless: /^##\s/m,
        reply: 'Pull from the git remote, user scope only.',
        once: true,
      },
      { when: /^##\s/m, reply: 'Looks good.' },
      { when: /\?/, reply: 'Keep it simple.' },
    ]);

    const agent = await createAgent({
      agent: EVAL_AGENT,
      timeout: 420,
      skillDir: SKILL_DIR,
      workspace: FIXTURE_DIR,
      debug: true,
    });

    const conversation = await agent.runConversation({
      firstMessage: REAL_PROMPT,
      maxTurns: 8,
      reactions: REACTIONS,
      ...CONVERSE_ASK_USER_DEFAULTS,
      until: async ({ lastMessage }) =>
        lastMessage.match(/^## /m) !== null && lastMessage.length > 400,
    });

    // Structured ask_user can collapse Q&A into one model turn; accept either
    // multi-turn dialogue or a single turn that reached the design `until`.
    expect(
      conversation.turns >= 2 || conversation.completionReason === 'until',
    ).toBe(true);

    const result = await evaluate(
      agent,
      [
        judge('recommends-adr', {
          rubric: `The user said "Start from brainstorm and adr writing" — they want the durable
mechanism decision recorded as an ADR. There is already an adr/ directory in the workspace.

Review the full transcript.

Score 1.0: The agent recommends capturing the auto-update decision as an ADR (mentions ADR / adr/ / architecture decision record) and treats it as a durable repo-level call.
Score 0.5: The agent mentions ADRs only in passing without tying it to this decision.
Score 0.0: The agent never surfaces an ADR despite the user asking for one.`,
          weight: 3,
        }),
        check(
          'presents-design-with-tradeoffs',
          ({ transcript }) =>
            /##\s|approach|tradeoff|alternativ|option|hook|daily|opt.?out/i.test(
              transcript,
            ),
          { weight: 1 },
        ),
      ],
      { failFast: false, onScorerError: 'skip' },
    );

    expect(result.score).toBeGreaterThan(0.5);
    await agent.dispose();
  });
});
