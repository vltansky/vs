#!/usr/bin/env node
// Offline GitHub CLI for the ship-it cost A/B eval. State, the call log, and the
// bare "origin" live under MOCK_GH_DIR in /tmp because the Codex workspace-write
// sandbox blocks writes to the sandbox HOME and to any `.git` directory.
import { execFileSync, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const DIR = process.env.MOCK_GH_DIR;
if (!DIR) { process.stderr.write('mock gh: MOCK_GH_DIR is not set\n'); process.exit(4); }
const STATE = path.join(DIR, 'state.json');
const CI_SECONDS = Number(process.env.MOCK_GH_CI_SECONDS ?? 360);
const REPO = 'acme/shop';
const REMOTE = path.join(DIR, 'remote.git');
fs.mkdirSync(DIR, { recursive: true });

const args = process.argv.slice(2);
fs.appendFileSync(path.join(DIR, 'calls.jsonl'), `${JSON.stringify({ t: Date.now(), args, cwd: process.cwd() })}\n`);

const load = () => (fs.existsSync(STATE) ? JSON.parse(fs.readFileSync(STATE, 'utf8')) : { prs: [] });
const save = (s) => fs.writeFileSync(STATE, JSON.stringify(s, null, 2));
const flag = (name) => {
  const i = args.findIndex((a) => a === name || a.startsWith(`${name}=`));
  if (i < 0) return undefined;
  return args[i].includes('=') ? args[i].slice(name.length + 1) : args[i + 1];
};
const has = (name) => args.includes(name);
const git = (...a) => execFileSync('git', a, { encoding: 'utf8' }).trim();
// The Codex Linux sandbox can refuse to spawn git from this shim (EPERM), so the
// refs the mock needs are read straight from the git directories as a fallback.
const readRef = (gitDir, ref) => {
  const loose = path.join(gitDir, ref);
  if (fs.existsSync(loose)) return fs.readFileSync(loose, 'utf8').trim();
  const packed = path.join(gitDir, 'packed-refs');
  if (!fs.existsSync(packed)) return null;
  const line = fs.readFileSync(packed, 'utf8').split('\n').find((l) => l.endsWith(` ${ref}`));
  return line ? line.split(' ')[0] : null;
};
const remoteSha = (branch) => {
  try { return git('--git-dir', REMOTE, 'rev-parse', `refs/heads/${branch}`); } catch { return readRef(REMOTE, `refs/heads/${branch}`); }
};
const currentBranch = () => {
  try { return git('branch', '--show-current'); } catch {
    const head = fs.readFileSync(path.join(process.env.GIT_DIR ?? '.git', 'HEAD'), 'utf8').trim();
    return head.replace(/^ref: refs\/heads\//, '');
  }
};
const fail = (msg, code = 1) => { process.stderr.write(`${msg}\n`); process.exit(code); };

function out(value) {
  const jq = flag('--jq') ?? flag('-q');
  const text = typeof value === 'string' ? value : JSON.stringify(value);
  if (jq) {
    // Plain .a.b paths are answered here: inside the Codex sandbox a jq child can
    // fail to start or hang, and the skills' own scripts only ask for such paths.
    if (/^(\.[A-Za-z_][\w]*)+$/.test(jq)) {
      const v = jq.slice(1).split('.').reduce((o, k) => (o == null ? o : o[k]), JSON.parse(text));
      process.stdout.write(`${v == null ? 'null' : typeof v === 'object' ? JSON.stringify(v) : v}\n`);
      return;
    }
    const r = spawnSync('jq', ['-r', jq], { input: text, encoding: 'utf8' });
    process.stdout.write(r.stdout);
    if (r.status) fail(r.stderr, r.status);
    return;
  }
  process.stdout.write(typeof value === 'string' ? `${value}\n` : `${JSON.stringify(value, null, 2)}\n`);
}

function ciDone(pr) {
  return (Date.now() - pr.headPushedAt) / 1000 >= CI_SECONDS;
}

function currentPr(state, explicit) {
  if (explicit && /^\d+$/.test(explicit)) return state.prs.find((p) => p.number === Number(explicit));
  const branch = explicit && !explicit.startsWith('-') ? explicit : currentBranch();
  return state.prs.find((p) => p.headRefName === branch);
}

function refresh(state, pr) {
  const sha = remoteSha(pr.headRefName);
  if (sha && sha !== pr.headRefOid) {
    pr.headRefOid = sha;
    pr.headPushedAt = Date.now();
    save(state);
  }
  return pr;
}

function changedFiles(pr) {
  let files = '';
  try { files = git('--git-dir', REMOTE, 'diff', '--name-only', `${pr.baseRefName}...${pr.headRefName}`); } catch { return 1; }
  return files ? files.split('\n').length : 0;
}

function prJson(pr) {
  const done = ciDone(pr);
  return {
    number: pr.number,
    url: `https://github.com/${REPO}/pull/${pr.number}`,
    title: pr.title,
    body: pr.body,
    state: 'OPEN',
    isDraft: pr.isDraft,
    headRefName: pr.headRefName,
    headRefOid: pr.headRefOid,
    baseRefName: pr.baseRefName,
    changedFiles: changedFiles(pr),
    mergeable: 'MERGEABLE',
    reviewDecision: 'REVIEW_REQUIRED',
    author: { login: 'eval-user' },
    statusCheckRollup: [{ __typename: 'CheckRun', name: 'test', status: done ? 'COMPLETED' : 'IN_PROGRESS', conclusion: done ? 'SUCCESS' : '' }],
    reviewRequests: [{ login: 'alice' }],
    labels: [],
    comments: [],
    reviews: [],
  };
}

function pick(obj, fields) {
  if (!fields) return obj;
  return Object.fromEntries(fields.split(',').map((f) => [f, obj[f]]));
}

function checksTable(pr) {
  const done = ciDone(pr);
  return done ? 'test\tpass\t1m12s\thttps://github.com/acme/shop/actions/runs/1' : 'test\tpending\t0\thttps://github.com/acme/shop/actions/runs/1';
}

const [cmd, sub] = args;
const state = load();

if (cmd === '--version') out('gh version 2.80.0 (mock)');
else if (cmd === 'auth') {
  if (sub === 'token') out('gho_mockmockmockmock');
  else process.stderr.write('github.com\n  ✓ Logged in to github.com account eval-user (keyring)\n  - Token scopes: repo, workflow\n');
} else if (cmd === 'repo' && sub === 'view') {
  out(pick({ nameWithOwner: REPO, name: 'shop', owner: { login: 'acme' }, url: `https://github.com/${REPO}`, defaultBranchRef: { name: 'main' }, isPrivate: true, visibility: 'PRIVATE' }, flag('--json')));
} else if (cmd === 'pr' && sub === 'create') {
  const branch = flag('--head') ?? currentBranch();
  const sha = remoteSha(branch);
  if (!sha) fail(`pull request create failed: branch ${branch} is not pushed to origin`);
  if (state.prs.some((p) => p.headRefName === branch)) fail(`a pull request for branch "${branch}" already exists`);
  const bodyFile = flag('--body-file') ?? flag('-F');
  const body = bodyFile ? fs.readFileSync(bodyFile === '-' ? 0 : bodyFile, 'utf8') : flag('--body') ?? flag('-b') ?? '';
  const pr = { number: 101 + state.prs.length, title: flag('--title') ?? flag('-t') ?? branch, body, headRefName: branch, headRefOid: sha, baseRefName: flag('--base') ?? flag('-B') ?? 'main', isDraft: has('--draft') || has('-d'), createdAt: Date.now(), headPushedAt: Date.now() };
  state.prs.push(pr);
  save(state);
  out(`https://github.com/${REPO}/pull/${pr.number}`);
} else if (cmd === 'pr' && ['view', 'checks', 'edit', 'ready', 'list', 'diff', 'comment'].includes(sub)) {
  if (sub === 'list') {
    out(state.prs.map((p) => pick(prJson(refresh(state, p)), flag('--json') ?? 'number,url,title,headRefName')));
  } else {
    const pr = currentPr(state, args[2]);
    if (!pr) fail('no pull requests found for branch');
    refresh(state, pr);
    if (sub === 'view') {
      const json = flag('--json');
      if (json) out(pick(prJson(pr), json));
      else out(`${pr.title} #${pr.number}\nOpen • eval-user wants to merge into ${pr.baseRefName} from ${pr.headRefName}\n\n${pr.body}\n\nView this pull request on GitHub: https://github.com/${REPO}/pull/${pr.number}`);
    } else if (sub === 'edit') {
      const bodyFile = flag('--body-file') ?? flag('-F');
      if (bodyFile) pr.body = fs.readFileSync(bodyFile, 'utf8');
      if (flag('--body')) pr.body = flag('--body');
      if (flag('--title')) pr.title = flag('--title');
      save(state);
      out(`https://github.com/${REPO}/pull/${pr.number}`);
    } else if (sub === 'ready') {
      pr.isDraft = has('--undo');
      save(state);
    } else if (sub === 'diff') {
      out(git('--git-dir', REMOTE, 'diff', `${pr.baseRefName}...${pr.headRefName}`));
    } else if (sub === 'comment') {
      out(`https://github.com/${REPO}/pull/${pr.number}#issuecomment-1`);
    } else if (sub === 'checks') {
      const json = flag('--json');
      const done = () => ciDone(pr);
      if (json) out([{ name: 'test', state: done() ? 'SUCCESS' : 'PENDING', bucket: done() ? 'pass' : 'pending', link: 'https://github.com/acme/shop/actions/runs/1' }]);
      else if (has('--watch')) {
        const interval = Number(flag('--interval') ?? 10) * 1000;
        while (!done()) {
          process.stdout.write(`Refreshing checks status every ${interval / 1000} seconds. Press Ctrl+C to quit.\n\n${checksTable(pr)}\n\n`);
          Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, interval);
        }
        out(`All checks were successful\n${checksTable(pr)}`);
      } else {
        out(checksTable(pr));
        if (!done()) process.exit(8);
      }
    }
  }
} else if (cmd === 'api') {
  const endpoint = args.slice(1).find((a) => !a.startsWith('-') && !/^[a-z_]+=/.test(a) && a !== flag('--jq') && a !== flag('-q') && a !== flag('-X') && a !== flag('--method'));
  const pr = state.prs.at(-1);
  if (pr) refresh(state, pr);
  const ep = (endpoint ?? '').replace(/^\//, '').split('?')[0];
  const method = (flag('-X') ?? flag('--method') ?? 'GET').toUpperCase();
  if (/^https:\/\/uploads\.github\.com\/user-attachments\/assets$/.test(ep)) {
    if (method !== 'POST') fail('gh: Bad Request (HTTP 400)');
    out({ id: Date.now(), name: 'upload', url: `https://github.com/user-attachments/assets/mock-${Date.now()}` });
  } else if (pr && method === 'PATCH' && ep === `repos/${REPO}/pulls/${pr.number}`) {
    const input = flag('--input');
    const payload = input ? JSON.parse(fs.readFileSync(input, 'utf8')) : {};
    if (typeof payload.body === 'string') pr.body = payload.body;
    if (typeof payload.title === 'string') pr.title = payload.title;
    save(state);
    out({ number: pr.number, body: pr.body, title: pr.title });
  } else if (ep === 'graphql') out({ data: { repository: { pullRequest: { reviewDecision: 'REVIEW_REQUIRED', reviewThreads: { nodes: [] } } } } });
  else if (ep === `repos/${REPO}`) out({ id: 987654321, full_name: REPO, default_branch: 'main', private: true });
  else if (ep === 'user') out({ login: 'eval-user' });
  else if (pr && ep === `repos/${REPO}/pulls/${pr.number}`) out({ number: pr.number, state: 'open', merged: false, draft: pr.isDraft, mergeable: true, head: { sha: pr.headRefOid, ref: pr.headRefName }, base: { ref: pr.baseRefName }, requested_reviewers: [{ login: 'alice' }], requested_teams: [], body: pr.body, title: pr.title });
  else if (/^repos\/acme\/shop\/commits\/[^/]+\/check-runs$/.test(ep)) {
    const done = pr && ciDone(pr);
    out({ total_count: 1, check_runs: [{ name: 'test', status: done ? 'completed' : 'in_progress', conclusion: done ? 'success' : null, details_url: 'https://github.com/acme/shop/actions/runs/1' }] });
  } else if (/^repos\/acme\/shop\/commits\/[^/]+\/status$/.test(ep)) out({ state: 'success', statuses: [] });
  else if (/^repos\/acme\/shop\/(deployments|issues\/\d+\/comments|pulls\/\d+\/(reviews|comments)|actions\/runs)$/.test(ep)) out(ep.endsWith('actions/runs') ? { workflow_runs: [] } : []);
  else fail(`gh: Not Found (HTTP 404) [mock: unsupported endpoint ${endpoint}]`);
} else if (cmd === 'run') {
  out(flag('--json') ? [] : 'no runs found');
} else {
  fail(`mock gh: unsupported command: ${args.join(' ')}`);
}
