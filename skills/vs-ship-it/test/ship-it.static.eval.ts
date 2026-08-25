import * as fs from 'fs';
import * as path from 'path';
import { describe, expect, it } from 'vitest';

const SKILL = fs.readFileSync(path.resolve(__dirname, '..', 'SKILL.md'), 'utf8');
const OPENAI_CONFIG = fs.readFileSync(
  path.resolve(__dirname, '..', 'agents', 'openai.yaml'),
  'utf8',
);
const README = fs.readFileSync(
  path.resolve(__dirname, '..', '..', '..', 'README.md'),
  'utf8',
);
const DESCRIPTION = SKILL.match(/^description: "([^"]+)"$/m)?.[1] ?? '';
const PR_WORKFLOW = SKILL.split('## PR workflow')[1]?.split('## Handoff')[0] ?? '';

describe('vs-ship-it routing', () => {
  it('owns affirmative PR publishing requests', () => {
    expect(DESCRIPTION).toMatch(
      /^Use vs-ship-it when the user asks to create or open a PR/i,
    );
    expect(DESCRIPTION).toMatch(/says create PR, open PR, or ship it/i);
    expect(DESCRIPTION).toMatch(/affirmative publish intent/i);
    expect(DESCRIPTION).toMatch(/review\/readiness-only requests/i);
    expect(DESCRIPTION.indexOf('create or open a PR')).toBeLessThan(
      DESCRIPTION.indexOf('review'),
    );
    expect(OPENAI_CONFIG).toContain('allow_implicit_invocation: true');
  });

  it('wins over generic publishers without composing them', () => {
    expect(DESCRIPTION).toMatch(/github:yeet/i);
    expect(SKILL).toMatch(/Prefer this workflow over a\s+generic publisher/);
    expect(SKILL).toMatch(/do not compose two publishers/i);
  });

  it('keeps explicit direct pushes separate', () => {
    expect(SKILL).toContain('### Direct-push path');
    expect(SKILL).toMatch(/verify local and remote SHAs match/i);
    expect(SKILL).toContain('Do not create a feature branch or PR in direct-push mode.');
    expect(SKILL).toMatch(/Direct-push mode does\s+not start `vs-pr-walkthrough` or `vs-baby-sit`/i);
  });

  it('routes bare ship-it to the single PR workflow', () => {
    expect(SKILL).toMatch(/says bare `ship it` without naming a push destination/);
    expect(SKILL).toContain('## PR workflow');
    expect(SKILL).not.toContain('Immediate PR path');
    expect(SKILL).not.toContain('Mechanical PR fast path');
  });
});

describe('vs-ship-it publishing boundary', () => {
  it('does not include a pre-PR code-review phase', () => {
    expect(PR_WORKFLOW).toMatch(/five outcomes: prepare the PR description/i);
    expect(PR_WORKFLOW).toMatch(/Code\s+review is outside this workflow/i);
    expect(SKILL).not.toContain('Offer review without blocking');
    expect(SKILL).not.toContain('vs-roast-code');
    expect(SKILL).not.toMatch(/Review: <reused \| ran with approval \| skipped/);
  });

  it('shows the PR format and available proof in the README flow', () => {
    expect(README).not.toContain('Review explicitly approved?');
    expect(README).toMatch(/Prepare PR description<br\/>feature_area: title/);
    expect(README).toMatch(/Problem \+ Before\/After<br\/>Why this change/);
    expect(README).toMatch(/User impact<br\/>Evidence \+ gaps<br\/>Review focus/);
    expect(README).toMatch(/Attach available proof<br\/>matched screenshots/);
    expect(README).toMatch(/short video for interactions/);
  });
});

describe('vs-ship-it independent PR preparation', () => {
  it('prepares reviewer-facing copy without asking for wording approval', () => {
    expect(PR_WORKFLOW).toMatch(/Write the description directly from the live conversation/i);
    expect(PR_WORKFLOW).toMatch(/Do not ask the user to write or approve PR\s+copy/i);
    expect(PR_WORKFLOW).toContain('## What Problem This Solves');
    expect(PR_WORKFLOW).toContain('## Why This Change Was Made');
    expect(PR_WORKFLOW).toContain('## User Impact');
    expect(PR_WORKFLOW).toContain('## Evidence');
    expect(PR_WORKFLOW).toContain('## Review focus');
  });

  it('does not make ceremony part of default PR creation', () => {
    expect(PR_WORKFLOW).toMatch(/Do not add brief generation, broad\s+verification, reviewer discovery, preview startup, or QA unless the user\s+explicitly requested/i);
    expect(PR_WORKFLOW).toMatch(/do not introduce `vs-brief`, `vs-verify`/i);
    expect(PR_WORKFLOW).toMatch(/Do not suggest reviewers, start a\s+preview, or run QA by default/i);
  });

  it('uses body files for create and edit', () => {
    expect(PR_WORKFLOW).toContain(
      'gh pr create --draft --title "<title>" --body-file "$BODY_FILE"',
    );
    expect(PR_WORKFLOW).toMatch(/never pass[\s\S]*inline `--body`/i);
    expect(PR_WORKFLOW).toContain('gh pr edit --body-file');
  });
});

describe('vs-ship-it media preparation', () => {
  it('handles screenshots and video before PR creation', () => {
    expect(PR_WORKFLOW).toMatch(/Before creating the PR, inspect/i);
    expect(PR_WORKFLOW).toMatch(/matched screenshots for static visual states/i);
    expect(PR_WORKFLOW).toMatch(/matched recordings for motion/i);
    expect(PR_WORKFLOW).toMatch(/Insert the URLs into the body file before `gh pr create`/i);
  });

  it('does not block when media is unavailable', () => {
    expect(PR_WORKFLOW).toMatch(/If no valid media exists, continue without asking/i);
    expect(PR_WORKFLOW).toMatch(/state\s+the exact visual-proof gap under Evidence/i);
    expect(PR_WORKFLOW).toMatch(/On upload failure, continue creating the PR/i);
  });

  it('uploads through GitHub user attachments', () => {
    expect(PR_WORKFLOW).toContain('https://uploads.github.com/user-attachments/assets');
    expect(PR_WORKFLOW).toContain('gh auth token');
    expect(PR_WORKFLOW).toContain('--data-binary @<absolute-file-path>');
    expect(PR_WORKFLOW).toMatch(/inherits repository\s+visibility/i);
    expect(PR_WORKFLOW).toMatch(/needs no browser, Computer Use, draft comment, or vision tool/i);
  });

  it('embeds images and video correctly', () => {
    expect(PR_WORKFLOW).toContain('image/png');
    expect(PR_WORKFLOW).toContain('video/mp4');
    expect(PR_WORKFLOW).toContain('video/webm');
    expect(PR_WORKFLOW).toContain(
      'ffmpeg -i in.webm -c:v libx264 -pix_fmt yuv420p out.mp4',
    );
    expect(PR_WORKFLOW).toMatch(/Embed images as `!\[concise caption\]/i);
    expect(PR_WORKFLOW).toMatch(/videos as the\s+returned URL on its own bare line/i);
    expect(PR_WORKFLOW).toMatch(/every uploaded image renders and\s+every video exposes a player/i);
  });

  it('keeps proof assets out of the product branch', () => {
    expect(PR_WORKFLOW).toMatch(/HTTP 422.*unsupported media type/i);
    expect(PR_WORKFLOW).toMatch(/HTTP 404.*bad repository ID/i);
    expect(PR_WORKFLOW).toMatch(/Never commit proof assets to the product\s+branch/i);
    expect(PR_WORKFLOW).toContain('.github/pr-assets');
  });
});

describe('vs-ship-it PR association and stopping point', () => {
  it('creates and verifies a draft before babysitting starts', () => {
    expect(PR_WORKFLOW).toContain('gh pr create --draft');
    expect(PR_WORKFLOW).toContain('isDraft');
    expect(PR_WORKFLOW).toContain('.isDraft == true');
    expect(PR_WORKFLOW).toMatch(/babysit.*owns.*ready for review/is);
    expect(SKILL).toMatch(
      /State: draft[\s\S]*exact head[\s\S]*CI[\s\S]*automated review[\s\S]*ready for review/i,
    );
  });

  it('verifies open state, branch, and exact head', () => {
    expect(PR_WORKFLOW).toContain(
      'gh pr view --json number,url,title,state,isDraft,headRefName,headRefOid,changedFiles',
    );
    expect(PR_WORKFLOW).toContain('.state == "OPEN"');
    expect(PR_WORKFLOW).toContain('.headRefName == $branch');
    expect(PR_WORKFLOW).toContain('.headRefOid == $head');
    expect(PR_WORKFLOW).toContain("HEAD_SHA=$(echo \"$PR_JSON\" | jq -r '.headRefOid')");
    expect(PR_WORKFLOW).toContain("CHANGED_FILES=$(echo \"$PR_JSON\" | jq -r '.changedFiles')");
    expect(PR_WORKFLOW).toMatch(/Do not switch branches before this succeeds/i);
  });

  it('starts one bounded large-PR walkthrough without delaying babysitting', () => {
    expect(PR_WORKFLOW).toMatch(/Fewer than 10 changed files[\s\S]*do not start a walkthrough child/i);
    expect(PR_WORKFLOW).toMatch(/10 or more changed files[\s\S]*vs-pr-walkthrough\/SKILL\.md/i);
    expect(PR_WORKFLOW).toMatch(/fresh-context child/i);
    expect(PR_WORKFLOW).toMatch(/hand the verified draft PR to\s+`vs-baby-sit`\s+immediately without waiting/i);
    expect(PR_WORKFLOW).toMatch(/exactly those two active children/i);
  });

  it('never surfaces a stale walkthrough or refreshes after every repair', () => {
    expect(PR_WORKFLOW).toMatch(/current `headRefOid`[\s\S]*walkthrough's `Explains` SHA/i);
    expect(PR_WORKFLOW).toMatch(/do not surface the stale artifact/i);
    expect(PR_WORKFLOW).toMatch(/do not regenerate after\s+each repair push/i);
    expect(PR_WORKFLOW).toMatch(/At `reason: ready-for-review`, refresh it once/i);
    expect(PR_WORKFLOW).toMatch(/one initial walkthrough and at most one final\s+refresh/i);
    expect(PR_WORKFLOW).toMatch(/Never prepare a walkthrough before the PR exists/i);
  });

  it('keeps walkthrough generation non-blocking', () => {
    expect(PR_WORKFLOW).toMatch(/A review aid never blocks publishing, repair, or the\s+`review-approval` stop/i);
    expect(SKILL).toMatch(/Walkthrough: <\[open walkthrough\][\s\S]*exact <short SHA>[\s\S]*generating for\s+exact head[\s\S]*skipped — small PR[\s\S]*exact gap>/i);
  });

  it('starts babysitting after PR verification unless declined', () => {
    expect(DESCRIPTION).toMatch(/babysits them by default/i);
    expect(SKILL).toMatch(/Hand the verified draft PR to `vs-baby-sit`/i);
    expect(SKILL).toMatch(/unless the user explicitly says not to watch/i);
    expect(SKILL).toMatch(/visibly separate\s+babysitting phase/i);
  });

  it('ends the composed workflow at a human review gate', () => {
    expect(SKILL).toMatch(/`Review needed: @<user-or-team>`/);
    expect(SKILL).toMatch(/Do\s+not resume watching because auto-merge is armed/i);
    expect(SKILL).toMatch(/require a new\s+user turn after the human review gate clears/i);
  });

  it('keeps evidence boundaries honest', () => {
    expect(SKILL).toMatch(/Do not describe CI, deployment, preview behavior, or production as verified/i);
    expect(SKILL).toMatch(/Media: <N screenshots, N videos attached/);
  });
});
