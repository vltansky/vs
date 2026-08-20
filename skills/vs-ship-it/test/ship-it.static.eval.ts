import * as fs from 'fs';
import * as path from 'path';
import { describe, expect, it } from 'vitest';

const SKILL = fs.readFileSync(path.resolve(__dirname, '..', 'SKILL.md'), 'utf8');
const OPENAI_CONFIG = fs.readFileSync(
  path.resolve(__dirname, '..', 'agents', 'openai.yaml'),
  'utf8',
);
const DESCRIPTION = SKILL.match(/^description: "([^"]+)"$/m)?.[1] ?? '';
const REVIEW_STEP =
  SKILL.split('### Step 0: Offer review without blocking')[1]?.split(
    '### Step 1:',
  )[0] ?? '';
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
    expect(SKILL).toMatch(/Direct-push mode does\s+not start `vs-baby-sit`/i);
  });

  it('routes bare ship-it to the single PR workflow', () => {
    expect(SKILL).toMatch(/says bare `ship it` without naming a push destination/);
    expect(SKILL).toContain('## PR workflow');
    expect(SKILL).not.toContain('Immediate PR path');
    expect(SKILL).not.toContain('Mechanical PR fast path');
  });
});

describe('vs-ship-it optional review consent', () => {
  it('separates publishing authorization from review consent', () => {
    expect(SKILL).toContain('## Non-negotiable consent boundary');
    expect(SKILL).toMatch(/authorize the scoped\s+commit, push, and PR creation/i);
    expect(SKILL).toMatch(/They do \*\*not\*\* authorize running code review/i);
    expect(SKILL).toMatch(/without an explicit "run review" instruction,\s+skip it/i);
    expect(SKILL).toMatch(/never\s+hold PR creation for review confirmation/i);
  });

  it('reuses review evidence and honors explicit decisions', () => {
    expect(REVIEW_STEP).toMatch(/Review already ran:[\s\S]*reuse it/i);
    expect(REVIEW_STEP).toMatch(/explicitly requested review or approved it/i);
    expect(REVIEW_STEP).toMatch(/explicitly declined or said to skip review/i);
  });

  it('offers review without blocking PR preparation', () => {
    expect(REVIEW_STEP).toMatch(/short, non-blocking commentary (?:offer|statement)/i);
    expect(REVIEW_STEP).toContain('Say “run review” if you want it first');
    expect(REVIEW_STEP).toMatch(/Continue gathering PR facts(?: and creating the PR)? immediately/i);
    expect(REVIEW_STEP).toMatch(/Do not call `request_user_input`, wait\s+for a response/i);
  });

  it('never runs review without explicit approval', () => {
    expect(REVIEW_STEP).toMatch(/Only an explicit affirmative review instruction authorizes/i);
    expect(REVIEW_STEP).toMatch(/infer review approval from “ship it,” “create PR,” silence/i);
    expect(REVIEW_STEP).toMatch(/If none exists, skip\s+review and continue/i);
    expect(REVIEW_STEP).not.toMatch(/run it now/i);
    expect(REVIEW_STEP).not.toMatch(/auto-select/i);
  });

  it('reports the review decision in the handoff', () => {
    expect(SKILL).toContain('Review: reused');
    expect(SKILL).toContain('Review: ran with approval');
    expect(SKILL).toContain('Review: skipped — not explicitly approved');
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
    expect(PR_WORKFLOW).toMatch(/Do not add\s+brief generation, broad verification, reviewer\s+discovery, preview startup, or QA unless the user explicitly requested/i);
    expect(PR_WORKFLOW).toMatch(/do not introduce `vs-brief`, `vs-verify`/i);
    expect(PR_WORKFLOW).toMatch(/Do not suggest reviewers, start a\s+preview, or run QA by default/i);
  });

  it('uses body files for create and edit', () => {
    expect(PR_WORKFLOW).toContain('gh pr create --title "<title>" --body-file "$BODY_FILE"');
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
  it('verifies open state, branch, and exact head', () => {
    expect(PR_WORKFLOW).toContain(
      'gh pr view --json number,url,title,state,headRefName,headRefOid',
    );
    expect(PR_WORKFLOW).toContain('.state == "OPEN"');
    expect(PR_WORKFLOW).toContain('.headRefName == $branch');
    expect(PR_WORKFLOW).toContain('.headRefOid == $head');
    expect(PR_WORKFLOW).toMatch(/Do not switch branches before this succeeds/i);
  });

  it('starts babysitting after PR verification unless declined', () => {
    expect(DESCRIPTION).toMatch(/babysits them by default/i);
    expect(SKILL).toMatch(/Hand the verified PR to `vs-baby-sit`/i);
    expect(SKILL).toMatch(/unless the user explicitly says not to watch/i);
    expect(SKILL).toMatch(/visibly separate\s+babysitting phase/i);
  });

  it('keeps evidence boundaries honest', () => {
    expect(SKILL).toMatch(/Do not describe CI, deployment, preview behavior, or production as verified/i);
    expect(SKILL).toMatch(/Review: <reused \| ran with approval \| skipped/);
    expect(SKILL).toMatch(/Media: <N screenshots, N videos attached/);
  });
});
