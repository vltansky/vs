#!/usr/bin/env node
// Refuses a PR body that shows the reviewer nothing: no Before/After comparison at all, or
// frontend changes with no hosted media.
//
//   node pr-media-gate.mjs <body-file> [--base <ref>] [--frontend <regex>]
//
// Reads git (which paths changed against the base) and the body text. It never opens the
// media, so it costs the model no context. Exit codes match check-visual-evidence.mjs:
//   0  passes: a Before/After pair is present, and media is present, gapped, or not needed
//   1  fails:  the body omits Before/After, or shows nothing for a frontend change
//   2  not checked: body missing or git cannot resolve the base
//
// Output is one JSON object on stdout so the caller can quote counts instead of re-reading.
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';

const FRONTEND_PATH =
  /\.(?:tsx|jsx|vue|svelte|astro|css|scss|sass|less|styl|html|mdx)$|\/(?:components?|pages|views|layouts|routes|app|ui|styles?|screens?)\//i;
const TEST_PATH = /\.(?:test|spec|stories)\.[cm]?[jt]sx?$|\/(?:__tests__|__snapshots__|test|tests|e2e)\//i;

// A GitHub user-attachment URL has no extension, so hosting is decided by host, not suffix.
const HOSTED_MEDIA_HOST =
  /^https:\/\/(?:github\.com\/user-attachments\/assets\/|(?:private-)?user-images\.githubusercontent\.com\/|user-images\.githubusercontent\.com\/)/i;
const MEDIA_EXTENSION = /\.(?:png|jpe?g|webp|gif|svg|webm|mp4|mov)(?:[?#].*)?$/i;
const MARKDOWN_IMAGE = /!\[[^\]]*\]\(\s*<?([^\s)>]+)>?(?:\s+"[^"]*")?\s*\)/g;
const HTML_MEDIA = /<(?:img|video|source)\b[^>]*\bsrc=["']([^"']+)["']/gi;
const BARE_URL = /^\s*<?(https?:\/\/\S+?)>?\s*$/;

// Either phrase makes the gap a reviewed decision instead of an omission: the gate exists to
// stop silence, not to force a screenshot of a refactor.
const STATED_GAP = /(?:\*\*)?Still unverified:?(?:\*\*)?[^\n]*|No (?:visual|UI|user-visible) change[^\n]*/i;

// Before/After is required on every PR, so the marker must be a deliberate label — a bold run,
// a heading, or a comparison-table header — never the word inside a prose sentence.
const sideMarker = (side) =>
  new RegExp(
    String.raw`(?:\*\*|__)[ \t]*${side}\b[^*_\n]*(?:\*\*|__)` +
      String.raw`|^[ \t]*#{1,6}[ \t]*${side}\b` +
      String.raw`|^[ \t]*\|.*\|[ \t]*${side}[ \t]*\|`,
    'im',
  );
const BEFORE_MARKER = sideMarker('Before');
const AFTER_MARKER = sideMarker('After');

const args = process.argv.slice(2);
const bodyPath = args.find((arg) => !arg.startsWith('--'));
const flag = (name, fallback) => {
  const index = args.indexOf(name);
  return index === -1 ? fallback : args[index + 1];
};
const baseRef = flag('--base', null);
const frontendPattern = flag('--frontend', null);
const frontendPath = frontendPattern ? new RegExp(frontendPattern, 'i') : FRONTEND_PATH;

const notChecked = (reason) => {
  process.stderr.write(`pr-media-gate: not checked. ${reason}\n`);
  process.exit(2);
};

if (!bodyPath || !fs.existsSync(bodyPath)) {
  notChecked('Pass the PR body file: node pr-media-gate.mjs "$BODY_FILE" [--base origin/main].');
}

const git = (...gitArgs) => spawnSync('git', gitArgs, { encoding: 'utf8' });

const resolveBase = () => {
  if (baseRef) return baseRef;
  const remoteHead = git('symbolic-ref', '--short', 'refs/remotes/origin/HEAD');
  if (remoteHead.status === 0) return remoteHead.stdout.trim();
  for (const candidate of ['origin/main', 'origin/master', 'main', 'master']) {
    if (git('rev-parse', '--verify', '--quiet', candidate).status === 0) return candidate;
  }
  return null;
};

const base = resolveBase();
if (!base) notChecked('No base branch found. Pass --base <ref> (for example origin/main).');

const mergeBase = git('merge-base', base, 'HEAD');
if (mergeBase.status !== 0) {
  notChecked(`git cannot resolve base "${base}": ${mergeBase.stderr.trim()}. Pass --base <ref>.`);
}

const diff = git('diff', '--name-only', `${mergeBase.stdout.trim()}...HEAD`);
if (diff.status !== 0) notChecked(`git diff failed: ${diff.stderr.trim()}`);

const changedFiles = diff.stdout.split('\n').filter(Boolean);
const frontendFiles = changedFiles.filter(
  (file) => frontendPath.test(file) && !TEST_PATH.test(file),
);

const body = fs.readFileSync(bodyPath, 'utf8');
const refs = [];
for (const match of body.matchAll(MARKDOWN_IMAGE)) refs.push({ url: match[1], kind: 'image' });
for (const match of body.matchAll(HTML_MEDIA)) refs.push({ url: match[1], kind: 'image' });
for (const line of body.split('\n')) {
  const match = line.match(BARE_URL);
  if (match) refs.push({ url: match[1], kind: 'video' });
}

const isHosted = (url) => HOSTED_MEDIA_HOST.test(url) || (/^https?:\/\//i.test(url) && MEDIA_EXTENSION.test(url));
const hosted = refs.filter((ref) => isHosted(ref.url));
const localRefs = refs.filter((ref) => !/^(?:https?:|data:)/i.test(ref.url));
const images = hosted.filter((ref) => ref.kind === 'image').length;
const videos = hosted.filter((ref) => ref.kind === 'video').length;
const gapStated = body.match(STATED_GAP)?.[0].trim() ?? null;

const beforeAfter = { before: BEFORE_MARKER.test(body), after: AFTER_MARKER.test(body) };
const mediaOk = frontendFiles.length === 0 || images + videos > 0 || gapStated !== null;
const beforeAfterOk = beforeAfter.before && beforeAfter.after;
const valid = mediaOk && beforeAfterOk;

process.stdout.write(
  `${JSON.stringify({ valid, base, frontendFiles, images, videos, localRefs: localRefs.map((ref) => ref.url), gapStated, beforeAfter }, null, 2)}\n`,
);

if (valid) process.exit(0);

const missingSides = [!beforeAfter.before && 'Before', !beforeAfter.after && 'After'].filter(Boolean);
const next = [
  missingSides.length > 0
    ? [
        `pr-media-gate: the PR body has no ${missingSides.join(' and ')} marker. Every PR compares both sides.`,
        '  Next: label the same actor, input, and precondition on each side, then state the concrete result:',
        '    **Before** <same-state setup>  ->  proof (screenshot, bare video URL, paired output block, or table row)',
        '    **After** <same-state setup>   ->  matched proof',
        '  A new feature describes the previous absence or workaround under Before; an internal change compares the',
        '  old and new mechanism and says observable behavior is unchanged. A heading or a | Before | After | table',
        '  header counts. Never fabricate the missing side.',
      ].join('\n')
    : null,
  !mediaOk
    ? [
        `pr-media-gate: ${frontendFiles.length} frontend file(s) changed and the PR body embeds no hosted media.`,
        localRefs.length > 0
          ? `  ${localRefs.length} reference(s) point at a local path the reviewer cannot open: ${localRefs.map((ref) => ref.url).join(', ')}. Upload them and embed the returned URL.`
          : null,
        '  Next, one of:',
        '    1. Capture: write flow.json with captions, run node <shared>/scripts/record-flow.mjs flow.json --out <dir>,',
        '       upload the stills and video from the manifest, embed the URLs (image: ![caption](url), video: bare URL line).',
        '    2. State the gap in the body: "**Still unverified:** visual proof; <exact blocker>".',
        '    3. Frontend refactor with identical output: write "No visual change: <why>" in the body.',
        `  Changed: ${frontendFiles.join(', ')}`,
      ]
        .filter(Boolean)
        .join('\n')
    : null,
]
  .filter(Boolean)
  .join('\n');
process.stderr.write(`${next}\n`);
process.exit(1);
