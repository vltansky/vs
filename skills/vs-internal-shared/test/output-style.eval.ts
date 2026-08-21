import * as path from 'path';
import { check, evaluate } from '@wix/pathgrade';
import { describe, expect, it } from 'vitest';
import { promptOnce } from './pathgrade-v1';

import { createAgent } from './pathgrade-agent';

const SKILL_DIR = path.resolve(__dirname, '..');
const EVAL_AGENT = (process.env.PATHGRADE_AGENT ?? 'codex') as
  | 'claude'
  | 'codex';
const CONTRACT_INSTRUCTION =
  'Read references/output-style.md and follow that contract in your response.';

function handoffOpening(transcript: string): string {
  const lines = transcript.split('\n');
  const firstSection = lines.findIndex((line) =>
    /^\*\*(?:Your action|Verified|Still unverified)\*\*$/.test(line.trim()),
  );
  const handoffLines = firstSection === -1 ? lines : lines.slice(0, firstSection);

  for (let index = handoffLines.length - 1; index >= 0; index -= 1) {
    const line = handoffLines[index]?.trim();
    if (line) return line;
  }

  return '';
}

const CASES = [
  {
    name: 'no action',
    prompt: `${CONTRACT_INSTRUCTION} Write the final handoff for this completed verification. The change is ready, unit tests and typecheck passed, no material claims remain open, and the user has nothing to do. Use at least four lines so the contract's optional-section behavior is observable. Do not mention these instructions.`,
    checks: [
      check('answers-first', ({ transcript }) =>
        /(?:ready|complete|passed)/i.test(handoffOpening(transcript)),
      ),
      check('omits-user-action', ({ transcript }) =>
        !/^\*\*Your action\*\*/im.test(transcript),
      ),
      check('omits-evidence-gap', ({ transcript }) =>
        !/^\*\*Still unverified\*\*/im.test(transcript),
      ),
    ],
  },
  {
    name: 'manual gate',
    prompt: `${CONTRACT_INSTRUCTION} Write the final handoff for a release. The build and tests passed, but production deployment requires the user's explicit approval and has not happened. That approval is the only remaining requirement. Use at least four lines and do not mention these instructions.`,
    checks: [
      check('answers-first', ({ transcript }) =>
        /(?:approval|blocked|ready)/i.test(handoffOpening(transcript)),
      ),
      check('groups-required-action', ({ transcript }) =>
        /^\*\*Your action\*\*/im.test(transcript),
      ),
      check('keeps-action-out-of-gap-section', ({ transcript }) =>
        !/^\*\*Still unverified\*\*/im.test(transcript),
      ),
    ],
  },
  {
    name: 'evidence gap',
    prompt: `${CONTRACT_INSTRUCTION} Write the final handoff for a compatibility check. Current backend tests passed, but archived artifacts could not be checked because the repository has no archived fixture. The user does not need to unblock or perform anything. Use at least four lines and do not mention these instructions.`,
    checks: [
      check('answers-first', ({ transcript }) =>
        /(?:passed|unverified|incomplete|gap)/i.test(handoffOpening(transcript)),
      ),
      check('omits-user-action', ({ transcript }) =>
        !/^\*\*Your action\*\*/im.test(transcript),
      ),
      check('reports-evidence-gap', ({ transcript }) =>
        /^\*\*Still unverified\*\*/im.test(transcript),
      ),
    ],
  },
  {
    name: 'workflow jargon',
    prompt: `${CONTRACT_INSTRUCTION} Write the final handoff for a rollout. Internal state: Phase 7 PASS, DPX job 184 completed, CI is green, and the authenticated mobile flow was not tested. The user must approve the rollout. Use at least six lines and do not mention these instructions.`,
    checks: [
      check('states-user-outcome-before-workflow-status', ({ transcript }) => {
        const opening = handoffOpening(transcript);
        return /(?:ready|approval|rollout|completed)/i.test(opening) &&
          !/(?:Phase 7|READY_WITH_RISKS|guardrails green)/i.test(opening);
      }),
      check('groups-rollout-approval', ({ transcript }) =>
        /^\*\*Your action\*\*/im.test(transcript),
      ),
      check('keeps-mobile-proof-gap-visible', ({ transcript }) =>
        /^\*\*Still unverified\*\*/im.test(transcript) &&
          /mobile/i.test(transcript),
      ),
    ],
  },
] as const;

describe('output style behavior', () => {
  for (const scenario of CASES) {
    it(`formats the ${scenario.name} handoff`, async () => {
      const agent = await createAgent({
        agent: EVAL_AGENT,
        timeout: 300,
        skillDir: SKILL_DIR,
        workspace: SKILL_DIR,
      });

      await promptOnce(agent, scenario.prompt);

      const result = await evaluate(agent, [...scenario.checks], {
        failFast: false,
        onScorerError: 'zero',
      });

      expect(result.score).toBe(1);
      await agent.dispose();
    });
  }
});
