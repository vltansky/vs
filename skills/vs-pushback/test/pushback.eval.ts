import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { check, evaluate } from '@wix/pathgrade';
import { afterAll, describe, expect, it } from 'vitest';

import { createAgent } from '../../vs-internal-shared/test/pathgrade-agent';
import {
  CONVERSE_ASK_USER_DEFAULTS,
  promptOnce,
  withAskUserSupport,
} from '../../vs-internal-shared/test/pathgrade-v1';

const SKILL_DIR = path.resolve(__dirname, '..');
const API_FIXTURE = path.join(__dirname, 'fixtures', 'api-migration');
const AUDIENCE_FIXTURE = path.join(__dirname, 'fixtures', 'layered-review');
const EVAL_AGENT = (process.env.PATHGRADE_AGENT ?? 'codex') as
  | 'claude'
  | 'codex';
const STAGED_WORKSPACES: string[] = [];

function stageWorkspaceWithSiblingSkills(fixture: string) {
  const workspace = fs.mkdtempSync(
    path.join(os.tmpdir(), 'vs-pushback-eval-'),
  );
  fs.cpSync(fixture, workspace, { recursive: true });

  for (const convention of ['.agents', '.claude']) {
    const skillsDir = path.join(workspace, convention, 'skills');
    fs.mkdirSync(skillsDir, { recursive: true });

    const ponytailSource = path.resolve(__dirname, '..', '..', 'vs-ponytail');
    const ponytailTarget = path.join(skillsDir, 'vs-ponytail');
    fs.mkdirSync(ponytailTarget, { recursive: true });
    fs.copyFileSync(
      path.join(ponytailSource, 'SKILL.md'),
      path.join(ponytailTarget, 'SKILL.md'),
    );
    fs.cpSync(
      path.join(ponytailSource, 'references'),
      path.join(ponytailTarget, 'references'),
      { recursive: true },
    );

    const sharedSource = path.resolve(
      __dirname,
      '..',
      '..',
      'vs-internal-shared',
      'references',
      'output-style.md',
    );
    const sharedTarget = path.join(
      skillsDir,
      'vs-internal-shared',
      'references',
    );
    fs.mkdirSync(sharedTarget, { recursive: true });
    fs.copyFileSync(sharedSource, path.join(sharedTarget, 'output-style.md'));
  }

  STAGED_WORKSPACES.push(workspace);
  return workspace;
}

afterAll(() => {
  for (const workspace of STAGED_WORKSPACES) {
    fs.rmSync(workspace, { recursive: true, force: true });
  }
});

type ToolEvent = {
  action: string;
  arguments?: Record<string, unknown>;
};

function hasWorkspaceMutation(toolEvents: ToolEvent[]) {
  return toolEvents.some((event) => {
    if (event.action === 'write_file' || event.action === 'edit_file') {
      return String(event.arguments?.file_path ?? '').includes('/workspace/');
    }
    if (event.action === 'run_shell') {
      return /git\s+(?:add|commit|checkout|switch|merge|rebase)\b/i.test(
        String(event.arguments?.command ?? ''),
      );
    }
    return false;
  });
}

function askedQuestions(toolEvents: ToolEvent[]) {
  return toolEvents
    .filter((event) => event.action === 'ask_user')
    .flatMap((event) => {
      const questions = event.arguments?.questions;
      return Array.isArray(questions)
        ? (questions as Array<{
            question?: string;
            options?: Array<{ label?: string; description?: string }>;
            answer?: { values?: string[] };
          }>)
        : [];
    });
}

describe('pushback', () => {
  it('composed review returns concise Ponytail alternative without ceremony', async () => {
    const agent = await createAgent({
      agent: EVAL_AGENT,
      timeout: 420,
      skillDir: SKILL_DIR,
      workspace: stageWorkspaceWithSiblingSkills(API_FIXTURE),
      copyFromHome:
        EVAL_AGENT === 'codex' ? ['.codex/auth.json'] : undefined,
      debug: true,
    });

    await promptOnce(
      agent,
      'Use vs-pushback from .agents/skills/vs-pushback/SKILL.md in composed mode to review docs/migration-plan.md. ' +
        'Return the compact contract. Do not ask questions, implement, or create artifacts.',
    );

    const result = await evaluate(
      agent,
      [
        check(
          'compact-contract',
          ({ transcript }) =>
            /verdict:/i.test(transcript) &&
            /what holds up:/i.test(transcript) &&
            /top pushback:/i.test(transcript) &&
            /smaller complete alternative:/i.test(transcript),
          { weight: 3 },
        ),
        check(
          'retains-safety-and-proof',
          ({ transcript }) =>
            /auth|rate limit/i.test(transcript) &&
            /test|verif|rollback/i.test(transcript),
          { weight: 2 },
        ),
        check(
          'no-ponytail-ceremony',
          ({ transcript }) => !/Ponytail decision:|Chosen rung:/i.test(transcript),
        ),
        check(
          'read-only',
          ({ toolEvents }) => !hasWorkspaceMutation(toolEvents),
          { weight: 2 },
        ),
      ],
      { failFast: false, onScorerError: 'zero' },
    );

    expect(result.score).toBe(1);
    await agent.dispose();
  }, 480_000);

  it('asks audience and edge-case questions that can shrink the proposal', async () => {
    const agent = await createAgent({
      agent: EVAL_AGENT,
      timeout: 420,
      skillDir: SKILL_DIR,
      workspace: stageWorkspaceWithSiblingSkills(AUDIENCE_FIXTURE),
      copyFromHome:
        EVAL_AGENT === 'codex' ? ['.codex/auth.json'] : undefined,
      debug: true,
    });

    const conversation = await agent.runConversation({
      firstMessage:
        'Use vs-pushback from .agents/skills/vs-pushback/SKILL.md to review docs/audience-plan.md. Investigate first, then ask only user decisions that could materially improve the feedback. Do not implement or write a report.',
      maxTurns: 4,
      reactions: withAskUserSupport([
        {
          when: /audience|enterprise|every customer|who.*first release|first release serve/i,
          reply: 'The first release is only for enterprise account admins.',
          once: true,
        },
        {
          when: /edge case|offline|mobile|cross.device|scope.*first release|beyond the observed desktop CSV|advanced capabilities|release.one requirements/i,
          reply: 'Those edge cases are not relevant to the first release.',
          once: true,
        },
        {
          when: /\?|confirm|decision/i,
          reply: 'Use your recommendation and finish the review.',
        },
      ]),
      ...CONVERSE_ASK_USER_DEFAULTS,
      until: async ({ lastMessage }) =>
        /verdict:/i.test(lastMessage) &&
        /smaller complete alternative:/i.test(lastMessage),
    });

    expect(conversation.turns).toBeGreaterThanOrEqual(1);

    const result = await evaluate(
      agent,
      [
        check(
          'asks-decision-signal',
          ({ transcript }) =>
            /intended audience|enterprise.*admin/i.test(transcript) &&
            /edge case|offline|mobile|cross.device/i.test(transcript),
          { weight: 3 },
        ),
        check(
          'frames-question-impact',
          ({ toolEvents }) => {
            const questions = askedQuestions(toolEvents);
            return (
              questions.length > 0 &&
              questions.length <= 3 &&
              questions.every((question) => {
                const framing = [
                  question.question,
                  ...(question.options ?? []).flatMap((option) => [
                    option.label,
                    option.description,
                  ]),
                ].join(' ');

                return (
                  /recommended/i.test(question.options?.[0]?.label ?? '') &&
                  Boolean(question.options?.[0]?.description) &&
                  /audience|customer|enterprise|scope|edge case|offline|mobile|cross.device/i.test(
                    framing,
                  ) &&
                  /align|constrain|defer|evidence|complex|cost|risk|release|delivery/i.test(
                    framing,
                  )
                );
              })
            );
          },
          { weight: 2 },
        ),
        check(
          'uses-real-user-answers',
          ({ toolEvents }) => {
            const answers = askedQuestions(toolEvents).flatMap(
              (question) => question.answer?.values ?? [],
            );
            return (
              answers.some((answer) => /enterprise.*admin/i.test(answer)) &&
              answers.some((answer) => /not relevant|out of scope/i.test(answer))
            );
          },
          { weight: 2 },
        ),
        check(
          'uses-answers-to-shrink',
          ({ transcript }) =>
            /enterprise.*admin/i.test(transcript) &&
            /defer|remove|out of scope|first release/i.test(transcript) &&
            /smaller complete alternative:/i.test(transcript),
          { weight: 3 },
        ),
        check(
          'does-not-ask-repository-facts',
          ({ transcript }) =>
            !/which file|where is the code|how many endpoints|what does the code do/i.test(
              transcript,
            ),
        ),
        check('read-only', ({ toolEvents }) => !hasWorkspaceMutation(toolEvents)),
      ],
      { failFast: false, onScorerError: 'zero' },
    );

    expect(result.score).toBe(1);
    await agent.dispose();
  }, 480_000);
});
