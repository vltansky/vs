import * as path from 'path';
import { check, evaluate } from '@wix/pathgrade';
import { describe, expect, it } from 'vitest';
import {
  hasAskUserEvent,
  promptAllowingAskUserInterrupt,
  promptOnce,
} from '../../vs-internal-shared/test/pathgrade-v1';

import { createAgent } from '../../vs-internal-shared/test/pathgrade-agent';

const SKILL_DIR = path.resolve(__dirname, '..');
const EVAL_AGENT = (process.env.PATHGRADE_AGENT ?? 'codex') as 'claude' | 'codex';

function assistantOutput(log: Array<{ type: string; assistant_message?: string }>) {
  return log
    .filter((entry) => entry.type === 'agent_result')
    .map((entry) => entry.assistant_message ?? '')
    .join('\n');
}

describe('vs-baby-sit behavior', () => {
  it('uses an interactive thread-write gate and keeps ownership of the run', async () => {
    const agent = await createAgent({
      agent: EVAL_AGENT,
      timeout: 360,
      skillDir: SKILL_DIR,
      copyFromHome:
        EVAL_AGENT === 'codex' ? ['.codex/auth.json'] : undefined,
    });

    try {
      await promptAllowingAskUserInterrupt(
        agent,
        `Use $vs-baby-sit on PR #542 in batch-ask mode. A verified repair was pushed at exact head def456. Two fixed inline threads now have unique evidence-linked draft replies ready. CI is pending. The host exposes AskUserQuestion.

Perform the normal next action. This is approval for GitHub thread writes, not the external human-review gate. Do not post or resolve before approval, do not end the babysitting run merely because this approval is pending, and do not ask me to invoke a skill again.`,
      );

      const result = await evaluate(
        agent,
        [
          check('uses-thread-write-approval-tool', ({ toolEvents }) =>
            hasAskUserEvent(
              toolEvents,
              /post.*resolve|post.*only|edit.*draft|thread.*write/i,
            )),
          check('does-not-misclassify-as-human-review-stop', ({ transcript }) =>
            !/Review needed:|invoke.*(?:fix-pr|baby-sit)|start.*new.*(?:turn|task)/i.test(
              transcript,
            )),
          check('preserves-continuation-after-approval', ({ transcript, toolEvents }) => {
            const haystack = `${transcript}\n${JSON.stringify(toolEvents)}`;
            return /same (?:babysitting )?(?:run|invocation|watcher)|resume.*watcher|continue.*babysit/i.test(
              haystack,
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

  it('stops after six repair cycles and asks for another bounded batch', async () => {
    const agent = await createAgent({
      agent: EVAL_AGENT,
      timeout: 360,
      skillDir: SKILL_DIR,
      copyFromHome:
        EVAL_AGENT === 'codex' ? ['.codex/auth.json'] : undefined,
    });

    try {
      await promptOnce(
        agent,
        `Use $vs-baby-sit on PR #542. The run has already consumed its default six repair cycles. Each cycle was a confirmed PR-owned fix, validation, commit, and push. Every new review found a different issue in the same scorer and sanitizer seam, and the PR is not merge-ready. The watcher has just returned another review-feedback event on a new head. There is no user approval for more work yet.

Describe exactly how you stop now, what you tell the user about why this merits human investigation, and the direct question you ask before doing anything else. Do not invent a fix or continue into a seventh repair cycle.`,
      );

      const result = await evaluate(
        agent,
        [
          check('enforces-six-cycle-budget', ({ log }) => {
            const output = assistantOutput(log);
            return /six|6/.test(output) && /repair.*(?:cycle|budget)|(?:cycle|budget).*repair/i.test(output);
          }),
          check('stops-before-seventh-repair', ({ log }) => {
            const output = assistantOutput(log);
            return /stop|pause|hand.*back|do not continue/i.test(output) &&
              !/(?:apply|start|push|perform).{0,80}(?:seventh|7th|next).*repair/i.test(output);
          }),
          check('explains-human-investigation', ({ log }) => {
            const output = assistantOutput(log);
            return /human.*(?:investig|review|look)|worth.*human|new.*(?:non.?identical|different).*finding/i.test(output);
          }),
          check('asks-for-exactly-six-more', ({ log }) => {
            const output = assistantOutput(log);
            return /(?:approve|approval|permission).*another.*6.*(?:repair|cycle)|another.*bounded.*batch.*6.*(?:repair|cycle)/i.test(output);
          }),
        ],
        { failFast: false, onScorerError: 'zero' },
      );

      expect(result.score).toBe(1);
    } finally {
      await agent.dispose();
    }
  });

  it('repairs PR-owned external CI and returns to the same watcher', async () => {
    const agent = await createAgent({
      agent: EVAL_AGENT,
      timeout: 360,
      skillDir: SKILL_DIR,
      copyFromHome:
        EVAL_AGENT === 'codex' ? ['.codex/auth.json'] : undefined,
    });

    try {
      await promptOnce(
        agent,
        `Use $vs-baby-sit on PR #542 and automatically fix failures caused by this PR until it is merge-ready.

The watcher has just returned this first event with exit code 10:
{"event":"attention","reason":"ci-failure","snapshot":{"draft":false,"headSha":"abc123","mergeable":true,"reviewDecision":"REVIEW_REQUIRED","unresolvedThreads":0,"ciState":"FAILURE","failures":[]}}

The shared check inspector identifies one external provider check and its build URL, but no GitHub Actions logs. This environment has an installed provider build-investigation skill that can retrieve those logs. The configured checkout contains unrelated user changes.

Describe the exact actions you take now, including how you protect the old head before local repair. After the successful fix is pushed, assume the same watcher returns {"event":"attention","reason":"ready-for-review","snapshot":{"draft":true,"headSha":"def456","mergeable":true,"reviewDecision":"REVIEW_REQUIRED","unresolvedThreads":0,"ciState":"SUCCESS","failures":[]}}. Explain how you handle that event and what you do if the resumed watcher says review approval from requested team platform-reviewers is the only remaining gate. Auto-merge is armed and a production rollout is planned afterward. Do not invent the missing provider error.`,
      );

      const result = await evaluate(
        agent,
        [
          check('uses-provider-evidence-before-editing', ({ log }) => {
            const output = assistantOutput(log);
            const provider = output.search(
              /provider.*(?:skill|tool|evidence)|build-investigation|provider(?:'s)? (?:returned )?logs/i,
            );
            const evidenceAfterProvider = output
              .slice(provider)
              .search(/evidence.*(?:PR-owned|caused by this PR)|provider.*logs/i);
            const mutationSetup = output.search(/(temporary|isolated|separate|detached).*worktree/i);
            return (
              provider >= 0 &&
              evidenceAfterProvider >= 0 &&
              (mutationSetup < 0 || provider + evidenceAfterProvider < mutationSetup)
            );
          }),
          check('proves-pr-ownership', ({ log }) => {
            const output = assistantOutput(log);
            return (
              /failure.*(?:belongs to|caused by|is PR-owned)|PR-owned.*(?:failure|defect)/i.test(
                output,
              ) &&
              /not caused by this PR|not tied to the current head|failure.*(flake|infra(?:structure)?|unrelated)|(flake|infra(?:structure)?).*failure|infra.*issue|(?:infrastructure|unrelated).*(?:no code change|make no code change)|logs? (?:cannot|can't) be retrieved[\s\S]*no code change/i.test(
                output,
              )
            );
          }),
          check('protects-configured-checkout', ({ log }) => {
            const output = assistantOutput(log);
            return (
              /(temporary|isolated|detached).*worktree/i.test(output) &&
              /not .*current (checkout|worktree)|do not work in the current worktree|not modify.*dirty checkout|(configured|current|existing) checkout.*(do not touch|untouched|unchanged|read-only)|checkout as read-only|do not mutate.*checkout|leave.*checkout.*(untouched|unchanged)|separate worktree.*user.*changes|preserv(?:e|ing).*(?:configured checkout.*unrelated changes|unrelated checkout changes)/is.test(
                output,
              )
            );
          }),
          check('drafts-before-local-repair', ({ log }) => {
            const output = assistantOutput(log);
            const draft = output.search(/gh pr ready --undo|convert.*(?:PR|pull request).*draft/i);
            const afterDraft = output.slice(Math.max(draft, 0));
            return (
              draft >= 0 &&
              /(?:create|add).*worktree|local repair|apply.*fix|smallest repair/i.test(
                afterDraft,
              ) &&
              /same head|head.*abc123|abc123.*head/i.test(output) &&
              /isDraft.*true|draft.*true|verify.*draft/i.test(output)
            );
          }),
          check('returns-to-same-watcher-task', ({ log }) => {
            const output = assistantOutput(log);
            return (
              /reuse the (existing|same).*watcher|same (dedicated )?watcher (task|thread|child|agent|process(?:\/task)?)|resume the same watcher/i.test(
                output,
              ) &&
              !/new watcher (task|thread|child|agent)/i.test(output)
            );
          }),
          check('preserves-watcher-strengths', ({ log }) => {
            const output = assistantOutput(log);
            return (
              /next watcher event|return.*watcher|resume.*watcher|reuse.*watcher/i.test(output) &&
              !/sleep loop|repeated.*gh|re-check PR state/i.test(output)
            );
          }),
          check('promotes-only-after-green-draft-event', ({ log }) => {
            const output = assistantOutput(log);
            const event = output.search(/ready-for-review/i);
            const ready = output.slice(Math.max(event, 0)).search(/gh pr ready(?! --undo)/i);
            return (
              event >= 0 &&
              ready >= 0 &&
              /same head|head.*def456|def456.*head|still at `?def456/i.test(
                output.slice(event),
              ) &&
              /isDraft.*false|draft.*false|no longer draft/i.test(output.slice(event)) &&
              /resume the same watcher|same watcher.*resume/i.test(output.slice(event))
            );
          }),
          check('stops-on-approval-only-gate', ({ log }) => {
            const output = assistantOutput(log);
            return (
              /review-approval|approval.*only remaining|waiting for approval/i.test(output) &&
              /Review needed:.*@?platform-reviewers/i.test(output) &&
              /stop (the )?watcher|stop babysitting|hand.*back|do not (keep|continue).*(watch|poll)/i.test(
                output,
              ) &&
              !/continue babysitting|still waiting|keep(?:ing)? .*under watch/i.test(output)
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
