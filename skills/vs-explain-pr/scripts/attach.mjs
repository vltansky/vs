#!/usr/bin/env node
// Adds the finished video to an open PR without touching the rest of its body:
//
//   node attach.mjs --repo <owner/name> --pr <N> --sha <head sha> --video <final.mp4>
//                   --base origin/<base> [--gate "<pr-media-gate flags>"]
//                   [--reviewed] [--words-unchecked] [--url <already uploaded url>] [--dry-run]
//
// 1. Uploads the mp4 to GitHub's user-attachments CDN (same host as drag and
//    drop) through `gh api`, unless --url names an upload already made.
// 2. Reads the PR's current body over REST, then replaces only the
//    <!-- vs:video --> ... <!-- /vs:video --> block, or inserts it before the
//    Walkthrough. Everything else stays byte for byte, so a babysit refresh
//    made meanwhile survives.
// 3. Runs pr-media-gate.mjs on the new body (the gate ignores the block's
//    video), and PATCHes the body over REST only when the gate exits 0. Just
//    before the PATCH it reads the body again; when someone changed it, it
//    rebuilds from the newer body once.
// Never `gh pr edit`, never a whole-body rewrite from a stale copy.
//
// Exit codes: 0 attached (or --dry-run wrote the new body); 1 the gate refused
// the new body or the PR changed twice; 2 blocked (missing input, upload or gh failure).
import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { probeDuration } from '../../vs-explain-video/scripts/media.mjs';
import { MAX_BYTES, upsertVideoBlock, videoBlock } from './pr-video.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const GATE = path.resolve(here, '..', '..', 'vs-internal-shared', 'scripts', 'pr-media-gate.mjs');
const args = process.argv.slice(2);
const opt = (name) => (args.includes(name) ? args[args.indexOf(name) + 1] : null);
const has = (name) => args.includes(name);
const blocked = (message) => {
  process.stdout.write(`${JSON.stringify({ status: 'BLOCKED', next: message }, null, 2)}\n`);
  process.exit(2);
};
const repo = opt('--repo');
const pr = opt('--pr');
const sha = opt('--sha');
const video = opt('--video') && path.resolve(opt('--video'));
const base = opt('--base');
if (!repo || !pr || !sha || !video || !base) blocked('Usage: attach.mjs --repo owner/name --pr N --sha <head sha> --video final.mp4 --base origin/<base> [--gate "<flags>"]');
if (!existsSync(video)) blocked(`${video} is missing. Run finish.mjs first.`);
const bytes = statSync(video).size;
if (bytes > MAX_BYTES) blocked(`${video} is ${(bytes / 1024 / 1024).toFixed(1)} MB; GitHub takes 10 MB on Free plans. Run finish.mjs again.`);

const gh = (list, input) => {
  const result = spawnSync('gh', list, { encoding: 'utf8', input, maxBuffer: 64 * 1024 * 1024 });
  if (result.status !== 0) blocked(`gh ${list.slice(0, 3).join(' ')} failed: ${(result.stderr || result.stdout).trim().slice(0, 400)}`);
  return result.stdout.trim();
};
const readPr = () => JSON.parse(gh(['api', `repos/${repo}/pulls/${pr}`]));

let url = opt('--url');
if (!url && !has('--dry-run')) {
  const id = gh(['api', `repos/${repo}`, '--jq', '.id']);
  const name = encodeURIComponent(path.basename(video));
  url = gh(['api', '-X', 'POST', `https://uploads.github.com/user-attachments/assets?name=${name}&content_type=video%2Fmp4&repository_id=${id}`,
    '-H', 'Content-Type: video/mp4', '-H', 'Accept: application/json', '--input', video, '--jq', '.url']);
  if (!/^https:\/\//.test(url)) blocked(`The upload returned no URL (${url.slice(0, 200)}). Status 422: unsupported type; 404: wrong repository id or no push access.`);
}
url ??= 'https://github.com/user-attachments/assets/dry-run';

const block = videoBlock({ url, sha, seconds: probeDuration(video) ?? 0, reviewed: has('--reviewed'), wordsChecked: !has('--words-unchecked') });
const scratch = mkdtempSync(path.join(tmpdir(), 'vs-attach-'));
const gateFlags = (opt('--gate') ?? '').split(/\s+/).filter(Boolean);

const build = (current) => {
  const body = upsertVideoBlock(current.body ?? '', block);
  const file = path.join(scratch, 'body.md');
  writeFileSync(file, body);
  const gate = spawnSync(process.execPath, [GATE, file, '--base', base, '--title', current.title, '--head', sha, ...gateFlags], { encoding: 'utf8' });
  return { body, file, gate };
};

let current = readPr();
if (current.head?.sha && current.head.sha !== sha) process.stderr.write(`attach: the PR head is now ${current.head.sha.slice(0, 7)}; the block says "made for ${sha.slice(0, 7)}".\n`);
let next = build(current);
if (next.gate.status !== 0) {
  process.stdout.write(`${JSON.stringify({ status: 'GATE_FAILED', url, bodyFile: next.file, gate: next.gate.stdout.slice(-1500) || next.gate.stderr.slice(-800), next: 'Do not patch. Fix what the gate names (it ignores the video block) or report the gap.' }, null, 2)}\n`);
  process.exit(1);
}
if (has('--dry-run')) {
  process.stdout.write(`${JSON.stringify({ status: 'DRY_RUN', url, bodyFile: next.file }, null, 2)}\n`);
  process.exit(0);
}
const again = readPr();
if ((again.body ?? '') !== (current.body ?? '')) {
  current = again;
  next = build(current);
  if (next.gate.status !== 0) {
    process.stdout.write(`${JSON.stringify({ status: 'GATE_FAILED', url, bodyFile: next.file, next: 'The body changed while attaching and the new one fails the gate. Do not patch.' }, null, 2)}\n`);
    process.exit(1);
  }
  if ((readPr().body ?? '') !== (current.body ?? '')) {
    process.stdout.write(`${JSON.stringify({ status: 'BODY_CHANGED', url, next: 'The PR body changed twice while attaching. Rerun attach.mjs with --url to reuse the upload.' }, null, 2)}\n`);
    process.exit(1);
  }
}
const payload = path.join(scratch, 'payload.json');
writeFileSync(payload, JSON.stringify({ body: next.body }));
gh(['api', '-X', 'PATCH', `repos/${repo}/pulls/${pr}`, '--input', payload, '--jq', '.number']);
process.stdout.write(`${JSON.stringify({ status: 'ATTACHED', url, pr: Number(pr), madeFor: sha.slice(0, 7), bytes, next: 'Tell the parent the video is on the PR. Do not edit the body again.' }, null, 2)}\n`);
