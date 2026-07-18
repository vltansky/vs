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
    ], { failFast: false, onScorerError: 'skip' });

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
    ], { failFast: false, onScorerError: 'skip' });

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
    ], { failFast: false, onScorerError: 'skip' });

    expect(result.score).toBeGreaterThan(0.5);
    await agent.dispose();
  });

  it('large effort: proposes durable coordination and Codex parallel work', async () => {
    const agent = await createAgent({
      agent: EVAL_AGENT,
      timeout: 420,
      skillDir: SKILL_DIR,
      workspace: FIXTURE_DIR,
      debug: true,
    });

    await agent.runConversation({
      firstMessage:
        "We're planning a tenant migration that touches authentication, billing, and data storage. It is too large for one coding session, and we're working in Codex. Help me shape it and recommend how to coordinate the work across sessions, but don't create or implement anything yet.",
      maxTurns: 6,
      reactions: [
        {
          when: /destination|success|done|outcome|goal/i,
          reply:
            'Success means every tenant is migrated with no billing drift and a tested rollback path.',
          once: true,
        },
        {
          when: /scope|constraint|order|sequence|risk/i,
          reply:
            'Authentication and billing must remain live. Storage migration can run tenant by tenant.',
          once: true,
        },
        { when: /\?/, reply: 'Use the safest practical default.' },
      ],
      until: async ({ lastMessage }) =>
        lastMessage.match(/^## /m) !== null && lastMessage.length > 500,
    });

    const result = await evaluate(
      agent,
      [
        check('suggests-durable-coordination', ({ transcript }) =>
          /issue|ticket|tracker/i.test(transcript),
        ),
        check('suggests-codex-parallel-work', ({ transcript }) =>
          /codex.{0,80}(task|thread)|(task|thread).{0,80}codex/is.test(
            transcript,
          ),
        ),
        judge('topology-is-optional-and-proportional', {
          rubric: `Evaluate the proposed coordination approach:
- It treats issues/tickets as durable shared coordination for a multi-session effort. (0-0.35)
- It proposes Codex tasks or threads for independent bounded work. (0-0.35)
- It keeps issues as the source of truth when both mechanisms are used. (0-0.15)
- It recommends rather than creates issues/tasks or starts implementation. (0-0.15)`,
          weight: 0.4,
        }),
      ],
      { failFast: false, onScorerError: 'skip' },
    );

    expect(result.score).toBeGreaterThan(0.65);
    await agent.dispose();
  });

  it('large effort: produces a goal-ready orchestration blueprint for build-it', async () => {
    const agent = await createAgent({
      agent: EVAL_AGENT,
      timeout: 420,
      skillDir: SKILL_DIR,
      workspace: FIXTURE_DIR,
      debug: true,
    });

    await agent.runConversation({
      firstMessage:
        'Shape a build-ready plan for a migration audit across the legacy web app, replacement mobile app, and shared backend contracts. The audit needs static inventory, runtime proof, and an independent evidence review. Give build-it enough operational detail to run it safely, but do not create workers, issues, or implementation changes yet.',
      maxTurns: 5,
      reactions: [
        {
          when: /success|outcome|goal|done|approval/i,
          reply:
            'Success is an evidence-backed parity matrix with product gaps separated from harness failures; fixes require approval by gap ID.',
          once: true,
        },
        {
          when: /scope|constraint|runtime|platform/i,
          reply:
            'Cover all three surfaces. Runtime proof may stop when infrastructure is unhealthy; do not turn blockers into product defects.',
          once: true,
        },
        { when: /\?/, reply: 'Use the safest practical default.' },
      ],
      until: async ({ lastMessage }) =>
        /```mermaid[\s\S]*```/i.test(lastMessage) &&
        /implementation goal|goal contract/i.test(lastMessage),
    });

    const result = await evaluate(
      agent,
      [
        check('defines-implementation-goal', ({ transcript }) =>
          /implementation goal|objective|goal contract/i.test(transcript) &&
          /success criteria|done when|acceptance/i.test(transcript),
        ),
        check('defines-workstreams-and-waves', ({ transcript }) =>
          /workstream|worker|lane/i.test(transcript) &&
          /wave|merge gate|dependency|parallel|sequential/i.test(transcript),
        ),
        check('assigns-effort-and-verification', ({ transcript }) =>
          /effort|reasoning/i.test(transcript) &&
          /verification|evidence|test/i.test(transcript),
        ),
        check('renders-orchestration-diagram', ({ transcript }) =>
          /```mermaid[\s\S]*```/i.test(transcript),
        ),
        judge('handoff-is-runnable-not-generic', {
          rubric: `Evaluate whether the response gives build-it a runnable orchestration contract:
- It states one implementation objective with observable success criteria. (0-0.2)
- It assigns bounded workstreams to concrete host primitives with inputs, outputs, effort, dependencies, and verification. (0-0.3)
- It distinguishes parallel waves from sequential merge/approval gates. (0-0.2)
- It explains whether GitHub issues or durable tasks/threads are needed as source of truth. (0-0.1)
- It includes copyable worker briefs or prompts and a Mermaid execution diagram. (0-0.15)
- It plans only; it does not create workers/issues or implement. (0-0.05)`,
          weight: 0.5,
        }),
      ],
      { failFast: false, onScorerError: 'skip' },
    );

    expect(result.score).toBeGreaterThan(0.7);
    await agent.dispose();
  });

  it('small effort: keeps the handoff simple', async () => {
    const agent = await createAgent({
      agent: EVAL_AGENT,
      timeout: 300,
      skillDir: SKILL_DIR,
      workspace: FIXTURE_DIR,
      debug: true,
    });

    await agent.prompt(
      'Shape a tiny change for this CLI: rename the --pretty flag to --json, keep --pretty as a deprecated alias for one release, and update the existing CLI behavior test. This should fit in one coding session. Keep the design in chat.',
    );

    const result = await evaluate(
      agent,
      [
        check('produces-a-bounded-design', ({ transcript }) =>
          /deprecated alias|one release|behavior test|verification|out of scope/i.test(
            transcript,
          ),
        ),
        check('does-not-add-coordination-overhead', ({ transcript }) =>
          /coordination:\s*none/i.test(transcript) ||
          !/codex task|codex thread|claude subagent|dependency graph issue|parallel worker/i.test(
            transcript,
          ),
        ),
        judge('small-work-stays-proportional', {
          rubric: `Evaluate the response:
- It gives a concise, buildable one-session design. (0-0.5)
- It does not recommend issues, tasks, threads, subagents, or other coordination overhead. (0-0.3)
- It does not implement the change. (0-0.2)`,
          weight: 0.3,
        }),
      ],
      { failFast: false, onScorerError: 'skip' },
    );

    expect(result.score).toBeGreaterThan(0.65);
    await agent.dispose();
  });

  it('context-rich request: synthesizes a spec with a behavioral test seam', async () => {
    const agent = await createAgent({
      agent: EVAL_AGENT,
      timeout: 300,
      skillDir: SKILL_DIR,
      workspace: FIXTURE_DIR,
      debug: true,
    });

    await agent.prompt(
      'We already decided the products endpoint will use a five-minute Redis cache, stale reads are acceptable, cache invalidation happens on product writes, and success means p99 below 100ms with unchanged API responses. Turn this into a buildable design in chat. The existing endpoint integration tests should remain the main verification surface.',
    );

    const result = await evaluate(
      agent,
      [
        check('does-not-restart-the-interview', ({ transcript }) =>
          !/Question 1 of|before I can|need you to answer|first, clarify/i.test(
            transcript,
          ),
        ),
        check('names-a-behavioral-testing-seam', ({ transcript }) =>
          /integration test|behavioral seam|verification seam|endpoint behavior/i.test(
            transcript,
          ),
        ),
        check('captures-the-settled-boundaries', ({ transcript }) =>
          /five.minute|5.minute|stale|invalidat|p99|unchanged API/i.test(
            transcript,
          ),
        ),
        judge('spec-synthesis-quality', {
          rubric: `Evaluate the response:
- It synthesizes the decisions already provided instead of reopening them. (0-0.35)
- It covers boundaries, non-goals, risks, and success criteria. (0-0.35)
- It uses the existing endpoint integration tests as the highest behavioral verification seam. (0-0.3)`,
          weight: 0.3,
        }),
      ],
      { failFast: false, onScorerError: 'skip' },
    );

    expect(result.score).toBeGreaterThan(0.7);
    await agent.dispose();
  });

  it('Claude Code effort: recommends subagents for independent lanes', async () => {
    const agent = await createAgent({
      agent: EVAL_AGENT,
      timeout: 300,
      skillDir: SKILL_DIR,
      workspace: FIXTURE_DIR,
      debug: true,
    });

    await agent.prompt(
      'We are using Claude Code to shape a large modernization with three independent lanes: audit authentication, inventory billing integrations, and prototype the storage migration state machine. Recommend how to coordinate the planning work, but do not create or run anything.',
    );

    const result = await evaluate(
      agent,
      [
        check('recommends-claude-subagents', ({ transcript }) =>
          /subagents?|agent tool|task tool|`?(?:plan|explore|general-purpose)`? agents?/i.test(
            transcript,
          ),
        ),
        check('keeps-the-lanes-bounded', ({ transcript }) =>
          /authentication|billing|storage migration/i.test(transcript) &&
          /independent|bounded|one lane|separate/i.test(transcript),
        ),
        judge('claude-topology-quality', {
          rubric: `Evaluate the coordination recommendation:
- It explicitly proposes Claude Code subagents, not Codex tasks/threads. (0-0.4)
- It gives each independent lane a bounded planning outcome. (0-0.35)
- It recommends rather than launches workers or implementation. (0-0.25)`,
          weight: 0.3,
        }),
      ],
      { failFast: false, onScorerError: 'skip' },
    );

    expect(result.score).toBeGreaterThan(0.65);
    await agent.dispose();
  });
});
