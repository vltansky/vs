import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { afterAll, describe, expect, it } from 'vitest';
import { check, evaluate } from '@wix/pathgrade';
import { createAgent } from '../../vs-internal-shared/test/pathgrade-agent';

const FIXTURE_DIR = path.join(__dirname, 'fixtures', 'minimum-solution');
const EVAL_AGENT = (process.env.PATHGRADE_AGENT ?? 'codex') as
  | 'claude'
  | 'codex';
const COPY_FROM_HOME =
  EVAL_AGENT === 'codex' ? ['.codex/auth.json'] : undefined;
const BEFORE_COMMIT = '30780508344d9dba10e79f55d3aba96f9a4604e5';
const RESULTS_PATH = path.join(
  __dirname,
  '..',
  '..',
  '..',
  '.pathgrade',
  'minimum-solution-comparison.json',
);

const BASE_GUIDANCE = `# Implementation discipline

Read the affected code before editing. Implement the complete requested
behavior, preserve security and accessibility requirements, and run the
smallest existing check that proves the result. Stay within the requested
scope.`;

const VS_GUIDANCE = fs.readFileSync(
  path.join(
    __dirname,
    '..',
    '..',
    'vs-ponytail',
    'references',
    'contract.md',
  ),
  'utf8',
);
const PONYTAIL_GUIDANCE = fs
  .readFileSync(path.join(__dirname, 'baselines', 'ponytail-full.md'), 'utf8')
  .replace(/^---[\s\S]*?---\s*/, '');

type Task = {
  name: string;
  fixture: string;
  target: string;
  prompt: string;
  expectedPattern: RegExp;
  forbiddenPattern?: RegExp;
  verify?: (source: string) => boolean;
};

type Arm = 'ponytail' | 'vs-before' | 'vs-after';

type ArmResult = {
  arm: Arm;
  repetition: number;
  task: string;
  score: number;
  correct: boolean;
  economy: boolean;
  addedLines: number;
  changedFiles: number;
  dependencyDelta: number;
  tokens: number;
  durationMs: number;
  targetSource: string;
};

type ComparisonSummary = Record<
  'ponytail' | 'vsBefore' | 'vsAfter',
  {
    correct: number;
    economy: number;
    dependencyDelta: number;
    correctOutputMedianLines: number;
    correctOutputMedianFiles: number;
    correctOutputMedianTokens: number;
    correctOutputMedianDurationMs: number;
  }
>;

const ALL_TASKS: Task[] = [
  {
    name: 'native date input',
    fixture: 'native-date',
    target: 'src/ProfileForm.jsx',
    prompt:
      'Users need to provide their birth date in ProfileForm. Add the complete field, make it required, and submit it as birthDate. Take it from here and implement it end to end. Do not start a dev server.',
    expectedPattern: /type\s*=\s*["'{]date|type:\s*["']date/,
    forbiddenPattern: /flatpickr|datepicker|calendar/i,
  },
  {
    name: 'native profile controls',
    fixture: 'native-controls',
    target: 'src/PreferencesForm.jsx',
    prompt:
      'Extend PreferencesForm so users can choose a favorite color and select an avatar image in the default form. Collapse only its existing optional preferences so they do not clutter that view. The form must remain keyboard accessible. Take it from here and implement it end to end. Do not start a dev server.',
    expectedPattern: /type\s*=\s*["'{]color[\s\S]*type\s*=\s*["'{]file[\s\S]*<details/i,
    forbiddenPattern:
      /useState|drag(?:And)?Drop|dropzone|colorpicker|addEventListener/i,
    verify: (source) =>
      /name\s*=\s*["'{]favoriteColor/.test(source) &&
      /name\s*=\s*["'{]avatar/.test(source) &&
      /accept\s*=\s*["'{]image\//.test(source) &&
      /<details[\s\S]*<summary[\s\S]*<fieldset[\s\S]*<legend[\s\S]*name\s*=\s*["'{]timeZone[\s\S]*name\s*=\s*["'{]weeklyDigest[\s\S]*<\/fieldset[\s\S]*<\/details/.test(
        source,
      ),
  },
  {
    name: 'existing ID helper',
    fixture: 'reuse-helper',
    target: 'src/orders.js',
    prompt:
      'Add createDraftOrder() so it returns a new order with a unique id and draft status. Take it from here and implement it end to end. Do not start a dev server.',
    expectedPattern: /newId\s*\(/,
    forbiddenPattern: /randomUUID|Date\.now|Math\.random|from ['"]uuid['"]/,
  },
  {
    name: 'URLSearchParams',
    fixture: 'url-search',
    target: 'src/filters.js',
    prompt:
      'Implement parseFilters(search). It must decode q and preserve every repeated tag value. Take it from here and implement it end to end. Do not start a dev server.',
    expectedPattern: /URLSearchParams/,
    forbiddenPattern: /decodeURIComponent|\.split\s*\(\s*['"]&/,
  },
];
const taskFilter = process.env.MINIMUM_SOLUTION_TASK;
const TASKS = taskFilter
  ? ALL_TASKS.filter((task) => task.name === taskFilter)
  : ALL_TASKS;
const REPETITIONS = Number.parseInt(
  process.env.MINIMUM_SOLUTION_REPEATS ?? '3',
  10,
);
const GUIDANCE_BY_ARM = new Map<Arm, string>([
  ['ponytail', PONYTAIL_GUIDANCE],
  ['vs-before', ''],
  ['vs-after', VS_GUIDANCE],
]);
const ARM_ORDERS: Arm[][] = [
  ['ponytail', 'vs-before', 'vs-after'],
  ['vs-before', 'vs-after', 'ponytail'],
  ['vs-after', 'ponytail', 'vs-before'],
];

const temporaryRoots: string[] = [];

function writeResults(results: ArmResult[], summary?: ComparisonSummary) {
  fs.mkdirSync(path.dirname(RESULTS_PATH), { recursive: true });
  fs.writeFileSync(
    RESULTS_PATH,
    `${JSON.stringify(
      {
        metadata: {
          beforeCommit: BEFORE_COMMIT,
          repetitions: REPETITIONS,
          tasks: TASKS.map((task) => task.name),
          complete: Boolean(summary),
        },
        ...(summary ? { summary } : {}),
        runs: results,
      },
      null,
      2,
    )}\n`,
  );
}

afterAll(() => {
  for (const root of temporaryRoots) fs.rmSync(root, { recursive: true });
});

function createArmWorkspace(task: Task, arm: Arm) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'vs-minimum-solution-'));
  const workspace = path.join(root, 'workspace');
  temporaryRoots.push(root);
  fs.cpSync(path.join(FIXTURE_DIR, task.fixture), workspace, {
    recursive: true,
  });
  const armGuidance = GUIDANCE_BY_ARM.get(arm);
  fs.writeFileSync(
    path.join(workspace, 'AGENTS.md'),
    armGuidance ? `${BASE_GUIDANCE}\n\n${armGuidance}` : BASE_GUIDANCE,
  );
  return workspace;
}

async function initGitRepo(
  agent: Awaited<ReturnType<typeof createAgent>>,
) {
  await agent.exec('git init -q');
  await agent.exec('git config user.name "Pathgrade"');
  await agent.exec('git config user.email "pathgrade@example.com"');
  await agent.exec('git add .');
  await agent.exec('git commit -qm "fixture: initial state"');
}

async function runArm(
  task: Task,
  arm: Arm,
  repetition: number,
): Promise<ArmResult> {
  const agent = await createAgent({
    agent: EVAL_AGENT,
    timeout: 600,
    workspace: createArmWorkspace(task, arm),
    copyFromHome: COPY_FROM_HOME,
    debug: true,
    transport: EVAL_AGENT === 'codex' ? 'exec' : undefined,
  });

  await initGitRepo(agent);
  const startedAt = performance.now();
  await agent.prompt(task.prompt);
  const durationMs = performance.now() - startedAt;

  const result = await evaluate(
    agent,
    [
      check('correct', async ({ runCommand }) => {
        if (task.verify || task.fixture === 'native-date') {
          const { stdout } = await runCommand(`sed -n '1,240p' ${task.target}`);
          return task.verify
            ? task.verify(stdout)
            : /name\s*=\s*["'{]birthDate/.test(stdout) && /required/.test(stdout);
        }
        const { exitCode } = await runCommand('npm test');
        return exitCode === 0;
      }),
      check('economical-choice', async ({ runCommand }) => {
        const { stdout } = await runCommand(`sed -n '1,260p' ${task.target}`);
        return (
          task.expectedPattern.test(stdout) &&
          !(task.forbiddenPattern?.test(stdout) ?? false)
        );
      }),
    ],
    { failFast: false, onScorerError: 'zero' },
  );

  const rootCommit = (
    await agent.exec('git rev-list --max-parents=0 HEAD')
  ).stdout.trim();
  const numstat = await agent.exec(
    `git diff --numstat ${rootCommit} -- src package.json`,
  );
  const rows = numstat.stdout
    .trim()
    .split('\n')
    .filter(Boolean)
    .map((line) => line.split('\t'));
  const addedLines = rows.reduce(
    (sum, [added]) => sum + (Number.parseInt(added, 10) || 0),
    0,
  );
  const packageDiff = await agent.exec(
    `git diff ${rootCommit} -- package.json`,
  );
  const dependencyDelta = packageDiff.stdout
    .split('\n')
    .filter((line) => /^\+\s*"[^"\n]+":\s*"/.test(line)).length;
  const correct =
    result.scorers.find((scorer) => scorer.name === 'correct')?.score === 1;
  const economy =
    result.scorers.find((scorer) => scorer.name === 'economical-choice')
      ?.score === 1;
  const tokenMatches = agent.log
    .flatMap((entry) => [entry.stderr, entry.output])
    .filter((value): value is string => Boolean(value))
    .flatMap((value) =>
      [...value.matchAll(/tokens used\s+([\d,]+)/gi)].map((match) =>
        Number.parseInt(match[1].replaceAll(',', ''), 10),
      ),
    );
  const targetSource = (await agent.exec(`sed -n '1,260p' ${task.target}`))
    .stdout;
  await agent.dispose();
  return {
    arm,
    repetition,
    task: task.name,
    score: result.score,
    correct,
    economy,
    addedLines,
    changedFiles: rows.length,
    dependencyDelta,
    tokens: Math.max(0, ...tokenMatches),
    durationMs,
    targetSource,
  };
}

describe('VS minimum-solution before/after and pure Ponytail comparison', () => {
  it('keeps VS after non-inferior to both VS before and Ponytail', async () => {
    const results: ArmResult[] = [];

    for (let repetition = 1; repetition <= REPETITIONS; repetition += 1) {
      for (const [taskIndex, task] of TASKS.entries()) {
        const order = ARM_ORDERS[(repetition - 1 + taskIndex) % ARM_ORDERS.length];
        for (const arm of order) {
          results.push(await runArm(task, arm, repetition));
          writeResults(results);
        }
      }
    }

    console.table(
      results.map(({ targetSource: _targetSource, ...result }) => result),
    );

    const ponytail = results.filter((result) => result.arm === 'ponytail');
    const before = results.filter((result) => result.arm === 'vs-before');
    const after = results.filter((result) => result.arm === 'vs-after');
    const sum = (items: ArmResult[], key: keyof ArmResult) =>
      items.reduce((total, item) => total + Number(item[key]), 0);
    const median = (values: number[]) => {
      const sorted = [...values].sort((left, right) => left - right);
      const middle = Math.floor(sorted.length / 2);
      return sorted.length % 2 === 0
        ? (sorted[middle - 1] + sorted[middle]) / 2
        : sorted[middle];
    };
    const medianTotal = (items: ArmResult[], key: keyof ArmResult) =>
      TASKS.reduce(
        (total, task) =>
          total +
          median(
            items
              .filter(
                (result) => result.task === task.name && result.correct,
              )
              .map((result) => Number(result[key])),
          ),
        0,
      );

    const summarize = (items: ArmResult[]) => ({
      correct: sum(items, 'correct'),
      economy: sum(items, 'economy'),
      dependencyDelta: sum(items, 'dependencyDelta'),
      correctOutputMedianLines: medianTotal(items, 'addedLines'),
      correctOutputMedianFiles: medianTotal(items, 'changedFiles'),
      correctOutputMedianTokens: medianTotal(items, 'tokens'),
      correctOutputMedianDurationMs: medianTotal(items, 'durationMs'),
    });
    const summary = {
      ponytail: summarize(ponytail),
      vsBefore: summarize(before),
      vsAfter: summarize(after),
    };

    writeResults(results, summary);
    console.table(summary);

    expect(after.every((result) => result.correct)).toBe(true);
    for (const baseline of [before, ponytail]) {
      expect(
        TASKS.every((task) =>
          baseline.some(
            (result) => result.task === task.name && result.correct,
          ),
        ),
      ).toBe(true);
      expect(sum(after, 'correct')).toBeGreaterThanOrEqual(
        sum(baseline, 'correct'),
      );
      expect(medianTotal(after, 'addedLines')).toBeLessThanOrEqual(
        medianTotal(baseline, 'addedLines'),
      );
      expect(medianTotal(after, 'changedFiles')).toBeLessThanOrEqual(
        medianTotal(baseline, 'changedFiles'),
      );
      expect(medianTotal(after, 'economy')).toBeGreaterThanOrEqual(
        medianTotal(baseline, 'economy'),
      );
      expect(medianTotal(after, 'durationMs')).toBeLessThanOrEqual(
        medianTotal(baseline, 'durationMs') * 1.1,
      );

      const baselineTokens = medianTotal(baseline, 'tokens');
      const afterTokens = medianTotal(after, 'tokens');
      if (baselineTokens > 0 && afterTokens > 0) {
        expect(afterTokens).toBeLessThanOrEqual(baselineTokens * 1.1);
      }
    }
    expect(sum(after, 'dependencyDelta')).toBe(0);
  }, 1_800_000);
});
