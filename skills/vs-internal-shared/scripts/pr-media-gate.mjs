#!/usr/bin/env node
// Refuses a PR body that shows the reviewer nothing: no Before/After comparison at all,
// no merge-danger classification, frontend changes with no hosted media, endpoint and
// schema changes with no contract proof, or Surfaces claim↔path mismatches.
//
//   node pr-media-gate.mjs <body-file> [--base <ref>] [--frontend <regex>] [--api <regex>] [--schema <regex>]
//
// Reads git (which paths changed against the base) and the body text. It never opens the
// media, so it costs the model no context. Exit codes match check-visual-evidence.mjs:
//   0  passes: Before/After and Door/Blast Radius are present, and media is present,
//      gapped, or not needed; Surfaces claims match path classes when present
//   1  fails:  the body omits a comparison side, omits merge danger, shows nothing for a
//      frontend change, shows no request/response or schema shape for a contract change,
//      or stamps Surfaces that the paths do not support
//   2  not checked: body missing or git cannot resolve the base
//
// Output is one JSON object on stdout so the caller can quote counts instead of re-reading.
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';

const FRONTEND_PATH =
  /\.(?:tsx|jsx|vue|svelte|astro|css|scss|sass|less|styl|html|mdx)$|\/(?:components?|pages|views|layouts|routes|app|ui|styles?|screens?)\//i;
// Handler code only: UI files under an api/ folder are frontend, and plain server code has no
// contract to show. Contract definitions (proto, OpenAPI) are schema, not endpoints.
const API_PATH =
  /(?:^|\/)(?:api|apis|controllers?|handlers?|endpoints?|resolvers?|rpc)\/[^.]*\.(?:[cm]?[jt]s|py|go|rb|java|kt|scala|cs|php|rs)$|\.(?:controller|handler|resolver|endpoint|routes?)\.[cm]?[jt]s$|(?:^|\/)route\.[cm]?[jt]s$/i;
const SCHEMA_PATH =
  /(?:^|\/)migrations?\/|\.(?:sql|prisma|graphqls?|gql|proto|avsc)$|(?:^|\/)(?:openapi|swagger)[^/]*\.(?:ya?ml|json)$|\.schema\.(?:json|[cm]?[jt]s)$|(?:^|\/)schemas?\.[cm]?[jt]s$|(?:^|\/)schemas?\//i;
const CLI_PATH =
  /(?:^|\/)(?:cli|bin|cmd|commands?)\/|\.(?:cli)\.[cm]?[jt]s$|(?:^|\/)(?:cli|commander|yargs)\.[cm]?[jt]s$/i;
const MCP_PATH =
  /(?:^|\/)mcp(?:\/|-)|(?:^|\/)(?:tools|resources|prompts)\/mcp|\.mcp\.[cm]?[jt]s$|(?:^|\/)mcp\.[cm]?[jt]s$/i;
const INFRA_PATH =
  /(?:^|\/)\.github\/(?:workflows|actions)\/|(?:^|\/)(?:deploy|deployment|infra|infrastructure|terraform|helm|k8s|kubernetes|charts?)\/|(?:^|\/)Dockerfile|(?:^|\/)docker-compose[^/]*\.(?:ya?ml)$|\.(?:tf|tfvars)$|(?:^|\/)\.env|(?:^|\/)(?:flags?|feature-flags?)\/|(?:^|\/)(?:flags?|feature-flags?)\.[cm]?[jt]s$/i;
const TEST_PATH = /\.(?:test|spec|stories)\.[cm]?[jt]sx?$|\/(?:__tests__|__snapshots__|test|tests|e2e)\//i;
const PRODUCT_SURFACES = ['UI', 'Endpoint', 'Schema', 'CLI', 'MCP'];
const ALLOWED_SURFACES = new Set([...PRODUCT_SURFACES, 'Infra']);
const FORBIDDEN_SURFACE = /^(?:backend|backends?|db|database|databases?)$/i;

// A GitHub user-attachment URL has no extension, so hosting is decided by host, not suffix.
const HOSTED_MEDIA_HOST =
  /^https:\/\/(?:github\.com\/user-attachments\/assets\/|(?:private-)?user-images\.githubusercontent\.com\/|user-images\.githubusercontent\.com\/)/i;
// vs-ship-it merge-risk badges classify the PR; they never show the change, so they are not proof.
const MERGE_RISK_BADGE = /\/skills\/vs-ship-it\/assets\/badge-[a-z-]+\.svg(?:[?#].*)?$/i;
const MEDIA_EXTENSION = /\.(?:png|jpe?g|webp|gif|svg|webm|mp4|mov)(?:[?#].*)?$/i;
const MARKDOWN_IMAGE = /!\[[^\]]*\]\(\s*<?([^\s)>]+)>?(?:\s+"[^"]*")?\s*\)/g;
const HTML_MEDIA = /<(?:img|video|source)\b[^>]*\bsrc=["']([^"']+)["']/gi;
const BARE_URL = /^\s*<?(https?:\/\/\S+?)>?\s*$/;

// Either phrase makes the gap a reviewed decision instead of an omission: the gate exists to
// stop silence, not to force a screenshot of a refactor.
const STATED_GAP = /(?:\*\*)?Still unverified:?(?:\*\*)?[^\n]*|No (?:visual|UI|user-visible) change[^\n]*/i;
// Contract gaps are per kind: a missing screenshot must not excuse a missing response diff.
const ENDPOINT_GAP =
  /No (?:contract|API|endpoint) change[^\n]*|Still unverified:?(?:\*\*)?[^\n]*\b(?:endpoint|API|contract|response)\b[^\n]*/i;
const SCHEMA_GAP = /No schema change[^\n]*|Still unverified:?(?:\*\*)?[^\n]*\bschema\b[^\n]*/i;

// Before/After and the merge-danger pair are required on every PR, so each marker must be a
// deliberate label — a bold run, a heading, or a comparison-table header — never the word
// inside a prose sentence.
const labelMarker = (label) =>
  new RegExp(
    String.raw`(?:\*\*|__)[ \t]*${label}\b[^*_\n]*(?:\*\*|__)` +
      String.raw`|^[ \t]*#{1,6}[ \t]*${label}\b` +
      String.raw`|^[ \t]*\|.*\|[ \t]*${label}[ \t]*\|`,
    'im',
  );
const BEFORE_MARKER = labelMarker('Before');
const AFTER_MARKER = labelMarker('After');
// Merge danger routes review attention: a one-way door or a wide blast radius earns a slow
// read, everything else earns a fast one. Silence here reads as "safe" by default.
const DOOR_MARKER = labelMarker('Door');
const BLAST_MARKER = labelMarker(String.raw`Blast[ \t]+Radius`);
const ENDPOINT_MARKER = labelMarker('Endpoint');
const SCHEMA_MARKER = labelMarker('Schema');
const FENCE = /^[ \t]*(?:```|~~~)/m;

const args = process.argv.slice(2);
const bodyPath = args.find((arg) => !arg.startsWith('--'));
const flag = (name, fallback) => {
  const index = args.indexOf(name);
  return index === -1 ? fallback : args[index + 1];
};
const baseRef = flag('--base', null);
const frontendPattern = flag('--frontend', null);
const frontendPath = frontendPattern ? new RegExp(frontendPattern, 'i') : FRONTEND_PATH;
const apiPattern = flag('--api', null);
const apiPath = apiPattern ? new RegExp(apiPattern, 'i') : API_PATH;
const schemaPattern = flag('--schema', null);
const schemaPath = schemaPattern ? new RegExp(schemaPattern, 'i') : SCHEMA_PATH;

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

const apiFiles = changedFiles.filter((file) => apiPath.test(file) && !TEST_PATH.test(file));
const schemaFiles = changedFiles.filter((file) => schemaPath.test(file) && !TEST_PATH.test(file));
const cliFiles = changedFiles.filter((file) => CLI_PATH.test(file) && !TEST_PATH.test(file));
const mcpFiles = changedFiles.filter((file) => MCP_PATH.test(file) && !TEST_PATH.test(file));
const infraFiles = changedFiles.filter((file) => INFRA_PATH.test(file) && !TEST_PATH.test(file));

const body = fs.readFileSync(bodyPath, 'utf8');
// The label must carry a code block after it: a request/response or schema shape, not a sentence.
const labelledBlock = (marker) => {
  const at = body.search(marker);
  return at !== -1 && FENCE.test(body.slice(at));
};
const refs = [];
for (const match of body.matchAll(MARKDOWN_IMAGE)) refs.push({ url: match[1], kind: 'image' });
for (const match of body.matchAll(HTML_MEDIA)) refs.push({ url: match[1], kind: 'image' });
for (const line of body.split('\n')) {
  const match = line.match(BARE_URL);
  if (match) refs.push({ url: match[1], kind: 'video' });
}

const isHosted = (url) =>
  !MERGE_RISK_BADGE.test(url) &&
  (HOSTED_MEDIA_HOST.test(url) || (/^https?:\/\//i.test(url) && MEDIA_EXTENSION.test(url)));
const hosted = refs.filter((ref) => isHosted(ref.url));
const localRefs = refs.filter((ref) => !/^(?:https?:|data:)/i.test(ref.url));
const images = hosted.filter((ref) => ref.kind === 'image').length;
const videos = hosted.filter((ref) => ref.kind === 'video').length;
const gapStated = body.match(STATED_GAP)?.[0].trim() ?? null;

const beforeAfter = { before: BEFORE_MARKER.test(body), after: AFTER_MARKER.test(body) };
// The badge alone is a label: ship-it bodies show the badge with the reason under it, no text label.
const DOOR_BADGE = /\/skills\/vs-ship-it\/assets\/badge-(?:one|two)-way-door\.svg/i;
const BLAST_BADGE = /\/skills\/vs-ship-it\/assets\/badge-(?:wide|narrow)-blast\.svg/i;
const mergeDanger = {
  door: DOOR_MARKER.test(body) || DOOR_BADGE.test(body),
  blastRadius: BLAST_MARKER.test(body) || BLAST_BADGE.test(body),
};
const mediaOk = frontendFiles.length === 0 || images + videos > 0 || gapStated !== null;
const beforeAfterOk = beforeAfter.before && beforeAfter.after;
const mergeDangerOk = mergeDanger.door && mergeDanger.blastRadius;
const contract = {
  endpoint: apiFiles.length === 0 || labelledBlock(ENDPOINT_MARKER) || ENDPOINT_GAP.test(body),
  schema: schemaFiles.length === 0 || labelledBlock(SCHEMA_MARKER) || SCHEMA_GAP.test(body),
};
const contractOk = contract.endpoint && contract.schema;

// Surfaces proof selectors: parse ## Surfaces until the next heading. Claims must
// match path classes; forbidden names (backend/DB) always fail.
// Capture until the next ATX heading or end of body. (JS has no \\Z.)
const surfacesSection = (() => {
  const at = body.search(/^##[ \t]+Surfaces\b/im);
  if (at === -1) return '';
  const afterHeading = body.indexOf('\n', at);
  if (afterHeading === -1) return '';
  const rest = body.slice(afterHeading + 1);
  const nextHeading = rest.search(/^##[ \t]+/m);
  return nextHeading === -1 ? rest : rest.slice(0, nextHeading);
})();
// Only the first non-empty line of the section is the selector row (ignore HTML comments).
const surfacesLine =
  surfacesSection
    .split('\n')
    .map((line) => line.trim())
    .find((line) => line && !line.startsWith('<!--') && !line.startsWith('-->')) ?? '';
const claimedRaw = surfacesLine
  .split(/[·|,/]|\s+/)
  .map((token) => token.trim())
  .filter(Boolean);
const claimedForbidden = claimedRaw.filter((token) => FORBIDDEN_SURFACE.test(token));
const claimed = [...new Set(claimedRaw.filter((token) => ALLOWED_SURFACES.has(token)))];
const pathClasses = {
  UI: frontendFiles.length > 0,
  Endpoint: apiFiles.length > 0,
  Schema: schemaFiles.length > 0,
  CLI: cliFiles.length > 0,
  MCP: mcpFiles.length > 0,
  Infra: infraFiles.length > 0,
};
const productClaimed = claimed.filter((name) => PRODUCT_SURFACES.includes(name));
const surfacesReasons = [];
if (claimedForbidden.length > 0) {
  surfacesReasons.push(
    `stamped forbidden surface name(s) ${claimedForbidden.join(', ')} — never invent backend/DB surface names`,
  );
}
if (claimed.includes('Infra') && productClaimed.length > 0) {
  surfacesReasons.push('Infra stacked with a product surface — Infra only when the PR is solely CI/deploy/flags/env');
}
// migration-only ≠ UI: schema paths present, no UI paths, but UI claimed
if (claimed.includes('UI') && pathClasses.Schema && !pathClasses.UI && !pathClasses.Endpoint && !pathClasses.CLI && !pathClasses.MCP) {
  surfacesReasons.push('migration-only ≠ UI — schema/migration paths do not prove a UI surface');
}
// MCP-wrap-only ≠ Endpoint: MCP paths without API paths, but Endpoint claimed
if (claimed.includes('Endpoint') && pathClasses.MCP && !pathClasses.Endpoint) {
  surfacesReasons.push('MCP-wrap-only ≠ Endpoint — MCP wrap of an unchanged route is MCP only');
}
if (productClaimed.length > 3) {
  const unmatched = productClaimed.filter((name) => !pathClasses[name]);
  if (unmatched.length > 0) {
    surfacesReasons.push(
      `>3 product surfaces without matching path classes (${unmatched.join(', ')} lack path evidence)`,
    );
  }
}
const surfaces = {
  ok: surfacesReasons.length === 0,
  claimed,
  forbidden: claimedForbidden,
  pathClasses,
  reasons: surfacesReasons,
};
const surfacesOk = surfaces.ok;
const valid = mediaOk && beforeAfterOk && mergeDangerOk && contractOk && surfacesOk;

process.stdout.write(
  `${JSON.stringify({ valid, base, frontendFiles, apiFiles, schemaFiles, cliFiles, mcpFiles, infraFiles, images, videos, localRefs: localRefs.map((ref) => ref.url), gapStated, beforeAfter, mergeDanger, contract, surfaces }, null, 2)}\n`,
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
  !mergeDangerOk
    ? [
        `pr-media-gate: the PR body has no ${[!mergeDanger.door && 'Door', !mergeDanger.blastRadius && 'Blast radius'].filter(Boolean).join(' and ')} line. Every PR states its merge risk.`,
        '  Next: classify from the diff, one line each, under a "## Merge risk" heading:',
        '    **Door:** Two-way — <what makes reverting cheap>, or One-way — <the irreversible step and its cost>',
        '    **Blast radius:** <who breaks and how widely> — <the adjacent surfaces this does not touch>',
        '  One-way signals: migration, backfill, destructive write, released artifact, public API or wire',
        '  contract, auth/billing/send side effects. Everything a plain `git revert` undoes is two-way.',
        '  Name the recovery path (flag, staged rollout, backup) or say none exists. Never guess reassuringly.',
      ].join('\n')
    : null,
  !contract.endpoint
    ? [
        `pr-media-gate: ${apiFiles.length} endpoint file(s) changed and the PR body shows no request/response comparison.`,
        '  Next, one of:',
        '    1. Add **Endpoint** `<METHOD> <path>`, one request, and the Before and After response to that',
        '       same request: paired fenced blocks or one fenced `diff`. Real captured output, never invented.',
        '    2. Handler change with identical responses: write "No contract change: <why>".',
        '    3. State the gap: "**Still unverified:** endpoint response; <exact blocker>".',
        `  Changed: ${apiFiles.join(', ')}`,
      ].join('\n')
    : null,
  !contract.schema
    ? [
        `pr-media-gate: ${schemaFiles.length} schema file(s) changed and the PR body shows no before/after shape.`,
        '  Next, one of:',
        '    1. Add **Schema** `<table | message | type>`, then a fenced `diff` of the resulting shape before and after',
        '       (columns, fields, types, nullability) — the shape, not the migration script.',
        '    2. No shape change (index, comment, reformat): write "No schema change: <why>".',
        '    3. State the gap: "**Still unverified:** schema diff; <exact blocker>".',
        `  Changed: ${schemaFiles.join(', ')}`,
      ].join('\n')
    : null,
  !surfacesOk
    ? [
        `pr-media-gate: Surfaces claim↔path failed.`,
        ...surfacesReasons.map((reason) => `  - ${reason}`),
        '  Vocabulary: UI · Endpoint · Schema · CLI · MCP (Infra alone on infra-only PRs).',
        '  Endpoint not backend; Schema = wire + persistence (no separate DB).',
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
