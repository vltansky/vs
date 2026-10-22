import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const WATCHER = path.resolve(__dirname, '..', 'scripts', 'watch_pr.py');
const R = 'acme/shop';
const SHA = 'm1';
const MERGED = '2026-10-01T10:00:00Z';

// Loads watch_pr.py with gh_json replaced by a fake: endpoint -> JSON, missing -> CalledProcessError.
const HARNESS = String.raw`
import importlib.util, json, subprocess, sys
spec = importlib.util.spec_from_file_location("watch_pr", sys.argv[1])
w = importlib.util.module_from_spec(spec); spec.loader.exec_module(w)
fake = json.loads(sys.argv[2]); call = json.loads(sys.argv[3])
def gh_json(*args, attempts=3):
    key = args[-1]
    if key not in fake: raise subprocess.CalledProcessError(1, "gh")
    return fake[key]
w.gh_json = gh_json
if call["fn"] == "deploy":
    out = w.fetch_production_deploy(call["repo"], call["sha"], call.get("mergedAt"))
elif call["fn"] == "discover":
    out = w.discover_deploy(call["repo"])
else:
    w.fetch_snapshot = lambda *a, **k: {"state": "closed", "merged": True, "deploy": dict(call["deploy"])}
    out = next(iter(w.poll_github(call["repo"], 1, 0, 0, 1, "deployed", 0)))["deploy"]
print(json.dumps(out))
`;

function call(fake: Record<string, unknown>, c: Record<string, unknown>) {
  const r = spawnSync('python3', ['-c', HARNESS, WATCHER, JSON.stringify(fake), JSON.stringify({ repo: R, sha: SHA, mergedAt: MERGED, ...c })], { encoding: 'utf8' });
  if (r.status !== 0) throw new Error(r.stderr);
  return JSON.parse(r.stdout);
}

const run = (name: string, p: string, status: string, conclusion: string | null, created = '2026-10-01T10:05:00Z') =>
  ({ name, path: `.github/workflows/${p}`, status, conclusion, created_at: created, updated_at: created, html_url: `https://x/${p}` });
const runs = (...r: object[]) => ({ [`repos/${R}/actions/runs?head_sha=${SHA}&per_page=100`]: { workflow_runs: r } });
const dep = (id: number, environment: string, sha: string, created = '2026-10-01T10:10:00Z', extra = {}) =>
  ({ id, environment, sha, created_at: created, statuses_url: `https://api.github.com/repos/${R}/deployments/${id}/statuses`, ...extra });
const statuses = (id: number, list: object[]) => ({ [`repos/${R}/deployments/${id}/statuses`]: list });

describe('fetch_production_deploy', () => {
  it('ignores a cancelled or superseded deploy run instead of failing', () => {
    expect(call(runs(run('Deploy', 'deploy.yml', 'completed', 'cancelled')), { fn: 'deploy' }).state).toBe('none');
    const out = call(runs(
      run('Deploy', 'deploy.yml', 'completed', 'success', '2026-10-01T10:05:00Z'),
      run('Deploy', 'deploy.yml', 'completed', 'cancelled', '2026-10-01T10:09:00Z'),
    ), { fn: 'deploy' });
    expect(out.state).toBe('success');
  });

  it('does not count Release Drafter or docs publishing as a production deploy', () => {
    expect(call(runs(run('Release Drafter', 'release-drafter.yml', 'completed', 'success')), { fn: 'deploy' }).state).toBe('none');
    const out = call(runs(
      run('Deploy to production', 'deploy.yml', 'completed', 'success'),
      run('Publish docs', 'docs.yml', 'completed', 'failure'),
    ), { fn: 'deploy' });
    expect(out.state).toBe('success');
    expect(out.runs).toHaveLength(1);
  });

  it('still fails when a real production deploy workflow fails', () => {
    const out = call(runs(
      run('Deploy app', 'deploy.yml', 'completed', 'success'),
      run('Deploy functions', 'deploy-functions.yml', 'completed', 'failure'),
    ), { fn: 'deploy' });
    expect(out.state).toBe('failure');
  });

  it('treats a production deployment with no statuses as pending, then stalled after the wait', () => {
    const fake = { [`repos/${R}/deployments?sha=${SHA}&per_page=100`]: [dep(7, 'production', SHA)], ...statuses(7, []) };
    expect(call(fake, { fn: 'deploy' }).state).toBe('pending');
    expect(call({}, { fn: 'poll', deploy: { state: 'pending' } }).state).toBe('stalled');
    expect(call({}, { fn: 'poll', deploy: { state: 'none' } }).state).toBe('timeout');
  });

  it('counts an inactive (superseded) production deployment as deployed', () => {
    const fake = { [`repos/${R}/deployments?sha=${SHA}&per_page=100`]: [dep(8, 'production', SHA)], ...statuses(8, [{ state: 'inactive', created_at: 't' }]) };
    expect(call(fake, { fn: 'deploy' }).state).toBe('success');
  });

  it('pages past 100 newer non-production deployments to a later production deploy that contains the merge', () => {
    const page1 = Array.from({ length: 100 }, (_, i) => dep(100 + i, 'preview', `p${i}`, '2026-10-01T12:00:00Z'));
    const fake = {
      [`repos/${R}/deployments?sha=${SHA}&per_page=100`]: [],
      [`repos/${R}/deployments?per_page=100&page=1`]: page1,
      [`repos/${R}/deployments?per_page=100&page=2`]: [dep(9, 'production', 'later', '2026-10-01T11:00:00Z')],
      [`repos/${R}/compare/${SHA}...later`]: { status: 'ahead' },
      ...statuses(9, [{ state: 'success', created_at: 't', environment_url: 'https://shop.example' }]),
    };
    const out = call(fake, { fn: 'deploy' });
    expect(out).toMatchObject({ state: 'success', source: 'deployment', url: 'https://shop.example' });
  });
});

describe('discover_deploy uses the same definition', () => {
  it('finds production environments and deploy workflows, not drafter or docs', () => {
    const fake = {
      [`repos/${R}/environments`]: { environments: [{ name: 'production' }, { name: 'staging' }] },
      [`repos/${R}/actions/workflows?per_page=100`]: { workflows: [
        { name: 'Deploy', path: '.github/workflows/deploy.yml', state: 'active' },
        { name: 'Release Drafter', path: '.github/workflows/release-drafter.yml', state: 'active' },
        { name: 'Publish docs', path: '.github/workflows/docs.yml', state: 'active' },
      ] },
    };
    expect(call(fake, { fn: 'discover' })).toEqual({
      signal: true, environments: ['production'], workflows: [{ name: 'Deploy', path: '.github/workflows/deploy.yml' }],
    });
    expect(call({}, { fn: 'discover' }).signal).toBe(false);
  });
});
