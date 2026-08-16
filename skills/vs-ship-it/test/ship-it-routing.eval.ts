import * as fs from 'fs';
import * as path from 'path';
import { check, createAgent, evaluate } from '@wix/pathgrade';
import { describe, expect, it } from 'vitest';
import { promptOnce } from '../../vs-internal-shared/test/pathgrade-v1';

const SKILL_DIR = path.resolve(__dirname, '..');
const EVAL_AGENT = (process.env.PATHGRADE_AGENT ?? 'claude') as
  | 'claude'
  | 'codex';

const SKILL = fs.readFileSync(path.join(SKILL_DIR, 'SKILL.md'), 'utf8');
const VS_DESCRIPTION = SKILL.match(/^description: "([^"]+)"$/m)?.[1] ?? '';
const VS_PUBLISHER = `vs-ship-it — ${VS_DESCRIPTION}`;
const GENERIC_PUBLISHER =
  'github:yeet — Publish local changes to GitHub by confirming scope, committing intentionally, pushing the branch, and opening a draft PR through the GitHub app from this plugin, with gh used only as a fallback where connector coverage is insufficient.';

describe('vs-ship-it routing collision', () => {
  for (const request of [
    'ok so remove it create pr',
    'do it create pr',
    'add logs - create pr',
    'ok open pr',
  ]) {
    it(`prefers vs-ship-it for: ${request}`, async () => {
      const agent = await createAgent({
        agent: EVAL_AGENT,
        timeout: 300,
        skillDir: SKILL_DIR,
      });

      try {
        await promptOnce(
          agent,
          `The implementation is complete. The user now says: "${request}".

The host exposes both publishing skills:
- ${VS_PUBLISHER}
- ${GENERIC_PUBLISHER}

Do not modify files or contact GitHub in this fixture. State which single skill
should own the request and why. Reply in exactly two lines beginning with
"Skill:" and "Why:".`,
        );

        const result = await evaluate(
          agent,
          [
            check('selects-vs-ship-it', ({ transcript }) =>
              /^Skill:\s*`?(?:vs:)?vs-ship-it`?\s*$/im.test(transcript),
            ),
            check(
              'does-not-select-or-compose-yeet',
              ({ transcript }) =>
                !/^Skill:.*(?:github:)?yeet/im.test(transcript) &&
                !/use both|compose both|then.*yeet/i.test(transcript),
            ),
            check('explains-precedence', ({ transcript }) =>
              /^Why:.*(?:VS|primary|preferred|verification|handback)/im.test(transcript),
            ),
          ],
          { failFast: false, onScorerError: 'zero' },
        );

        expect(result.score).toBe(1);
      } finally {
        await agent.dispose();
      }
    });
  }
});

describe('vs-ship-it reviewer evidence', () => {
  it('ships independently without auto-running review', async () => {
    const agent = await createAgent({
      agent: EVAL_AGENT,
      timeout: 300,
      skillDir: SKILL_DIR,
    });

    try {
      await promptOnce(
        agent,
        `/vs-ship-it

Read and follow the current staged vs-ship-it SKILL.md as the authority; do not
substitute a remembered or generic shipping workflow.

The implementation is complete and the user says only: "ship it". Review has
not run in this session, and the user has not approved or declined it. Local
before/after screenshots exist. This fixture blocks file uploads and GitHub
writes, so describe what vs-ship-it would do. Reply in exactly four lines
beginning with "Review:", "Description:", "Media:", and "Create:".`,
      );

      const result = await evaluate(
        agent,
        [
          check('offers-but-does-not-auto-run-review', ({ transcript }) =>
            /^Review:.*(?:offer|propose|ask|say)/im.test(transcript) &&
            /^Review:.*(?:skip|not run|no explicit yes|unless.*approve)/im.test(
              transcript,
            ) &&
            /^Review:.*(?:not block|without wait|continue|proceed)/im.test(
              transcript,
            ),
          ),
          check('prepares-description-and-media', ({ transcript }) =>
            /^Description:.*(?:prepare|write|draft)/im.test(transcript) &&
            /^Media:.*(?:upload|attach|embed).*screenshot/im.test(transcript),
          ),
          check('creates-and-verifies-pr', ({ transcript }) =>
            (/^Create:.*(?:create|open).*PR/im.test(transcript) ||
              /^Create:.*gh pr create/im.test(transcript)) &&
            /^Create:.*(?:verif|re-resolve|assert.*(?:match|state))/im.test(
              transcript,
            ),
          ),
        ],
        { failFast: false, onScorerError: 'zero' },
      );

      expect(result.score).toBe(1);
    } finally {
      await agent.dispose();
    }
  });

  it('runs review only after explicit approval', async () => {
    const agent = await createAgent({
      agent: EVAL_AGENT,
      timeout: 300,
      skillDir: SKILL_DIR,
    });

    try {
      await promptOnce(
        agent,
        `/vs-ship-it

Read and follow the current staged vs-ship-it SKILL.md as the authority; do not
substitute a remembered or generic shipping workflow.

The implementation is complete. The user says: "ship it, and yes run review
first." Review has not run in this session. This fixture blocks file and GitHub
writes. State whether review would run and what happens afterward. Reply in
exactly two lines beginning with "Review:" and "Then:".`,
      );

      const result = await evaluate(
        agent,
        [
          check('runs-approved-review', ({ transcript }) =>
            /^Review:.*(?:run|yes|vs-roast-code)/im.test(transcript),
          ),
          check('continues-to-pr', ({ transcript }) =>
            /^Then:.*(?:description|media|PR|create)/im.test(transcript),
          ),
        ],
        { failFast: false, onScorerError: 'zero' },
      );

      expect(result.score).toBe(1);
    } finally {
      await agent.dispose();
    }
  });

  it('drafts the problem-first format and handles video as hosted proof', async () => {
    const agent = await createAgent({
      agent: EVAL_AGENT,
      timeout: 300,
      skillDir: SKILL_DIR,
    });

    try {
      await promptOnce(
        agent,
        `/vs-ship-it

Read and follow the current staged vs-ship-it SKILL.md as the authority; do not
substitute a remembered or generic shipping workflow.

The user says: "Create the PR for this UI fix." Dragging a split pane used to make the
transcript jump; it now remains anchored. Matched local recordings exist at
/tmp/before.webm and /tmp/after.webm, but neither is hosted yet.

The fixture blocks files, uploads, and GitHub access, so describe the actions
instead of executing them. Following vs-ship-it, draft the PR-body outline with
its exact top-level headings, then explain in at most five lines how it would
host and embed those recordings.`,
      );

      const result = await evaluate(
        agent,
        [
          check('uses-problem-first-headings', ({ transcript }) =>
            /## What Problem This Solves[\s\S]*## Why This Change Was Made[\s\S]*## User Impact[\s\S]*## Evidence/i.test(
              transcript,
            ),
          ),
          check('keeps-matched-before-after-proof', ({ transcript }) =>
            /before[\s\S]*after/i.test(transcript) &&
            /same|matched|identical/i.test(transcript),
          ),
          check('uses-user-attachments-endpoint', ({ transcript }) =>
            (transcript.includes('uploads.github.com/user-attachments/assets') &&
              /video(?:\/|%2F)(?:webm|mp4)/i.test(transcript)) ||
            /uploads\.github\.com\/user-attachments\/assets/i.test(transcript) &&
            /video\/webm|video\/mp4/i.test(transcript),
          ),
          check('embeds-video-as-bare-url', ({ transcript }) =>
            (transcript.includes('own bare line') &&
              transcript.includes('no `![]()`')) ||
            /bare (?:returned )?URL|URL on its own (?:bare )?line/i.test(transcript) &&
            /(?:not|never)\s+!?\[|not image syntax|not `?!\[\]\(\)`?|!\[\]\(\).*suppress/i.test(
              transcript,
            ),
          ),
        ],
        { failFast: false, onScorerError: 'zero' },
      );

      expect(result.score).toBe(1);
    } finally {
      await agent.dispose();
    }
  });
});
