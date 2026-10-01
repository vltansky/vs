#!/usr/bin/env node
// Upload a local file to GitHub's user-attachments CDN (same surface as drag-and-drop).
//
//   node upload-github-attachment.mjs <file> [--repo owner/name] [--name filename] [--content-type mime]
//
// Resolves repository_id via `gh api repos/{owner}/{repo}`, POSTs to
// uploads.github.com/user-attachments/assets, prints the returned URL on stdout.
//
// Quirk: the asset URL returns HTTP 404 until it is referenced at least once in a
// PR/issue body (or comment). Embed it in the PR body before treating a 404 as failure.
//
// Exit: 0 printed URL; 2 usage / auth / upload failure.
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const fail = (message) => {
  process.stderr.write(`upload-github-attachment: ${message}\n`);
  process.exit(2);
};

const args = process.argv.slice(2);
const fileArg = args.find((a) => !a.startsWith('--'));
const repoIdx = args.indexOf('--repo');
const nameIdx = args.indexOf('--name');
const typeIdx = args.indexOf('--content-type');

if (!fileArg) {
  fail(
    'Usage: upload-github-attachment.mjs <file> [--repo owner/name] [--name filename] [--content-type mime]\n' +
      'Needs `gh` authenticated with push access to the repository.',
  );
}

const abs = path.resolve(fileArg);
if (!fs.existsSync(abs) || !fs.statSync(abs).isFile()) fail(`File not found: ${abs}`);

const guessMime = (file) => {
  const ext = path.extname(file).toLowerCase();
  return (
    {
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.webp': 'image/webp',
      '.gif': 'image/gif',
      '.svg': 'image/svg+xml',
      '.mp4': 'video/mp4',
      '.webm': 'video/webm',
      '.mov': 'video/quicktime',
    }[ext] || 'application/octet-stream'
  );
};

const displayName = nameIdx === -1 ? path.basename(abs) : String(args[nameIdx + 1] ?? path.basename(abs));
const contentType =
  typeIdx === -1 ? guessMime(displayName) : String(args[typeIdx + 1] ?? guessMime(displayName));

const resolveRepo = () => {
  if (repoIdx !== -1) return String(args[repoIdx + 1] ?? '');
  const r = spawnSync('gh', ['repo', 'view', '--json', 'nameWithOwner', '-q', '.nameWithOwner'], {
    encoding: 'utf8',
  });
  if (r.status !== 0) fail(`Could not resolve repo (pass --repo owner/name): ${r.stderr || r.stdout}`);
  return r.stdout.trim();
};

const repo = resolveRepo();
if (!/^[^/]+\/[^/]+$/.test(repo)) fail(`Bad --repo value: ${repo}`);

const idRun = spawnSync('gh', ['api', `repos/${repo}`, '--jq', '.id'], { encoding: 'utf8' });
if (idRun.status !== 0) fail(`Could not resolve repository_id for ${repo}: ${idRun.stderr || idRun.stdout}`);
const repositoryId = idRun.stdout.trim();
if (!/^\d+$/.test(repositoryId)) fail(`Unexpected repository id: ${repositoryId}`);

const tokenRun = spawnSync('gh', ['auth', 'token'], { encoding: 'utf8' });
if (tokenRun.status !== 0 || !tokenRun.stdout.trim()) fail('gh auth token failed; run gh auth login.');
const token = tokenRun.stdout.trim();

const qs = new URLSearchParams({
  name: displayName,
  content_type: contentType,
  repository_id: repositoryId,
});
const url = `https://uploads.github.com/user-attachments/assets?${qs.toString()}`;

const curl = spawnSync(
  'curl',
  [
    '-sS',
    '--fail-with-body',
    url,
    '-X',
    'POST',
    '-H',
    `Authorization: Bearer ${token}`,
    '-H',
    'Accept: application/json',
    '--data-binary',
    `@${abs}`,
  ],
  { encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 },
);

if (curl.status !== 0) {
  fail(`Upload failed (HTTP/curl): ${curl.stderr || curl.stdout || `exit ${curl.status}`}`);
}

let payload;
try {
  payload = JSON.parse(curl.stdout);
} catch {
  fail(`Upload response was not JSON: ${curl.stdout.slice(0, 200)}`);
}
if (!payload?.url || typeof payload.url !== 'string') {
  fail(`Upload response missing url: ${curl.stdout.slice(0, 200)}`);
}

process.stdout.write(`${payload.url}\n`);
process.stderr.write(
  'upload-github-attachment: note — asset URL 404s until referenced once in a PR/issue body.\n',
);
