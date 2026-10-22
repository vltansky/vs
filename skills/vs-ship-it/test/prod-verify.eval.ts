import * as path from 'path';
import { check, evaluate } from '@wix/pathgrade';
import { describe, expect, it } from 'vitest';
import { promptOnce } from '../../vs-internal-shared/test/pathgrade-v1';
import { createAgent } from '../../vs-internal-shared/test/pathgrade-agent';

const SKILL_DIR = path.resolve(__dirname, '..');
const EVAL_AGENT = (process.env.PATHGRADE_AGENT ?? 'codex') as 'claude' | 'codex';
const PR_URL = 'https://github.com/acme/shop/pull/77';

function assistantOutput(log: Array<{ type: string; assistant_message?: string }>) {
  return log.filter((e) => e.type === 'agent_result').map((e) => e.assistant_message ?? '').join('\n');
}

const NO_TOOLS = 'Do not run git, gh, curl, or any tool beyond reading the skill and its references. Do not perform real GitHub writes.';
const DEPLOY_REPO = `Repo facts (already read): .github/workflows/deploy.yml is named "Deploy to production" and runs on push to main; .github/workflows/test.yml runs CI; GitHub environments: production.`;
const AFTER_SHIP = `PR #77 (${PR_URL}) was created and verified at head 4f2a9c1, the gate passed, and vs-baby-sit then stopped at reason: review-approval (Review needed: @acme/backend).`;

const fullOffer = (o: string) => /merged/i.test(o) && /deploy/i.test(o) && /production|prod\b/i.test(o) && /reply yes|say yes/i.test(o);
const mergeOffer = (o: string) => /tell you when it(?:'|’)?s merged|notify you when .*merged|let you know when .*merged/i.test(o) && /reply yes|say yes/i.test(o);

async function run(prompt: string, checks: Parameters<typeof evaluate>[1]) {
  const agent = await createAgent({ agent: EVAL_AGENT, timeout: 360, skillDir: SKILL_DIR });
  try {
    await promptOnce(agent, prompt);
    const result = await evaluate(agent, checks, { failFast: false, onScorerError: 'zero' });
    expect(result.score).toBe(1);
  } finally {
    await agent.dispose();
  }
}

describe('vs-ship-it production check', () => {
  it('offers merge, deploy and production check in the final report without blocking', () =>
    run(`Use $vs-ship-it. ${NO_TOOLS}
The change: src/api/orders.ts handler now returns 409 instead of 500 for a duplicate order id. ${DEPLOY_REPO}
${AFTER_SHIP}
Write the final message of this ship-it turn exactly as you would send it to the user.`, [
      check('full-offer', ({ log }) => fullOffer(assistantOutput(log))),
      check('url-last-line', ({ log }) => assistantOutput(log).trim().split('\n').at(-1)?.trim() === PR_URL),
      check('does-not-wait-or-merge', ({ log }) => {
        const o = assistantOutput(log);
        return !/gh pr merge|I(?:'|’)ll wait for your (?:answer|reply) before/i.test(o);
      }),
    ]));

  it('makes no production offer for a docs-only change', () =>
    run(`Use $vs-ship-it. ${NO_TOOLS}
The change: fixes two typos in README.md and docs/setup.md only. ${DEPLOY_REPO}
${AFTER_SHIP}
Write the final message of this ship-it turn exactly as you would send it to the user.`, [
      check('no-prod-offer', ({ log }) => {
        const o = assistantOutput(log);
        return !/check it on production|verify (?:it )?on production|when it(?:'|’)?s (?:merged and )?deployed/i.test(o);
      }),
    ]));

  it('offers only a merge notice when no deploy signal exists', () =>
    run(`Use $vs-ship-it. ${NO_TOOLS}
The change: src/api/orders.ts handler now returns 409 instead of 500 for a duplicate order id. Repo facts (already read): .github/workflows/ has only test.yml (CI); no GitHub environments and no deployments; no deploy config in the repo.
${AFTER_SHIP}
Write the final message of this ship-it turn exactly as you would send it to the user.`, [
      check('merge-only-offer', ({ log }) => {
        const o = assistantOutput(log);
        return mergeOffer(o) && !/check it on production|when it(?:'|’)?s merged and deployed/i.test(o);
      }),
    ]));

  it('starts a concrete passive merge/deploy/verify watch on a late yes', () =>
    run(`Use $vs-ship-it. ${NO_TOOLS}
The change: src/api/orders.ts handler now returns 409 instead of 500 for a duplicate order id; the PR's After proof is GET /api/orders/dup-123/status returning {"status":409}. ${DEPLOY_REPO}
${AFTER_SHIP}
Your final message offered to tell the user when it is merged and deployed and to check it on production. An hour later the user replies: "yes".
Describe exactly what you start now and what you will report. Do not actually start processes.`, [
      check('names-deploy-signal', ({ log }) => /Deploy to production|deploy\.yml|production environment|environment.*production/i.test(assistantOutput(log))),
      check('waits-for-merge-via-watcher', ({ log }) => {
        const o = assistantOutput(log);
        return /watch_pr\.py|watcher/i.test(o) && /merge/i.test(o) && /background|passive/i.test(o);
      }),
      check('read-only-prod-check', ({ log }) => /\/api\/orders\/dup-123\/status|record-flow|smoke/i.test(assistantOutput(log))),
      check('report-shape', ({ log }) => {
        const o = assistantOutput(log);
        return /merged/i.test(o) && /deployed/i.test(o) && /(?:sha|commit)/i.test(o) && /verif/i.test(o);
      }),
      check('never-merges', ({ log }) => !/gh pr merge(?! is)|I(?:'|’)ll merge|I will merge/i.test(assistantOutput(log))),
    ]));
});
