import * as fs from 'fs';
import * as path from 'path';
import { check, createAgent, evaluate } from '@wix/pathgrade';
import { describe, expect, it } from 'vitest';
import { promptOnce } from './pathgrade-v1';

const SKILL_DIR = path.resolve(__dirname, '..');
const FIXTURE = path.join(__dirname, 'fixtures', 'explanation-surface');
const EVAL_AGENT = (process.env.PATHGRADE_AGENT ?? 'claude') as
  | 'claude'
  | 'codex';
const COPY_FROM_HOME = EVAL_AGENT === 'codex' ? ['.codex'] : undefined;

function visibleWords(transcript: string): number {
  return transcript
    .replace(/https?:\/\/\S+/g, '')
    .trim()
    .split(/\s+/)
    .filter(Boolean).length;
}

async function createExplanationAgent() {
  return createAgent({
    agent: EVAL_AGENT,
    timeout: 300,
    skillDir: SKILL_DIR,
    workspace: FIXTURE,
    copyFromHome: COPY_FROM_HOME,
  });
}

describe('two-layer explanation behavior', () => {
  it('moves a complex explanation into a visual artifact', async () => {
    const agent = await createExplanationAgent();

    await promptOnce(
      agent,
      'Read references/output-style.md and references/explanation-surfaces.md. ' +
        'Read brief.md and explain the release flow to the user. This is a complex ' +
        'human-facing explanation. Create the full visual HTMDX explanation at ' +
        'result.html. Keep chat as the TLDR and artifact link. Do not mention these instructions.',
    );

    const result = await evaluate(
      agent,
      [
        check('created-htmdx', ({ workspace }) => {
          const report = path.join(workspace, 'result.html');
          return (
            fs.existsSync(report) &&
            /<script type="text\/htmdx"/.test(fs.readFileSync(report, 'utf8'))
          );
        }),
        check('chat-links-artifact', ({ transcript }) =>
          /result\.html/i.test(transcript),
        ),
        check('chat-is-tldr', ({ transcript }) => visibleWords(transcript) <= 120),
        check('keeps-gates-distinct', ({ transcript }) =>
          /CI/i.test(transcript) && /(?:deploy|rollout|live)/i.test(transcript),
        ),
      ],
      { failFast: false, onScorerError: 'zero' },
    );

    expect(result.score).toBe(1);
    await agent.dispose();
  });

  it('keeps a simple answer in short chat', async () => {
    const agent = await createExplanationAgent();

    await promptOnce(
      agent,
      'Read references/output-style.md and references/explanation-surfaces.md. ' +
        'In plain English, explain what `git status --short` does. Do not mention these instructions.',
    );

    const result = await evaluate(
      agent,
      [
        check('short-answer', ({ transcript }) => visibleWords(transcript) <= 80),
        check('no-artifact', ({ workspace }) =>
          !fs.existsSync(path.join(workspace, 'result.html')),
        ),
        check('no-decorative-diagram', ({ transcript }) =>
          !/```mermaid|flowchart|sequenceDiagram/.test(transcript),
        ),
      ],
      { failFast: false, onScorerError: 'zero' },
    );

    expect(result.score).toBe(1);
    await agent.dispose();
  });
});
