import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import type { Agent, Scorer } from '@wix/pathgrade';
import { createAgent, evaluate, judge, score } from '@wix/pathgrade';
import { describe, expect, it } from 'vitest';
import { promptOnce } from '../../vs-internal-shared/test/pathgrade-v1';

const SKILLS_DIR = path.resolve(__dirname, '..', '..');
const ARCHITECT_DIR = path.resolve(__dirname, '..');
const FIXTURE_DIR = path.join(__dirname, 'fixtures', 'dispatch');
const EVAL_AGENT = (process.env.PATHGRADE_AGENT ?? 'claude') as 'claude' | 'codex';
const MIN_DELTA = Number.parseFloat(process.env.VS_ARCHITECT_WORKFLOW_MIN_DELTA ?? '0.03');
const SLICE = process.env.VS_ARCHITECT_WORKFLOW_SLICE as Workflow | undefined;

type Arm = 'baseline' | 'treatment';
type Workflow = 'shape-it' | 'build-it' | 'roast-code';

type WorkflowSpec = {
  workflow: Workflow;
  skillName: `vs-${Workflow}`;
  prompt: string;
  removeComposition?: RegExp;
  addTreatment?: (skill: string) => string;
  prepare?: (agent: Agent) => Promise<void>;
  scorers: () => Scorer[];
};

type ArmResult = {
  arm: Arm;
  overall: number;
  scorers: Record<string, number>;
};

const SHAPE_COMPOSITION =
  /#### Architecture evidence[\s\S]+?Skip architect for greenfield work,[\s\S]+?implementation evidence invalidates it\.\s*/;
const BUILD_COMPOSITION =
  /For an unplanned request whose primary outcome is architecture,[\s\S]+?verification\s+owns proof of the implemented behavior\.\s*/;
const ROAST_COMPOSITION =
  /For the \*\*Architecture\*\* lens, when changed code suggests a structural[\s\S]+?Roast Code still owns severity, fixes, and the verdict\.\s*/;

function stripFrontmatter(markdown: string): string {
  return markdown.replace(/^---\s*\n[\s\S]+?\n---\s*\n/, '');
}

function appendArchitect(skill: string): string {
  const architect = stripFrontmatter(
    fs.readFileSync(path.join(ARCHITECT_DIR, 'SKILL.md'), 'utf8'),
  );
  const localComposition = skill.replace(
    /\[`\.\.\/vs-architect\/SKILL\.md`\]\(\.\.\/vs-architect\/SKILL\.md\)/g,
    '**the Composed Architect protocol appended below**',
  );
  return (
    `${localComposition}\n\n## Composed Architect protocol\n\n` +
    'Apply this protocol only at the workflow gate above. The parent workflow owns output and interaction.\n\n' +
    architect
  );
}

function buildSkillVariant(spec: WorkflowSpec, arm: Arm): { root: string; skillDir: string } {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), `vs-${spec.workflow}-${arm}-`));
  const source = path.join(SKILLS_DIR, spec.skillName);
  const skillDir = path.join(root, spec.skillName);
  fs.cpSync(source, skillDir, { recursive: true });

  const skillPath = path.join(skillDir, 'SKILL.md');
  const current = fs.readFileSync(skillPath, 'utf8');
  if (arm === 'baseline') {
    const baseline = spec.removeComposition ? current.replace(spec.removeComposition, '') : current;
    if (spec.removeComposition && baseline === current) {
      throw new Error(`Could not isolate ${spec.workflow} architect composition`);
    }
    fs.writeFileSync(skillPath, baseline);
  } else {
    fs.writeFileSync(skillPath, spec.addTreatment ? spec.addTreatment(current) : appendArchitect(current));
  }
  return { root, skillDir };
}

function signalScore(transcript: string, signals: RegExp[]): number {
  return signals.filter((signal) => signal.test(transcript)).length / signals.length;
}

function sharedEvidenceScorers(): Scorer[] {
  return [
    score('dispatch-evidence', ({ transcript }) =>
      signalScore(transcript, [
        /src\/http\/submit\.ts/i,
        /src\/cli\/submit\.ts/i,
        /(repeat|duplicat|drift|re-?assembl|two callers)/i,
        /CONTEXT\.md|documented concept|domain (?:term|noun)/i,
      ]),
    ),
    score('architecture-depth', ({ transcript }) =>
      signalScore(transcript, [
        /caller (?:obligations?|knowledge)|what callers? must know/i,
        /locality|leverage/i,
        /deletion test|complexity (?:would )?reappear/i,
        /test surface|behavioral (?:test|seam)|characterization test/i,
      ]),
    ),
    score('decision-integrity', ({ transcript }) =>
      signalScore(transcript, [
        /ADR|0001-queue-port\.md/i,
        /QueuePort/i,
        /(preserv|intact|untouched|honou?r|compatible|do not reopen)/i,
      ]),
    ),
  ];
}

function shapeScorers(): Scorer[] {
  return [
    ...sharedEvidenceScorers(),
    score('buildable-design', ({ transcript }) =>
      signalScore(transcript, [
        /smallest|first slice|vertical slice/i,
        /dispatch/i,
        /webhook/i,
        /verification|success criteria|evidence plan/i,
      ]),
    ),
    judge('shape-quality', {
      rubric: `Evaluate the shaped recommendation:
- Grounds module ownership in the duplicated HTTP and CLI Dispatch behavior. (0.30)
- Proposes a deep owned Dispatch boundary that preserves QueuePort rather than a shallow helper or generic pipeline. (0.25)
- Defines the smallest webhook-ready slice and a behavioral proof surface. (0.25)
- Gives concrete tradeoffs and leaves a clear approval decision without implementing code. (0.20)`,
      weight: 0.4,
    }),
  ];
}

function buildScorers(): Scorer[] {
  return [
    ...sharedEvidenceScorers(),
    score('implementation-plan', ({ transcript }) =>
      signalScore(transcript, [
        /plan|steps?/i,
        /failing test|red|TDD|characterization/i,
        /dispatch/i,
        /http[\s\S]{0,200}cli|cli[\s\S]{0,200}http/i,
      ]),
    ),
    score('stops-before-editing', ({ transcript, toolEvents }) => {
      const writes = toolEvents.filter(
        (event) => event.action === 'write_file' || event.action === 'edit_file',
      );
      return writes.length === 0 && /(approve|approval|before (?:code|edit)|stop)/i.test(transcript)
        ? 1
        : 0;
    }),
    judge('build-plan-quality', {
      rubric: `Evaluate the pre-implementation plan:
- Finds the repeated Dispatch responsibilities before choosing file changes. (0.25)
- Concentrates behavior behind a smaller caller-facing boundary while preserving QueuePort. (0.25)
- Orders behavioral characterization before consolidation and names updates to both callers. (0.25)
- Is concrete enough to execute but respects the requested approval stop and makes no edits. (0.25)`,
      weight: 0.4,
    }),
  ];
}

function roastScorers(): Scorer[] {
  return [
    score('finds-triplicated-dispatch', ({ transcript }) =>
      signalScore(transcript, [
        /src\/webhook\/submit\.ts/i,
        /src\/(?:http|cli)\/submit\.ts/i,
        /(third|three|triplicat|copy|duplicat|same sequence)/i,
        /validat[\s\S]{0,120}(select|queue)[\s\S]{0,120}enqueue/i,
      ]),
    ),
    score('actionable-deepening', ({ transcript }) =>
      signalScore(transcript, [
        /caller (?:obligations?|knowledge)|caller pain/i,
        /locality|leverage/i,
        /test surface|behavioral test|characterization/i,
        /dispatch/i,
      ]),
    ),
    score('review-boundary', ({ transcript }) => {
      const scoped = /webhook|staged/i.test(transcript);
      const noInterfaceSketch =
        !/(interface\s+\w+\s*\{|function\s+dispatch\s*\(|class\s+\w*Dispatch)/i.test(
          transcript,
        );
      return (Number(scoped) + Number(noInterfaceSketch)) / 2;
    }),
    score('decision-integrity', ({ transcript }) =>
      signalScore(transcript, [
        /ADR|0001-queue-port\.md/i,
        /QueuePort/i,
        /(preserv|intact|untouched|honou?r|compatible)/i,
      ]),
    ),
    judge('roast-architecture-quality', {
      rubric: `Evaluate the architecture finding in the code review:
- Confirms that the staged webhook change creates a third copy of existing Dispatch behavior, with file evidence. (0.30)
- Explains the structural cost in caller knowledge, locality, or leverage rather than saying only "deduplicate." (0.25)
- Recommends deepening the owned Dispatch behavior while preserving QueuePort and naming the test surface. (0.25)
- Stays within the staged review scope and avoids prematurely designing an interface. (0.20)`,
      weight: 0.4,
    }),
  ];
}

async function stageWebhookCopy(agent: Agent): Promise<void> {
  await agent.exec('git init -q');
  await agent.exec('git config user.name "Pathgrade"');
  await agent.exec('git config user.email "pathgrade@example.com"');
  await agent.exec('git add .');
  await agent.exec('git commit -qm "fixture: existing dispatch entry points"');

  const webhookDir = path.join(agent.workspace, 'src', 'webhook');
  fs.mkdirSync(webhookDir, { recursive: true });
  fs.writeFileSync(
    path.join(webhookDir, 'submit.ts'),
    `import { selectQueue, type Job, validateJob } from '../domain/job';
import type { QueuePort } from '../queue/queue-port';

type WebhookRequest = {
  event: string;
  job: Job;
  signature: string;
};

export async function submitWebhook(request: WebhookRequest, queue: QueuePort) {
  if (!request.signature) {
    return { status: 401, body: { error: 'missing signature' } };
  }

  try {
    validateJob(request.job);
    const queueName = selectQueue(request.job);
    const id = await queue.enqueue(queueName, request.job);
    return {
      status: 202,
      body: {
        accepted: true,
        event: request.event,
        id,
      },
    };
  } catch (error) {
    return {
      status: 400,
      body: {
        accepted: false,
        error: (error as Error).message,
      },
    };
  }
}
`,
  );
  await agent.exec('git add src/webhook/submit.ts');
}

const WORKFLOWS: WorkflowSpec[] = [
  {
    workflow: 'shape-it',
    skillName: 'vs-shape-it',
    removeComposition: SHAPE_COMPOSITION,
    prompt:
      '/vs-shape-it We need webhook submissions alongside the existing HTTP and CLI entry points. ' +
      'Preserve the queue-provider decision. The first slice must avoid behavior drifting between entry points and be provable with tests. ' +
      'No code yet. Those constraints are settled, so bring back the recommendation and approval decision in one response.',
    scorers: shapeScorers,
  },
  {
    workflow: 'build-it',
    skillName: 'vs-build-it',
    removeComposition: BUILD_COMPOSITION,
    prompt:
      '/vs-build-it We need to consolidate the existing HTTP and CLI submission flow before adding a webhook. ' +
      'There is no plan yet. I need to approve your generated plan before any code changes, so stop after the pre-implementation plan.',
    scorers: buildScorers,
  },
  {
    workflow: 'roast-code',
    skillName: 'vs-roast-code',
    removeComposition: ROAST_COMPOSITION,
    prompt:
      '/vs-roast-code Roast the staged webhook change. Focus on whether it fits the existing Job Dispatch architecture. ' +
      'Do not fix it yet; I only want the review findings.',
    prepare: stageWebhookCopy,
    scorers: roastScorers,
  },
];

const ACTIVE_WORKFLOWS = SLICE
  ? WORKFLOWS.filter((spec) => spec.workflow === SLICE)
  : WORKFLOWS;

if (SLICE && ACTIVE_WORKFLOWS.length === 0) {
  throw new Error(`Unknown VS_ARCHITECT_WORKFLOW_SLICE: ${SLICE}`);
}

async function runArm(spec: WorkflowSpec, arm: Arm): Promise<ArmResult> {
  const variant = buildSkillVariant(spec, arm);
  let agent: Agent;
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

  if (spec.prepare) await spec.prepare(agent);
  await promptOnce(agent, spec.prompt);
  const result = await evaluate(agent, spec.scorers(), {
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

describe('vs-architect downstream workflow impact', () => {
  it('improves architecture decisions across shape, build, and review checkpoints', async () => {
    const summaries: Array<{ workflow: Workflow; before: number; after: number; delta: number }> = [];

    for (const spec of ACTIVE_WORKFLOWS) {
      const baseline = await runArm(spec, 'baseline');
      const treatment = await runArm(spec, 'treatment');
      const delta = treatment.overall - baseline.overall;
      summaries.push({
        workflow: spec.workflow,
        before: baseline.overall,
        after: treatment.overall,
        delta,
      });
      console.log(
        JSON.stringify({
          event: 'vs-architect-workflow-ab',
          workflow: spec.workflow,
          before: baseline,
          after: treatment,
          delta,
        }),
      );
    }

    console.log(JSON.stringify({ event: 'vs-architect-workflow-ab-summary', summaries }));
    for (const summary of summaries) {
      expect(summary.delta, summary.workflow).toBeGreaterThanOrEqual(MIN_DELTA);
    }
  }, 2_000_000);
});
