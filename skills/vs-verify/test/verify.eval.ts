import * as path from 'path';
import { check, evaluate } from '@wix/pathgrade';
import { describe, expect, it } from 'vitest';
import { promptOnce } from '../../vs-internal-shared/test/pathgrade-v1';

import { createAgent } from '../../vs-internal-shared/test/pathgrade-agent';

const SKILL_DIR = path.resolve(__dirname, '..');
const EVAL_AGENT = (process.env.PATHGRADE_AGENT ?? 'codex') as 'claude' | 'codex';
const COPY_FROM_HOME = EVAL_AGENT === 'codex' ? ['.codex'] : undefined;

async function verify(prompt: string) {
  const agent = await createAgent({
    agent: EVAL_AGENT,
    timeout: 300,
    skillDir: SKILL_DIR,
    copyFromHome: COPY_FROM_HOME,
  });

  await promptOnce(
    agent,
    `${prompt}\n\nFollow the verify skill. Return the Verification Result only.`,
  );
  const response = [...agent.messages]
    .reverse()
    .find((message) => message.role === 'agent')?.content ?? '';
  return { agent, response };
}

describe('verify behavior', () => {
  it.concurrent('keeps unexercised user-visible behavior at WARN', async () => {
    const { agent, response } = await verify(
      'The checkout UI changed. Unit tests pass, but no browser or preview is available, so the changed UI behavior was not exercised. Verify whether it is done.',
    );
    try {
      const result = await evaluate(agent, [
        check('warn-status', () => /Status:\s*WARN/i.test(response)),
        check('names-ui-gap', () =>
          /browser|preview|user-visible|not exercised/i.test(response),
        ),
      ]);

      expect(result.score).toBe(1);
    } finally {
      await agent.dispose();
    }
  });

  it.concurrent('does not treat deployment reachability as artifact proof', async () => {
    const { agent, response } = await verify(
      'A production URL returns HTTP 200, but there is no bundle hash, version, etag, or other evidence connecting it to the new build. Verify the deployment.',
    );
    try {
      const result = await evaluate(agent, [
        check('warn-status', () => /Status:\s*WARN/i.test(response)),
        check('requests-artifact-identity', () =>
          /artifact|hash|version|etag|identity/i.test(response),
        ),
      ]);

      expect(result.score).toBe(1);
    } finally {
      await agent.dispose();
    }
  });

  it.concurrent('reports a failed verification command as FAIL', async () => {
    const { agent, response } = await verify(
      'The targeted command `npm test -- checkout` ran and exited 1 with `expected total 42, received 41`. Classify the verification result.',
    );
    try {
      const result = await evaluate(agent, [
        check('fail-status', () => /Status:\s*FAIL/i.test(response)),
        check('preserves-failure', () =>
          /exited 1|expected total 42|received 41/i.test(response),
        ),
      ]);

      expect(result.score).toBe(1);
    } finally {
      await agent.dispose();
    }
  });
});
