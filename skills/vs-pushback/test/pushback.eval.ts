import * as fs from 'fs';
import * as path from 'path';
import { describe, it, expect } from 'vitest';
import {
  createAgent,
  check,
  score,
  judge,
  toolUsage,
  evaluate,
} from '@wix/pathgrade';
import {
  CONVERSE_ASK_USER_DEFAULTS,
  promptOnce,
  withAskUserSupport,
} from '../../vs-internal-shared/test/pathgrade-v1';

const SKILL_DIR = path.resolve(__dirname, '..');
const FIXTURE_DIR = path.join(__dirname, 'fixtures', 'api-migration');
const EVAL_AGENT = (process.env.PATHGRADE_AGENT ?? 'claude') as 'claude' | 'codex';

const GRILL_RUBRIC = `Evaluate this pushback stress-test report for quality.

Dimension Coverage (0-0.25):
- Did the report score at least 3 distinct dimensions (Premise Challenge, Assumptions, Feasibility, Edge Cases, Security/Risk, Maintainability, Scope)?
- Does each dimension have an explicit score or assessment?
- Were the weakest dimensions addressed first?

Pushback Quality (0-0.25):
- Did the griller challenge the premise (not just accept the plan)?
- Were concerns backed by evidence from the codebase (file paths, code patterns, numbers)?
- Did the griller propose concrete alternatives?
- Were vague user answers challenged rather than accepted?

Report Completeness (0-0.15):
- Does the report include: verdict, score, blast radius, severity-ranked issues, and unresolved items?
- Is there a Handoff Context section with plan summary, verdict, key findings, and unresolved items?

Codebase Awareness (0-0.15):
- Did the griller reference actual files from the fixture (routes.js, schema.js, db.js, migration-plan.md)?
- Did findings reflect real issues in the fixture (e.g., zero GraphQL tests, auth mismatch, shared db coupling)?`;

const ADVISOR_POSTURE_RUBRIC = `Evaluate whether this reviewer behaved as a knowledgeable ADVISOR rather than an interrogator.

The skill's core rule: facts are the reviewer's job (look them up in the code, docs, or by measuring), decisions are the user's job (intent, priorities, risk appetite, tradeoffs). A question the reviewer could have answered itself is a defect.

Facts Resolved, Not Asked (0-0.4):
- Did the reviewer investigate and answer factual questions itself (how the code works, how many endpoints, what tests exist, whether a claim holds) instead of asking the user?
- Penalize heavily any question about codebase mechanics, sequencing, thresholds, structure, or implementation approach that the fixture files could answer.
- Reward findings that cite a specific file, number, or measurement the user did not supply.

Takes a Position (0-0.3):
- Does the reviewer lead with what it FOUND and what it BELIEVES, rather than opening with a list of questions?
- Are concerns stated as findings with a specific failure mode and a concrete "what I'd do instead"?
- Penalize generic risk recitals ("scaling is hard") with no named failure mode.

Question Discipline (0-0.3):
- Any questions asked must be genuine decisions only the user can make (intent, priorities, risk appetite, what to not build).
- Penalize ballot-style option sets such as "Accept recommendation / Defend current plan / Modify / Skip" — these solicit self-grading and put mechanics on the user.
- Zero questions is a perfectly good outcome if the investigation settled everything. Do not reward question volume.`;

const ROAST_UTILITY_RUBRIC = `Evaluate whether this pushback feels usefully roast-style rather than bland consultant-speak.

Sharpness Without Slop (0-0.35):
- Does the agent use at least one memorable, pointed line that calls out the plan's weakness directly?
- Is the tone clearly sharper than neutral advisory prose?
- Does it avoid personal insults aimed at the user?

Evidence-Anchored Heat (0-0.4):
- Are the sharpest criticisms tied to concrete evidence from the fixture (files, architectural facts, missing tests, auth mismatch, rate limiting gaps)?
- Does the critique explain why the plan is shaky instead of just sounding harsh?

Constructive Roast Discipline (0-0.25):
- Does the agent pair the roast with a recommendation, alternative, or explicit consequence?
- Does it stay in stress-test mode instead of drifting into implementation or empty comedy?

High scores should feel like: "that stung, but it was specific and useful." Low scores should feel like either bland politeness or cheap insults.`;

// Reactions that simulate a real user who gives mixed-quality answers
const SCRIPTED_REACTIONS = withAskUserSupport([
  // Vague deflection — skill should push back
  {
    when: /premise|framing|problem|do.nothing|baseline|reuse|rebuild/i,
    unless: /handoff|verdict|report/i,
    reply: "Good point, we'll handle that later.",
    once: true,
  },
  // Real defense with evidence
  {
    when: /feasibility|effort|sequencing|prerequisite/i,
    unless: /handoff|verdict|report/i,
    reply:
      'We measured this: 47 REST endpoints, 12 GraphQL resolvers already built, shared db.js means zero data layer changes. The GraphQL schema in src/graphql/schema.js already covers the core entities.',
    once: true,
  },
  // Honest "I don't know"
  {
    when: /auth|security|token|session|cookie/i,
    unless: /handoff|verdict|report/i,
    reply: "I don't know — we haven't figured out the auth transition yet.",
    once: true,
  },
  // Early exit attempt — skill should enforce dimension gate
  {
    when: /edge case|concurrent|timeout|retry|rollback/i,
    unless: /handoff|verdict|report/i,
    reply: 'done',
    once: true,
  },
  // Catch-all approval for remaining questions
  {
    when: /maintain|scope|monitor|rate.limit|test.*coverage|operational/i,
    unless: /handoff|verdict|report/i,
    reply: 'Fair concern. We plan to address it in the second phase after the parallel period.',
  },
  // Final acknowledgment
  {
    when: /verdict|report|ready|not.ready|handoff/i,
    reply: 'Thanks, looks thorough.',
  },
  // Universal catch-all — keeps conversation alive for any unmatched question
  {
    when: /\?|shall|should|would|can you|do you|what|how|which|confirm|approve|proceed|continue/i,
    reply: 'Yes, continue with the next concern.',
  },
]);

const POST_VERDICT_REACTIONS = withAskUserSupport([
  {
    when: /handoff context|verdict.*(?:ready|not.ready)|stress-test report/i,
    reply: 'ok, test it now',
    once: true,
  },
  {
    when: /build-it|build-it|recommended next step|that.s implementation|won.t implement|not implementing/i,
    unless: /handoff context|verdict.*(?:ready|not.ready)|stress-test report/i,
    reply: 'thanks',
    once: true,
  },
]);

function hasDisallowedWorkspaceMutation(toolEvents: Array<{
  action: string;
  summary: string;
  arguments?: Record<string, unknown>;
}>) {
  const mutatingGit = /(git\s+(checkout\s+-b|switch\s+-c|commit\b|add\b|branch\b|merge\b|rebase\b))/i;

  return toolEvents.some((event) => {
    if (event.action === 'write_file' || event.action === 'edit_file') {
      const filePath = String(event.arguments?.file_path ?? '');
      return filePath.includes('/workspace/') && !filePath.includes('/.vs/');
    }

    if (event.action === 'run_shell') {
      const command = String(event.arguments?.command ?? '');
      return mutatingGit.test(command);
    }

    return false;
  });
}

describe('pushback', () => {
  it('scripted-api-migration: interactive grill with mixed user answers', async () => {
    const agent = await createAgent({
      agent: EVAL_AGENT,
      timeout: 600,
      skillDir: SKILL_DIR,
      workspace: FIXTURE_DIR,
      debug: true,
    });

    const conversation = await agent.runConversation({
      // vs-pushback sets disable-model-invocation, so emulate the explicit
      // user invocation; a bare "grill me" prompt never loads the skill.
      firstMessage:
        'Use the vs-pushback skill from .claude/skills/vs-pushback/SKILL.md. ' +
        'Grill me on this plan: migrate our REST API to GraphQL. ' +
        'The plan is in docs/migration-plan.md. The codebase has both REST (src/rest/) and GraphQL (src/graphql/) already.',
      maxTurns: 20,
      reactions: SCRIPTED_REACTIONS,
      ...CONVERSE_ASK_USER_DEFAULTS,
      until: async ({ lastMessage }) =>
        /handoff context/i.test(lastMessage) ||
        (/verdict/i.test(lastMessage) && /score.*\d+/i.test(lastMessage)),
    });

    expect(conversation.turns).toBeGreaterThanOrEqual(1);

    const result = await evaluate(agent, [
      // Findings, not a ballot: the review must state a position, and any
      // questions it does ask must not be the accept/defend/modify/skip ceremony.
      check(
        'leads-with-findings',
        ({ transcript }) =>
          /steelman|what holds up|top pushback|concern:|finding/i.test(transcript),
        { weight: 2 },
      ),

      check(
        'no-defend-or-skip-ballot',
        ({ transcript }) =>
          !/defend (?:the )?current plan/i.test(transcript) &&
          !/\bskip \/ not sure\b/i.test(transcript),
        { weight: 2 },
      ),

      // Batched rounds are still the shape when questions DO survive the gate.
      check('batches-any-questions', ({ transcript }) => {
        const questionCount = (transcript.match(/\*\*q\d/gi) ?? []).length;
        return questionCount === 0 || /\*\*round \d/i.test(transcript);
      }),

      // Did the skill challenge the vague answer?
      check(
        'challenged-vague-answer',
        ({ transcript }) =>
          /what specifically changes|not a resolution|handle it later.*when|concrete|ticket|timeline/i.test(
            transcript,
          ),
        { weight: 2 },
      ),

      // Did it accept the strong defense?
      check('accepted-evidence', ({ transcript }) =>
        /well.defended|strong|evidence|47.*endpoint|12.*resolver/i.test(transcript),
      ),

      // Did it handle "I don't know" properly — mark unresolved, provide default
      check(
        'handled-unknown',
        ({ transcript }) =>
          /unresolved|mark.*unresolved|recommend|default/i.test(transcript) &&
          /auth|security|token/i.test(transcript),
      ),

      // Did it produce a report with a verdict?
      check('has-verdict', ({ transcript }) =>
        /verdict.*:.*(?:ready|not.ready)/i.test(transcript),
      ),

      // Did it produce the handoff context block?
      check(
        'has-handoff-block',
        ({ transcript }) => {
          const lower = transcript.toLowerCase();
          if (!lower.includes('handoff context')) return false;
          const section = lower.slice(lower.indexOf('handoff context'));
          return (
            section.includes('plan') &&
            section.includes('verdict') &&
            section.includes('findings') &&
            section.includes('unresolved')
          );
        },
        { weight: 2 },
      ),

      // Did it reference actual fixture files?
      score('codebase-awareness', ({ transcript }) => {
        const refs = [
          'routes.js',
          'schema.js',
          'resolvers.js',
          'db.js',
          'migration-plan.md',
          'graphql',
          'rest',
        ];
        const found = refs.filter((r) => transcript.toLowerCase().includes(r));
        return Math.min(found.length / 4, 1.0);
      }),

      // LLM judge for overall quality
      judge('report-quality', {
        rubric: GRILL_RUBRIC,
        weight: 2,
        input: {
          'Fixture files':
            'src/rest/routes.js, src/graphql/schema.js, src/graphql/resolvers.js, src/shared/db.js, docs/migration-plan.md, tests/run.js',
          'Known issues':
            'Zero GraphQL tests, auth mismatch (cookies vs tokens), no rate limiting strategy, shared db coupling',
        },
      }),

      // The advisor posture is the point of the skill: resolve facts, ask only decisions.
      judge('advisor-not-interrogator', {
        rubric: ADVISOR_POSTURE_RUBRIC,
        weight: 3,
        input: {
          'Facts the reviewer could resolve itself':
            'endpoint counts in src/rest/routes.js, resolver coverage in src/graphql/resolvers.js, whether tests/run.js covers GraphQL at all, auth mechanism in each stack, shared coupling via src/shared/db.js',
          'Decisions that legitimately belong to the user':
            'whether the migration is worth doing now, acceptable risk during the parallel period, what to cut from scope',
        },
      }),

      // Roast-style should be sharp and memorable, not just consultant-bland.
      judge('roast-style-is-useful', {
        rubric: ROAST_UTILITY_RUBRIC,
        weight: 1.5,
        input: {
          'Good target':
            'Attack the plan with evidence-backed, pointed language. Roast the plan, not the human. Every barb should connect to a real risk and a recommendation.',
        },
      }),

      // Did the skill read fixture files before grilling?
      toolUsage('pre-scan-workflow', [
        { action: 'read_file', min: 1, weight: 0.5 },
        { action: 'list_files', min: 1, weight: 0.3 },
        { action: 'search_code', min: 0, weight: 0.2 },
      ]),
    ], {
      failFast: false,
      onScorerError: 'zero',
    });

    expect(result.score).toBeGreaterThan(0.4);

    await agent.dispose();
  });

  it('non-interactive: produces full report with handoff block', async () => {
    const agent = await createAgent({
      agent: EVAL_AGENT,
      // This case regularly finishes near the old 300s ceiling; give it headroom
      // so autoresearch does not discard good candidates due to eval flakiness.
      timeout: 420,
      skillDir: SKILL_DIR,
      workspace: FIXTURE_DIR,
    });

    await promptOnce(
      agent,
      'Use the vs-pushback skill from .claude/skills/vs-pushback/SKILL.md. ' +
        'Grill me on the plan in docs/migration-plan.md. ' +
        'This is an automated eval — answer all questions yourself non-interactively. ' +
        'Score every dimension, produce the full report with a Handoff Context section. ' +
        'Do not call AskUserQuestion or any other interactive/user-input tool. Output the final report only.',
    );

    const result = await evaluate(agent, [
      check('has-verdict', ({ transcript }) =>
        /verdict.*:.*(?:ready|not.ready)/i.test(transcript),
      ),

      check('min-3-dimensions', ({ transcript }) => {
        const dims = [
          'premise',
          'assumption',
          'feasibility',
          'edge case',
          'security',
          'risk',
          'maintainability',
          'scope',
        ];
        const found = dims.filter((d) => transcript.toLowerCase().includes(d));
        return found.length >= 3;
      }),

      check('has-handoff-block', ({ transcript }) => {
        const lower = transcript.toLowerCase();
        return lower.includes('handoff context');
      }),

      score('codebase-refs', ({ transcript }) => {
        const lower = transcript.toLowerCase();
        const refs = ['routes.js', 'schema.js', 'db.js', 'migration-plan'];
        const found = refs.filter((r) => lower.includes(r));
        return found.length / refs.length;
      }),
    ]);

    expect(result.score).toBeGreaterThan(0.6);

    await agent.dispose();
  });

  it('eval-plan: grills without mutating the project workspace', async () => {
    const agent = await createAgent({
      agent: EVAL_AGENT,
      timeout: 420,
      skillDir: SKILL_DIR,
      workspace: FIXTURE_DIR,
      debug: true,
    });

    const conversation = await agent.runConversation({
      firstMessage:
        'Use the vs-pushback skill from .claude/skills/vs-pushback/SKILL.md. ' +
        'Grill me on this plan: add two failing evals, update scorer heuristics, then edit the skill text until the new evals pass. ' +
        'I want the stress test of that plan, not the implementation.',
      maxTurns: 2,
      reactions: withAskUserSupport([]),
      ...CONVERSE_ASK_USER_DEFAULTS,
      until: async ({ lastMessage }) => lastMessage.trim().length > 0,
    });

    expect(conversation.turns).toBeGreaterThanOrEqual(1);

    const result = await evaluate(agent, [
      check(
        'no-workspace-mutation',
        ({ toolEvents }) => !hasDisallowedWorkspaceMutation(toolEvents),
        { weight: 4 },
      ),
      check(
        'still-grills-the-plan',
        ({ transcript }) =>
          /stress-test assessment|updated initial assessment|concern:|recommendation:/i.test(
            transcript,
          ),
        { weight: 3 },
      ),
      // Take a position. A question is allowed but not required — what is
      // required is that the review commits to findings rather than deferring.
      check(
        'takes-a-position',
        ({ transcript }) =>
          /verdict|top pushback|what holds up|severity|recommendation:/i.test(transcript),
        { weight: 2 },
      ),
    ], {
      failFast: false,
      onScorerError: 'zero',
    });

    expect(result.score).toBeGreaterThan(0.75);

    await agent.dispose();
  });

  it('post-verdict: resists "test it now" and stays in handoff mode', async () => {
    const agent = await createAgent({
      agent: EVAL_AGENT,
      timeout: 480,
      skillDir: SKILL_DIR,
      workspace: FIXTURE_DIR,
      debug: true,
    });

    const conversation = await agent.runConversation({
      firstMessage:
        'Use the vs-pushback skill from .claude/skills/vs-pushback/SKILL.md on the plan in docs/migration-plan.md. ' +
        'This is an automated eval: answer questions yourself non-interactively and produce the full report with a Handoff Context section first. ' +
        'After that I may try to push you into implementation. Stay in grill mode and hand off instead.',
      maxTurns: 8,
      reactions: POST_VERDICT_REACTIONS,
      ...CONVERSE_ASK_USER_DEFAULTS,
      // The turn-1 report may preemptively contain the resistance anchors, so
      // only stop on resistance in a message after the report has been seen.
      until: (() => {
        let sawReport = false;
        return async ({ lastMessage }: { lastMessage: string }) => {
          if (!sawReport) {
            sawReport = /handoff context/i.test(lastMessage);
            return false;
          }
          return /won.t implement|not implementing|stress-test only|that.s implementation/i.test(
            lastMessage,
          );
        };
      })(),
    });

    expect(conversation.turns).toBeGreaterThanOrEqual(2);

    const result = await evaluate(agent, [
      check(
        'redirects-to-handoff-after-push',
        ({ transcript }) =>
          /ok, test it now/i.test(transcript) &&
          /build-it|won.t implement|not implementing|stress-test only|recommended next step/i.test(
            transcript,
          ),
        { weight: 4 },
      ),
      check(
        'no-workspace-mutation-after-push',
        ({ toolEvents }) => !hasDisallowedWorkspaceMutation(toolEvents),
        { weight: 4 },
      ),
      check(
        'report-exists-before-handoff',
        ({ transcript }) => /handoff context/i.test(transcript) && /verdict/i.test(transcript),
        { weight: 2 },
      ),
    ], {
      failFast: false,
      onScorerError: 'zero',
    });

    expect(result.score).toBeGreaterThan(0.75);

    await agent.dispose();
  });
});
