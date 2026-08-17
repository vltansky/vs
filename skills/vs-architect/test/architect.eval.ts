import * as path from 'node:path';
import { check, createAgent, evaluate, judge } from '@wix/pathgrade';
import { describe, expect, it } from 'vitest';
import { promptOnce } from '../../vs-internal-shared/test/pathgrade-v1';

const SKILL_DIR = path.resolve(__dirname, '..');
const FIXTURE_DIR = path.join(__dirname, 'fixtures', 'dispatch');
const EVAL_AGENT = (process.env.PATHGRADE_AGENT ?? 'claude') as 'claude' | 'codex';

describe('vs-architect behavior', () => {
  it('finds the Dispatch deepening without designing it prematurely', async () => {
    const agent = await createAgent({
      agent: EVAL_AGENT,
      timeout: 600,
      skillDir: SKILL_DIR,
      workspace: FIXTURE_DIR,
      debug: true,
    });

    await promptOnce(
      agent,
      '/vs-architect quick. Review this fixture for architecture deepening opportunities. ' +
        'This is an automated eval: keep the initial report in your response, do not create or open an artifact, ' +
        'and stop at the candidate-selection gate.',
    );

    const result = await evaluate(
      agent,
      [
        check(
          'reads-domain-and-decision-docs',
          ({ transcript }) => /CONTEXT\.md/i.test(transcript) && /0001-queue-port\.md/i.test(transcript),
          { weight: 2 },
        ),
        check(
          'finds-repeated-dispatch-ordering',
          ({ transcript }) =>
            /Dispatch/i.test(transcript) &&
            /src\/http\/submit\.ts/i.test(transcript) &&
            /src\/cli\/submit\.ts/i.test(transcript) &&
            /(validat|ordering|repeat|duplicat)/i.test(transcript),
          { weight: 3 },
        ),
        check(
          'uses-depth-language-and-evidence-shape',
          ({ transcript }) =>
            /Suggested deepening/i.test(transcript) &&
            /Test surface/i.test(transcript) &&
            /Locality\/leverage/i.test(transcript) &&
            /Deletion test/i.test(transcript),
          { weight: 2 },
        ),
        check(
          'respects-existing-queue-port-adr',
          ({ transcript }) => /ADR/i.test(transcript) && /(align|preserv|compatible|honor)/i.test(transcript),
          { weight: 2 },
        ),
        check(
          'stops-before-interface-design',
          ({ transcript }) =>
            /Which candidate would you like to shape\?/i.test(transcript) &&
            !/(interface\s+\w+\s*\{|function\s+dispatch\s*\(|class\s+\w*Dispatch)/i.test(transcript),
          { weight: 3 },
        ),
        judge('architecture-candidate-quality', {
          rubric:
            'Score whether the response identifies repeated Dispatch orchestration across HTTP and CLI as a concrete deepening candidate; uses the project term Dispatch; explains caller obligations, locality, leverage, deletion test, behavioral test surface, and the queue port ADR; avoids inventing an interface or implementation plan before selection; and asks the user to choose a candidate. Penalize generic refactor advice and unsupported extra candidates.',
          weight: 3,
        }),
      ],
      { failFast: false, onScorerError: 'zero' },
    );

    expect(result.score).toBeGreaterThan(0.7);
    await agent.dispose();
  });
});
