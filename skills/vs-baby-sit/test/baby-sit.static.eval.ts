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
    expect(SKILL).toContain('[babysit]');
    expect(SKILL).toContain('[ready]');
    expect(SKILL).toMatch(/replace the existing workflow\s+prefix/);
  });
});

describe('vs-baby-sit watcher', () => {
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
