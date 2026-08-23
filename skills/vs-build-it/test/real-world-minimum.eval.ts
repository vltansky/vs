import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { afterAll, describe, expect, it } from 'vitest';
import { check, evaluate } from '@wix/pathgrade';
import { promptOnce } from '../../vs-internal-shared/test/pathgrade-v1';
import { createAgent } from '../../vs-internal-shared/test/pathgrade-agent';

const SKILL_DIR = path.resolve(__dirname, '..');
const FIXTURE_DIR = path.join(__dirname, 'fixtures', 'real-world-minimum');
const EVAL_AGENT = (process.env.PATHGRADE_AGENT ?? 'codex') as 'claude' | 'codex';
const COPY_FROM_HOME = EVAL_AGENT === 'codex' ? ['.codex/auth.json'] : undefined;
const VS_GUIDANCE = fs.readFileSync(
  path.join(__dirname, '..', '..', 'vs-ponytail', 'references', 'contract.md'),
  'utf8',
);
const BASE_GUIDANCE = `# Implementation discipline

Read the affected code before editing. Implement the complete requested
behavior, preserve security and accessibility requirements, and run the
smallest existing check that proves the result. Stay within the requested
scope.`;

type Task = {
  name: string;
  fixture: string;
  target: string;
  prompt: string;
  expected: RegExp;
  forbidden: RegExp;
  testCommand?: string;
  privacy?: RegExp;
};

const TASKS: Task[] = [
  {
    name: 'reuse queue boundary',
    fixture: 'reuse-queue',
    target: 'src/reminders.js',
    prompt:
      'Implement queueReminder(reminder) end to end. Reuse the existing validateRecipient and enqueue helpers, preserve their returned shape, and keep this operation queue-only. Do not send, schedule, add dependencies, or refactor unrelated files. Add or update only the smallest necessary test. Follow build-it, do not ask questions, and do not start a dev server.',
    expected: /validateRecipient[\s\S]*enqueue|enqueue[\s\S]*validateRecipient/,
    forbidden: /fetch\s*\(|send(?:Message|Reminder)\s*\(|setTimeout|setInterval|randomUUID/i,
    testCommand: 'npm test',
  },
  {
    name: 'native confirmation surface',
    fixture: 'native-dialog',
    target: 'src/RemoveFilter.jsx',
    prompt:
      'Add a keyboard-accessible confirmation surface to RemoveFilter. Use the browser native <dialog> element and a form with method="dialog", with clear Cancel and Confirm actions. Keep the existing name and remove button. Do not add a UI dependency, custom modal state, a portal, or unrelated refactors. Follow build-it, do not ask questions, and do not start a dev server.',
    expected: /<dialog[\s\S]*<form[^>]*method\s*=\s*["']dialog["'][\s\S]*(Cancel|cancel)[\s\S]*(Confirm|confirm)/i,
    forbidden: /useState|createPortal|role\s*=\s*["']dialog|from ['"][^'"]*(dialog|modal)[^'"]*['"]|addEventListener/i,
  },
  {
    name: 'private handoff boundary',
    fixture: 'private-handoff',
    target: 'src/handoff.js',
    prompt:
      'Implement publicHandoff(record) end to end by reusing pickPublicFields. Return only the public id, status, and summary fields; never copy private properties, add logging, or add dependencies. Do not repeat any private fixture values in your final response. Follow build-it, do not ask questions, and do not start a dev server.',
    expected: /pickPublicFields\s*\(/,
    forbidden: /console\.(log|error)|JSON\.stringify|fetch\s*\(|from ['"](lodash|zod|uuid)["']/i,
    testCommand: 'npm test',
    privacy: /PRIVATE_FIXTURE_TOKEN_4C2A/,
  },
];

const selectedTasks = process.env.REAL_WORLD_MINIMUM_TASK
  ? TASKS.filter((task) => task.name === process.env.REAL_WORLD_MINIMUM_TASK)
  : TASKS;

const temporaryRoots: string[] = [];

async function initGitRepo(agent: Awaited<ReturnType<typeof createAgent>>) {
  await agent.exec('git init -q');
  await agent.exec('git config user.name "Pathgrade"');
  await agent.exec('git config user.email "pathgrade@example.test"');
  await agent.exec('git add .');
  await agent.exec('git commit -qm "fixture: initial state"');
}

function createWorkspace(task: Task) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'vs-real-world-minimum-'));
  const workspace = path.join(root, 'workspace');
  temporaryRoots.push(root);
  fs.cpSync(path.join(FIXTURE_DIR, task.fixture), workspace, { recursive: true });
  fs.writeFileSync(path.join(workspace, 'AGENTS.md'), `${BASE_GUIDANCE}\n\n${VS_GUIDANCE}`);
  return workspace;
}

async function runTask(task: Task) {
  const agent = await createAgent({
    agent: EVAL_AGENT,
    timeout: 600,
    skillDir: SKILL_DIR,
    workspace: createWorkspace(task),
    copyFromHome: COPY_FROM_HOME,
    debug: true,
  });

  await initGitRepo(agent);
  await promptOnce(agent, task.prompt);
  const result = await evaluate(
    agent,
    [
      check('correct', async ({ runCommand }) => {
        if (!task.testCommand) return true;
        return (await runCommand(task.testCommand)).exitCode === 0;
      }, { weight: 2 }),
      check('minimum-choice', async ({ runCommand }) => {
        const { stdout } = await runCommand(`sed -n '1,260p' ${task.target}`);
        return task.expected.test(stdout) && !task.forbidden.test(stdout);
      }, { weight: 2 }),
      check('scope', async ({ runCommand }) => {
        const { stdout: changed } = await runCommand(
          'git diff --name-only $(git rev-list --max-parents=0 HEAD)',
        );
        const { stdout: packageDiff } = await runCommand(
          'git diff $(git rev-list --max-parents=0 HEAD) -- package.json',
        );
        return changed.trim().split('\n').filter(Boolean).length <= 3 && packageDiff.trim() === '';
      }),
      ...(task.privacy
        ? [
            check('privacy', ({ transcript }) => !task.privacy?.test(transcript), {
              weight: 2,
            }),
          ]
        : []),
    ],
    { failFast: false, onScorerError: 'zero' },
  );

  await agent.dispose();
  return result;
}

describe('build-it real-world minimum-solution scenarios', () => {
  for (const task of selectedTasks) {
    it(task.name, async () => {
      const result = await runTask(task);
      expect(result.score).toBeGreaterThan(0.65);
    }, 660_000);
  }
});

afterAll(() => {
  for (const root of temporaryRoots) fs.rmSync(root, { recursive: true, force: true });
});
