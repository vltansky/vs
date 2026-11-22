import * as path from 'path';
import { check, evaluate } from '@wix/pathgrade';
import { describe, expect, it } from 'vitest';
import { promptOnce } from '../../vs-internal-shared/test/pathgrade-v1';

import { createAgent } from '../../vs-internal-shared/test/pathgrade-agent';

const SKILL_DIR = path.resolve(__dirname, '..');
const EVAL_AGENT = (process.env.PATHGRADE_AGENT ?? 'codex') as 'claude' | 'codex';
const COPY_FROM_HOME =
  EVAL_AGENT === 'codex' ? ['.codex/auth.json'] : undefined;

const DEPLOY_CONFIG_FIXTURE = path.join(__dirname, 'fixtures', 'deploy-config');

async function verify(prompt: string, workspace?: string) {
  const agent = await createAgent({
    agent: EVAL_AGENT,
    timeout: 300,
    skillDir: SKILL_DIR,
    copyFromHome: COPY_FROM_HOME,
    ...(workspace ? { workspace } : {}),
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

  it.concurrent('keeps later delivery gates unproven after merge', async () => {
    const { agent, response } = await verify(
      'The PR merged and CI passed. Deployment has not run, live behavior was not checked, and monitoring has no new data. Verify the overall delivery outcome.',
    );
    try {
      const result = await evaluate(agent, [
        check('warn-status', () => /Status:\s*WARN/i.test(response)),
        check('merge-is-proven', () => /merge[^\n]*(proven|passed|complete)/i.test(response)),
        check('later-gates-are-open', () =>
          /deploy[^\n]*(pending|unproven|not run|not proven)/i.test(response) &&
          /live[^\n]*(pending|unproven|not checked|not proven)/i.test(response),
        ),
      ]);

      expect(result.score).toBe(1);
    } finally {
      await agent.dispose();
    }
  });

  // mt-reports failure class: the post-deploy smoke passed while production was
  // missing a secret the new code reads. A 200 is not proof the config exists.
  it.concurrent('keeps a green smoke at WARN when deployed config presence is unproven', async () => {
    const { agent, response } = await verify(
      'I deployed the invoice reminders release to production; deploy-log.txt has the deploy output and the post-deploy smoke result. Verify whether the deploy is done. Production consoles and CLIs are not available from here.',
      DEPLOY_CONFIG_FIXTURE,
    );
    try {
      const result = await evaluate(agent, [
        check('not-pass', () => /Status:\s*(WARN|FAIL|BLOCKED)/i.test(response) && !/Status:\s*PASS/i.test(response)),
        check('names-the-unproven-config', () =>
          /INVOICE_MAIL_API_KEY/.test(response) && /INVOICE_FROM_ADDRESS/.test(response),
        ),
        check('asks-for-a-config-presence-check', () =>
          /(?:list|describe|secrets?:get|versions? (?:list|access)|present|presence|exists?)[^\n]*(?:secret|env|config)|(?:secret|env|config)[^\n]*(?:list|describe|present|presence|exists?)/i.test(response),
        ),
      ], { failFast: false, onScorerError: 'zero' });

      expect(result.score, response).toBe(1);
    } finally {
      await agent.dispose();
    }
  });

  it.concurrent('fails a green smoke when the deployed config is shown missing', async () => {
    const { agent, response } = await verify(
      'After deploying the `sendInvoiceReminders` Cloud Function to production, `curl -fsS https://api.example.test/healthz` returned HTTP 200 and the served revision matches the built commit. The change reads `INVOICE_MAIL_API_KEY` and `INVOICE_FROM_ADDRESS` at request time. `gcloud run services describe sendinvoicereminders --format=yaml(spec.template.spec.containers[0].env)` on the live revision lists `INVOICE_FROM_ADDRESS` but no `INVOICE_MAIL_API_KEY` entry. Verify the deploy.',
    );
    try {
      const result = await evaluate(agent, [
        check('fail-status', () => /Status:\s*FAIL/i.test(response)),
        check('names-the-missing-secret', () =>
          /(?:missing|absent|not (?:set|present|listed|found|configured)|\bno)\s+`?INVOICE_MAIL_API_KEY|INVOICE_MAIL_API_KEY`?[^\n]*(?:missing|absent|not (?:set|present|listed|found|configured))/i.test(response),
        ),
      ], { failFast: false, onScorerError: 'zero' });

      expect(result.score, response).toBe(1);
    } finally {
      await agent.dispose();
    }
  });
});
