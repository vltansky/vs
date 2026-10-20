#!/usr/bin/env node
// Refuses a PR body that shows the reviewer nothing: no Before/After comparison at all,
// no merge-danger classification, frontend changes with no hosted media, endpoint and
// schema changes with no contract proof, Surfaces claim↔path mismatches, or changed tests
// with no ## Verification block.
//
//   node pr-media-gate.mjs <body-file> [--base <ref>] [--frontend <regex>] [--api <regex>] [--schema <regex>] [--tests <regex>] [--head <ref>] [--template <path>] [--title <PR title>] [--bugfix[=true|false]]
//
// Reads git (which paths changed against the base) and the body text. It never opens the
// media, so it costs the model no context. Exit codes match check-visual-evidence.mjs:
//   0  passes: Before/After and Door/Blast Radius are present, and media is present,
//      gapped, or not needed; when ## Surfaces is stamped (chips and/or kind tags),
//      every claimed surface has a matching path class (omit Surfaces on skill-only / docs-only)
//   1  fails:  the body omits a comparison side, omits merge danger, shows nothing for a
//      frontend change, shows no request/response or schema shape for a contract change,
//      stamps a forbidden surface name (backend/DB), stacks Infra with a product surface,
//      stamps Infra without infra paths, stamps a product surface with no matching path
//      class (including skill-only + Schema), migration-only≠UI, MCP-wrap-only≠Endpoint,
//      or >3 product surfaces without matching path classes, or test/eval files changed
//      (added, edited, or deleted) and the body has no ## Verification block with a Not covered: line
//      Warn only (never exit 1): behavior paths changed, no test/eval file changed, and
//      ## Verification has no "No tests changed" bullet — the warning goes to stderr.
//      or >3 product surfaces without matching path classes, or has no collapsed
//      last-section Walkthrough (≥1 area group ordered 🔴 → 🟡 → 🟢, each with a ```diff of
//      logic pseudocode without diff/hunk headers, links pinned to the --head SHA)
//      or --template <path> was passed and a template section (# … ###### heading or bold-label
//      line) or checklist item is missing from the body, or a section is out of template order,
//      or a repo file link under Change and proof is not pinned to the --head SHA
//      or the Tests block's Not covered line is neither `none` nor followed by `- [ ]` reviewer
//      checkboxes (or has a ticked box), or the PR is a bugfix (--bugfix, a fix/ fix- hotfix/ branch, a fix: --title, or a fix: FIRST commit;
//      --bugfix=false opts out) and Change and proof has no real `Root cause:` line
//      (no <placeholder>, TBD/TODO/unknown/N/A, at least 4 words)
//      or the body does not start with a two-line plain TL;DR (no links, code, badges; not the title)
//   2  not checked: body missing, git cannot resolve the base, or --template is unreadable or has no sections
//
// Output is one JSON object on stdout so the caller can quote counts instead of re-reading.
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import { checkMediaPairs } from './pr-media-pairs.mjs';

const FRONTEND_PATH =
  /\.(?:tsx|jsx|vue|svelte|astro|css|scss|sass|less|styl|html|mdx)$|\/(?:components?|pages|views|layouts|routes|app|ui|styles?|screens?)\/|(?:^|\/)(?:web|client|frontend)\/[^.]*\.[cm]?[jt]s$/i;
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
// Test/eval files for the ## Verification block and the no-test flag. Generic defaults; pass
// --tests <regex> to add a repository convention the defaults miss.
// `*.spec.*`, `*.test.*`, `*.eval.*`, and a `spec/` directory count only for code files: an
// `api.spec.yaml` (OpenAPI) or a `docs/spec/design.md` is a specification, not a test.
const CODE_EXT = String.raw`\.(?:[cm]?[jt]sx?|py|rb|go|rs|java|kt|swift|php|cs|dart|exs?|vue|svelte)$`;
const TEST_FILE = new RegExp(
  [
    String.raw`\.(?:test|spec|eval)${CODE_EXT}`,
    String.raw`\.(?:test|spec|eval)\.[^/.]+${CODE_EXT}`,
    String.raw`(?:^|\/)(?:__tests__|__snapshots__|tests?|evals?|e2e)\/`,
    String.raw`(?:^|\/)spec\/(?:[^/]+\/)*[^/]+${CODE_EXT}`,
    String.raw`_test\.(?:go|py|rb|exs?)$`,
    String.raw`(?:^|\/)test_[^/]+\.py$`,
    String.raw`_spec\.rb$`,
  ].join('|'),
  'i',
);
// Paths that cannot change runtime behavior on their own: docs, copy/styling, config, CI.
// A skill contract is behavior even though it is Markdown: SKILL.md, the references a skill
// loads and follows, and CONTEXT.md.
const SKILL_CONTRACT =
  /(?:^|\/)SKILL\.md$|(?:^|\/)skills\/(?:[^/]+\/)+references\/(?:[^/]+\/)*[^/]+\.md$|(?:^|\/)CONTEXT\.md$/i;
const NON_BEHAVIOR =
  /\.(?:md|mdx|markdown|rst|txt|adoc)$|(?:^|\/)(?:docs?|adr)\/|(?:^|\/)(?:LICENSE|NOTICE|CHANGELOG|CODEOWNERS)[^/]*$|\.(?:css|scss|sass|less|styl|svg|png|jpe?g|gif|webp|ico)$|\.(?:json|ya?ml|toml|ini|cfg|lock)$|(?:^|\/)\.[^/]+$|(?:^|\/)[^/]+\.config\.[cm]?[jt]s$|(?:^|\/)\.github\/|(?:^|\/)(?:package-lock\.json|pnpm-lock\.yaml|yarn\.lock)$/i;
const PRODUCT_SURFACES = ['UI', 'Endpoint', 'Schema', 'CLI', 'MCP'];
const ALLOWED_SURFACES = new Set([...PRODUCT_SURFACES, 'Infra']);
const FORBIDDEN_SURFACE = /^(?:backend|backends?|db|database|databases?)$/i;

// A GitHub user-attachment URL has no extension, so hosting is decided by host, not suffix.
const HOSTED_MEDIA_HOST =
  /^https:\/\/(?:github\.com\/user-attachments\/assets\/|(?:private-)?user-images\.githubusercontent\.com\/|user-images\.githubusercontent\.com\/)/i;
// vs-ship-it merge-risk badges classify the PR; they never show the change, so they are not proof.
const MERGE_RISK_BADGE = /\/skills\/vs-ship-it\/assets\/badge-[a-z0-9-]+\.svg(?:[?#].*)?$/i;
const MEDIA_EXTENSION = /\.(?:png|jpe?g|webp|gif|svg|webm|mp4|mov)(?:[?#].*)?$/i;
const MARKDOWN_IMAGE = /!\[[^\]]*\]\(\s*<?([^\s)>]+)>?(?:\s+"[^"]*")?\s*\)/g;
const HTML_MEDIA = /<(img|video|source)\b[^>]*\bsrc=["']([^"']+)["']/gi;
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

const notChecked = (reason) => {
  process.stderr.write(`pr-media-gate: not checked. ${reason}\n`);
  process.exit(2);
};

const VALUE_FLAGS = new Set(['--base', '--frontend', '--api', '--schema', '--tests', '--head', '--template', '--title']);
// `--flag=value` is the same as `--flag value`; an empty `--flag=` is a missing value.
const args = process.argv.slice(2).flatMap((arg) => {
  const eq = arg.match(/^(--[\w-]+)=(.*)$/s);
  if (!eq || !VALUE_FLAGS.has(eq[1])) return [arg];
  return eq[2] === '' ? [eq[1]] : [eq[1], eq[2]];
});
// A flag's value is never the body path, and a flag with no value is an error, not a no-op.
const flagValueAt = new Set();
for (const [index, arg] of args.entries()) {
  if (!VALUE_FLAGS.has(arg)) continue;
  const value = args[index + 1];
  if (value === undefined || value.startsWith('--')) notChecked(`${arg} needs a value.`);
  flagValueAt.add(index + 1);
}
// --bugfix: bare, --bugfix=<bool>, or --bugfix <bool> (true|false|1|0|yes|no). Only a
// boolean word after a space is its value, so the body path is never eaten. Without the
// flag the gate auto-detects a bugfix from the head branch and commit subjects.
const BOOL_TRUE = /^(?:true|1|yes)$/i;
const BOOL_FALSE = /^(?:false|0|no)$/i;
let bugfixFlag = null;
for (const [index, arg] of args.entries()) {
  const m = arg.match(/^--bugfix(?:=(.*))?$/s);
  if (!m) continue;
  flagValueAt.add(index);
  let value = m[1];
  const next = args[index + 1];
  if (value === undefined && next !== undefined && (BOOL_TRUE.test(next) || BOOL_FALSE.test(next))) {
    value = next;
    flagValueAt.add(index + 1);
  }
  if (value === undefined || BOOL_TRUE.test(value)) bugfixFlag = true;
  else if (BOOL_FALSE.test(value)) bugfixFlag = false;
  else notChecked(`--bugfix takes true or false, not "${value}".`);
}
const bodyPath = args.find((arg, index) => !arg.startsWith('--') && !flagValueAt.has(index));
const flag = (name, fallback) => {
  const index = args.indexOf(name);
  return index === -1 ? fallback : args[index + 1];
};
const regexFlag = (name, fallback) => {
  const pattern = flag(name, null);
  if (pattern === null) return fallback;
  try {
    return new RegExp(pattern, 'i');
  } catch (error) {
    return notChecked(`${name} is not a valid regex (${pattern}): ${error.message}`);
  }
};
const baseRef = flag('--base', null);
const frontendPath = regexFlag('--frontend', FRONTEND_PATH);
const apiPath = regexFlag('--api', API_PATH);
const schemaPath = regexFlag('--schema', SCHEMA_PATH);
const testsExtra = regexFlag('--tests', null);
const isTestFile = (file) => TEST_FILE.test(file) || (testsExtra !== null && testsExtra.test(file));

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
// Surface classes use the same test predicate as the Tests block (evals/, *.eval.*), plus
// stories, so a test-only file under src/api/ never proves an Endpoint.
const productFile = (file) => !isTestFile(file) && !TEST_PATH.test(file);
const frontendFiles = changedFiles.filter((file) => frontendPath.test(file) && productFile(file));
const apiFiles = changedFiles.filter((file) => apiPath.test(file) && productFile(file));
const schemaFiles = changedFiles.filter((file) => schemaPath.test(file) && productFile(file));
const cliFiles = changedFiles.filter((file) => CLI_PATH.test(file) && productFile(file));
const mcpFiles = changedFiles.filter((file) => MCP_PATH.test(file) && productFile(file));
const infraFiles = changedFiles.filter((file) => INFRA_PATH.test(file) && productFile(file));
// `git diff --name-only` lists deleted files too, so a deleted test still needs its line.
const testFiles = changedFiles.filter(isTestFile);
const behaviorFiles = changedFiles.filter(
  (file) => !isTestFile(file) && (SKILL_CONTRACT.test(file) || !NON_BEHAVIOR.test(file)),
);

const rawBody = fs.readFileSync(bodyPath, 'utf8');
// The PR video explainer (vs-explain-pr) is narration over the PR, not proof: its
// marked block is cut before every check, so its video never counts as a
// Before/After or functional video and its words never count as markers.
// Markers count only on their own line, so prose that quotes `<!-- vs:video -->` is not a block.
const VIDEO_BLOCK = /^<!-- vs:video -->[ \t]*\r?$[\s\S]*?^<!-- \/vs:video -->[ \t]*\r?$/gm;
const videoBlocks = [...rawBody.matchAll(VIDEO_BLOCK)];
const body = rawBody.replace(VIDEO_BLOCK, '');
const explainerReasons = [];
for (const match of videoBlocks) {
  if (!/^<!-- vs:video -->\s*<details\b[^>]*>\s*<summary\b[^>]*>\s*Video explainer\b[\s\S]*<\/details>\s*<!-- \/vs:video -->[ \t]*\r?$/i.test(match[0]))
    explainerReasons.push('Video explainer block must be one collapsed <details> whose <summary> starts "Video explainer"');
  const walkAt = rawBody.search(/<details\b[^>]*>\s*<summary\b[^>]*>\s*(?:<(?:b|strong)>\s*)?Walkthrough\b/i);
  if (walkAt !== -1 && match.index > walkAt) explainerReasons.push('Video explainer block must come before the Walkthrough');
}
if (videoBlocks.length > 1) explainerReasons.push('more than one Video explainer block; attach.mjs keeps exactly one');
const explainer = videoBlocks.length
  ? { present: true, videos: videoBlocks.reduce((n, m) => n + m[0].split('\n').filter((line) => BARE_URL.test(line)).length, 0) }
  : { present: false, videos: 0 };
// The label must carry a code block after it: a request/response or schema shape, not a sentence.
// The Walkthrough's pseudocode fences are not proof, so the search stops where it starts.
const WALKTHROUGH_OPEN = /<details\b[^>]*>\s*<summary\b[^>]*>\s*(?:<(?:b|strong)>\s*)?Walkthrough\b/i;
// Blanks fenced blocks and inline code spans but keeps offsets, so prose or a code block
// that quotes the Walkthrough summary does not cut the proof scan short.
const blank = (block) => block.replace(/[^\n]/g, ' ');
const maskFences = (text) =>
  text.replace(/^[ \t]*(```|~~~)[^\n]*\n[\s\S]*?^[ \t]*\1[ \t]*$/gm, blank).replace(/`[^`\n]+`/g, blank);
const proofEnd = maskFences(body).search(WALKTHROUGH_OPEN);
const proofBody = proofEnd === -1 ? body : body.slice(0, proofEnd);
const labelledBlock = (marker) => {
  const at = proofBody.search(marker);
  return at !== -1 && FENCE.test(proofBody.slice(at));
};
const refs = [];
for (const match of body.matchAll(MARKDOWN_IMAGE)) refs.push({ url: match[1], kind: 'image' });
for (const match of body.matchAll(HTML_MEDIA)) {
  refs.push({ url: match[2], kind: match[1].toLowerCase() === 'img' ? 'image' : 'video' });
}
for (const line of body.split('\n')) {
  const match = line.match(BARE_URL);
  if (match) refs.push({ url: match[1], kind: 'video' });
}

const isHosted = (url) =>
  !MERGE_RISK_BADGE.test(url) &&
  (HOSTED_MEDIA_HOST.test(url) || (/^https?:\/\//i.test(url) && MEDIA_EXTENSION.test(url)));
const hosted = [...new Map(refs.filter((ref) => isHosted(ref.url)).map(ref => [`${ref.kind}:${ref.url}`, ref])).values()];
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
const media = checkMediaPairs({
  body, images, videos,
  frontend: frontendFiles.length > 0,
  functional: args.includes('--functional') ||
    (!args.includes('--static-ui') && frontendFiles.some(file => !/\.(?:css|scss|sass|less|styl)$/.test(file))),
});
const mediaOk = media.ok;
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
// A ## section ends at the next heading of any level or at a <details> block, so a section
// parser never swallows the Walkthrough or its "### " groups.
const untilNextBlock = (rest) => {
  const stop = rest.search(/^(?:#{1,6}[ \t]+|[ \t]*<details\b)/im);
  return stop === -1 ? rest : rest.slice(0, stop);
};
const surfacesSection = (() => {
  const at = body.search(/^##[ \t]+(?:Surfaces|Review map)\b/im);
  if (at === -1) return '';
  const afterHeading = body.indexOf('\n', at);
  if (afterHeading === -1) return '';
  return untilNextBlock(body.slice(afterHeading + 1));
})();
// Claims come from: (1) badge-surface-{kind}-{n}.svg chips, (2) optional (Kind)
// tags on module bullets, (3) legacy vocabulary selector lines (UI · Endpoint …).
const SURFACE_KIND_TITLE = {
  endpoint: 'Endpoint',
  schema: 'Schema',
  ui: 'UI',
  cli: 'CLI',
  mcp: 'MCP',
  infra: 'Infra',
};
const fromChips = [...surfacesSection.matchAll(/badge-surface-(endpoint|schema|ui|cli|mcp|infra)(?:-\d+)?\.svg/gi)].map(
  (match) => SURFACE_KIND_TITLE[match[1].toLowerCase()],
);
const fromParen = [...surfacesSection.matchAll(/\((Endpoint|Schema|UI|CLI|MCP|Infra)\)/g)].map(
  (match) => match[1],
);
const selectorLines = surfacesSection
  .split('\n')
  .map((line) => line.trim())
  .filter(
    (line) =>
      line &&
      !line.startsWith('<!--') &&
      !line.startsWith('-->') &&
      !line.startsWith('<img') &&
      !line.startsWith('-') &&
      !line.startsWith('*'),
  );
const fromLegacy = (surfacesSection.includes('**Risk:**') || /^##[ \t]+Review map\b/im.test(body) ? [] : selectorLines).flatMap((line) =>
  line
    .split(/[·|,/]|\s+/)
    .map((token) => token.trim())
    .filter(Boolean),
);
// The (Kind) tag right after a module bullet's bold name must be in the locked vocabulary:
// (Backend) or (DB) is forbidden, any other unknown tag is rejected too.
const bulletTags = [...surfacesSection.matchAll(/^[ \t]*[-*][ \t]+\*\*[^*\n]+\*\*[ \t]*\(([^)\n]+)\)/gm)].map(
  (match) => match[1].trim(),
);
const unknownTags = bulletTags.filter((tag) => !ALLOWED_SURFACES.has(tag) && !FORBIDDEN_SURFACE.test(tag));
const claimedRaw = [...fromChips, ...fromParen, ...bulletTags.filter((tag) => FORBIDDEN_SURFACE.test(tag)), ...fromLegacy];
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
const unmatchedProduct = productClaimed.filter((name) => !pathClasses[name]);
const surfacesReasons = [];
if (claimedForbidden.length > 0) {
  surfacesReasons.push(
    `stamped forbidden surface name(s) ${claimedForbidden.join(', ')} — never invent backend/DB surface names`,
  );
}
if (unknownTags.length > 0) {
  surfacesReasons.push(
    `unknown module kind tag(s) ${unknownTags.join(', ')} — use (Endpoint), (Schema), (UI), (CLI), (MCP), or (Infra)`,
  );
}
if (claimed.includes('Infra') && productClaimed.length > 0) {
  surfacesReasons.push('Infra stacked with a product surface — Infra only when the PR is solely CI/deploy/flags/env');
}
if (claimed.includes('Infra') && !pathClasses.Infra) {
  surfacesReasons.push('Infra stamped without infra path class — Infra only when the PR is solely CI/deploy/flags/env');
}
// Any stamped product surface must have a matching path class (skill-only + Schema fails here).
if (unmatchedProduct.length > 0) {
  surfacesReasons.push(
    `unmatched product surface(s) ${unmatchedProduct.join(', ')} — no matching path class; omit Surfaces when paths prove none (skill-only / docs-only)`,
  );
}
// migration-only ≠ UI: schema paths present, no UI paths, but UI claimed
if (claimed.includes('UI') && pathClasses.Schema && !pathClasses.UI && !pathClasses.Endpoint && !pathClasses.CLI && !pathClasses.MCP) {
  surfacesReasons.push('migration-only ≠ UI — schema/migration paths do not prove a UI surface');
}
// MCP-wrap-only ≠ Endpoint: MCP paths without API paths, but Endpoint claimed
if (claimed.includes('Endpoint') && pathClasses.MCP && !pathClasses.Endpoint) {
  surfacesReasons.push('MCP-wrap-only ≠ Endpoint — MCP wrap of an unchanged route is MCP only');
}
if (productClaimed.length > 3 && unmatchedProduct.length > 0) {
  surfacesReasons.push(
    `>3 product surfaces without matching path classes (${unmatchedProduct.join(', ')} lack path evidence)`,
  );
}
const surfaces = {
  ok: surfacesReasons.length === 0,
  claimed,
  forbidden: claimedForbidden,
  pathClasses,
  reasons: surfacesReasons,
};
const surfacesOk = surfaces.ok;

// ## Verification block: required when any test/eval file changed. Diff-derived; the gate runs nothing.
// Headings inside fenced examples and HTML comments are not sections.
// The Walkthrough is not prose: its "### " groups and pseudocode are cut before parsing.
const proseBody = proofBody
  .replace(/^[ \t]*(```|~~~)[^\n]*\n[\s\S]*?^[ \t]*\1[ \t]*$/gm, '')
  .replace(/<!--[\s\S]*?-->/g, '');
const section = (heading) => {
  const at = proseBody.search(new RegExp(String.raw`^#{2,3}[ \t]+${heading}\b`, 'im'));
  if (at === -1) return null;
  const afterHeading = proseBody.indexOf('\n', at);
  if (afterHeading === -1) return '';
  return untilNextBlock(proseBody.slice(afterHeading + 1));
};
const verificationSection = section('Verification');
const testsSection = verificationSection ?? section('Tests');
// The label closes explicitly (**Not covered:**, **Not covered**:, __…__, or plain Not covered:),
// and what follows must carry a letter or digit: `none` or a named behavior, never only
// whitespace, `*`, or punctuation.
const NOT_COVERED_LABEL =
  /^[ \t]*[-*][ \t]+(?:\*\*Not covered:?\*\*:?|__Not covered:?__:?|Not covered:)(.*)$/i;
const sectionLines = (testsSection ?? '').split('\n');
const notCoveredLines = sectionLines.filter((line) => NOT_COVERED_LABEL.test(line));
// Reviewer checklist: Not covered is `none`, or an empty label followed by `- [ ] <check>`
// boxes the human runs. Inline prose after the label, or boxes after `none`, fail.
const CHECKBOX = /^[ \t]*[-*][ \t]+\[[ xX]\][ \t]+(.*)$/;
const TICKED = /^[ \t]*[-*][ \t]+\[[xX]\]/;
// Deleted guards still carry coverage intent. Accept the existing removed label
// without letting automated-result bullets substitute for behavioral coverage.
const COVERAGE_LABEL = /^[ \t]*[-*][ \t]+\*\*Coverage(?: removed)?:\*\*[ \t]+\S/i;
const testLines = sectionLines.filter(
  (line) => /^[ \t]*[-*][ \t]+\S/.test(line) && !NOT_COVERED_LABEL.test(line) && !CHECKBOX.test(line)
    && (verificationSection === null || COVERAGE_LABEL.test(line)),
);
const checklist = (() => {
  const at = sectionLines.findIndex((line) => NOT_COVERED_LABEL.test(line));
  if (at === -1) return { ok: false, none: false, boxes: 0, reason: 'no Not covered line' };
  const rest = sectionLines[at].match(NOT_COVERED_LABEL)[1].trim();
  const after = [];
  for (const line of sectionLines.slice(at + 1)) {
    if (!line.trim()) { if (after.length) break; continue; }
    if (!CHECKBOX.test(line)) break;
    after.push(line.match(CHECKBOX)[1]);
  }
  const boxes = after.filter((text) => /[\p{L}\p{N}]/u.test(text)).length;
  if (/^none\.?$/i.test(rest))
    return after.length ? { ok: false, none: true, boxes, reason: '`none` with checkboxes' } : { ok: true, none: true, boxes: 0, reason: null };
  if (rest) return { ok: false, none: false, boxes, reason: 'Not covered items must be `- [ ]` checkboxes, not inline text' };
  const ticked = sectionLines.slice(at + 1, at + 1 + after.length).filter((line) => TICKED.test(line)).length;
  if (ticked) return { ok: false, none: false, boxes, reason: `${ticked} Not covered box(es) ticked; the reviewer ticks them, not the PR author` };
  if (!boxes || boxes !== after.length) return { ok: false, none: false, boxes, reason: 'Not covered has no `- [ ] <check>` items' };
  return { ok: true, none: false, boxes, reason: null };
})();
const reviewFocus = section('Verification') ?? section('Review focus') ?? '';
const NO_TEST_FLAG = /^[ \t]*[-*][ \t]+(?:\*\*|__)?No tests changed\b/im;
const tests = {
  files: testFiles,
  behaviorFiles,
  section: testsSection !== null,
  lines: testLines.length,
  notCovered: notCoveredLines.length > 0 && checklist.ok,
  checklist,
  noTestFlag: {
    needed: testFiles.length === 0 && behaviorFiles.length > 0,
    present: NO_TEST_FLAG.test(reviewFocus),
  },
};
const testsOk = testFiles.length === 0 || (tests.section && tests.lines > 0 && tests.notCovered);
const warnings = [];
if (tests.noTestFlag.needed && !tests.noTestFlag.present) {
  warnings.push(
    [
      `pr-media-gate: warning (does not block): ${behaviorFiles.length} behavior file(s) changed and no test/eval file changed.`,
      '  Next: add one bullet under ## Verification: "- **No tests changed:** <the behavior that changed with no test>".',
      '  Do not run tests or write new ones to clear this; it is a reviewer note.',
      `  Changed: ${behaviorFiles.join(', ')}`,
    ].join('\n'),
  );
}

// Walkthrough: the last block of the body is one <details> (open or closed) whose <summary>
// starts "Walkthrough". Inside: ≥1 "### " area group, ordered 🔴 → 🟡 → 🟢, each with a
// ```diff of logic pseudocode. Diff file headers and hunk headers fail hard. Code-shaped
// lines only warn, and only with two strong signals on one line, because pseudocode
// legitimately says "return 401", "export:", or "class = premium".
// Every Walkthrough link must be /blob/<40-hex sha>/ with the sha equal to --head (default HEAD).
const HARD_CODE_LINE = /^(?:@@ .* @@|diff --git |index [0-9a-f]+\.\.[0-9a-f]+|\+\+\+ [ab]\/|--- (?:a\/|\/dev\/null))/;
const CODE_SIGNALS = [
  ['assignment', /^\s*[\w.[\]&*]+\s*(?:[+\-*/%]=|:=|=(?!=))/],
  ['call', /[A-Za-z_]\w*\([^)]*\)/],
  ['member access', /\b[A-Za-z_]\w*\.[A-Za-z_]\w*\b(?!\.(?:md|mjs|ts|js|json|py|go)\b)/],
  ['equality operator', /[=!]==?/],
  ['SQL statement', /\b(?:SELECT\b[\s\S]*\bFROM|UPDATE\b[\s\S]*\bSET|INSERT INTO|DELETE FROM)\b/],
  ['bind parameter or pointer', /\$\d+\b|&[A-Za-z_]\w*/],
  ['quoted literal', /'[^']*'/],
  ['trailing semicolon', /;\s*$/],
  ['brace block', /\{\s*$|^\s*[})\]];?\s*$|=>\s*[{(]/],
];
const codeSignals = (line) => {
  const text = line.replace(/^[+\- ]/, '');
  return CODE_SIGNALS.filter(([, pattern]) => pattern.test(text)).map(([name]) => name);
};
const RISK_RANK = { High: 0, Medium: 1, Low: 2, '🔴': 0, '🟡': 1, '🟢': 2 };

// Balanced <details> matching, so a nested <details> inside a group does not end the section.
// Tags inside fenced code are text (pseudocode may mention <details>), so mask fences first;
// masking keeps offsets so slices of the original text stay aligned.
const findWalkthrough = (text) => {
  const tags = [...maskFences(text).matchAll(/<details\b[^>]*>|<\/details\s*>/gi)];
  for (let i = 0; i < tags.length; i += 1) {
    const open = tags[i];
    if (open[0].startsWith('</')) continue;
    const after = text.slice(open.index + open[0].length);
    const summary = after.match(/^\s*<summary\b[^>]*>\s*(?:<(?:b|strong)>\s*)?Walkthrough\b[\s\S]*?<\/summary>/i);
    if (!summary) continue;
    let depth = 0;
    for (let j = i; j < tags.length; j += 1) {
      depth += tags[j][0].startsWith('</') ? -1 : 1;
      if (depth === 0) {
        const innerStart = open.index + open[0].length + summary[0].length;
        return {
          inner: text.slice(innerStart, tags[j].index),
          trailing: text.slice(tags[j].index + tags[j][0].length),
        };
      }
    }
    return { inner: text.slice(open.index + open[0].length + summary[0].length), trailing: '', unclosed: true };
  }
  return null;
};

const headFlag = flag('--head', null);
const headResolved = git('rev-parse', '--verify', '--quiet', `${headFlag ?? 'HEAD'}^{commit}`);
if (headResolved.status !== 0) {
  notChecked(`git cannot resolve head "${headFlag ?? 'HEAD'}" to pin Walkthrough links. Pass --head <ref>.`);
}
const headSha = headResolved.stdout.trim();
// This repo's owner/name from origin, so links into other repos are not pin-checked. Without
// a GitHub origin, every github.com blob/tree link counts as a repo file link.
const repoSlug = (() => {
  const remote = git('remote', 'get-url', 'origin');
  const match = remote.status === 0 && remote.stdout.trim().match(/github\.com[:/]([^/]+\/[^/]+?)(?:\.git)?$/i);
  return match ? match[1].toLowerCase() : null;
})();
const GITHUB_FILE_LINK = /^https?:\/\/(?:www\.)?github\.com\/([^/]+\/[^/]+)\/(?:blob|tree)\//i;
// Repo file link = blob/tree path in this repo, or a relative path. Issues, PRs, anchors, and
// external URLs are allowed unpinned.
const isRepoFileLink = (url) => {
  const github = url.match(GITHUB_FILE_LINK);
  if (github) return repoSlug === null || github[1].toLowerCase() === repoSlug;
  return !/^(?:[a-z][a-z0-9+.-]*:|#|\/\/)/i.test(url);
};
const walkthroughLinks = (text) => {
  const urls = [
    ...[...text.matchAll(/\]\(\s*<?([^\s)>]+)>?(?:\s+"[^"]*")?\s*\)/g)].map((match) => match[1]),
    ...[...text.matchAll(/<a\b[^>]*\bhref=["']([^"']+)["']/gi)].map((match) => match[1]),
    ...[...text.matchAll(/(?<![("'=])\bhttps?:\/\/(?:www\.)?github\.com\/[^\s)<>"'\]]+/gi)].map((match) => match[0]),
  ];
  return [...new Set(urls)];
};
function pinReasons(links) {
  const out = [];
  for (const url of links) {
    const pinned = url.match(/\/(?:blob|tree)\/([0-9a-f]{40})(?:\/|$)/);
    if (!pinned) out.push(`link is not pinned to a 40-hex head SHA (/blob/<sha>/): ${url}`);
    else if (pinned[1] !== headSha) out.push(`link pins ${pinned[1].slice(0, 7)}, not the current head ${headSha.slice(0, 7)}: ${url}`);
  }
  return out;
}
const walkthroughReasons = [];
const walkthroughWarnings = [];
const walkthroughGroups = [];
const walkthroughBlock = findWalkthrough(body);
if (!walkthroughBlock) {
  if (/^#{1,6}[ \t]+Walkthrough\b/im.test(maskFences(body)))
    walkthroughReasons.push('Walkthrough must be collapsed in <details>');
} else {
  if (walkthroughBlock.unclosed) walkthroughReasons.push('Walkthrough <details> is never closed');
  const trailing = walkthroughBlock.trailing.replace(/<!--[\s\S]*?-->/g, '').trim();
  if (trailing) walkthroughReasons.push('Walkthrough is not the last section of the body');
  const parts = walkthroughBlock.inner.split(/^###[ \t]+/m).slice(1);
  if (parts.length === 0) walkthroughReasons.push('Walkthrough has no "### " area group');
  let lastRank = -1;
  for (const part of parts) {
    const heading = part.split('\n')[0].trim();
    const marker = Object.keys(RISK_RANK).find((emoji) => heading.startsWith(emoji));
    const fence = part.match(/^```diff[ \t]*\n([\s\S]*?)^```[ \t]*$/m);
    const group = { heading, risk: marker ?? null, diff: Boolean(fence), realCode: [], codeLike: [] };
    if (!marker) walkthroughReasons.push(`group "${heading}" has no 🔴/🟡/🟢 risk marker`);
    else if (RISK_RANK[marker] < lastRank) {
      walkthroughReasons.push(`group "${heading}" is out of risk order — order groups 🔴 → 🟡 → 🟢`);
    } else lastRank = RISK_RANK[marker];
    if (!fence) walkthroughReasons.push(`group "${heading}" has no \`\`\`diff pseudocode fence`);
    else {
      for (const line of fence[1].split('\n')) {
        if (HARD_CODE_LINE.test(line)) group.realCode.push(line);
        else {
          const signals = codeSignals(line);
          if (signals.length >= 2) group.codeLike.push({ line, signals });
        }
      }
      if (group.realCode.length > 0) {
        walkthroughReasons.push(
          `group "${heading}" diff contains real diff/hunk headers, not logic pseudocode: ${group.realCode.slice(0, 2).join(' | ')}`,
        );
      }
      for (const { line, signals } of group.codeLike) {
        walkthroughWarnings.push(
          `pr-media-gate: warning — Walkthrough group "${heading}" line looks like real code (${signals.join(', ')}): ${line.trim()}`,
        );
      }
    }
    walkthroughGroups.push(group);
  }
  const links = walkthroughLinks(maskFences(walkthroughBlock.inner)).filter(isRepoFileLink);
  if (links.length === 0) walkthroughReasons.push('Walkthrough has no file links pinned to the head SHA');
  walkthroughReasons.push(...pinReasons(links));
}
// Change and proof: the Closes/Refs spec link (any repo file link there) pins the head too.
const problemSection = (() => {
  const match = maskFences(body).match(/^##[ \t]+(?:Change and proof|What Problem This Solves)[ \t]*$([\s\S]*?)(?=^##[ \t]|<details\b|$(?![\s\S]))/im);
  return match ? match[1].replace(/<!--[\s\S]*?-->/g, '') : '';
})();
// Embedded images and video are Before/After proof, checked by the media rule; only links count.
const problemProse = problemSection.replace(/!\[[^\]\n]*\]\([^)\n]*\)/g, '').replace(/<(?:img|video|source|track)\b[^>]*>/gi, '');
const problemLinkReasons = pinReasons(walkthroughLinks(problemProse).filter(isRepoFileLink));
const problemLinks = { ok: problemLinkReasons.length === 0, reasons: problemLinkReasons };
const walkthrough = {
  ok: walkthroughReasons.length === 0,
  head: headSha,
  repo: repoSlug,
  groups: walkthroughGroups,
  included: walkthroughBlock !== null,
  reasons: walkthroughReasons,
  warnings: walkthroughWarnings.length,
};
const walkthroughOk = walkthrough.ok;

// --template <path>: the repo's own PR template. Every "## " heading it has must survive in the
// body, in the template's order. Extra headings (the vs sections) may sit between or after.
const templatePath = flag('--template', null);
// A template section is a `#`–`######` heading or a line that is only a bold label (`**Notes:**`).
// Matching ignores a leading emoji/symbol, case, spacing, and a trailing colon.
const normHeading = (text) =>
  text.replace(/<!--[\s\S]*?-->/g, '').replace(/^[^\p{L}\p{N}]+/u, '').trim().replace(/\s+/g, ' ').replace(/[:#*\s]+$/, '').toLowerCase();
const stripNoise = (text) => text.replace(/<!--[\s\S]*?-->/g, '').replace(/^(```|~~~)[\s\S]*?^\1/gm, '');
const HEADING_LINE = /^(?:#{1,6}[ \t]+(.+?)|\*\*([^*\n]+?)\*\*[ \t]*:?[ \t]*)$/gm;
const BODY_HEADING_LINE = /^(?:#{1,6}[ \t]+(.+?)|\*\*([^*\n]+?)\*\*[ \t]*:?.*)$/gm;
const headingsOf = (text, re) => [...stripNoise(text).matchAll(re)].map((m) => normHeading(m[1] ?? m[2])).filter(Boolean);
const CHECK_ITEM = /^[ \t]*[-*+][ \t]+\[[ xX]\][ \t]+(.+?)[ \t]*$/gm;
const checklistOf = (text) => [...stripNoise(text).matchAll(CHECK_ITEM)].map((m) => m[1].replace(/\s+/g, ' ').toLowerCase());
let template = null;
if (templatePath !== null) {
  if (!fs.existsSync(templatePath)) notChecked(`--template file not found: ${templatePath}`);
  const templateText = fs.readFileSync(templatePath, 'utf8');
  const wanted = headingsOf(templateText, HEADING_LINE);
  if (wanted.length === 0) notChecked(`could not check --template ${templatePath}: it has no heading or bold-label section.`);
  const have = headingsOf(body, BODY_HEADING_LINE);
  const missing = [];
  let cursor = 0;
  for (const heading of wanted) {
    const at = have.indexOf(heading, cursor);
    if (at === -1) missing.push(have.includes(heading) ? `${heading} (out of template order)` : heading);
    else cursor = at + 1;
  }
  const bodyChecks = new Set(checklistOf(body));
  const checks = checklistOf(templateText);
  const missingChecks = checks.filter((item) => !bodyChecks.has(item));
  template = {
    path: templatePath,
    headings: wanted.length,
    checklist: checks.length,
    missing,
    missingChecks,
    ok: missing.length === 0 && missingChecks.length === 0,
  };
}
const templateOk = template === null || template.ok;
warnings.push(...walkthroughWarnings);
// Root cause: a bugfix PR (--bugfix) has one `Root cause: <mechanism>` line under What Problem.
const ROOT_CAUSE = /^[ \t]*(?:\*\*Root cause:?\*\*:?|__Root cause:?__:?|Root cause:)[ \t]*(.*)$/im;
const problemText = section('Change and proof') ?? section('What Problem This Solves') ?? '';
const rootCauseMatch = problemText.match(ROOT_CAUSE);
// Bugfix detection: the branch name, the PR title (--title, else `gh pr view` when it
// answers), or the FIRST commit subject after the merge-base. Later `fix:` commits
// (CI repairs, review fixes) on a feature branch never make it a bugfix.
const FIX_BRANCH = /(?:^|\/)(?:hot)?fix[\/-]/i;
const FIX_SUBJECT = /^fix(?:\([^)]*\))?!?:/i;
const prTitle = () => {
  const given = flag('--title', null);
  if (given !== null) return given;
  const gh = spawnSync('gh', ['pr', 'view', '--json', 'title', '--jq', '.title'], { encoding: 'utf8', timeout: 5000 });
  return gh.status === 0 ? gh.stdout.trim() || null : null;
};
const detectBugfix = () => {
  const branch = git('rev-parse', '--abbrev-ref', headFlag ?? 'HEAD').stdout.trim();
  if (branch && branch !== 'HEAD' && FIX_BRANCH.test(branch)) return `branch ${branch}`;
  const title = prTitle();
  if (title && FIX_SUBJECT.test(title)) return `title "${title}"`;
  const log = git('log', '--reverse', '--format=%s', `${base}..${headSha}`);
  const first = log.status === 0 ? log.stdout.split('\n')[0] : '';
  return first && FIX_SUBJECT.test(first) ? `first commit "${first}"` : null;
};
const detected = bugfixFlag === null ? detectBugfix() : null;
const bugfix = bugfixFlag ?? Boolean(detected);
const rootText = rootCauseMatch ? rootCauseMatch[1].replace(/[*_`]/g, ' ').trim() : '';
const rootProblem = !rootCauseMatch
  ? 'missing'
  : /<[^>]*>/.test(rootText)
    ? 'a <placeholder>'
    : /\b(?:TBD|TODO)\b/i.test(rootText) || /^(?:unknown|root cause unknown|unknown root cause|cause unknown|N\/?A)\.?$/i.test(rootText)
      ? 'TBD/TODO/unknown/N/A'
      : (rootText.match(/[\p{L}\p{N}]+/gu) ?? []).length < 4
        ? 'fewer than 4 words'
        : null;
const rootCause = {
  bugfix,
  source: bugfixFlag !== null ? 'flag' : detected,
  present: rootProblem === null,
  problem: bugfix ? rootProblem : null,
};
const rootCauseOk = !bugfix || rootCause.present;
// TL;DR: the first non-empty content of the body is exactly two short plain lines
// (optionally under a lone **TL;DR** label): what changes and for whom, then the effect.
// No heading, list, link, code, badge, or HTML, and line 1 must not echo --title.
const tldr = (() => {
  const lines = body.replace(/^\uFEFF/, '').split('\n');
  let i = 0;
  while (i < lines.length && !lines[i].trim()) i += 1;
  const block = [];
  for (; i < lines.length && lines[i].trim(); i += 1) block.push(lines[i].trim());
  const labeled = block.length > 0 && /^\*\*TL;DR\*\*:?$/i.test(block[0]);
  const content = labeled ? block.slice(1) : block;
  const reasons = [];
  // Not a TL;DR candidate: a heading, HTML, a list/quote/table row, or a bold/italic-led
  // line (`**Before** …`, `**Door:**`). Those bodies have no TL;DR at all: report missing.
  const NOT_CANDIDATE = /^(?:#{1,6}[ \t]|<|[-*+>|][ \t]|\d+[.)][ \t]|\*\*|__|[*_](?=\S))/;
  if (!content.length || NOT_CANDIDATE.test(content[0]))
    return { ok: false, labeled, lines: 0, reasons: ['missing: the body must start with a two-line TL;DR, before Review map and any repo template'] };
  if (content.length !== 2) reasons.push(`has ${content.length} line(s); write exactly 2`);
  content.forEach((line, n) => {
    const at = `line ${n + 1}`;
    if (/^(?:#{1,6}[ \t]|[-*+>|][ \t]|\d+[.)][ \t])/.test(line)) reasons.push(`${at} is a heading, list, quote, or table row; write plain text`);
    if (/\]\(|https?:\/\/|<a\b|\b[\w-]+(?:\.[\w-]+)+\/\S*/i.test(line)) reasons.push(`${at} has a link`);
    if (/\*\*|__|(?:^|[\s(])[*_](?=\S)[^*_\n]*\S[*_](?=$|[\s.,;:!?)])/.test(line)) reasons.push(`${at} has bold or italic markup; write plain text`);
    if (/`/.test(line)) reasons.push(`${at} has code`);
    if (/<img\b|!\[/i.test(line)) reasons.push(`${at} has a badge or image`);
    if (/<[a-z][^>]*>/i.test(line) && !/<img\b|<a\b/i.test(line)) reasons.push(`${at} has HTML`);
    const words = (line.match(/[\p{L}\p{N}]+/gu) ?? []).length;
    if (words < 3) reasons.push(`${at} has ${words} word(s); write at least 3`);
    if (words > 20) reasons.push(`${at} has ${words} words; keep it under 21`);
  });
  const norm = (t) => String(t).toLowerCase().replace(/^[a-z]+(?:\([^)]*\))?!?:\s*/, '').replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
  const title = flag('--title', null);
  if (title && content[0] && norm(content[0]) === norm(title)) reasons.push('line 1 echoes the PR title; say what changes and for whom');
  return { ok: reasons.length === 0, labeled, lines: content.length, reasons };
})();
const tldrOk = tldr.ok;
const explainerOk = explainerReasons.length === 0;
const valid = rootCauseOk && tldrOk && mediaOk && beforeAfterOk && mergeDangerOk && contractOk && surfacesOk && testsOk && walkthroughOk && templateOk && problemLinks.ok && explainerOk;

process.stdout.write(
  `${JSON.stringify({ valid, base, frontendFiles, apiFiles, schemaFiles, cliFiles, mcpFiles, infraFiles, images, videos, media, localRefs: localRefs.map((ref) => ref.url), gapStated, beforeAfter, mergeDanger, contract, surfaces, tests, walkthrough, template, problemLinks, rootCause, tldr, explainer: { ...explainer, ok: explainerOk, reasons: explainerReasons }, warnings: warnings.length }, null, 2)}\n`,
);

if (warnings.length > 0) process.stderr.write(`${warnings.join('\n')}\n`);
if (valid) process.exit(0);

if (!explainerOk) process.stderr.write(`pr-media-gate: ${explainerReasons.join('; ')}.\n  Next: rerun vs-explain-pr's attach.mjs; it writes the block in the right shape and place.\n`);
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
        '  Next: classify from the diff, one line each, under a "## Review map" heading:',
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
        '  Every stamped surface needs a matching path class; omit Surfaces on skill-only / docs-only.',
        '  Endpoint not backend; Schema = wire + persistence (no separate DB).',
      ].join('\n')
    : null,
  !testsOk
    ? [
        `pr-media-gate: ${testFiles.length} test/eval file(s) changed and the PR body has no complete ## Verification block.`,
        !tests.section ? '  Missing: the "## Verification" heading.' : null,
        tests.section && tests.lines === 0 ? '  Missing: one line per changed test naming the behavior it proves.' : null,
        tests.section && !tests.notCovered
          ? `  Not covered: ${tests.checklist.reason}. Write "- **Not covered:** none", or the label alone followed by "  - [ ] <concrete check the reviewer runs>" lines.`
          : null,
        '  Next: write it from the diff only. Do not run tests to fill it.',
        '    - `<test file or case>` — proves <behavior, not the test name restated>',
        '    - Deleted `<test>` — <behavior it no longer guards>',
        '    - **Not covered:** none   (or the label alone, then "  - [ ] <check the reviewer runs>")',
        `  Changed: ${testFiles.join(', ')}`,
      ]
        .filter(Boolean)
        .join('\n')
    : null,
  !walkthroughOk
    ? [
        'pr-media-gate: Walkthrough failed.',
        ...walkthroughReasons.map((reason) => `  - ${reason}`),
        '  Next: end the body with <details><summary>Walkthrough: N areas, M files</summary>, one',
        '  "### 🔴|🟡|🟢 <Area> · <risk>" group per area (riskiest first), each with a ```diff of',
        '  language-agnostic logic pseudocode (- old, + new) and head-pinned file links. No real code.',
      ].join('\n')
    : null,
  !tldrOk
    ? [
        'pr-media-gate: TL;DR failed.',
        ...tldr.reasons.map((reason) => `  - ${reason}`),
        '  Next: start the body (before Merge risk and any repo template) with exactly two plain lines:',
        '    <what changes, for whom>',
        '    <the effect or result>',
        '  Optional lone **TL;DR** label above them. No heading, link, code, or badge.',
      ].join('\n')
    : null,
  !rootCauseOk
    ? [
        `pr-media-gate: bugfix PR (${rootCause.source}) and the Change and proof Root cause line is ${rootCause.problem}.`,
        '  Not a bugfix? pass --bugfix=false.',
        '  Next: after the STE scenario, add one line "Root cause: <mechanism that caused the bug>".',
      ].join('\n')
    : null,
  !templateOk
    ? [
        `pr-media-gate: the repo PR template (${template.path}) lost ${template.missing.length} section(s) and ${template.missingChecks.length} checklist item(s).`,
        ...template.missing.map((heading) => `  - missing section: ${heading}`),
        ...template.missingChecks.map((item) => `  - missing checklist item: - [ ] ${item}`),
        '  Next: keep every template heading in its order; write N/A under one that does not apply.',
        '  Never delete a template section. Put the vs sections in matching headings or after the template.',
      ].join('\n')
    : null,
  !problemLinks.ok
    ? [
        'pr-media-gate: a repo file link under Change and proof (the spec link) is not pinned to the head.',
        ...problemLinks.reasons.map((reason) => `  - ${reason}`),
        '  Next: link the spec as https://github.com/<owner>/<repo>/blob/<HEAD_SHA>/<path>, like the Walkthrough links.',
      ].join('\n')
    : null,
  !mediaOk
    ? [
        `pr-media-gate: ${frontendFiles.length} frontend file(s) changed and the PR body lacks matched hosted media pairs.`,
        localRefs.length > 0
          ? `  ${localRefs.length} reference(s) point at a local path the reviewer cannot open: ${localRefs.map((ref) => ref.url).join(', ')}. Upload them and embed the returned URL.`
          : null,
        ...media.reasons.map(reason => `  - ${reason}`),
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
