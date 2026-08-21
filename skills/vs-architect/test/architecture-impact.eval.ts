import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { check, evaluate, judge, score } from '@wix/pathgrade';
import { describe, expect, it } from 'vitest';
import { promptOnce } from '../../vs-internal-shared/test/pathgrade-v1';

import { createAgent } from '../../vs-internal-shared/test/pathgrade-agent';

const ARCHITECT_DIR = path.resolve(__dirname, '..');
const IMPROVE_DIR = path.resolve(__dirname, '..', '..', 'vs-improve');
const FIXTURE_DIR = path.join(__dirname, 'fixtures', 'dispatch');
const EVAL_AGENT = (process.env.PATHGRADE_AGENT ?? 'codex') as 'claude' | 'codex';
const TRIALS = Math.max(1, Number.parseInt(process.env.VS_ARCHITECT_AB_TRIALS ?? '1', 10));
const MIN_DELTA = Number.parseFloat(process.env.VS_ARCHITECT_AB_MIN_DELTA ?? '0.03');

const PROMPT =
  '/vs-improve architecture quick. We are about to add webhook submissions alongside the existing HTTP and CLI entry points. ' +
  'Before deciding how, review the current Dispatch flow and tell me which architectural direction is worth shaping. ' +
  'Do not change code or design the new interface yet.';

const COMPOSITION_BLOCK =
  /For the \*\*tech debt & architecture\*\* category,[\s\S]+?unless the user explicitly names\s+architecture\.\s*/;

type Arm = 'baseline' | 'treatment';

type ArmResult = {
  arm: Arm;
  overall: number;
  scorers: Record<string, number>;
};

function stripFrontmatter(markdown: string): string {
  return markdown.replace(/^---\s*\n[\s\S]+?\n---\s*\n/, '');
}

function buildSkillVariant(arm: Arm): { root: string; skillDir: string } {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), `vs-architect-${arm}-`));
  const skillDir = path.join(root, 'vs-improve');
  fs.cpSync(IMPROVE_DIR, skillDir, { recursive: true });

  const improvePath = path.join(skillDir, 'SKILL.md');
  const currentImprove = fs.readFileSync(improvePath, 'utf8');
  const baselineImprove = currentImprove.replace(COMPOSITION_BLOCK, '');
  if (baselineImprove === currentImprove) {
    throw new Error('Could not isolate the architect composition block from vs-improve');
  }

  if (arm === 'baseline') {
    fs.writeFileSync(improvePath, baselineImprove);
    return { root, skillDir };
  }

  const architect = stripFrontmatter(
    fs.readFileSync(path.join(ARCHITECT_DIR, 'SKILL.md'), 'utf8'),
  );
  fs.writeFileSync(
    improvePath,
    `${currentImprove}\n\n## Composed Architect protocol\n\n` +
      'For the active architecture category, apply this protocol as evidence gathering. ' +
      'Improve still owns the final findings and next-step question.\n\n' +
      architect,
  );
  return { root, skillDir };
}

function architectureScorers() {
  return [
    score('concrete-dispatch-evidence', ({ transcript }) => {
      const signals = [
        /src\/http\/submit\.ts/i,
        /src\/cli\/submit\.ts/i,
        /(repeat|duplicat|both callers)[\s\S]{0,160}(validat|order)|(?:validat|order)[\s\S]{0,160}(repeat|duplicat|both callers)/i,
        /0001-queue-port\.md|queue port ADR/i,
      ];
      return signals.filter((signal) => signal.test(transcript)).length / signals.length;
    }),
    score('architecture-depth-analysis', ({ transcript }) => {
      const signals = [
        /caller (?:obligations?|knowledge)|what callers? must know/i,
        /locality|leverage/i,
        /deletion test/i,
        /test surface|behavioral test/i,
      ];
      return signals.filter((signal) => signal.test(transcript)).length / signals.length;
    }),
    check('respects-existing-decision', ({ transcript }) =>
      /ADR/i.test(transcript) &&
      /(align|preserv|honou?r|compatible|do not reopen|untouched|intact)/i.test(transcript),
    ),
    score('stops-at-a-decision-gate', ({ transcript }) => {
      const asksForSelection =
        /which candidate|what should we shape|worth shaping|choose|select/i.test(transcript);
      const avoidsPrematureInterface =
        !/(interface\s+\w+\s*\{|function\s+dispatch\s*\(|class\s+\w*Dispatch)/i.test(
          transcript,
        );
      return (Number(asksForSelection) + Number(avoidsPrematureInterface)) / 2;
    }),
    judge('recommendation-usefulness', {
      rubric: `Evaluate the architecture recommendation in the transcript:
- Grounds one concrete recommendation in the two existing Dispatch callers and their repeated responsibilities. (0.30)
- Explains how the direction reduces caller knowledge or concentrates behavior, rather than merely moving code. (0.25)
- Accounts for the queue-port ADR and identifies the behavioral test surface. (0.25)
- Stops before interface design or implementation planning and leaves a clear next decision. (0.20)

Give credit for any terminology or presentation that demonstrates these outcomes.`,
      weight: 0.4,
    }),
  ];
}

async function runArm(arm: Arm): Promise<ArmResult> {
  const variant = buildSkillVariant(arm);
  let agent;
  try {
    agent = await createAgent({
      agent: EVAL_AGENT,
      timeout: 600,
      skillDir: variant.skillDir,
      workspace: FIXTURE_DIR,
    });
  } finally {
    fs.rmSync(variant.root, { recursive: true, force: true });
  }

  await promptOnce(agent, PROMPT);
  const result = await evaluate(agent, architectureScorers(), {
    failFast: false,
    onScorerError: 'zero',
  });
  await agent.dispose();

  return {
    arm,
    overall: result.score,
    scorers: Object.fromEntries(result.scorers.map((entry) => [entry.name, entry.score])),
  };
}

function mean(values: number[]): number {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

describe('vs-architect impact', () => {
  it('improves architecture findings when composed into vs-improve', async () => {
    const baseline: ArmResult[] = [];
    const treatment: ArmResult[] = [];

    for (let trial = 1; trial <= TRIALS; trial++) {
      const before = await runArm('baseline');
      const after = await runArm('treatment');
      baseline.push(before);
      treatment.push(after);
      console.log(JSON.stringify({ event: 'vs-architect-ab-trial', trial, before, after }));
    }

    const before = mean(baseline.map((result) => result.overall));
    const after = mean(treatment.map((result) => result.overall));
    const delta = after - before;
    console.log(
      JSON.stringify({
        event: 'vs-architect-ab-summary',
        trials: TRIALS,
        before,
        after,
        delta,
      }),
    );

    expect(delta).toBeGreaterThanOrEqual(MIN_DELTA);
  });
});
