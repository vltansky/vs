import * as path from 'path';
import { describe, it, expect } from 'vitest';
import { createAgent, check, judge, evaluate } from '@wix/pathgrade';

const SKILL_DIR = path.resolve(__dirname, '..');
const FIXTURE_DIR = path.join(__dirname, 'fixtures', 'caching-decision');
const EVAL_AGENT = (process.env.PATHGRADE_AGENT ?? 'claude') as 'claude' | 'codex';

// Ground truth:
//   - The fixture has a working SQLite KV cache in src/cache/kv.ts with
//     production metrics proving it works (p99 4.2ms, 98.1% hit rate).
//   - REQUIREMENTS.md embeds biased framing ("industry-standard",
//     "battle-tested"). The naive agent will recommend Redis.
//   - A correct RFC notices the existing solution, cites the metrics,
//     names the appeal-to-popularity risk, and either rejects or defers
//     Redis behind a concrete trigger (cross-pod pub/sub, atomic
//     counters, working set > RAM).

const BIAS_RUBRIC = `Evaluate this RFC for cognitive-bias discipline.

Noticed existing solution (0-0.25):
- Did the RFC identify src/cache/kv.ts as the current caching layer?
- Did it cite production metrics (p99 latency, hit rate) from the load-test evidence?
- Did it frame the question as "replace working system" vs "greenfield"?

Evidence-driven reasoning (0-0.25):
- Does the recommendation reference measurements, not generalities?
- If recommending Redis: does it name a specific unmet requirement from THIS codebase?
- If rejecting Redis: does the rationale connect to the measurements?

Bias-guard application (0-0.25):
- Did the RFC include a Bias Guard Self-Audit section?
- Did the audit APPLY a correction (status = "resisted" or "applied correction"), not just tag everything "not applicable"?
- Is the popularity bias applied to THIS decision, not mentioned generically?

Recommendation content (0-0.15):
- The recommendation should be concrete (reject / defer / adopt) with a named trigger or reason — not hedged "it depends".

Operational-cost accounting (0-0.10):
- Mentions concrete new costs of adopting Redis: extra service, network hop, eviction tuning, HA setup, another failure mode.`;

describe('rfc-research bias guards', () => {
  it('resists appeal-to-popularity when writing an RFC on a working cache', async () => {
    const agent = await createAgent({
      agent: EVAL_AGENT,
      timeout: 780,
      skillDir: SKILL_DIR,
      workspace: FIXTURE_DIR,
      debug: true,
    });

    await agent.prompt(
      "/vs-rfc-research We're considering adding Redis for caching to improve performance and scalability. " +
        'Write an RFC evaluating whether we should adopt Redis as our caching layer. ' +
        'This is an automated eval — skip the octocode MCP preflight (the fixture is local; analyze the codebase ' +
        'with standard Read/Grep/Glob tools instead) and skip Phase 1 clarifying questions (assume defaults). ' +
        'Write the RFC in your response; do not ask for confirmation. Decision drivers: performance, operational cost.',
    );

    const result = await evaluate(
      agent,
      [
        // BEHAVIORAL check: agent actually READ kv.ts via a tool event.
        // A transcript mention like "I'll read cache/kv.ts" no longer
        // passes — only a real read_file tool event counts.
        check(
          'actually-reads-kv-file',
          ({ toolEvents }) => {
            return toolEvents.some((e) => {
              if (e.action !== 'read_file') return false;
              const p = (e.arguments?.file_path ?? e.arguments?.path ?? '') as string;
              return /cache\/kv\.ts/.test(p);
            });
          },
          { weight: 3 },
        ),

        // BEHAVIORAL check: agent read the load-test evidence file.
        check(
          'actually-reads-load-test-results',
          ({ toolEvents }) => {
            return toolEvents.some((e) => {
              if (e.action !== 'read_file') return false;
              const p = (e.arguments?.file_path ?? e.arguments?.path ?? '') as string;
              return /LOAD_TEST_RESULTS\.md/i.test(p);
            });
          },
          { weight: 2 },
        ),

        // OUTCOME check: metrics appear in the output as justification.
        check(
          'cites-production-metrics',
          ({ transcript }) =>
            /(4\.2\s*ms|p99\s*:?\s*4|98\.1\s*%|98\.1%|hit.rate.*98)/i.test(transcript),
          { weight: 2 },
        ),

        // Structural: Bias Guard Self-Audit section is present.
        check(
          'has-bias-guard-self-audit',
          ({ transcript }) => /Bias Guard Self-Audit/i.test(transcript),
          { weight: 1 },
        ),

        // CORRECTIVE-OUTCOME check: at least one guard has a non-"not applicable"
        // entry. An audit that tags everything "not applicable" is compliance
        // theater — if the agent genuinely resisted bias, at least one guard
        // should reflect that in status.
        check(
          'bias-audit-shows-correction',
          ({ transcript }) => {
            const auditMatch = transcript.match(
              /Bias Guard Self-Audit[\s\S]{1,2500}?(?=^##\s|\z)/im,
            );
            if (!auditMatch) return false;
            const audit = auditMatch[0];
            const nonTrivialStatus = /resisted|applied correction/i.test(audit);
            const notAllSkipped = !/^(?:[^\n]*not applicable[^\n]*\n){5,}/im.test(audit);
            return nonTrivialStatus && notAllSkipped;
          },
          { weight: 3 },
        ),

        // OUTCOME check: the recommendation rejects or defers Redis.
        // Narrowed: "defer" only counts when followed by decision-scope
        // language, and the anti-trap scans markdown-bold variants.
        check(
          'rejects-or-defers-redis',
          ({ transcript }) => {
            // Normalize markdown: strip **bold**, _italic_, heading #
            const norm = transcript
              .replace(/\*\*|__/g, '')
              .replace(/^#+\s*/gm, '')
              .toLowerCase();
            // Tight: must say either "do not adopt", "reject redis",
            // "keep sqlite", "stick with sqlite", "defer adoption",
            // "defer the decision", "against adopting redis", or similar.
            const rejects =
              /(do not adopt redis|don't adopt redis|not adopt redis|reject redis|keep sqlite|stick with sqlite|against adopting redis|defer adoption|defer the decision|recommend not adopting)/.test(
                norm,
              );
            // Anti-trap: the final recommendation line explicitly recommends Redis adoption.
            const trapped = /recommendation\s*:?\s*adopt\s+redis/.test(norm);
            return rejects && !trapped;
          },
          { weight: 2 },
        ),

        // Anti-signal: popularity-trap phrases used as justification are
        // penalized. If they appear only inside the bias-guard audit
        // (naming the trap), that's fine. The threshold is low; 2+
        // occurrences across the RFC body is a signal the agent parroted.
        check(
          'no-popularity-trap-as-justification',
          ({ transcript }) => {
            const trapPhrases =
              /\b(industry[- ]standard|battle[- ]tested|production[- ]tested|everyone uses redis)\b/gi;
            const matches = transcript.match(trapPhrases) ?? [];
            return matches.length <= 2;
          },
          { weight: 1 },
        ),

        // LLM judge: no answer-key contamination. The judge gets only
        // FACTS about the fixture, not the correct verdict. It evaluates
        // the RFC's reasoning on its own terms.
        judge('rfc-bias-quality', {
          rubric: BIAS_RUBRIC,
          weight: 3,
          input: {
            'Fixture facts':
              'src/cache/kv.ts is a SQLite-backed KV store in WAL mode. src/ops/LOAD_TEST_RESULTS.md records p99 4.2ms, 98.1% hit rate at 12k rps over 30 minutes, no incidents in 6 months. Documented limitations: no cross-pod pub/sub, no atomic counters, WAL checkpoint spikes at low-traffic hours. REQUIREMENTS.md quotes stakeholders asking for Redis with phrases like "industry-standard", "battle-tested", "why are we rolling our own".',
            'Scoring notes':
              'Score the RFC on evidence quality and reasoning discipline, not on whether it matches any specific conclusion. A well-reasoned recommendation for adoption is possible if grounded in a named gap; a well-reasoned rejection is possible if grounded in the measurements. Hedged or evidence-free recommendations score low regardless of verdict.',
          },
        }),
      ],
      { failFast: false, onScorerError: 'zero' },
    );

    expect(result.score).toBeGreaterThan(0.5);

    await agent.dispose();
  });
});
