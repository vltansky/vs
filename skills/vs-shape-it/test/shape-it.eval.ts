import * as path from 'path';
import { describe, it, expect } from 'vitest';
import {
  createAgent,
  check,
  judge,
  evaluate,
} from '@wix/pathgrade';
import type { Reaction } from '@wix/pathgrade';

const SKILL_DIR = path.resolve(__dirname, '..');
const FIXTURE_DIR = path.join(__dirname, 'fixtures', 'caching-project');
const PERF_FIXTURE_DIR = path.join(__dirname, 'fixtures', 'perf-project');
const EVAL_AGENT = (process.env.PATHGRADE_AGENT ?? 'claude') as 'claude' | 'codex';

describe('shape-it', () => {
  it('explore-mode: vague idea triggers clarifying questions, not grilling', async () => {
    const agent = await createAgent({
      agent: EVAL_AGENT,
      timeout: 300,
      skillDir: SKILL_DIR,
      workspace: PERF_FIXTURE_DIR,
      debug: true,
    });

    await agent.prompt(
      'I want to improve performance somehow, maybe caching?',
    );

    const result = await evaluate(agent, [
      judge('asks-before-acting', {
        rubric: `The user message is: "I want to improve performance somehow, maybe caching?"

Look at the FIRST agent response (not the user's message).

Score 1.0: The agent asked at least one clarifying question about context (what's slow, the goal, the platform, constraints, etc.) BEFORE proposing or implementing any solution.
Score 0.5: The agent asked a clarifying question but simultaneously proposed approaches or hinted at a solution in the same turn.
Score 0.0: The agent jumped straight to proposing or implementing a solution (wrote code, described "what was added", listed implementation steps) without asking what specifically needs improvement.`,
        weight: 3,
      }),
      check(
        'does-not-immediately-grill',
        ({ transcript }) => {
          const early = transcript.toLowerCase().slice(0, 500);
          return !/score.*\d+\/100|verdict|stress.test|premise challenge|not.ready|ready.with.risks/i.test(early);
        },
      ),
    ], { failFast: false, onScorerError: 'zero' });

    expect(result.score).toBeGreaterThan(0.5);
    await agent.dispose();
  });

  it('explore-mode: batches questions and presents full design without per-section gates', async () => {
    // Reactions simulate a user answering one topic per turn.
    // If the skill drips questions (one at a time), multiple reactions fire before the design.
    // If the skill batches questions, fewer reactions fire and the design arrives sooner.
    const REACTIONS: Reaction[] = [
      // Platform / mobile question
      {
        when: /\bios\b|\bandroid\b|platform|mobile|simulator/i,
        unless: /## |presented|approach:\s|architecture:\s/i,
        reply: 'iOS first.',
        once: true,
      },
      // Auto-fix / scope question
      {
        when: /auto.?fix|fix.*issue|after.*find|what.*happen|report.*only|scope/i,
        unless: /## |presented|approach:\s|architecture:\s/i,
        reply: 'Report only — no auto-fixing.',
        once: true,
      },
      // Complexity / tooling question
      {
        when: /shell|typescript|cli|tool|simple|complex/i,
        unless: /## |presented|approach:\s|architecture:\s/i,
        reply: 'Simplest thing that works.',
        once: true,
      },
      // Design approval — only fire when there are actual section headers
      {
        when: /^##\s/m,
        reply: 'Looks good.',
      },
      // Catch-all for any remaining questions
      {
        when: /\?/,
        reply: 'Keep it simple.',
      },
    ];

    const agent = await createAgent({
      agent: EVAL_AGENT,
      timeout: 480,
      skillDir: SKILL_DIR,
      workspace: FIXTURE_DIR,
      debug: true,
    });

    const conversation = await agent.runConversation({
      firstMessage:
        "I want to build a self-QA harness for our mobile app — something coding agents can run after making changes to verify they didn't break anything. Not sure about the exact shape yet.",
      maxTurns: 10,
      reactions: REACTIONS,
      // Stop when we see actual design section headers (## X) — not just the word "design"
      until: async ({ lastMessage }) =>
        (lastMessage.match(/^## /m) !== null) && lastMessage.length > 500,
    });

    expect(conversation.turns).toBeGreaterThanOrEqual(2);

    const result = await evaluate(agent, [
      judge('batches-questions-not-drip', {
        rubric: `Review the conversation transcript. Count how many separate turns the agent used to ask clarifying questions before presenting a design.

Score 1.0: agent asked 2+ questions in a single message, OR made recommendations for non-blocking choices (e.g. "I'll default to iOS") and asked only 1–2 questions total.
Score 0.5: agent spread questions across exactly 2 turns.
Score 0.0: agent asked only 1 question per message across 3 or more turns before reaching the design.

Consider only the question-asking phase. Ignore turns after the design starts.`,
        weight: 3,
      }),
      judge('full-design-single-gate', {
        rubric: `Review the conversation. Did the agent present the full design in one response and ask for approval once at the end — or did it present one section at a time, asking "does this look right?" after each section?

Score 1.0: full design delivered in a single response, one approval question at the end.
Score 0.5: two approval checks total.
Score 0.0: three or more mid-design approval requests (section-by-section gating).`,
        weight: 3,
      }),
      check(
        'presents-design',
        ({ transcript }) =>
          /##\s|architecture|approach|shell|cli|report|harness|output/i.test(transcript),
        { weight: 1 },
      ),
    ], { failFast: false, onScorerError: 'zero' });

    expect(result.score).toBeGreaterThan(0.5);
    await agent.dispose();
  });

  it('challenge-mode: structured plan triggers adversarial review', async () => {
    const agent = await createAgent({
      agent: EVAL_AGENT,
      timeout: 420,
      skillDir: SKILL_DIR,
      workspace: FIXTURE_DIR,
      debug: true,
    });

    await agent.prompt(
      'I have a plan to add Redis caching to this API. See docs/plan.md. Challenge it — I want to make sure it holds up.',
    );

    const result = await evaluate(agent, [
      check(
        'challenge-mode-behavior',
        ({ transcript }) =>
          /challenge|stress.test|pushback|concern|premise|grill|adversarial|weakness|risk/i.test(
            transcript,
          ),
        { weight: 2 },
      ),
      check(
        'reads-plan',
        ({ transcript }) =>
          /plan\.md|redis.*caching|caching.*redis|products.*endpoint|800ms|ttl/i.test(
            transcript,
          ),
      ),
      check(
        'raises-concern',
        ({ transcript }) =>
          /cache.*invalidat|stale|consistency|eviction|memory|cold.start|cache.*miss|connection.*pool|failover|redis.*down/i.test(
            transcript,
          ),
        { weight: 2 },
      ),
      check(
        'not-sycophantic',
        ({ transcript }) => {
          const early = transcript.slice(0, 600).toLowerCase();
          return !/great plan|solid plan|good plan|looks good|nice approach/i.test(early);
        },
      ),
    ], { failFast: false, onScorerError: 'zero' });

    expect(result.score).toBeGreaterThan(0.5);
    await agent.dispose();
  });
});
