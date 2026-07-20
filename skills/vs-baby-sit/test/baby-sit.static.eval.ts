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

  it('uses the same ordering for review and CI fixes', () => {
    expect(SKILL).toMatch(/push immediately after the focused check passes/);
    expect(SKILL).toMatch(/Run broad local validation after the push/);
  });

  it('delegates unchanged waiting to the bundled watcher', () => {
    expect(SKILL).toContain('scripts/watch_pr.py');
    expect(SKILL).toMatch(/one long-running process/);
    expect(SKILL).toMatch(/Do not implement\s+polling with JavaScript `setTimeout`/);
  });

  it('reflects babysitting state in the host thread title when supported', () => {
    expect(SKILL).toContain('set_thread_title');
    expect(SKILL).toMatch(/At startup, rename it to `\[babysit\]`\./);
    expect(SKILL).toMatch(/terminal event, rename it to\s+`\[ready\]`\./);
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
watcher.gh_json = lambda *args: next(responses)
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

  it('does not declare merge-ready while an approval is required', () => {
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

    expect(result.status).toBe(0);
    expect(result.stdout.trim()).toBe(
      JSON.stringify({ event: 'baseline', snapshot }),
    );
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
