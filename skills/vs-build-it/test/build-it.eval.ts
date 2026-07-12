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

const SKILL_DIR = path.resolve(__dirname, '..');
const TS_FIXTURE = path.join(__dirname, 'fixtures', 'ts-project');
const BUG_FIXTURE = path.join(__dirname, 'fixtures', 'ts-project-with-bug');
const EVAL_AGENT = (process.env.PATHGRADE_AGENT ?? 'claude') as 'claude' | 'codex';
const COPY_FROM_HOME = EVAL_AGENT === 'codex' ? ['.codex'] : undefined;

const HAPPY_PATH_RUBRIC = `Evaluate whether the build-it skill correctly implemented a plan end-to-end.

Pipeline Execution (0-0.4):
- Did it create a feature branch (not work on main)?
- Were commits atomic (multiple commits, not one giant commit)?
- Did it write tests before or alongside implementation (TDD discipline)?
- Did guardrails (tsc, bun test) pass at the end?

Handoff Quality (0-0.3):
- Does the output include a pipeline summary table (phases + results)?
- Is there a decision log showing auto-resolved decisions?
- Are final guardrail results shown (types, tests, build)?
- Does it suggest the next step (ship-it or fixes needed)?

Code Quality (0-0.3):
- Does the implementation match what was asked for?
- Are tests meaningful (not just "it exists" checks)?
- Does the code follow the project's existing patterns?`;

const CIRCUIT_BREAKER_RUBRIC = `Evaluate whether the build-it skill correctly STOPPED on a bad plan.

Stop Behavior (0-0.6):
- Did build-it identify the plan as NOT_READY or overly ambitious?
- Did it STOP before writing any implementation code?
- Did it explain what needs to change before the plan is worth implementing?

Analysis Quality (0-0.4):
- Did it identify specific problems (scope too large, missing prerequisites, unrealistic)?
- Were concerns backed by evidence (codebase state, dependency count, complexity)?
- Did it present findings clearly to the user?`;

const TDD_RUBRIC = `Evaluate whether the build-it skill followed TDD discipline for a bug fix.

TDD Order (0-0.4):
- Was a failing test written BEFORE the fix was applied?
- Does the test specifically cover the reported bug (special chars -> 'untitled')?
- Did the agent verify the test fails before fixing?

Fix Quality (0-0.3):
- Is the fix minimal (adding a fallback, not rewriting the function)?
- Does slugify now return 'untitled' for inputs with only special characters?
- Do all existing tests still pass?

Process (0-0.3):
- Were commits atomic (test commit and/or fix commit, not one blob)?
- Did guardrails pass at the end?
- Is there a handoff summary?`;

async function initGitRepo(agent: Awaited<ReturnType<typeof createAgent>>) {
  await agent.exec('git init -q');
  await agent.exec('git config user.name "Pathgrade"');
  await agent.exec('git config user.email "pathgrade@example.com"');
  await agent.exec('git add .');
  await agent.exec('git commit -qm "fixture: initial state"');
}

async function createBuildItAgent(workspace: string, timeout: number) {
  const agent = await createAgent({
    agent: EVAL_AGENT,
    timeout,
    skillDir: SKILL_DIR,
    workspace,
    copyFromHome: COPY_FROM_HOME,
    debug: true,
  });

  await initGitRepo(agent);
  return agent;
}

describe('build-it', () => {
  it('happy-path: implements capitalize function with tests', async () => {
    const agent = await createBuildItAgent(TS_FIXTURE, 600);

    await agent.prompt(
      'Implement a capitalize(str) function that capitalizes the first letter of each word. ' +
        'Plan:\n- Step 1: Create src/string.ts with the capitalize function\n- Step 2: Add tests in src/string.test.ts\n\n' +
        'Run bun install first if needed. Follow the build-it skill. ' +
        'Do NOT ask questions — auto-resolve all decisions. ' +
        'Do not call AskUserQuestion or any other interactive/user-input tool. ' +
        'Do not start a dev server.',
    );

    const result = await evaluate(
      agent,
      [
        // Did it create the implementation file?
        check('impl-exists', ({ workspace }) =>
          fs.existsSync(path.join(workspace, 'src', 'string.ts')),
        ),

        // Did it create tests?
        check('tests-exist', ({ workspace }) => {
          const testFile = path.join(workspace, 'src', 'string.test.ts');
          return fs.existsSync(testFile);
        }),

        // Do tests pass?
        check(
          'tests-pass',
          async ({ runCommand }) => {
            const { exitCode } = await runCommand('bun test');
            return exitCode === 0;
          },
          { weight: 2 },
        ),

        // Does the function actually work?
        check('capitalize-works', async ({ runCommand }) => {
          const { stdout } = await runCommand(
            'bun -e "import {capitalize} from \'./src/string.ts\'; console.log(capitalize(\'hello world\'))"',
          );
          return stdout.trim() === 'Hello World';
        }),

        // Multiple commits (not one giant commit)?
        score('atomic-commits', async ({ runCommand }) => {
          const { stdout } = await runCommand('git log --oneline | wc -l');
          const count = parseInt(stdout.trim(), 10);
          if (count >= 3) return 1.0;
          if (count >= 2) return 0.5;
          return 0.0;
        }),

        // Feature branch created?
        check('feature-branch', async ({ runCommand }) => {
          const { stdout } = await runCommand('git branch --show-current');
          const branch = stdout.trim();
          return branch !== 'main' && branch !== 'master';
        }),

        // Types pass?
        check('types-pass', async ({ runCommand }) => {
          const { exitCode } = await runCommand('bunx tsc --noEmit');
          return exitCode === 0;
        }),

        // Has handoff summary?
        check('has-handoff', ({ transcript }) =>
          /pipeline|handoff|build-it complete|decision log/i.test(transcript),
        ),

        // LLM judge for overall quality
        judge('overall-quality', {
          rubric: HAPPY_PATH_RUBRIC,
          weight: 2,
        }),

        // Tool usage — did it follow the right workflow?
        toolUsage('implementation-workflow', [
          { action: 'read_file', min: 1, weight: 0.2 },
          { action: 'write_file', min: 1, weight: 0.3 },
          { action: 'run_shell', commandContains: 'test', min: 1, weight: 0.3 },
          { action: 'run_shell', commandContains: 'git', min: 1, weight: 0.2 },
        ]),
      ],
      { failFast: false, onScorerError: 'zero' },
    );

    expect(result.score).toBeGreaterThan(0.5);
    await agent.dispose();
  });

  it('circuit-breaker: stops on absurd plan', async () => {
    const agent = await createBuildItAgent(TS_FIXTURE, 300);

    await agent.prompt(
      'Rewrite the entire application to use microservices with Kubernetes orchestration, ' +
        'gRPC inter-service communication, event sourcing with Apache Kafka, and a CQRS pattern ' +
        'across 12 bounded contexts.\n\n' +
        'Follow the build-it skill. Do NOT ask questions. ' +
        'Do not call AskUserQuestion or any other interactive/user-input tool. ' +
        'Do not start a dev server. ' +
        'If the plan is NOT_READY, stop and explain what needs to change.',
    );

    const result = await evaluate(
      agent,
      [
        // Did NOT create implementation files (should have stopped)
        check('no-impl-files', ({ workspace }) => {
          const src = path.join(workspace, 'src');
          if (!fs.existsSync(src)) return true;
          const files = fs.readdirSync(src);
          // Should only have index.ts from fixture, nothing new
          return files.length <= 1;
        }),

        // Stayed on main (no feature branch created for a rejected plan)
        score('no-feature-branch', async ({ runCommand }) => {
          const { stdout } = await runCommand('git branch --show-current');
          const branch = stdout.trim();
          return branch === 'main' || branch === 'master' ? 1.0 : 0.3;
        }),

        // Output mentions NOT_READY or rejection
        check(
          'identified-bad-plan',
          ({ transcript }) =>
            /not.ready|not ready|score.*[0-5]\d|too ambitious|unrealistic|scope|circuit.breaker|stop/i.test(
              transcript,
            ),
          { weight: 2 },
        ),

        // LLM judge
        judge('stop-quality', {
          rubric: CIRCUIT_BREAKER_RUBRIC,
          weight: 2,
        }),
      ],
      { failFast: false, onScorerError: 'zero' },
    );

    expect(result.score).toBeGreaterThan(0.4);
    await agent.dispose();
  });

  it('tdd-discipline: fixes slugify bug with test-first approach', async () => {
    const agent = await createBuildItAgent(BUG_FIXTURE, 600);

    await agent.prompt(
      'Fix a bug: the slugify function returns empty string for inputs with only special characters. ' +
        "It should return 'untitled' as fallback. Plan:\n" +
        '- Step 1: Add failing test that reproduces the bug\n' +
        "- Step 2: Fix slugify to return 'untitled' when result is empty\n\n" +
        'Run bun install first if needed. Follow the build-it skill with TDD discipline. ' +
        'Do NOT ask questions. Do not call AskUserQuestion or any other interactive/user-input tool. ' +
        'Do not start a dev server.',
    );

    const result = await evaluate(
      agent,
      [
        // Bug is actually fixed
        check(
          'bug-fixed',
          async ({ runCommand }) => {
            const { stdout } = await runCommand(
              "bun -e \"import {slugify} from './src/slugify.ts'; console.log(slugify('!!!@@@###'))\"",
            );
            return stdout.trim() === 'untitled';
          },
          { weight: 2 },
        ),

        // All tests pass (old + new)
        check(
          'tests-pass',
          async ({ runCommand }) => {
            const { exitCode } = await runCommand('bun test');
            return exitCode === 0;
          },
          { weight: 2 },
        ),

        // Test file was modified (new test added)
        check('test-added', async ({ runCommand }) => {
          const { stdout } = await runCommand('git diff --name-only HEAD~1..HEAD 2>/dev/null || git diff --name-only');
          return /slugify\.test/.test(stdout) || /test/.test(stdout);
        }),

        // Fix is minimal (slugify.ts changed, not rewritten)
        score('minimal-fix', async ({ runCommand }) => {
          const { stdout } = await runCommand(
            'git diff --stat HEAD~1..HEAD 2>/dev/null || echo "1 file changed, 3 insertions"',
          );
          const insertions = stdout.match(/(\d+) insertion/);
          const count = insertions ? parseInt(insertions[1], 10) : 0;
          if (count <= 5) return 1.0;
          if (count <= 15) return 0.7;
          if (count <= 30) return 0.3;
          return 0.1;
        }),

        // LLM judge for TDD quality
        judge('tdd-quality', {
          rubric: TDD_RUBRIC,
          weight: 2,
        }),
      ],
      { failFast: false, onScorerError: 'zero' },
    );

    expect(result.score).toBeGreaterThan(0.5);
    await agent.dispose();
  });

  it('no-plan: auto-generates plan for reverse function', async () => {
    const agent = await createBuildItAgent(TS_FIXTURE, 600);

    await agent.prompt(
      'Add a reverse(str) utility function that reverses a string, handling unicode correctly.\n\n' +
        'No plan is provided — just this feature request. Follow the build-it skill. ' +
        'It should auto-generate a plan before executing. ' +
        'Do NOT ask questions. Do not call AskUserQuestion or any other interactive/user-input tool. ' +
        'Do not start a dev server.',
    );

    const result = await evaluate(
      agent,
      [
        // Function exists and works
        check(
          'reverse-works',
          async ({ runCommand }) => {
            const { stdout } = await runCommand(
              "bun -e \"import {reverse} from './src/string.ts'; console.log(reverse('hello'))\" 2>/dev/null || " +
                "bun -e \"import {reverse} from './src/reverse.ts'; console.log(reverse('hello'))\"",
            );
            return stdout.trim() === 'olleh';
          },
          { weight: 2 },
        ),

        // Tests exist and pass
        check('tests-pass', async ({ runCommand }) => {
          const { exitCode } = await runCommand('bun test');
          return exitCode === 0;
        }),

        // Output mentions auto-generating a plan
        check('auto-generated-plan', ({ transcript }) =>
          /auto.generat|no plan|generat.*plan|plan.*generat|missing plan|creat.*plan/i.test(
            transcript,
          ),
        ),

        // Has decision log mentioning the auto-generation
        check('decision-log', ({ transcript }) =>
          /decision.*log|decision.*#|auto.*resolv/i.test(transcript),
        ),

        // Feature branch
        check('feature-branch', async ({ runCommand }) => {
          const { stdout } = await runCommand('git branch --show-current');
          return stdout.trim() !== 'main' && stdout.trim() !== 'master';
        }),

        // LLM judge
        judge('no-plan-quality', {
          rubric: HAPPY_PATH_RUBRIC,
          weight: 2,
        }),
      ],
      { failFast: false, onScorerError: 'zero' },
    );

    expect(result.score).toBeGreaterThan(0.4);
    await agent.dispose();
  });
});
