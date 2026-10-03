#!/usr/bin/env node
// Candidate for the ship-it A/B: run the media gate, create the PR, and verify it
// in one tool call instead of three or four. Staged as vs-ship-it/scripts/publish-pr.mjs
// by the `v6-publish-script` variant; not part of the shipped skill until it wins.
//   node publish-pr.mjs --title <title> --body-file <file> [--base <branch>]
// Exit: 0 verified, 1 gate failed, 2 precondition failed, 3 verification mismatch.
import { execFileSync, spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const args = process.argv.slice(2);
const flag = (name) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
};
const title = flag('--title');
const bodyFile = flag('--body-file');
const run = (cmd, a) => execFileSync(cmd, a, { encoding: 'utf8' }).trim();
const done = (code, result) => {
  process.stdout.write(`${JSON.stringify(result)}\n`);
  process.exit(code);
};

if (!title || !bodyFile) done(2, { ok: false, error: 'usage: publish-pr.mjs --title <title> --body-file <file> [--base <branch>]' });
const base = flag('--base') ?? run('gh', ['repo', 'view', '--json', 'defaultBranchRef', '--jq', '.defaultBranchRef.name']);
const branch = run('git', ['branch', '--show-current']);
if (!branch || ['main', 'master', 'prod', base].includes(branch)) {
  done(2, { ok: false, error: `on "${branch || 'detached HEAD'}": create a feature branch, commit, and push first` });
}
const head = run('git', ['rev-parse', 'HEAD']);
const remote = run('git', ['ls-remote', 'origin', `refs/heads/${branch}`]).split(/\s/)[0];
if (remote !== head) done(2, { ok: false, error: `origin/${branch} is ${remote || 'missing'}, local is ${head}: run git push -u origin HEAD` });

const gate = path.join(path.dirname(fileURLToPath(import.meta.url)), '../../vs-internal-shared/scripts/pr-media-gate.mjs');
const gated = spawnSync('node', [gate, bodyFile, '--base', `origin/${base}`], { encoding: 'utf8' });
if (gated.status !== 0) {
  let report;
  try { report = JSON.parse(gated.stdout); } catch { report = gated.stdout.trim() || gated.stderr.trim(); }
  done(1, { ok: false, error: 'pr-media-gate failed; fix the body and rerun', gateExit: gated.status, gate: report });
}

const existing = spawnSync('gh', ['pr', 'view', branch, '--json', 'number', '--jq', '.number'], { encoding: 'utf8' });
if (existing.status === 0 && existing.stdout.trim()) {
  run('gh', ['pr', 'edit', existing.stdout.trim(), '--title', title, '--body-file', bodyFile]);
} else {
  run('gh', ['pr', 'create', '--title', title, '--body-file', bodyFile, '--base', base, '--head', branch]);
}

const pr = JSON.parse(run('gh', ['pr', 'view', branch, '--json', 'number,url,title,state,isDraft,headRefName,headRefOid,changedFiles']));
const mismatches = [
  pr.state !== 'OPEN' && `state ${pr.state}`,
  pr.isDraft && 'draft',
  pr.headRefName !== branch && `branch ${pr.headRefName}`,
  pr.headRefOid !== head && `head ${pr.headRefOid}`,
].filter(Boolean);
if (mismatches.length) done(3, { ok: false, error: `PR does not match the pushed branch: ${mismatches.join(', ')}`, pr });
done(0, {
  ok: true, number: pr.number, url: pr.url, title: pr.title, head, branch, base,
  changedFiles: pr.changedFiles, walkthrough: pr.changedFiles >= 10 ? 'start' : 'SKIPPED_SMALL_PR',
  // Without this the result reads as a terminal state and agents end the turn here.
  next: 'Not done: print the creation handoff, then load vs-baby-sit and watch this PR in the same turn.',
});
