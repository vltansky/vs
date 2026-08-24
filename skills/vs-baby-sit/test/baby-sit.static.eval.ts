import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { spawnSync } from 'child_process';
import { describe, expect, it } from 'vitest';

const SKILL = fs.readFileSync(path.resolve(__dirname, '..', 'SKILL.md'), 'utf8');
const WATCHER = path.resolve(__dirname, '..', 'scripts', 'watch_pr.py');
const INSPECTOR = path.resolve(__dirname, '..', 'scripts', 'inspect_pr_checks.py');

describe('vs-baby-sit remote-first validation', () => {
  it('pushes a focused fix before broad local validation', () => {
    expect(SKILL).toMatch(/focused regression test pass/);
    expect(SKILL).toMatch(/Push the scoped fix immediately so CI and review start/);
    expect(SKILL).toMatch(/Run broad local validation after the push/);
    expect(SKILL).toMatch(
      /Do not wait for the full root gate, full unit suite, or E2E suite before pushing/,
    );
  });

  it('preserves merge-readiness and repository-policy gates', () => {
    expect(SKILL).toMatch(/not enough to declare merge readiness/);
    expect(SKILL).toMatch(/repository policy\s+requires pre-push validation/);
  });

  it('uses a six-cycle repair budget and asks before extending it', () => {
    expect(SKILL).toMatch(/repair-cycle budget of \*\*6 cycles\*\*/i);
    expect(SKILL).toMatch(/cycle\s+is one attention event[\s\S]{0,280}commit, and push/i);
    expect(SKILL).toMatch(/Do not count watcher polls[\s\S]{0,220}approval-only\s+waiting/i);
    expect(SKILL).toMatch(/When the sixth cycle is spent[\s\S]{0,520}human investigation/i);
    expect(SKILL).toMatch(/approve another bounded batch of 6 repair\s+cycles/i);
    expect(SKILL).toMatch(/Do not silently roll the budget over/i);
    expect(SKILL).toMatch(/No further mutation work is allowed without an explicit user\s+approval/i);
  });

  it('protects the old head during repair and owns the ready-for-review transition', () => {
    expect(SKILL).toContain('gh pr ready --undo');
    expect(SKILL).toMatch(/before.*local repair/is);
    expect(SKILL).toMatch(/old\s+head.*cannot be\s+merged/is);
    expect(SKILL).toMatch(/reason: ready-for-review[\s\S]*gh pr ready/);
    expect(SKILL).toMatch(/verify.*same head SHA.*isDraft.*false/is);
    expect(SKILL).toMatch(/resume the same watcher/i);
  });

  it('uses the same ordering for review and CI fixes', () => {
    expect(SKILL).toMatch(/push immediately after the focused check passes/);
    expect(SKILL).toMatch(/Run broad local validation after the push/);
  });

  it('delegates unchanged waiting to the bundled watcher', () => {
    expect(SKILL).toContain('scripts/watch_pr.py');
    expect(SKILL).toMatch(/one long-running process/);
    expect(SKILL).toMatch(/Do not implement\s+polling with JavaScript `setTimeout`/);
  });

  it('names the busy-wait patterns that replace the watcher', () => {
    expect(SKILL).toMatch(/token bugs rather than alternatives to the watcher/);
    expect(SKILL).toMatch(
      /`gh pr checks <pr> --watch`, in the foreground or in a background\s+terminal/,
    );
    expect(SKILL).toMatch(/A `sleep` loop wrapped around `gh pr view`, `gh pr checks`, or `gh api`/);
    expect(SKILL).toMatch(/second background terminal, subagent, or automation that re-polls GitHub/);
    expect(SKILL).toMatch(/exactly one watcher process/);
  });

  it('keeps every watcher resume cheap', () => {
    expect(SKILL).toMatch(/smallest output budget that still holds one JSONL line/);
    expect(SKILL).toMatch(/hundreds of tokens,\s+not tens of thousands/);
    expect(SKILL).toMatch(/fresh-context watcher/i);
    expect(SKILL).toMatch(/fork_turns=["`]none["`]/);
    expect(SKILL).toMatch(/parent.*wait.*once|wait once.*parent/is);
    expect(SKILL).toMatch(/gpt-5\.6-luna/);
    expect(SKILL).toMatch(/routine lower-cost\s+model or inherit/is);
    expect(SKILL).not.toMatch(/Prefer babysitting\s+in a fresh thread/);
  });

  it('reuses one Codex watcher task across repair cycles', () => {
    expect(SKILL).toMatch(/reuse that same watcher\s+task/i);
    expect(SKILL).toMatch(/exact JSONL line and exit code/i);
    expect(SKILL).toMatch(/Do not create a new watcher task/i);
  });

  it('does not end babysitting on non-terminal attention', () => {
    expect(SKILL).toMatch(/exit `10` ends only the current watcher wait/i);
    expect(SKILL).toMatch(/does not end the babysitting\s+workflow/i);
    expect(SKILL).toMatch(
      /`ci-failure`[\s\S]*`review-feedback`[\s\S]*`ready-for-review`[\s\S]*resume/i,
    );
    expect(SKILL).toMatch(/final response\s+only after[\s\S]*stop condition/i);
  });

  it('routes external CI through an available provider integration', () => {
    expect(SKILL).toMatch(/provider-specific skill or tool/i);
    expect(SKILL).toMatch(/before concluding.*logs.*unavailable/is);
    expect(SKILL).toMatch(/prove.*failure.*belongs to the PR/is);
  });

  it('isolates PR mutations from the configured checkout', () => {
    expect(SKILL).toMatch(/configured checkout.*read-only/is);
    expect(SKILL).toMatch(/temporary isolated\s+worktree/i);
    expect(SKILL).toMatch(/remove only.*worktree.*created/is);
  });

  it('treats a host heartbeat as recovery rather than another poller', () => {
    expect(SKILL).toMatch(/host-provided heartbeat/i);
    expect(SKILL).toMatch(/recovery mechanism.*not.*polling loop/is);
  });

  it('forbids narrating an unchanged wait', () => {
    expect(SKILL).toMatch(/Never send a message whose\s+only content is that nothing changed/);
    expect(SKILL).toMatch(/`CI is still running` are not state changes/);
  });

  it('stops and hands off an approval-only gate with a grounded ping suggestion', () => {
    expect(SKILL).toMatch(/After `reason: review-approval`, stop the watcher/);
    expect(SKILL).toMatch(/Review needed: @<user-or-team>/i);
    expect(SKILL).toMatch(/first login in `approvalCandidates`/);
    expect(SKILL).toMatch(/first slug in `approvalTeams`/);
    expect(SKILL).toMatch(/auto-merge.*do not\s+override this stop/is);
    expect(SKILL).toMatch(/Do not send interim `still waiting` updates/);
    expect(SKILL).toMatch(/Never invent an owner/);
    expect(SKILL).toMatch(/Never\s+.*send the ping automatically/);
  });

  it('reflects babysitting state in the host thread title when supported', () => {
    expect(SKILL).toContain('set_thread_title');
    expect(SKILL).toContain('[babysit]');
    expect(SKILL).toContain('[ready]');
    expect(SKILL).toMatch(/replace the existing workflow\s+prefix/);
    expect(SKILL).toMatch(/preserve the rest of the current title verbatim/i);
    expect(SKILL).toMatch(/Never rename a thread to the prefix alone/);
    expect(SKILL).toMatch(/If the current title\s+cannot\s+be read.*skip renaming/s);
    expect(SKILL).toMatch(/Re-read the live title immediately before every rename/);
    expect(SKILL).not.toMatch(/`PR #<N> — <PR title>`/);
  });

  it('sends a newly available PR preview deployment', () => {
    expect(SKILL).toMatch(/preview deployment/i);
    expect(SKILL).toMatch(/send each new direct preview URL once/i);
    expect(SKILL).toMatch(/do not send .*dashboard.*log URL/i);
  });

  it('validates generic PR preview candidates without provider-specific rules', () => {
    expect(SKILL).toContain('previewCandidates');
    expect(SKILL).toMatch(/treat .*candidate.*untrusted/i);
    expect(SKILL).toMatch(/send only .*working app URL/i);
    expect(SKILL).toMatch(/current PR head/i);
    expect(SKILL).toMatch(/do not encode provider-specific\s+URL rewrites/i);
  });
});

describe('vs-baby-sit watcher', () => {
  it('emits provider-neutral preview candidates from PR comments for validation', () => {
    const fakeBin = fs.mkdtempSync(path.join(os.tmpdir(), 'baby-sit-candidate-gh-'));
    const fakeGh = path.join(fakeBin, 'gh');
    fs.writeFileSync(
      fakeGh,
      `#!/bin/sh
case "$*" in
  *"pulls/42"*) echo '{"state":"open","merged":false,"mergeable":true,"head":{"sha":"abc123"}}' ;;
  *"check-runs"*) echo '{"check_runs":[{"name":"Build","status":"completed","conclusion":"success"}]}' ;;
  *"commits/abc123/status"*) echo '{"state":"success","statuses":[]}' ;;
  *"deployments?sha=abc123"*) echo '[]' ;;
  *"issues/42/comments"*) printf '%s\\n' '[{"user":{"type":"Bot"},"body":"<a href=&quot;https://ci.example/build/42/previews&quot;>Preview report</a>\\n| app | preview url | [Open app](https://app.example/review/42?build=abc123)\\n[Docs](https://docs.example/preview-guide)"},{"user":{"type":"User"},"body":"Preview: [Open app](https://untrusted.example/credential-capture)"}]' ;;
  *"api graphql"*) echo '{"data":{"repository":{"pullRequest":{"reviewDecision":"APPROVED","reviewThreads":{"nodes":[]}}}}}' ;;
  *) exit 1 ;;
esac
`,
      { mode: 0o755 },
    );

    const result = spawnSync(
      'python3',
      [WATCHER, '--repo', 'owner/repo', '--pr', '42', '--max-polls', '1'],
      {
        encoding: 'utf8',
        env: { ...process.env, PATH: `${fakeBin}:${process.env.PATH}` },
      },
    );
    fs.rmSync(fakeBin, { recursive: true });

    expect(result.status, result.stderr).toBe(0);
    expect(JSON.parse(result.stdout).snapshot.previewCandidates).toEqual([
      'https://ci.example/build/42/previews',
      'https://app.example/review/42?build=abc123',
    ]);
    expect(result.stdout).not.toContain('https://docs.example/preview-guide');
    expect(result.stdout).not.toContain('https://untrusted.example/credential-capture');
  });

  it('emits a successful deployment environment URL for the current PR head', () => {
    const fakeBin = fs.mkdtempSync(path.join(os.tmpdir(), 'baby-sit-preview-gh-'));
    const fakeGh = path.join(fakeBin, 'gh');
    fs.writeFileSync(
      fakeGh,
      `#!/bin/sh
case "$*" in
  *"pulls/42"*) echo '{"state":"open","merged":false,"mergeable":true,"head":{"sha":"abc123"}}' ;;
  *"check-runs"*) echo '{"check_runs":[{"name":"Deploy Preview","status":"completed","conclusion":"success","details_url":"https://provider.example/logs"}]}' ;;
  *"commits/abc123/status"*) echo '{"state":"success","statuses":[]}' ;;
  *"deployments?sha=abc123"*) echo '[{"environment":"Production","production_environment":true,"statuses_url":"https://api.github.com/repos/owner/repo/deployments/8/statuses"},{"environment":"pr-42","transient_environment":false,"production_environment":false,"statuses_url":"https://api.github.com/repos/owner/repo/deployments/7/statuses"}]' ;;
  "api repos/owner/repo/deployments/7/statuses") echo '[{"state":"success","environment_url":"https://preview.example/pr-42"}]' ;;
  "api repos/owner/repo/deployments/8/statuses") echo '[{"state":"success","environment_url":"https://production.example"}]' ;;
  *"api graphql"*) echo '{"data":{"repository":{"pullRequest":{"reviewDecision":"APPROVED","reviewThreads":{"nodes":[]}}}}}' ;;
  *) exit 1 ;;
esac
`,
      { mode: 0o755 },
    );

    const result = spawnSync(
      'python3',
      [WATCHER, '--repo', 'owner/repo', '--pr', '42', '--max-polls', '1'],
      {
        encoding: 'utf8',
        env: { ...process.env, PATH: `${fakeBin}:${process.env.PATH}` },
      },
    );
    fs.rmSync(fakeBin, { recursive: true });

    expect(result.status).toBe(0);
    expect(JSON.parse(result.stdout).snapshot.previewUrls).toEqual([
      'https://preview.example/pr-42',
    ]);
    expect(result.stdout).not.toContain('https://provider.example/logs');
    expect(result.stdout).not.toContain('https://production.example');
  });

  it('does not surface an older success when the latest preview status is pending', () => {
    const code = `
import importlib.util
import subprocess
import sys
spec = importlib.util.spec_from_file_location("watch_pr", sys.argv[1])
watcher = importlib.util.module_from_spec(spec)
spec.loader.exec_module(watcher)
responses = iter([
    [{"environment": "Preview", "statuses_url": "repos/owner/repo/deployments/7/statuses"}],
    [
        {"state": "pending", "environment_url": "https://preview.example/new"},
        {"state": "success", "environment_url": "https://preview.example/old"},
    ],
])
watcher.gh_json = lambda *args, **kwargs: next(responses)
print(watcher.fetch_preview_urls("owner/repo", "abc123"))
`;
    const result = spawnSync('python3', ['-c', code, WATCHER], {
      encoding: 'utf8',
      env: { ...process.env, PYTHONDONTWRITEBYTECODE: '1' },
    });

    expect(result.status).toBe(0);
    expect(result.stdout.trim()).toBe('[]');
  });

  it('emits nothing when repeated polls observe no change', () => {
    const fixturePath = path.join(os.tmpdir(), `baby-sit-${process.pid}.jsonl`);
    const snapshot = {
      state: 'open',
      merged: false,
      headSha: 'abc123',
      mergeable: true,
      reviewDecision: 'APPROVED',
      unresolvedThreads: 0,
      ciState: 'PENDING',
      failures: [],
    };
    fs.writeFileSync(
      fixturePath,
      `${JSON.stringify(snapshot)}\n${JSON.stringify(snapshot)}\n${JSON.stringify(snapshot)}\n`,
    );

    const result = spawnSync(
      'python3',
      [WATCHER, '--replay', fixturePath, '--until', 'merged'],
      { encoding: 'utf8' },
    );
    fs.unlinkSync(fixturePath);

    expect(result.status).toBe(0);
    expect(result.stderr).toBe('');
    expect(result.stdout.trim().split('\n')).toEqual([
      JSON.stringify({ event: 'baseline', snapshot }),
    ]);
  });

  it('emits one terminal event and stops when the PR becomes merge-ready', () => {
    const fixturePath = path.join(os.tmpdir(), `baby-sit-ready-${process.pid}.jsonl`);
    const pending = {
      state: 'open',
      merged: false,
      headSha: 'abc123',
      mergeable: true,
      reviewDecision: 'APPROVED',
      unresolvedThreads: 0,
      ciState: 'PENDING',
      failures: [],
    };
    const ready = { ...pending, ciState: 'SUCCESS' };
    fs.writeFileSync(
      fixturePath,
      `${JSON.stringify(pending)}\n${JSON.stringify(ready)}\n${JSON.stringify(ready)}\n`,
    );

    const result = spawnSync(
      'python3',
      [WATCHER, '--replay', fixturePath, '--until', 'merge-ready'],
      { encoding: 'utf8' },
    );
    fs.unlinkSync(fixturePath);

    expect(result.status).toBe(0);
    expect(result.stdout.trim().split('\n')).toEqual([
      JSON.stringify({ event: 'baseline', snapshot: pending }),
      JSON.stringify({ event: 'terminal', reason: 'merge-ready', snapshot: ready }),
    ]);
  });

  it('requires a green draft to become ready for review before merge-ready', () => {
    const fixturePath = path.join(os.tmpdir(), `baby-sit-draft-${process.pid}.jsonl`);
    const draft = {
      state: 'open',
      merged: false,
      draft: true,
      headSha: 'abc123',
      mergeable: true,
      reviewDecision: 'REVIEW_REQUIRED',
      unresolvedThreads: 0,
      ciState: 'SUCCESS',
      failures: [],
    };
    fs.writeFileSync(fixturePath, `${JSON.stringify(draft)}\n`);

    const result = spawnSync(
      'python3',
      [WATCHER, '--replay', fixturePath, '--until', 'merge-ready'],
      { encoding: 'utf8' },
    );
    fs.unlinkSync(fixturePath);

    expect(result.status).toBe(10);
    expect(result.stdout.trim()).toBe(
      JSON.stringify({ event: 'attention', reason: 'ready-for-review', snapshot: draft }),
    );
  });

  it('polls GitHub inside one process without emitting unchanged snapshots', () => {
    const fakeBin = fs.mkdtempSync(path.join(os.tmpdir(), 'baby-sit-gh-'));
    const fakeGh = path.join(fakeBin, 'gh');
    fs.writeFileSync(
      fakeGh,
      `#!/bin/sh
case "$*" in
  *"pulls/42"*) echo '{"state":"open","merged":false,"mergeable":true,"head":{"sha":"abc123"}}' ;;
  *"check-runs"*) echo '{"check_runs":[{"name":"test","status":"in_progress","conclusion":null}]}' ;;
  *"commits/abc123/status"*) echo '{"state":"pending","statuses":[]}' ;;
  *"api graphql"*) echo '{"data":{"repository":{"pullRequest":{"reviewDecision":"APPROVED","reviewThreads":{"nodes":[]}}}}}' ;;
  *) exit 1 ;;
esac
`,
      { mode: 0o755 },
    );

    const result = spawnSync(
      'python3',
      [
        WATCHER,
        '--repo',
        'owner/repo',
        '--pr',
        '42',
        '--until',
        'merged',
        '--interval',
        '0',
        '--max-polls',
        '3',
      ],
      {
        encoding: 'utf8',
        env: { ...process.env, PATH: `${fakeBin}:${process.env.PATH}` },
      },
    );
    fs.rmSync(fakeBin, { recursive: true });

    expect(result.status).toBe(0);
    expect(result.stderr).toBe('');
    expect(result.stdout.trim().split('\n')).toEqual([
      JSON.stringify({
        event: 'baseline',
        snapshot: {
          state: 'open',
          merged: false,
          draft: false,
          headSha: 'abc123',
          mergeable: true,
          reviewDecision: 'APPROVED',
          unresolvedThreads: 0,
          ciState: 'PENDING',
          failures: [],
        },
      }),
    ]);
  });

  it('survives a transient GitHub API failure before the baseline snapshot', () => {
    const fakeBin = fs.mkdtempSync(path.join(os.tmpdir(), 'baby-sit-retry-gh-'));
    const fakeGh = path.join(fakeBin, 'gh');
    const failOnceState = path.join(fakeBin, 'failed-once');
    fs.writeFileSync(
      fakeGh,
      `#!/bin/sh
case "$*" in
  *"pulls/42"*)
    if [ ! -f "$FAIL_ONCE_STATE" ]; then
      : > "$FAIL_ONCE_STATE"
      echo 'temporary GitHub API failure' >&2
      exit 1
    fi
    echo '{"state":"open","merged":false,"mergeable":true,"head":{"sha":"abc123"}}'
    ;;
  *"check-runs"*) echo '{"check_runs":[{"name":"test","status":"in_progress","conclusion":null}]}' ;;
  *"commits/abc123/status"*) echo '{"state":"pending","statuses":[]}' ;;
  *"deployments?sha=abc123"*) echo '[]' ;;
  *"issues/42/comments"*) echo '[]' ;;
  *"api graphql"*) echo '{"data":{"repository":{"pullRequest":{"reviewDecision":"APPROVED","reviewThreads":{"nodes":[]}}}}}' ;;
  *) exit 1 ;;
esac
`,
      { mode: 0o755 },
    );

    const result = spawnSync(
      'python3',
      [WATCHER, '--repo', 'owner/repo', '--pr', '42', '--max-polls', '1'],
      {
        encoding: 'utf8',
        env: {
          ...process.env,
          FAIL_ONCE_STATE: failOnceState,
          PATH: `${fakeBin}:${process.env.PATH}`,
        },
      },
    );
    fs.rmSync(fakeBin, { recursive: true });

    expect(result.status, result.stderr).toBe(0);
    expect(result.stderr).toBe('');
    expect(JSON.parse(result.stdout)).toMatchObject({
      event: 'baseline',
      snapshot: { headSha: 'abc123', ciState: 'PENDING' },
    });
  });

  it('stops with an attention event when CI fails', () => {
    const fixturePath = path.join(os.tmpdir(), `baby-sit-failure-${process.pid}.jsonl`);
    const snapshot = {
      state: 'open',
      merged: false,
      headSha: 'abc123',
      mergeable: true,
      reviewDecision: 'APPROVED',
      unresolvedThreads: 0,
      ciState: 'FAILURE',
      failures: [{ name: 'test', conclusion: 'failure' }],
    };
    fs.writeFileSync(fixturePath, `${JSON.stringify(snapshot)}\n`);

    const result = spawnSync(
      'python3',
      [WATCHER, '--replay', fixturePath, '--until', 'merged'],
      { encoding: 'utf8' },
    );
    fs.unlinkSync(fixturePath);

    expect(result.status).toBe(10);
    expect(result.stdout.trim()).toBe(
      JSON.stringify({ event: 'attention', reason: 'ci-failure', snapshot }),
    );
  });

  it('treats a repository with no CI or approval rule as merge-ready', () => {
    const fixturePath = path.join(os.tmpdir(), `baby-sit-no-gates-${process.pid}.jsonl`);
    const snapshot = {
      state: 'open',
      merged: false,
      headSha: 'abc123',
      mergeable: true,
      reviewDecision: null,
      unresolvedThreads: 0,
      ciState: 'NONE',
      failures: [],
    };
    fs.writeFileSync(fixturePath, `${JSON.stringify(snapshot)}\n`);

    const result = spawnSync(
      'python3',
      [WATCHER, '--replay', fixturePath, '--until', 'merge-ready'],
      { encoding: 'utf8' },
    );
    fs.unlinkSync(fixturePath);

    expect(result.status).toBe(0);
    expect(result.stdout.trim()).toBe(
      JSON.stringify({ event: 'terminal', reason: 'merge-ready', snapshot }),
    );
  });

  it('stops with an approval attention event instead of hanging', () => {
    const fixturePath = path.join(os.tmpdir(), `baby-sit-review-required-${process.pid}.jsonl`);
    const snapshot = {
      state: 'open',
      merged: false,
      headSha: 'abc123',
      mergeable: true,
      reviewDecision: 'REVIEW_REQUIRED',
      unresolvedThreads: 0,
      ciState: 'SUCCESS',
      failures: [],
    };
    fs.writeFileSync(fixturePath, `${JSON.stringify(snapshot)}\n`);

    const result = spawnSync(
      'python3',
      [WATCHER, '--replay', fixturePath, '--until', 'merge-ready'],
      { encoding: 'utf8' },
    );
    fs.unlinkSync(fixturePath);

    expect(result.status).toBe(10);
    expect(result.stdout.trim()).toBe(
      JSON.stringify({ event: 'attention', reason: 'review-approval', snapshot }),
    );
  });

  it('suggests requested reviewers before prior approvers for an approval gate', () => {
    const code = `
import importlib.util
import sys
spec = importlib.util.spec_from_file_location("watch_pr", sys.argv[1])
watcher = importlib.util.module_from_spec(spec)
spec.loader.exec_module(watcher)
watcher.gh_json = lambda *args, **kwargs: [
    {"state": "APPROVED", "user": {"login": "prior-approver"}},
    {"state": "COMMENTED", "user": {"login": "commenter"}},
]
pull = {"requested_reviewers": [{"login": "requested-reviewer"}]}
print(watcher.fetch_approval_candidates("owner/repo", 42, pull))
`;
    const result = spawnSync('python3', ['-c', code, WATCHER], {
      encoding: 'utf8',
      env: { ...process.env, PYTHONDONTWRITEBYTECODE: '1' },
    });

    expect(result.status).toBe(0);
    expect(result.stdout.trim()).toBe("['requested-reviewer', 'prior-approver']");
  });

  it('surfaces requested review teams for an approval gate', () => {
    const code = `
import importlib.util
import sys
spec = importlib.util.spec_from_file_location("watch_pr", sys.argv[1])
watcher = importlib.util.module_from_spec(spec)
spec.loader.exec_module(watcher)
pull = {"requested_teams": [{"slug": "platform-reviewers"}, {"slug": "platform-reviewers"}]}
print(watcher.fetch_approval_teams(pull))
`;
    const result = spawnSync('python3', ['-c', code, WATCHER], {
      encoding: 'utf8',
      env: { ...process.env, PYTHONDONTWRITEBYTECODE: '1' },
    });

    expect(result.status).toBe(0);
    expect(result.stdout.trim()).toBe("['platform-reviewers']");
  });

  it('wakes with review-feedback once a reviewer bot posts findings', () => {
    const fixturePath = path.join(os.tmpdir(), `baby-sit-reviewer-${process.pid}.jsonl`);
    const pending = {
      state: 'open',
      merged: false,
      headSha: 'abc123',
      mergeable: true,
      reviewDecision: 'REVIEW_REQUIRED',
      unresolvedThreads: 0,
      ciState: 'PENDING',
      failures: [],
    };
    const findings = { ...pending, ciState: 'SUCCESS', unresolvedThreads: 2 };
    fs.writeFileSync(
      fixturePath,
      `${JSON.stringify(pending)}\n${JSON.stringify(findings)}\n`,
    );

    const result = spawnSync(
      'python3',
      [WATCHER, '--replay', fixturePath, '--until', 'merge-ready'],
      { encoding: 'utf8' },
    );
    fs.unlinkSync(fixturePath);

    expect(result.status).toBe(10);
    expect(result.stdout.trim().split('\n')).toEqual([
      JSON.stringify({ event: 'baseline', snapshot: pending }),
      JSON.stringify({
        event: 'attention',
        reason: 'review-feedback',
        snapshot: findings,
      }),
    ]);
  });

  it('does not treat a reviewer bot NEUTRAL conclusion as a failure', () => {
    const code = `
import importlib.util
import sys
spec = importlib.util.spec_from_file_location("watch_pr", sys.argv[1])
watcher = importlib.util.module_from_spec(spec)
spec.loader.exec_module(watcher)
combined = {"state": "success", "statuses": []}
for conclusion in ("neutral", "skipped"):
    checks = {"check_runs": [{"name": "Repo Review (Codex)", "status": "completed", "conclusion": conclusion}]}
    print(watcher.ci_state(checks, combined)[0])
`;
    const result = spawnSync('python3', ['-c', code, WATCHER], {
      encoding: 'utf8',
      env: { ...process.env, PYTHONDONTWRITEBYTECODE: '1' },
    });

    expect(result.status).toBe(0);
    expect(result.stdout.trim().split('\n')).toEqual(['SUCCESS', 'SUCCESS']);
  });

  it('classifies every unsuccessful terminal check conclusion as failure', () => {
    const code = `
import importlib.util
import sys
def load(name, path):
    spec = importlib.util.spec_from_file_location(name, path)
    module = importlib.util.module_from_spec(spec)
    sys.modules[name] = module
    spec.loader.exec_module(module)
    return module
watcher = load("watch_pr", sys.argv[1])
inspector = load("inspect_pr_checks", sys.argv[2])
for conclusion in ("action_required", "startup_failure", "stale"):
    checks = {"check_runs": [{"name": "test", "status": "completed", "conclusion": conclusion}]}
    print(watcher.ci_state(checks, {"state": "success", "statuses": []})[0])
    print(inspector.is_failure({"state": "COMPLETED", "conclusion": conclusion}))
`;
    const result = spawnSync('python3', ['-c', code, WATCHER, INSPECTOR], {
      encoding: 'utf8',
      env: { ...process.env, PYTHONDONTWRITEBYTECODE: '1' },
    });

    expect(result.status).toBe(0);
    expect(result.stdout.trim().split('\n')).toEqual([
      'FAILURE',
      'True',
      'FAILURE',
      'True',
      'FAILURE',
      'True',
    ]);
  });
});
