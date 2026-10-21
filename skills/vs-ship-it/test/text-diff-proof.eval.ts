import * as path from 'path';
import { check, evaluate } from '@wix/pathgrade';
import { describe, expect, it } from 'vitest';
import { promptOnce } from '../../vs-internal-shared/test/pathgrade-v1';
import { createAgent } from '../../vs-internal-shared/test/pathgrade-agent';

const SKILL_DIR = path.resolve(__dirname, '..');
const EVAL_AGENT = (process.env.PATHGRADE_AGENT ?? 'codex') as 'claude' | 'codex';

function assistantOutput(log: Array<{ type: string; assistant_message?: string }>) {
  return log.filter((e) => e.type === 'agent_result').map((e) => e.assistant_message ?? '').join('\n');
}

const fences = (out: string) => [...out.matchAll(/```([\w-]*)\n([\s\S]*?)```/g)].map((m) => ({ lang: m[1], body: m[2] }));

const ASK = `Use $vs-ship-it. Write only the "## Change and proof" section of the PR body as markdown. Do not run git, gh, or any tool beyond reading the skill and its PR-body reference.`;

describe('vs-ship-it text before/after', () => {
  it('renders a flag removal as one diff with only the changed flag marked', async () => {
    const agent = await createAgent({ agent: EVAL_AGENT, timeout: 360, skillDir: SKILL_DIR });
    try {
      await promptOnce(agent, `${ASK}
The PR changes how the eval runner spawns Claude. Source-derived from the diff of src/runner.ts:
Old command: claude --print --output-format stream-json --verbose --no-session-persistence --setting-sources user,project --model sonnet --max-turns 30 -p "$PROMPT"
New command: claude --print --output-format stream-json --verbose --no-session-persistence --model sonnet --max-turns 30 -p "$PROMPT"
Effect: with no --setting-sources flag, Claude loads every settings source (user, project, and local), so eval runs now also pick up .claude/settings.local.json, the same as a developer's own Claude session. No UI change.`);
      const result = await evaluate(agent, [
        check('one-diff-block-marks-the-flag', ({ log }) => {
          const blocks = fences(assistantOutput(log)).filter((b) => b.lang === 'diff');
          return blocks.some((b) => {
            const lines = b.body.split('\n');
            const changed = lines.filter((l) => /^[-+]/.test(l));
            return changed.some((l) => /^-.*--setting-sources/.test(l))
              && changed.length <= 2
              && lines.some((l) => /^ .*(?:--no-session-persistence|--model|claude)/.test(l));
          });
        }),
        check('gate-labels-present', ({ log }) => {
          const out = assistantOutput(log);
          return /\*\*[ \t]*Before\b/.test(out) && /\*\*[ \t]*After\b/.test(out);
        }),
        check('no-separate-before-after-command-blocks', ({ log }) => {
          const cmdBlocks = fences(assistantOutput(log)).filter((b) => b.lang !== 'diff' && /claude --print/.test(b.body));
          return cmdBlocks.length === 0;
        }),
      ], { failFast: false, onScorerError: 'zero' });
      expect(result.score).toBe(1);
    } finally {
      await agent.dispose();
    }
  });

  it('renders a JSON key removal as one diff and marks the moved comma', async () => {
    const agent = await createAgent({ agent: EVAL_AGENT, timeout: 360, skillDir: SKILL_DIR });
    try {
      await promptOnce(agent, `${ASK}
The PR turns off Renovate automerge. Source-derived from the diff of renovate.json:
Old: {"extends": ["config:recommended"], "labels": ["deps"], "schedule": ["before 6am on monday"], "automerge": true}
New: {"extends": ["config:recommended"], "labels": ["deps"], "schedule": ["before 6am on monday"]}
Effect: dependency PRs now wait for a human merge instead of merging on green CI. No UI change.`);
      const result = await evaluate(agent, [
        check('one-diff-marks-key-and-comma', ({ log }) => {
          const blocks = fences(assistantOutput(log)).filter((b) => b.lang === 'diff');
          return blocks.some((b) => {
            const lines = b.body.split('\n');
            const changed = lines.filter((l) => /^[-+]/.test(l));
            return changed.some((l) => /^-.*"automerge"/.test(l))
              && !changed.some((l) => /^\+.*"automerge"/.test(l))
              && changed.some((l) => /^-.*"schedule".*,\s*$/.test(l))
              && changed.some((l) => /^\+.*"schedule".*[^,\s]\s*$/.test(l))
              && changed.length <= 3
              && lines.some((l) => /^ .*"(?:extends|labels)"/.test(l));
          });
        }),
        check('gate-labels-present', ({ log }) => {
          const out = assistantOutput(log);
          return /\*\*[ \t]*Before\b/.test(out) && /\*\*[ \t]*After\b/.test(out);
        }),
        check('no-separate-before-after-json-blocks', ({ log }) =>
          fences(assistantOutput(log)).filter((b) => b.lang !== 'diff' && /"automerge"|"schedule"/.test(b.body)).length === 0),
      ], { failFast: false, onScorerError: 'zero' });
      expect(result.score).toBe(1);
    } finally {
      await agent.dispose();
    }
  });

  it('keeps screenshot Before/After for a UI change', async () => {
    const agent = await createAgent({ agent: EVAL_AGENT, timeout: 360, skillDir: SKILL_DIR });
    try {
      await promptOnce(agent, `${ASK}
The PR moves the Save button on the settings page from the bottom of a long form to a sticky footer, so it stays visible while scrolling. Matched hosted screenshots exist at the same viewport and data:
Before: https://github.com/user-attachments/assets/1111aaaa-0000-0000-0000-000000000001
After: https://github.com/user-attachments/assets/2222bbbb-0000-0000-0000-000000000002`);
      const result = await evaluate(agent, [
        check('screenshot-pair-kept', ({ log }) => {
          const out = assistantOutput(log);
          return /!\[[^\]]*\]\([^)]*1111aaaa/.test(out) && /!\[[^\]]*\]\([^)]*2222bbbb/.test(out)
            && /\*\*Before\b/.test(out) && /\*\*After\b/.test(out);
        }),
        check('no-diff-instead-of-ui-proof', ({ log }) => {
          const out = assistantOutput(log);
          return !fences(out).some((b) => b.lang === 'diff' && /1111aaaa|2222bbbb/.test(b.body));
        }),
      ], { failFast: false, onScorerError: 'zero' });
      expect(result.score).toBe(1);
    } finally {
      await agent.dispose();
    }
  });
});
