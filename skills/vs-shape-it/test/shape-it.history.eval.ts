import * as path from 'path';
import { describe, expect, it } from 'vitest';
import { check, judge, evaluate } from '@wix/pathgrade';
import {
  askedClarifyingQuestion,
  CONVERSE_ASK_USER_DEFAULTS,
  promptAllowingAskUserInterrupt,
  withAskUserSupport,
} from '../../vs-internal-shared/test/pathgrade-v1';
import { createAgent } from '../../vs-internal-shared/test/pathgrade-agent';

// These are synthetic scenarios derived from recurring product-shaping patterns
// in local history. Project names, people, URLs, and domain-specific details are
// intentionally omitted; only the decision difficulty is retained.

const SKILL_DIR = path.resolve(__dirname, '..');
const SUGGESTION_FIXTURE = path.join(
  __dirname,
  'fixtures',
  'suggestion-project',
);
const PUBLISHING_FIXTURE = path.join(
  __dirname,
  'fixtures',
  'publishing-project',
);
const EVAL_AGENT = (process.env.PATHGRADE_AGENT ?? 'codex') as 'claude' | 'codex';
const COPY_FROM_HOME =
  EVAL_AGENT === 'codex' ? ['.codex/auth.json'] : undefined;

const SUGGESTION_PROMPT =
  'I want the system to suggest a value from a conversation and make it feel ' +
  'automatic, but bad suggestions must not silently change the record. Shape ' +
  'the smallest useful version.';

const PUBLISHING_PROMPT =
  'I want authors to put small interactive blocks in Markdown and publish them ' +
  'through the existing static site pipeline. Shape this as a specification, ' +
  'not implementation. I am unsure whether blocks should allow arbitrary code ' +
  'or only a constrained declarative subset.';

describe('shape-it (history-derived scenarios)', () => {
  it('explore-mode: protects automatic suggestions with an approval boundary', async () => {
    const agent = await createAgent({
      agent: EVAL_AGENT,
      timeout: 360,
      skillDir: SKILL_DIR,
      workspace: SUGGESTION_FIXTURE,
      copyFromHome: COPY_FROM_HOME,
      debug: true,
    });

    await promptAllowingAskUserInterrupt(agent, SUGGESTION_PROMPT);

    const result = await evaluate(
      agent,
      [
        check('asks-via-tool-or-markdown', (ctx) => askedClarifyingQuestion(ctx), {
          weight: 2,
        }),
        judge('aligns-before-suggestion-design', {
          rubric: `The user wants a small feature that extracts a value from a conversation and makes it feel automatic, while explicitly forbidding silent record changes.

Review the FIRST agent response and any ask_user / AskUserQuestion tool event.

Score 1.0: Before proposing a concrete data model or automation, the agent asks a strategic question that resolves the first suggestion type, who reviews it, or whether the suggestion is private versus canonical. It treats the no-silent-change constraint as a product boundary.
Score 0.5: It asks a relevant question but also commits to a concrete architecture in the same response.
Score 0.0: It silently chooses a field, writes directly to the record, or presents an implementation plan without alignment.`,
          weight: 3,
          includeToolEvents: true,
        }),
      ],
      { failFast: false, onScorerError: 'skip' },
    );

    expect(result.score).toBeGreaterThan(0.5);
    await agent.dispose();
  });

  it('explore-mode: designs a reviewable suggestion slice with evidence and conflicts', async () => {
    const reactions = withAskUserSupport([
      {
        when: /first|scope|field|value|source|extract/i,
        unless: /^##\s/m,
        reply: 'Start with one explicit numeric value and only when the conversation states it clearly.',
        once: true,
      },
      {
        when: /review|approve|private|canonical|automatic|suggestion/i,
        unless: /^##\s/m,
        reply: 'Keep it private and pending until an editor approves it; block approval when the record changed meanwhile.',
        once: true,
      },
      { when: /^##\s/m, reply: 'Approved.' },
      { when: /\?/, reply: 'Use the safest reversible default.' },
    ]);

    const agent = await createAgent({
      agent: EVAL_AGENT,
      timeout: 480,
      skillDir: SKILL_DIR,
      workspace: SUGGESTION_FIXTURE,
      copyFromHome: COPY_FROM_HOME,
      debug: true,
    });

    const conversation = await agent.runConversation({
      firstMessage: SUGGESTION_PROMPT,
      maxTurns: 8,
      reactions,
      ...CONVERSE_ASK_USER_DEFAULTS,
      until: async ({ lastMessage }) =>
        lastMessage.match(/^## /m) !== null && lastMessage.length > 450,
    });

    expect(
      conversation.turns >= 2 || conversation.completionReason === 'until',
    ).toBe(true);

    const result = await evaluate(
      agent,
      [
        judge('keeps-suggestion-provisional', {
          rubric: `Review the complete shaping conversation for the synthetic suggestion feature.

Score 1.0: The design keeps extracted values private or pending until explicit human approval, clearly separates a suggestion from the canonical record, and refuses silent writes.
Score 0.5: It mentions review but leaves the canonical-write boundary ambiguous.
Score 0.0: It proposes auto-applying extracted values or treating model output as authoritative.`,
          weight: 3,
        }),
        check(
          'includes-evidence-and-conflict-safety',
          ({ transcript }) =>
            /evidence|source|excerpt|provenance|timestamp/i.test(transcript) &&
            /conflict|stale|revision|changed|concurr/i.test(transcript),
          { weight: 2 },
        ),
        check(
          'keeps-planning-only',
          ({ transcript }) =>
            !/```(ts|js|tsx|bash|json)\n[\s\S]*(function |const |=>|npm install)/i.test(
              transcript,
            ),
        ),
      ],
      { failFast: false, onScorerError: 'skip' },
    );

    expect(result.score).toBeGreaterThan(0.5);
    await agent.dispose();
  });

  it('explore-mode: resolves the trust boundary before extending a publishing pipeline', async () => {
    const agent = await createAgent({
      agent: EVAL_AGENT,
      timeout: 360,
      skillDir: SKILL_DIR,
      workspace: PUBLISHING_FIXTURE,
      copyFromHome: COPY_FROM_HOME,
      debug: true,
    });

    await promptAllowingAskUserInterrupt(agent, PUBLISHING_PROMPT);

    const result = await evaluate(
      agent,
      [
        check('asks-via-tool-or-markdown', (ctx) => askedClarifyingQuestion(ctx), {
          weight: 2,
        }),
        judge('aligns-on-execution-boundary', {
          rubric: `The user wants interactive blocks in Markdown but has not decided whether they are arbitrary executable code or a constrained declarative format, and explicitly asks for a specification rather than implementation.

Review the FIRST agent response and any ask_user / AskUserQuestion tool event.

Score 1.0: Before proposing a concrete extension, the agent asks a strategic question about the trust/sandbox boundary, allowed capabilities, or the existing pipeline contract. It honors the specification-only boundary.
Score 0.5: It asks about the boundary but also commits to a concrete runtime or implementation.
Score 0.0: It assumes arbitrary code execution or starts implementation without resolving the boundary.`,
          weight: 3,
          includeToolEvents: true,
        }),
      ],
      { failFast: false, onScorerError: 'skip' },
    );

    expect(result.score).toBeGreaterThan(0.5);
    await agent.dispose();
  });

  it('explore-mode: keeps a publishing extension within the existing service boundary', async () => {
    const reactions = withAskUserSupport([
      {
        when: /arbitrary|sandbox|trusted|declarative|capabilit|security/i,
        unless: /^##\s/m,
        reply: 'Use a constrained declarative block set; authors cannot run arbitrary code.',
        once: true,
      },
      {
        when: /pipeline|publish|artifact|source|existing|boundary/i,
        unless: /^##\s/m,
        reply: 'Reuse the current build and publish path, with one explicit source-artifact contract.',
        once: true,
      },
      { when: /^##\s/m, reply: 'Approved.' },
      { when: /\?/, reply: 'Keep the smallest safe scope.' },
    ]);

    const agent = await createAgent({
      agent: EVAL_AGENT,
      timeout: 480,
      skillDir: SKILL_DIR,
      workspace: PUBLISHING_FIXTURE,
      copyFromHome: COPY_FROM_HOME,
      debug: true,
    });

    const conversation = await agent.runConversation({
      firstMessage: PUBLISHING_PROMPT,
      maxTurns: 8,
      reactions,
      ...CONVERSE_ASK_USER_DEFAULTS,
      until: async ({ lastMessage }) =>
        lastMessage.match(/^## /m) !== null && lastMessage.length > 450,
    });

    expect(
      conversation.turns >= 2 || conversation.completionReason === 'until',
    ).toBe(true);

    const result = await evaluate(
      agent,
      [
        judge('specifies-safe-publishing-boundary', {
          rubric: `Review the complete shaping conversation for the synthetic Markdown publishing extension.

Score 1.0: The design chooses or explicitly recommends a constrained, non-arbitrary execution model; preserves the existing publish/build boundary; and defines a source-to-output contract plus security-focused acceptance checks.
Score 0.5: It rejects arbitrary code but leaves the pipeline or acceptance contract vague.
Score 0.0: It proposes arbitrary code execution, a new service without justification, or implementation work despite the specification-only request.`,
          weight: 3,
        }),
        check(
          'includes-spec-and-security-proof',
          ({ transcript }) =>
            /spec|contract|acceptance|output|publish|build/i.test(transcript) &&
            /security|sandbox|arbitrary|allowlist|escape|trust/i.test(transcript),
          { weight: 2 },
        ),
        check(
          'keeps-planning-only',
          ({ transcript }) =>
            !/```(ts|js|tsx|bash|json)\n[\s\S]*(function |const |=>|npm install)/i.test(
              transcript,
            ),
        ),
      ],
      { failFast: false, onScorerError: 'skip' },
    );

    expect(result.score).toBeGreaterThan(0.5);
    await agent.dispose();
  });
});
