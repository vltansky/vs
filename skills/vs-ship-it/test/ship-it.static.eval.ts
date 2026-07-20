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
  it('uses vs-write to keep the PR body concise', () => {
    expect(SKILL).toContain('[`vs-write`](../vs-write/SKILL.md)');
    expect(SKILL).toMatch(/`vs-write`\]\([^)]*\) in direct mode/);
    expect(SKILL).toMatch(/Target about 250 words/);
    expect(SKILL).toMatch(/short sentences and concrete verbs/);
  });

  it('shows reviewer evidence and judgment in the main body', () => {
    expect(SKILL).toContain('## Evidence');
    expect(SKILL).toContain('## Verification');
    expect(SKILL).toContain('## Review focus');
    expect(SKILL).toMatch(/Visible before\/after from the same state and input/);
    expect(SKILL).toMatch(/new feature with no\s+honest baseline, show Demo/);
    expect(SKILL).toMatch(/internal refactor with no observable output,\s+omit this section/);
    expect(SKILL).toMatch(
      /Keep Why, What changed, Evidence, Review map,\s+Verification, and Review focus visible/,
    );
    expect(SKILL).not.toContain('<summary>Evidence</summary>');
    expect(SKILL).not.toContain('<summary>Review map</summary>');
    expect(SKILL).not.toContain('<summary>Verification</summary>');
    expect(SKILL).not.toContain('<summary>Review focus</summary>');
  });

  it('collapses only secondary implementation detail and raw logs', () => {
    expect(SKILL).toContain('<summary>How it works</summary>');
    expect(SKILL).toMatch(
      /Collapse only supporting implementation\s+detail and optional raw test logs/,
    );
    expect(SKILL).toMatch(/keep each command, result, and gap visible/);
  });

  it('maps the change by intent and risk instead of narrating the session', () => {
    expect(SKILL).toContain('## Review map');
    expect(SKILL).toContain('| Order | Area | Why it matters | Risk | Start here |');
    expect(SKILL).toMatch(
      /core behavior, public contracts, risky boundaries,\s+consumers, and tests/,
    );
    expect(SKILL).toMatch(/Never use\s+the map to hide executable code/);
    expect(SKILL).toMatch(/no file inventory/);
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
      'Step 2 → Step 3/3b → Step 5/5b → Step 4/4b → update the PR body → Step 6/7',
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
