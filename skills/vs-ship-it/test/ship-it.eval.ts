import * as fs from 'fs';
import * as path from 'path';
import { check, evaluate } from '@wix/pathgrade';
import { describe, expect, it } from 'vitest';
import { promptOnce } from '../../vs-internal-shared/test/pathgrade-v1';

import { createAgent } from '../../vs-internal-shared/test/pathgrade-agent';

const SKILL_DIR = path.resolve(__dirname, '..');
const EVAL_AGENT = (process.env.PATHGRADE_AGENT ?? 'codex') as 'claude' | 'codex';
const INCIDENT_FIXTURE = path.join(__dirname, 'fixtures', 'incident-hotfix');
const INCIDENT_TEMPLATE = fs.readFileSync(
  path.join(INCIDENT_FIXTURE, '.github', 'pull_request_template.md'),
  'utf8',
);
const TEMPLATE_SECTIONS = [...INCIDENT_TEMPLATE.matchAll(/^#{1,6}\s+(.+?)\s*$/gm)].map((m) => m[1]);
const TEMPLATE_CHECKS = [...INCIDENT_TEMPLATE.matchAll(/^- \[ \] ([^:<\n]+)/gm)].map((m) => m[1].trim());

function fencedBody(output: string) {
  return (output.match(/^(\x60{3,})(?:markdown|md)?[ \t]*\n([\s\S]*?)^\1[ \t]*$/im)?.[2] ?? output).trim();
}

// Each template heading as found in the body, in body order; -1 when missing.
function sectionStarts(body: string) {
  return TEMPLATE_SECTIONS.map((name) => {
    const escaped = name.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&');
    return body.search(new RegExp(`^#{1,6}\\s+${escaped}\\s*$`, 'm'));
  });
}

function assistantOutput(log: Array<{ type: string; assistant_message?: string }>) {
  return log
    .filter((entry) => entry.type === 'agent_result')
    .map((entry) => entry.assistant_message ?? '')
    .join('\n');
}

describe('vs-ship-it behavior', () => {
  it('explains before and after and obtains frontend proof', async () => {
    const agent = await createAgent({ agent: EVAL_AGENT, timeout: 360, skillDir: SKILL_DIR });
    try {
      await promptOnce(agent, `Use $vs-ship-it. Prepare the description and evidence plan only; do not publish or invoke tools beyond reading the skill and its required PR-body reference.
The PR fixes checkout: with an expired coupon, clicking Pay previously spun forever; now an inline error lets the customer remove the coupon and retry. This is source-derived; tests and media have not been supplied. Base and head previews and browser recording tools are available. No screenshots or videos exist. The user said create pr and do not watch.
Then give the Before/After copy for a separate internal refactor that preserves the API response while consolidating duplicate parsing, and a new CSV export feature where export was previously unavailable.`);
      const result = await evaluate(agent, [
        check('paired-concrete-behavior', ({ log }) => {
          const output = assistantOutput(log);
          return /before/i.test(output) && /after/i.test(output) && /spinn|spinner/i.test(output) && /inline error/i.test(output);
        }),
        check('capture-missing-frontend-proof', ({ log }) => {
          const output = assistantOutput(log);
          return /captur|record/i.test(output) && /video|recording/i.test(output) && /screenshot|still/i.test(output)
            && !/would you like|shall I|ask.*(?:permission|approval)|approve.*record/i.test(output);
        }),
        check('honest-new-and-internal-comparisons', ({ log }) => {
          const output = assistantOutput(log);
          return /source-derived/i.test(output) && /unchanged|same.*response|response.*same|preserv[\s\S]{0,80}response/i.test(output)
            && /(?:no|unavailable|could not|cannot).*export|export.*(?:unavailable|not available)/i.test(output);
        }),
      ], { failFast: false, onScorerError: 'zero' });
      expect(result.score).toBe(1);
    } finally {
      await agent.dispose();
    }
  });

  it('moves a known merge blocker ahead of the proof', async () => {
    const agent = await createAgent({ agent: EVAL_AGENT, timeout: 360, skillDir: SKILL_DIR });
    try {
      await promptOnce(agent, `Use $vs-ship-it. Read the skill and its required PR-body reference, then return just the PR body in one fenced Markdown block. Do not run checks, capture evidence, or publish.
The team membership page used to let an admin remove the last owner. Now it rejects the same action. The authorization owner requires manual staging verification before merge. Matched screenshots are hosted at https://github.com/user-attachments/assets/owner-before and https://github.com/user-attachments/assets/owner-after. Matched recordings are hosted at https://github.com/user-attachments/assets/clip-before and https://github.com/user-attachments/assets/clip-after. There is no repository PR template.`);
      let draft = '';
      const result = await evaluate(agent, [
        check('puts-blocker-above-visible-proof', ({ log }) => {
          const output = assistantOutput(log);
          draft = (output.match(/^\x60{3,}(?:markdown|md)?[ \t]*\n([\s\S]*?)^\x60{3,}[ \t]*$/im)?.[1] ?? output).trim();
          const expander = draft.indexOf('<details>');
          return /^\*\*Risk:\*\* Block merge until[^\n]*stag/i.test(draft) &&
            ['owner-before', 'owner-after'].every((asset) => {
              const at = draft.indexOf(`assets/${asset}`);
              return at > 0 && at < expander;
            });
        }),
        check('uses-one-expander-for-supporting-evidence', ({ log }) => {
          const body = assistantOutput(log);
          const open = body.indexOf('<details>');
          return body.match(/<details\b/g)?.length === 1 && body.indexOf('assets/clip-before') > open &&
            body.indexOf('assets/clip-after') > open && body.indexOf('</details>') > body.indexOf('assets/clip-after');
        }),
        check('puts-the-badge-row-and-explanation-below-the-blocker', () => {
          const risk = draft.split(/\r?\n\s*\r?\n/, 1)[0];
          const [action, badges, explanation] = risk.split(/<br[ \t]*\/?>|(?:\\| {2,})\r?\n/i);
          return !/badge-/.test(action) && /badge-(?:one|two)-way-door\.svg/.test(badges ?? '') &&
            /badge-(?:wide|narrow)-blast\.svg/.test(badges ?? '') && Boolean(explanation?.trim());
        }),
      ], { failFast: false, onScorerError: 'zero' });
      expect(result.score, draft).toBe(1);
    } finally {
      await agent.dispose();
    }
  });

  // mt-reports failure class: a hurried incident hotfix PR shipped without required
  // template sections. Urgency must not shrink the repo's PR template.
  it('keeps every repo template section in a hurried incident hotfix', async () => {
    const agent = await createAgent({ agent: EVAL_AGENT, timeout: 360, skillDir: SKILL_DIR, workspace: INCIDENT_FIXTURE });
    try {
      await promptOnce(agent, `Use $vs-ship-it. Production incident, payments are failing right now. Since the last deploy the payment provider sends \`payment.pending\` events without \`data\`, and the webhook threw a 500 on every one, so the provider is retrying and queuing payments. The hotfix is already committed on branch \`hotfix/webhook-missing-data\`: src/payments-webhook.ts now answers 400 for an event without \`data.paymentId\` instead of throwing. No tests were added yet; the on-call engineer replayed one captured event locally and got 400 instead of 500.
We're mid-incident, so keep it short and get it up fast. Return just the PR body in one fenced Markdown block; do not run tests, capture evidence, push, or publish.`);
      let body = '';
      const result = await evaluate(agent, [
        check('keeps-every-template-section-in-order', ({ log }) => {
          body = fencedBody(assistantOutput(log));
          const at = sectionStarts(body);
          return at.every((i) => i >= 0) && at.every((i, k) => k === 0 || i > at[k - 1]);
        }),
        check('keeps-template-checklist-items', () =>
          TEMPLATE_CHECKS.every((item) => new RegExp(`^\\s*- \\[[ xX]\\] ${item.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&')}`, 'm').test(body)),
        ),
        check('fills-or-marks-every-section', () => {
          const at = sectionStarts(body);
          if (at.some((i) => i < 0)) return false;
          return at.every((start, k) => {
            const end = k + 1 < at.length ? at[k + 1] : body.length;
            const text = body.slice(start, end).split('\n').slice(1).join('\n').replace(/<!--[\s\S]*?-->/g, '').trim();
            return text.length > 0;
          });
        }),
      ], { failFast: false, onScorerError: 'zero' });
      expect(result.score, body).toBe(1);
    } finally {
      await agent.dispose();
    }
  });

  it('hands a newly created PR to babysitting by default', async () => {
    const agent = await createAgent({
      agent: EVAL_AGENT,
      timeout: 360,
      skillDir: SKILL_DIR,
    });

    try {
      await promptOnce(
        agent,
        `Use $vs-ship-it. The user said only "create pr" and did not ask to skip watching.

Assume the scoped changes are already validated and committed, PR #542 was just created as a regular non-draft PR, and the PR verification resolved its URL, branch, open state, exact head SHA, and 12 changed files. CI and automated review are pending.

Describe what you do next. Do not perform real GitHub writes or start a real watcher.`,
      );

      const result = await evaluate(
        agent,
        [
          check('starts-babysitting-by-default', ({ log }) => {
            const output = assistantOutput(log);
            return /(?:start|begin).*?(?:baby-?sit|babysitting)|transition.*babysit|hand off.*vs-baby-sit/is.test(
              output,
            );
          }),
          check('does-not-end-at-pr-link', ({ log }) => {
            const output = assistantOutput(log);
            const verifiedPr = output.search(
              /verified (?:draft )?PR|PR.*(?:created|verified)|verified creation handoff|creation handoff|Step 5b/i,
            );
            const babysit = output.slice(Math.max(0, verifiedPr)).search(
              /(?:start|begin)[\s\S]{0,100}(?:baby-?sit|babysitting)|transition.*babysit|hand (?:off )?.*to .*vs-baby-sit/i,
            );
            return verifiedPr >= 0 && babysit > 0;
          }),
          check('keeps-the-pr-regular-until-a-repair', ({ log }) => {
            const output = assistantOutput(log);
            return (
              !/keeps? (?:it|the PR) (?:as a |in )?draft|draft until|gh pr ready(?! --undo)/i.test(output) &&
              !/auto-?merge/i.test(output)
            );
          }),
          check('uses-the-babysit-contract', ({ log }) => {
            const output = assistantOutput(log);
            return (
              /vs-baby-sit|babysitting phase/i.test(output) &&
              /(?:monitor|watch|wait).*CI/is.test(output) &&
              /automated review|reviewer-bot findings/i.test(output) &&
              /separate.*(?:vs-baby-sit|babysitting)|hand.*to.*vs-baby-sit/is.test(output)
            );
          }),
        ],
        { failFast: false, onScorerError: 'zero' },
      );

      expect(result.score).toBe(1);
    } finally {
      await agent.dispose();
    }
  });
});
