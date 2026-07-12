import * as fs from 'fs';
import * as path from 'path';
import { describe, it, expect } from 'vitest';
import { createAgent, check, score, judge, evaluate } from '@wix/pathgrade';

const SKILL_DIR = path.resolve(__dirname, '..');
const BUG_FIXTURE = path.join(__dirname, 'fixtures', 'ts-library-with-bug');
const EVAL_AGENT = (process.env.PATHGRADE_AGENT ?? 'claude') as 'claude' | 'codex';
const COPY_FROM_HOME = EVAL_AGENT === 'codex' ? ['.codex'] : undefined;

const BUGFIX_RUBRIC = `Evaluate whether the bugfix skill handled the bug with an evidence-first bugfix workflow.

Reproduction and proof (0-0.4):
- Did the agent prove the bug with a failing or newly added regression test before claiming success?
- Does the resulting test specifically cover the reported special-characters case?

Fix quality (0-0.4):
- Does slugify now return 'untitled' for inputs with only special characters?
- Is the fix minimal and local to the reported behavior?
- Do the existing tests still pass?

Verification and handoff (0-0.2):
- Did the agent verify the full suite after the fix?
- Did it clearly explain what was fixed and how it was verified?`;

async function findTestAndFixCommits(runCommand: (cmd: string) => Promise<{ stdout: string }>) {
  const { stdout } = await runCommand('git log --reverse --format=%H --name-only');
  const lines = stdout.split(/\r?\n/);
  const commits: Array<{ hash: string; files: string[] }> = [];
  let current: { hash: string; files: string[] } | null = null;

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;
    if (/^[0-9a-f]{7,40}$/i.test(line)) {
      current = { hash: line, files: [] };
      commits.push(current);
      continue;
    }
    current?.files.push(line);
  }

  const relevantCommits = commits.slice(1);
  const testCommit = relevantCommits.find((commit) =>
    commit.files.includes('src/slugify.test.ts') && !commit.files.includes('src/slugify.ts'),
  );
  const fixCommit = relevantCommits.find((commit) => commit.files.includes('src/slugify.ts'));

  return { testCommit, fixCommit };
}

async function initGitRepo(agent: Awaited<ReturnType<typeof createAgent>>) {
  await agent.exec('git init -q');
  await agent.exec('git config user.name "Pathgrade"');
  await agent.exec('git config user.email "pathgrade@example.com"');
  await agent.exec('git add .');
  await agent.exec('git commit -qm "fixture: initial state"');
}

async function createBugfixAgent() {
  const agent = await createAgent({
    agent: EVAL_AGENT,
    timeout: 600,
    skillDir: SKILL_DIR,
    workspace: BUG_FIXTURE,
    copyFromHome: COPY_FROM_HOME,
    debug: true,
  });

  await initGitRepo(agent);
  return agent;
}

describe('bugfix', () => {
  it('reproduces a bug with a regression test, fixes it, and verifies the suite', async () => {
    const agent = await createBugfixAgent();

    await agent.prompt(
      "The slugify helper is broken: when the input is only special characters like '!!!@@@###', it returns an empty string. " +
        "It should return 'untitled' instead. Fix the bug end-to-end using the bugfix workflow. " +
        'Do not ask questions. Do not call AskUserQuestion or any other interactive/user-input tool. ' +
        'Run bun install first if needed, but continue if the environment blocks network access.',
    );

    const result = await evaluate(
      agent,
      [
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
        check(
          'tests-pass',
          async ({ runCommand }) => {
            const { exitCode } = await runCommand('bun test');
            return exitCode === 0;
          },
          { weight: 2 },
        ),
        check('regression-test-added', ({ workspace }) => {
          const testFile = path.join(workspace, 'src', 'slugify.test.ts');
          if (!fs.existsSync(testFile)) return false;
          const content = fs.readFileSync(testFile, 'utf8');
          return /untitled|special characters|!!!@@@###/.test(content);
        }),
        score('commit-discipline', async ({ runCommand }) => {
          const { stdout } = await runCommand('git log --oneline --max-count=5');
          const lines = stdout
            .split('\n')
            .map((line) => line.trim())
            .filter(Boolean);
          const hasTestCommit = lines.some((line) => /test:/i.test(line));
          const hasFixCommit = lines.some((line) => /fix:/i.test(line));
          if (hasTestCommit && hasFixCommit) return 1;
          if (hasTestCommit || hasFixCommit) return 0.5;
          return 0;
        }),
        check(
          'test-only-commit-fails-before-fix',
          async ({ runCommand }) => {
            const { testCommit, fixCommit } = await findTestAndFixCommits(runCommand);
            if (!testCommit || !fixCommit) return false;

            const { exitCode } = await runCommand(
              `tmp=$(mktemp -d) && ` +
                `git archive ${testCommit.hash} | tar -x -C "$tmp" && ` +
                `(cd "$tmp" && bun test >/dev/null 2>&1); code=$?; ` +
                `rm -rf "$tmp"; ` +
                `test $code -ne 0`,
            );

            return exitCode === 0;
          },
          { weight: 3 },
        ),
        check(
          'fix-keeps-scope-local',
          async ({ runCommand }) => {
            const { stdout } = await runCommand(
              'git diff --name-only $(git rev-list --max-parents=0 HEAD)..HEAD',
            );
            const files = stdout
              .split('\n')
              .map((line) => line.trim())
              .filter(Boolean)
              .sort();
            return (
              files.length === 2 &&
              files[0] === 'src/slugify.test.ts' &&
              files[1] === 'src/slugify.ts'
            );
          },
          { weight: 2 },
        ),
        judge('bugfix-quality', {
          rubric: BUGFIX_RUBRIC,
          weight: 2,
        }),
      ],
      { failFast: false, onScorerError: 'zero' },
    );

    expect(result.score).toBeGreaterThan(0.5);
    await agent.dispose();
  });
});
