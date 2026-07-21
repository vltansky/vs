import * as fs from 'fs';
import * as path from 'path';
import { describe, expect, it } from 'vitest';

const SKILL = fs.readFileSync(path.resolve(__dirname, '..', 'SKILL.md'), 'utf8');
const OPENAI_CONFIG = fs.readFileSync(
  path.resolve(__dirname, '..', 'agents', 'openai.yaml'),
  'utf8',
);
const DESCRIPTION = SKILL.match(/^description: "([^"]+)"$/m)?.[1] ?? '';

describe('vs-ship-it routing', () => {
  it('prioritizes PR creation while retaining explicit direct-push routing', () => {
    expect(DESCRIPTION).toMatch(/create\/open a (?:pull request|PR)/i);
    expect(DESCRIPTION).toMatch(/push to main\/master/i);
    expect(DESCRIPTION.indexOf('create/open')).toBeLessThan(
      DESCRIPTION.indexOf('push to main/master'),
    );
    expect(OPENAI_CONFIG).toMatch(
      /short_description: "Create a PR; commit and push when requested"/,
    );
  });

  it('excludes review-only requests without publishing intent', () => {
    expect(DESCRIPTION).toMatch(/affirmative publish intent/i);
    expect(DESCRIPTION).toMatch(/review\/readiness-only requests/i);
  });

  it('allows implicit invocation for commit, push, and PR requests', () => {
    expect(SKILL).not.toContain('disable-model-invocation: true');
    expect(SKILL).toMatch(/commit and push/);
    expect(SKILL).toMatch(/push to main\/master/);
    expect(OPENAI_CONFIG).toContain('allow_implicit_invocation: true');
  });

  it('keeps explicit direct pushes out of the PR workflow', () => {
    expect(SKILL).toContain('### Direct-push path');
    expect(SKILL).toContain(
      'Do not create a feature branch or PR in direct-push mode.',
    );
    expect(SKILL).toMatch(/verify the local and remote SHAs\s+match/);
  });

  it('does not silently map a missing destination branch', () => {
    expect(SKILL).toMatch(/does not exist,[\s\S]*do not silently create or map/);
  });
});

describe('vs-ship-it PR association handshake', () => {
  it('re-resolves complete PR identity after creation', () => {
    expect(SKILL).toContain(
      'gh pr view --json number,url,state,headRefName,headRefOid',
    );
    expect(SKILL).toMatch(/PR_NUM=.*\.number/);
    expect(SKILL).toMatch(/PR_URL=.*\.url/);
    expect(SKILL).toMatch(/REPO=.*gh repo view/);
  });

  it('verifies open state, branch, and HEAD before the turn ends', () => {
    expect(SKILL).toContain('.state == "OPEN"');
    expect(SKILL).toContain('.headRefName == $branch');
    expect(SKILL).toContain('.headRefOid == $head');
    expect(SKILL).toContain('Do not switch branches or end the turn');
  });

  it('uses the verified URL and stops on failed verification', () => {
    expect(SKILL).toContain('printf \'%s\\n\' "$PR_URL"');
    expect(SKILL).toMatch(/On failure,[\s\S]*report the mismatch, and stop/);
  });
});

describe('vs-ship-it optional browser image upload', () => {
  it('gets explicit approval through the ask-user-question tool', () => {
    expect(SKILL).toContain('request_user_input');
    expect(SKILL).toMatch(/ask-user-question tool/i);
    expect(SKILL).toMatch(/exact local image paths/i);
    expect(SKILL).toMatch(/verified `PR_URL`/);
    expect(SKILL).toMatch(/affirmative/i);
    expect(SKILL).not.toMatch(/autoResolutionMs/);
  });

  it('uses the browser only for approved GitHub uploads', () => {
    expect(SKILL).toMatch(/authenticated browser/i);
    expect(SKILL).toMatch(/approved image paths/i);
    expect(SKILL).toMatch(/do not submit (?:the )?comment/i);
    expect(SKILL).toMatch(/`gh pr edit` with\s+`--body-file`/);
  });

  it('keeps image hosting optional', () => {
    expect(SKILL).toMatch(/Skip upload/);
    expect(SKILL).toMatch(/declines? or skips?/i);
    expect(SKILL).toMatch(/continue shipping without browser access/i);
  });
});

describe('vs-ship-it mechanical PR fast path', () => {
  it('honors explicit requests to skip shipping ceremony', () => {
    expect(SKILL).toMatch(/just create (?:the\s+)?PR/);
    expect(SKILL).toMatch(/skip review/);
    expect(SKILL).toMatch(/do not run `vs-roast-review`/);
    expect(SKILL).toMatch(/do not spawn review agents/);
  });

  it('recognizes conservative trivial documentation diffs', () => {
    expect(SKILL).toMatch(/exactly one documentation or instruction file/);
    expect(SKILL).toMatch(/50\s+changed lines or fewer/);
    expect(SKILL).toMatch(
      /dependencies, CI, security,\s+permissions, ownership, schemas, migrations/,
    );
  });

  it('keeps the fast path focused and bounded', () => {
    expect(SKILL).toMatch(/repository-required checks/);
    expect(SKILL).toMatch(/requested PR modifiers/);
    expect(SKILL).toMatch(
      /Skip the brief, review map, reviewer suggestions, and CI watch/,
    );
    expect(SKILL).toMatch(/verify the PR association/);
    expect(SKILL).toMatch(/Verify\s+each requested modifier took effect/);
  });
});

describe('vs-ship-it reviewer guide', () => {
  it('uses vs-write for dense, complete reviewer-facing copy', () => {
    expect(SKILL).toContain('[`vs-write`](../vs-write/SKILL.md)');
    expect(SKILL).toMatch(/`vs-write`\]\([^)]*\) in direct mode/);
    expect(SKILL).toMatch(/comprehension per line/i);
    expect(SKILL).toMatch(/Do not enforce a global word budget/);
    expect(SKILL).toMatch(/short sentences and concrete verbs/);
  });

  it('shows matched visual evidence and verification in the main body', () => {
    expect(SKILL).toContain('## Before / after');
    expect(SKILL).toContain('## How to verify');
    expect(SKILL).toContain('## Review focus');
    expect(SKILL).toMatch(/matched screenshots from the same state/i);
    expect(SKILL).toMatch(/actual hosted attachments/i);
    expect(SKILL).toMatch(/direct PR preview/i);
    expect(SKILL).toMatch(/new\s+feature with no\s+honest baseline, show Demo/);
    expect(SKILL).toMatch(/internal\s+refactor with no\s+observable output,\s+omit this section/);
    expect(SKILL).toMatch(
      /Keep Why, Before \/ after or Demo, How it works, How to verify, and\s+Review focus visible/,
    );
    expect(SKILL).not.toContain('<summary>Before / after</summary>');
    expect(SKILL).not.toContain('<summary>How to verify</summary>');
    expect(SKILL).not.toContain('<summary>Review focus</summary>');
  });

  it('keeps the change logic visible and collapses only secondary detail', () => {
    expect(SKILL).toContain('## How it works');
    expect(SKILL).toContain('### Behavior examples');
    expect(SKILL).not.toContain('<summary>How it works</summary>');
    expect(SKILL).toMatch(
      /Collapse only raw test logs and\s+supporting detail/,
    );
    expect(SKILL).toMatch(/logic needed to understand the change visible/);
  });

  it('uses a review map only when several meaningful layers need ordering', () => {
    expect(SKILL).toContain('| Order | Area | Why it matters | Risk | Start here |');
    expect(SKILL).toMatch(
      /core behavior, public contracts, risky boundaries,\s+consumers, and tests/,
    );
    expect(SKILL).toMatch(/only when several meaningful layers/i);
    expect(SKILL).toMatch(/fold the paths into Review focus/i);
    expect(SKILL).toMatch(/Never use\s+the map to hide executable code/);
    expect(SKILL).toMatch(/Do not include AI session history/);
    expect(SKILL).not.toContain('<summary>AI Session Context');
    expect(SKILL).not.toContain('<summary>Change Brief');
  });
});

describe('vs-ship-it remote-first validation', () => {
  it('sends a PR preview deployment when GitHub exposes one', () => {
    expect(SKILL).toMatch(/preview deployment/i);
    expect(SKILL).toMatch(/send the\s+direct preview URL/i);
    expect(SKILL).toMatch(/do not send a provider dashboard or log URL/i);
  });

  it('validates generic preview links exposed in PR comments', () => {
    expect(SKILL).toMatch(/preview links?\s+in PR\s+comments/i);
    expect(SKILL).toMatch(/authenticated browser.*network/i);
    expect(SKILL).toMatch(/send only .*working app URL/i);
    expect(SKILL).toMatch(/current PR head/i);
    expect(SKILL).toMatch(/do not encode provider-specific\s+URL\s+rewrites/i);
  });

  it('starts PR feedback before broad local validation', () => {
    expect(SKILL).toMatch(/focused test or smallest relevant validation/);
    expect(SKILL).toMatch(/create the PR promptly/);
    expect(SKILL).toContain('Running locally and in CI');
    expect(SKILL).toContain(
      'Step 2 → Step 3/3b → Step 5/5b → Step 4/4b → Step 5c → update the PR body → Step 6/7',
    );
    expect(SKILL).toMatch(
      /Run `vs-brief` and `vs-verify` after PR creation while CI and automated review\s+run/,
    );
    expect(SKILL).toMatch(
      /Do not run Step 4 or Step 4b before Step 5 unless repository policy requires it/,
    );
  });

  it('requires local and remote evidence before readiness', () => {
    expect(SKILL).toMatch(
      /local verification and remote checks both\s+pass/,
    );
    expect(SKILL).toMatch(/repository policy requires pre-push validation/);
  });
});

describe('vs-ship-it finite goal boundary', () => {
  it('finishes shipping before optional monitoring starts', () => {
    expect(SKILL).toMatch(/complete the shipping goal before/);
    expect(SKILL).toMatch(/only when the user explicitly requested/);
    expect(SKILL).toMatch(/separate monitoring goal/);
    expect(OPENAI_CONFIG).not.toContain('and babysit it');
  });

  it('stops at a verified initial readiness snapshot by default', () => {
    expect(SKILL).toMatch(/stop after the verified initial readiness snapshot/);
    expect(SKILL).not.toMatch(/automatically continue with `vs-baby-sit`/);
  });
});
