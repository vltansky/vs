import * as fs from 'fs';
import * as path from 'path';
import { describe, it, expect } from 'vitest';
import { createAgent, check, score, judge, evaluate } from '@wix/pathgrade';

const SKILL_DIR = path.resolve(__dirname, '..');
const FIXTURE_DIR = path.join(__dirname, 'fixtures', 'slugify-regression');
const EVAL_AGENT = (process.env.PATHGRADE_AGENT ?? 'claude') as 'claude' | 'codex';
const COPY_FROM_HOME = EVAL_AGENT === 'codex' ? ['.codex'] : undefined;

async function initGitRepo(agent: Awaited<ReturnType<typeof createAgent>>) {
  await agent.exec('git init -q');
  await agent.exec('git config user.name "Pathgrade"');
  await agent.exec('git config user.email "pathgrade@example.com"');
  await agent.exec('git add .');
  await agent.exec('git commit -qm "fixture: initial state"');
}

async function createTddAgent(workspace: string, timeout: number) {
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

function parseGitLog(stdout: string) {
  const commits: Array<{ hash: string; files: string[] }> = [];
  let current: { hash: string; files: string[] } | null = null;

  for (const rawLine of stdout.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) continue;
    if (/^[0-9a-f]{7,40}$/i.test(line)) {
      current = { hash: line, files: [] };
      commits.push(current);
      continue;
    }
    current?.files.push(line);
  }

  return commits;
}

async function findTestAndFixCommits(runCommand: (cmd: string) => Promise<{ stdout: string }>) {
  const { stdout } = await runCommand('git log --reverse --format=%H --name-only');
  const commits = parseGitLog(stdout).slice(1);

  const testCommitIndex = commits.findIndex((commit) =>
    commit.files.includes('src/slugify.test.ts'),
  );
  const implCommitIndex = commits.findIndex((commit) =>
    commit.files.includes('src/slugify.ts'),
  );

  return {
    commits,
    testCommitIndex,
    implCommitIndex,
    testCommit: testCommitIndex === -1 ? null : commits[testCommitIndex],
    implCommit: implCommitIndex === -1 ? null : commits[implCommitIndex],
  };
}

const TDD_RUBRIC = `Evaluate whether the agent followed real TDD discipline for a small bug fix.

Behavior first (0-0.45):
- Did the slugify function end up returning 'untitled' for punctuation-only input?
- Did existing behavior for normal slugs still work?
- Did the agent keep the fix minimal rather than rewriting the whole module?

Test-first evidence (0-0.35):
- Was a regression test added for punctuation-only input?
- Does the git history show the test commit before the implementation commit?
- Was the test change isolated from the production fix in separate commits?

Verification (0-0.2):
- Did the agent run the test suite and leave it passing?
- Did the final workspace contain a believable TDD result rather than a transcript-only claim?`;

describe('tdd', () => {
  it('documents vertical red-green slices and public regression seams', () => {
    const skill = fs.readFileSync(path.join(SKILL_DIR, 'SKILL.md'), 'utf8');

    expect(skill).toMatch(/one vertical behavior slice/);
    expect(skill).toMatch(/Do not write all tests first and then all implementation/);
    expect(skill).toMatch(/public command, API, UI flow, or caller path/);
    expect(skill).toMatch(/Do not test a private helper just because it is easy/);
    expect(skill).toMatch(/Assert observable behavior through public interfaces/);
  });

  it('fixes the empty-slug bug with a failing-test-first flow', async () => {
    const agent = await createTddAgent(FIXTURE_DIR, 420);

    await agent.prompt(
      'This slug generator breaks article URLs when the title is only punctuation. ' +
        "Please fix it so punctuation-only titles become 'untitled'. " +
        'Follow TDD: add the regression test in src/slugify.test.ts first, verify it fails, ' +
        'then make the smallest code change needed. Treat this as a real TDD change and make two commits: ' +
        'first the test, then the fix. Keep the existing slug behavior for normal titles, and run the tests ' +
        'before you finish.',
    );

    const result = await evaluate(
      agent,
      [
        check(
          'slugify-returns-untitled',
          async ({ runCommand }) => {
            const { stdout } = await runCommand(
              "bun -e \"import {slugify} from './src/slugify.ts'; console.log(slugify('!!!'))\"",
            );
            return stdout.trim() === 'untitled';
          },
          { weight: 3 },
        ),
        check(
          'bun-tests-pass',
          async ({ runCommand }) => {
            const { exitCode } = await runCommand('bun test');
            return exitCode === 0;
          },
          { weight: 2 },
        ),
        check(
          'regression-test-added',
          ({ workspace }) => {
            const testFile = path.join(workspace, 'src', 'slugify.test.ts');
            const contents = fs.readFileSync(testFile, 'utf8');
            return /untitled/i.test(contents) && /slugify/i.test(contents);
          },
          { weight: 2 },
        ),
        score(
          'test-first-commit-order',
          async ({ runCommand }) => {
            const { testCommitIndex, implCommitIndex, testCommit } =
              await findTestAndFixCommits(runCommand);

            if (testCommitIndex === -1 || implCommitIndex === -1) return 0;
            if (testCommitIndex >= implCommitIndex) return 0;

            if (!testCommit) return 0;
            if (testCommit.files.includes('src/slugify.ts')) return 0;
            return 1;
          },
          { weight: 5 },
        ),
        check(
          'test-only-commit-fails-before-fix',
          async ({ runCommand }) => {
            const { testCommit } = await findTestAndFixCommits(runCommand);
            if (!testCommit) return false;

            const { exitCode } = await runCommand(
              `tmp=$(mktemp -d) && ` +
                `git archive ${testCommit.hash} | tar -x -C "$tmp" && ` +
                `(cd "$tmp" && bun test >/dev/null 2>&1); code=$?; ` +
                `rm -rf "$tmp"; ` +
                `test $code -ne 0`,
            );

            return exitCode === 0;
          },
          { weight: 4 },
        ),
        judge('tdd-quality', {
          rubric: TDD_RUBRIC,
          weight: 2,
        }),
      ],
      { failFast: false, onScorerError: 'zero' },
    );

    expect(result.score).toBeGreaterThanOrEqual(0.85);
    await agent.dispose();
  });
});
