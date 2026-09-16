import * as path from 'node:path';
import { check, evaluate } from '@wix/pathgrade';
import { expect, it } from 'vitest';
import { createAgent } from '../../vs-internal-shared/test/pathgrade-agent';
import { promptOnce } from '../../vs-internal-shared/test/pathgrade-v1';

it('routes from the installed catalog and refreshes after it changes without executing', async () => {
  const agent = await createAgent({ skillDir: path.resolve(__dirname, '..'), timeout: 300 });
  try {
    const request = (name: string) => `Use vs-ask. The current session's complete available-skills catalog is:
- ${name}: Review pull request feedback and fix failing CI. Location: /skills/${name}/SKILL.md
- vs-prose: Rewrite prose clearly. Location: /skills/vs-prose/SKILL.md
- external-review: Review pull request feedback. Location: /skills/external-review/SKILL.md
This replaces the previous catalog, if any. I need to address PR feedback and fix failing CI. Which installed VS skill should I use?`;
    await promptOnce(agent, request('vs-review-alpha'), {
      maxTurns: 2,
      reactions: [{ when: /Recommended:/, reply: request('vs-review-beta'), once: true }],
    });
    const result = await evaluate(agent, [
      check('current-installed-recommendation', ({ transcript }) => {
        const recommendations = [...transcript.matchAll(/Recommended:\s*`?\/(vs-[\w-]+)/g)];
        return recommendations.map((match) => match[1]).join(',') === 'vs-review-alpha,vs-review-beta';
      }),
      check('copyable-prompt', ({ transcript }) => /Start with:\s*\S/.test(transcript)),
      // Loading the router and reading references are allowed; running a workflow is not.
      check('no-execution', ({ toolEvents }) => toolEvents.every((event) =>
        event.action === 'read_file' ||
        (event.action === 'use_skill' && event.skillName === 'vs-ask') ||
        event.providerToolName === 'mcpServer/startupStatus/updated',
      )),
    ], { failFast: false, onScorerError: 'zero' });
    expect(result.score).toBe(1);
  } finally {
    await agent.dispose();
  }
});
