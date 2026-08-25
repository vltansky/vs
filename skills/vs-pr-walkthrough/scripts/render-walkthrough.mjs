#!/usr/bin/env node

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const DEFAULT_FOLD = String.raw`\.spec\.|\.driver\.|^docs/|lock|version_file|snap`;
const RICH_TAGS = /&lt;(\/?)((?:b|i|em|strong|code|br))\s*\/?&gt;/gi;
const LANG = {
  ts: 'ts', tsx: 'ts', mts: 'ts', cts: 'ts', js: 'ts', jsx: 'ts', mjs: 'ts', cjs: 'ts',
  scala: 'jvm', java: 'jvm', kt: 'jvm', kts: 'jvm', json: 'json', py: 'py',
  css: 'css', scss: 'css', less: 'css', sh: 'sh', bash: 'sh', zsh: 'sh', yml: 'yaml', yaml: 'yaml',
  md: '', snap: '',
};
const KEYWORDS = Object.fromEntries(Object.entries({
  ts: `abstract any as async await boolean break case catch class const constructor continue declare default delete do else enum export extends false finally for from function get if implements import in infer instanceof interface is keyof let new null number of private protected public readonly return satisfies set static string super switch symbol this throw true try type typeof undefined unknown var void while yield`,
  jvm: `abstract case catch class def do else enum extends false final finally for forSome if implicit import lazy match new null object override package private protected return sealed super this throw trait true try type val var while with yield boolean int long double public static void interface implements`,
  py: `and as assert async await break class continue def del elif else except False finally for from global if import in is lambda None nonlocal not or pass raise return True try while with yield`,
  json: `true false null`,
  css: `important from to and not only screen print media supports keyframes mixin include use`,
  sh: `if then else elif fi for while do done case esac function return local export echo cd set unset in`,
  yaml: `true false null yes no on off`,
}).map(([language, words]) => [language, new Set(words.split(/\s+/))]));
const TOKENS = /(?<str>"(?:\\.|[^"\\])*"?|'(?:\\.|[^'\\])*'?|`(?:\\.|[^`\\])*`?)|(?<comment>\/\/.*|#.*)|(?<ann>@[A-Za-z_]\w*)|(?<num>\b\d[\d_]*(?:\.\d+)?(?:[eE][-+]?\d+)?\b)|(?<word>[A-Za-z_$][\w$]*)/g;
const HASH_COMMENT = new Set(['py', 'sh', 'yaml']);

function fail(message) {
  process.stderr.write(`walkthrough: ${message}\n`);
  process.exit(1);
}

function args(argv) {
  const parsed = {};
  let index = 0;
  if (argv[0] && !argv[0].startsWith('-')) {
    parsed.config = argv[0];
    index = 1;
  }
  for (; index < argv.length; index += 2) {
    const flag = argv[index];
    const value = argv[index + 1];
    if (!['--config', '--diff', '--out'].includes(flag) || !value) {
      fail('usage: render-walkthrough.mjs config.json [--diff pr.diff] [--out walkthrough.html]');
    }
    parsed[flag.slice(2)] = value;
  }
  if (!parsed.config) fail('usage: render-walkthrough.mjs config.json [--diff pr.diff] [--out walkthrough.html]');
  return parsed;
}

function read(file, label) {
  try {
    return fs.readFileSync(file, 'utf8');
  } catch (error) {
    fail(`cannot read ${label} ${file}: ${error.message}`);
  }
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function safeJson(value) {
  return JSON.stringify(value).replaceAll('<', '\\u003c');
}

function rich(value = '') {
  return escapeHtml(value).replace(RICH_TAGS, (_, slash, tag) => `<${slash}${tag.toLowerCase()}>`);
}

function languageFor(file) {
  const extension = file.includes('.') ? file.split('.').at(-1).toLowerCase() : '';
  return LANG[extension] ?? '';
}

function highlight(text, language, state) {
  if (!language) return escapeHtml(text);
  const stripped = text.trim();
  if (state.block) {
    if (text.includes('*/')) state.block = false;
    return `<span class="tk-c">${escapeHtml(text)}</span>`;
  }
  if (stripped.startsWith('/*')) {
    if (!stripped.includes('*/')) state.block = true;
    return `<span class="tk-c">${escapeHtml(text)}</span>`;
  }
  if (stripped.startsWith('*') && !stripped.startsWith('*=')) return `<span class="tk-c">${escapeHtml(text)}</span>`;

  const output = [];
  let last = 0;
  for (const match of text.matchAll(TOKENS)) {
    output.push(escapeHtml(text.slice(last, match.index)));
    const value = match[0];
    let className = '';
    if (match.groups.comment && (!value.startsWith('#') || HASH_COMMENT.has(language))) className = 'tk-c';
    else if (match.groups.str) className = 'tk-s';
    else if (match.groups.num) className = 'tk-n';
    else if (match.groups.ann) className = 'tk-a';
    else if (KEYWORDS[language]?.has(value)) className = 'tk-k';
    else if (/^[A-Z]/.test(value)) className = 'tk-t';
    output.push(className ? `<span class="${className}">${escapeHtml(value)}</span>` : escapeHtml(value));
    last = match.index + value.length;
  }
  output.push(escapeHtml(text.slice(last)));
  return output.join('');
}

function validateConfig(config) {
  if (!config || typeof config !== 'object' || Array.isArray(config)) fail('config must be a JSON object');
  if (!/^https:\/\/github\.com\/[\w.-]+\/[\w.-]+\/pull\/\d+$/.test(config.pr ?? '')) {
    fail('config.pr must be a full GitHub pull-request URL');
  }
  if (!/^[0-9a-f]{40}$/i.test(config.headSha ?? '')) fail('config.headSha must be a 40-character commit SHA');
  for (const field of ['title', 'intro', 'subtitle', 'pr_label', 'path_prefix', 'out']) {
    if (config[field] !== undefined && typeof config[field] !== 'string') fail(`config.${field} must be a string`);
  }
  if (config.fold !== undefined) {
    if (typeof config.fold !== 'string') fail('config.fold must be a regular-expression string');
    try { new RegExp(config.fold); } catch (error) { fail(`config.fold is invalid: ${error.message}`); }
  }
  if (!Array.isArray(config.sections) || config.sections.length < 1 || config.sections.length > 8) {
    fail('config.sections must contain between 1 and 8 sections');
  }

  const ids = new Set();
  for (const [index, section] of config.sections.entries()) {
    if (!section || typeof section !== 'object' || Array.isArray(section)) fail(`section ${index + 1} must be an object`);
    if (!/^[A-Za-z][\w-]*$/.test(section.id ?? '')) fail(`section ${index + 1} has an invalid id`);
    if (ids.has(section.id)) fail(`duplicate section id: ${section.id}`);
    ids.add(section.id);
    if (typeof section.title !== 'string' || !section.title.trim()) fail(`section ${section.id}.title must be a non-empty string`);
    if (section.lede !== undefined && typeof section.lede !== 'string') fail(`section ${section.id}.lede must be a string`);
    if (!Array.isArray(section.files) || section.files.length === 0 || section.files.some((file) => typeof file !== 'string' || !file)) {
      fail(`section ${section.id}.files must be a non-empty string array`);
    }
    if (section.watch !== undefined && (!Array.isArray(section.watch) || section.watch.some((item) => typeof item !== 'string'))) {
      fail(`section ${section.id}.watch must be a string array`);
    }
    if (section.notes !== undefined && (!Array.isArray(section.notes) || section.notes.some((note) => !note || typeof note !== 'object' || typeof note.file !== 'string' || typeof note.text !== 'string'))) {
      fail(`section ${section.id}.notes must contain {file, text} objects`);
    }
    if (section.fold !== undefined && typeof section.fold !== 'boolean') fail(`section ${section.id}.fold must be boolean`);
  }
}

function parseDiff(text) {
  const files = [];
  let current;
  let hunk;

  for (const line of text.split('\n')) {
    if (line.startsWith('diff --git ')) {
      const match = /^diff --git a\/(.+) b\/(.+)$/.exec(line);
      if (!match) fail(`unsupported diff header: ${line}`);
      current = {
        oldPath: match[1],
        path: match[2],
        status: 'modified',
        added: 0,
        removed: 0,
        binary: false,
        hunks: [],
      };
      files.push(current);
      hunk = undefined;
      continue;
    }
    if (!current) continue;
    if (line.startsWith('new file mode')) current.status = 'added';
    else if (line.startsWith('deleted file mode')) current.status = 'deleted';
    else if (line.startsWith('rename from ') || line.startsWith('rename to ')) current.status = 'renamed';
    else if (line.startsWith('Binary files ') || line.startsWith('GIT binary patch')) current.binary = true;
    else if (line.startsWith('@@')) {
      const match = /^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@(.*)$/.exec(line);
      if (!match) fail(`unsupported hunk header in ${current.path}: ${line}`);
      hunk = { oldLine: Number(match[1]), newLine: Number(match[3]), context: match[5].trim(), rows: [] };
      current.hunks.push(hunk);
    } else if (hunk && line.startsWith('+')) {
      hunk.rows.push({ kind: 'add', old: null, new: hunk.newLine, text: line.slice(1) });
      hunk.newLine += 1;
      current.added += 1;
    } else if (hunk && line.startsWith('-')) {
      hunk.rows.push({ kind: 'del', old: hunk.oldLine, new: null, text: line.slice(1) });
      hunk.oldLine += 1;
      current.removed += 1;
    } else if (hunk && line.startsWith(' ')) {
      hunk.rows.push({ kind: 'ctx', old: hunk.oldLine, new: hunk.newLine, text: line.slice(1) });
      hunk.oldLine += 1;
      hunk.newLine += 1;
    }
  }
  if (files.length === 0) fail('diff contains no changed files');
  return files;
}

function validatePlacement(config, files) {
  const changed = new Set(files.map((file) => file.path));
  const seen = new Set();
  const duplicates = new Set();
  const unknown = new Set();
  const invalidNotes = new Set();

  for (const section of config.sections) {
    const sectionFiles = new Set(section.files);
    for (const file of section.files) {
      if (seen.has(file)) duplicates.add(file);
      seen.add(file);
      if (!changed.has(file)) unknown.add(file);
    }
    for (const note of section.notes ?? []) {
      if (!sectionFiles.has(note.file)) invalidNotes.add(note.file);
    }
  }
  const missing = [...changed].filter((file) => !seen.has(file));
  const problems = [];
  if (missing.length) problems.push(`missing changed files: ${missing.join(', ')}`);
  if (duplicates.size) problems.push(`files listed more than once: ${[...duplicates].join(', ')}`);
  if (unknown.size) problems.push(`listed files absent from diff: ${[...unknown].join(', ')}`);
  if (invalidNotes.size) problems.push(`note paths must exactly match a file in their section: ${[...invalidNotes].join(', ')}`);
  if (problems.length) fail(problems.join('\n'));
}

function githubAnchor(file) {
  return `diff-${crypto.createHash('sha256').update(file).digest('hex')}`;
}

function fetchDiff(config, destination) {
  const match = /^https:\/\/github\.com\/([^/]+)\/([^/]+)\/pull\/(\d+)$/.exec(config.pr);
  const [, owner, repo, number] = match;
  const repository = `${owner}/${repo}`;
  const head = spawnSync('gh', ['pr', 'view', number, '--repo', repository, '--json', 'headRefOid', '--jq', '.headRefOid'], { encoding: 'utf8' });
  if (head.status !== 0) fail(`gh pr view failed: ${head.stderr.trim()}`);
  if (head.stdout.trim().toLowerCase() !== config.headSha.toLowerCase()) {
    fail(`PR head moved: expected ${config.headSha}, got ${head.stdout.trim()}`);
  }
  const diff = spawnSync('gh', ['pr', 'diff', number, '--repo', repository], { encoding: 'utf8', maxBuffer: 1024 * 1024 * 100 });
  if (diff.status !== 0) fail(`gh pr diff failed: ${diff.stderr.trim()}`);
  fs.writeFileSync(destination, diff.stdout);
  return destination;
}

function renderRows(file, pr) {
  if (file.binary) return '<p class="empty">Binary diff — open this file on GitHub.</p>';
  if (file.hunks.length === 0) return '<p class="empty">No textual hunks.</p>';
  const rows = [];
  const language = languageFor(file.path);
  const state = {};
  for (const hunk of file.hunks) {
    rows.push(`<tr class="hunk"><td></td><td></td><td><code>@@ ${escapeHtml(hunk.context)}</code></td></tr>`);
    for (const row of hunk.rows) {
      const number = row.kind === 'del' ? row.old : row.new;
      const side = row.kind === 'del' ? 'L' : 'R';
      const href = `${pr}/files#${githubAnchor(file.path)}${side}${number}`;
      rows.push(
        `<tr class="line ${row.kind}" data-href="${escapeHtml(href)}" title="Open this line on GitHub">` +
        `<td class="ln">${row.old ?? ''}</td><td class="ln">${row.new ?? ''}</td>` +
        `<td><code><span class="mark">${row.kind === 'add' ? '+' : row.kind === 'del' ? '−' : ' '}</span>${highlight(row.text, language, state)}</code></td></tr>`,
      );
    }
  }
  return `<table class="diff"><tbody>${rows.join('')}</tbody></table>`;
}

function renderFile(file, section, config, foldPattern) {
  const defaultFold = section.fold || foldPattern.test(file.path);
  const badge = file.status === 'modified' ? '' : `<span class="pill pill-${file.status}">${escapeHtml(file.status)}</span>`;
  const displayPath = config.path_prefix && file.path.startsWith(config.path_prefix)
    ? file.path.slice(config.path_prefix.length)
    : file.path;
  const note = section.notes?.find((candidate) => candidate.file === file.path);
  const noteHtml = note ? `<div class="note">${rich(note.text)}</div>` : '';
  return `${noteHtml}<article class="file${defaultFold ? ' collapsed' : ''}" data-path="${escapeHtml(file.path)}" data-default-fold="${defaultFold}">
    <div class="file-head">
      <button class="file-toggle" type="button" aria-label="Toggle ${escapeHtml(file.path)}"><span class="chev">▾</span><strong class="fname">${escapeHtml(displayPath)}</strong></button>
      ${badge}<span class="stat"><span class="a">+${file.added}</span> <span class="d">−${file.removed}</span></span>
      <a class="ghlink" href="${escapeHtml(`${config.pr}/files#${githubAnchor(file.path)}`)}" target="_blank" rel="noopener">view on GitHub ↗</a>
      <label class="viewed-box"><input class="file-viewed" type="checkbox"> Viewed</label>
    </div>
    <div class="file-body">${renderRows(file, config.pr)}</div>
  </article>`;
}

function renderSection(section, byPath, config, foldPattern) {
  const watch = section.watch?.length
    ? `<aside class="watch"><strong>What to look at</strong><ul>${section.watch.map((item) => `<li>${rich(item)}</li>`).join('')}</ul></aside>`
    : '';
  const files = section.files.map((file) => renderFile(byPath.get(file), section, config, foldPattern)).join('\n');
  return `<section class="section" id="${escapeHtml(section.id)}" data-complete="false">
    <div class="sec-head"><button class="section-toggle" type="button"><span class="sec-chev">▾</span><h2>${escapeHtml(section.title)}</h2></button><span class="sec-count">0 / ${section.files.length}</span><label class="viewed-box"><input class="section-viewed" type="checkbox"> Section read</label></div>
    <div class="lede">${rich(section.lede)}</div>${watch}${files}
  </section>`;
}

function renderDocument(config, files) {
  const byPath = new Map(files.map((file) => [file.path, file]));
  const totalAdded = files.reduce((sum, file) => sum + file.added, 0);
  const totalRemoved = files.reduce((sum, file) => sum + file.removed, 0);
  const storageKey = `vs-pr-walkthrough:${config.pr}@${config.headSha}`;
  const foldPattern = new RegExp(config.fold ?? DEFAULT_FOLD);
  const number = config.pr.split('/').at(-1);
  const repo = config.pr.split('/')[4];
  const title = config.title || 'PR review';
  const prLabel = config.pr_label || `${repo} PR #${number}`;
  const navigation = config.sections.map((section) => {
    const chosen = section.files.map((file) => byPath.get(file));
    const added = chosen.reduce((sum, file) => sum + file.added, 0);
    const removed = chosen.reduce((sum, file) => sum + file.removed, 0);
    return `<li><a href="#${escapeHtml(section.id)}">${escapeHtml(section.title)}</a><span class="toc-stat">${chosen.length} files · <span class="a">+${added}</span> <span class="d">−${removed}</span></span></li>`;
  }).join('');
  const sections = config.sections.map((section) => renderSection(section, byPath, config, foldPattern)).join('\n');

  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escapeHtml(title)} · PR walkthrough</title>
<style>
:root{--bg:#fff;--bg-alt:#f6f8fa;--fg:#1f2328;--muted:#59636e;--border:#d1d9e0;--accent:#0969da;--add-bg:#e6ffec;--add-ln:#ccffd8;--del-bg:#ffebe9;--del-ln:#ffd7d5;--hunk-bg:#f6f8fa;--viewed-bg:#eef6ef;--pill:#ddf4ff;--shadow:0 1px 3px rgba(31,35,40,.08);--tk-c:#59636e;--tk-s:#0a3069;--tk-k:#cf222e;--tk-n:#0550ae;--tk-t:#953800;--tk-a:#8250df;--topbar:47px}
@media(prefers-color-scheme:dark){:root:not([data-theme="light"]){--bg:#0d1117;--bg-alt:#151b23;--fg:#e6edf3;--muted:#9198a1;--border:#3d444d;--accent:#4493f8;--add-bg:#12261e;--add-ln:#1b4721;--del-bg:#25171c;--del-ln:#542426;--hunk-bg:#151b23;--viewed-bg:#12261e;--pill:#121d2f;--shadow:none;--tk-c:#9198a1;--tk-s:#a5d6ff;--tk-k:#ff7b72;--tk-n:#79c0ff;--tk-t:#ffa657;--tk-a:#d2a8ff}}
*{box-sizing:border-box}html{scroll-behavior:smooth}body{margin:0;background:var(--bg);color:var(--fg);font:14px/1.55 -apple-system,BlinkMacSystemFont,"Segoe UI",Noto Sans,Helvetica,Arial,sans-serif}a{color:var(--accent);text-decoration:none}a:hover{text-decoration:underline}button{font:inherit;color:inherit}code{font-family:ui-monospace,SFMono-Regular,"SF Mono",Menlo,Consolas,monospace;font-size:.92em;background:var(--bg-alt);padding:.12em .4em;border-radius:6px}.wrap{max-width:1180px;margin:0 auto;padding:24px 16px 96px}.top{border-bottom:1px solid var(--border);padding-bottom:16px;margin-bottom:8px}.top h1{font-size:22px;margin:0 0 6px}.sub{color:var(--muted)}.a{color:#1a7f37}.d{color:#cf222e}.progressbar{position:sticky;top:0;z-index:20;background:var(--bg);border-bottom:1px solid var(--border);padding:10px 0 12px;margin-bottom:18px;display:flex;align-items:center;gap:12px}.ring{width:22px;height:22px;flex:none;transform:rotate(-90deg)}.ring circle{fill:none;stroke-width:3}.ring .track{stroke:var(--border)}.ring .fill{stroke:#1f883d;stroke-linecap:round;transition:stroke-dashoffset .25s ease}.pb-label{font-size:13px;color:var(--muted);white-space:nowrap}.pb-label b{color:var(--fg)}.pb-track{flex:1;height:5px;border-radius:20px;background:var(--bg-alt);border:1px solid var(--border);overflow:hidden}.pb-fill{height:100%;width:0;background:#1f883d;transition:width .25s}.hint{background:var(--pill);border:1px solid var(--border);border-radius:6px;padding:10px 12px;margin:16px 0 24px}.controls{display:flex;gap:10px;margin:0 0 18px;flex-wrap:wrap}.controls button,.progressbar button{font-size:13px;padding:5px 12px;border:1px solid var(--border);background:var(--bg-alt);border-radius:6px;cursor:pointer}.toc{background:var(--bg-alt);border:1px solid var(--border);border-radius:6px;padding:12px 16px;margin-bottom:32px}.toc ol{margin:0;padding-left:20px}.toc li{margin:4px 0}.toc-stat{color:var(--muted);font-size:12px;margin-left:8px}.section{margin-bottom:56px;scroll-margin-top:60px}.sec-head{display:flex;align-items:center;gap:12px;border-bottom:1px solid var(--border);padding-bottom:8px;margin:0 0 10px}.section-toggle{display:flex;align-items:center;gap:12px;min-width:0;flex:1;border:0;background:transparent;padding:0;text-align:left;cursor:pointer}.section-toggle h2{font-size:19px;margin:0}.sec-count{font-size:12px;color:var(--muted);white-space:nowrap}.sec-chev,.chev{color:var(--muted);width:12px;flex:none;display:inline-block;transition:transform .15s}.section.folded .sec-chev,.file.collapsed .chev{transform:rotate(-90deg)}.section.folded>.lede,.section.folded>.watch,.section.folded>.note,.section.folded>.file{display:none}.section.folded{margin-bottom:18px}.lede{background:var(--bg-alt);border-left:3px solid var(--accent);padding:12px 14px;border-radius:0 6px 6px 0;margin-bottom:16px;font-size:14.5px}.watch{border:1px solid var(--border);border-radius:6px;padding:10px 16px 12px;margin-bottom:22px}.watch strong{font-size:12px;text-transform:uppercase;letter-spacing:.05em;color:var(--muted)}.watch ul{margin:6px 0 0;padding-left:20px}.note{color:var(--muted);margin:18px 0 6px;padding-left:12px;border-left:2px solid var(--border)}.file{border:1px solid var(--border);border-radius:6px;margin:10px 0 18px;box-shadow:var(--shadow)}.file-head{display:flex;align-items:center;gap:10px;background:var(--bg-alt);padding:8px 12px;border-bottom:1px solid var(--border);position:sticky;top:var(--topbar);z-index:5;border-radius:5px 5px 0 0}.file.collapsed .file-head{border-radius:5px}.file-toggle{display:flex;align-items:center;gap:10px;min-width:0;flex:1;border:0;background:transparent;padding:0;text-align:left;cursor:pointer}.fname{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font:600 12.5px ui-monospace,SFMono-Regular,Menlo,Consolas,monospace}.viewed-box{display:inline-flex;align-items:center;gap:6px;font-size:12px;white-space:nowrap;border:1px solid var(--border);border-radius:6px;padding:4px 10px;background:var(--bg);cursor:pointer}.viewed-box input{margin:0;accent-color:var(--accent)}.file.viewed .file-head{background:var(--viewed-bg)}.file.viewed .fname{color:var(--muted);font-weight:400;text-decoration:line-through}.file.viewed{opacity:.82}.file-body{overflow-x:auto}.file.collapsed .file-body{display:none}.pill{font-size:11px;padding:1px 7px;border-radius:20px;border:1px solid var(--border)}.pill-added{background:var(--add-bg)}.pill-deleted{background:var(--del-bg)}.pill-renamed{background:var(--pill)}.stat{font-size:12px;white-space:nowrap}.ghlink{font-size:12px;white-space:nowrap}.diff{border-collapse:collapse;width:100%;font:12px/1.45 ui-monospace,SFMono-Regular,"SF Mono",Menlo,Consolas,monospace}.diff td{vertical-align:top}.diff .ln{width:1%;min-width:44px;text-align:right;padding:0 10px;color:var(--muted);user-select:none;border-right:1px solid var(--border)}.diff td:last-child{padding:0 10px;white-space:pre-wrap;word-break:break-word}.diff td code{font:inherit;background:none;padding:0;border-radius:0}.line[data-href]{cursor:pointer}.line[data-href]:hover td{filter:brightness(.97)}.line.add td:last-child{background:var(--add-bg)}.line.add .ln{background:var(--add-ln)}.line.del td:last-child{background:var(--del-bg)}.line.del .ln{background:var(--del-ln)}.hunk td{background:var(--hunk-bg);color:var(--muted);padding:4px 10px;border-top:1px solid var(--border);border-bottom:1px solid var(--border)}.mark{display:inline-block;width:1ch;margin-right:6px;color:var(--muted)}.tk-c{color:var(--tk-c);font-style:italic}.tk-s{color:var(--tk-s)}.tk-k{color:var(--tk-k)}.tk-n{color:var(--tk-n)}.tk-t{color:var(--tk-t)}.tk-a{color:var(--tk-a)}.empty{padding:14px;color:var(--muted)}
@media(max-width:720px){.wrap{padding:14px 10px 64px}.file-head{gap:7px}.ghlink,.stat{display:none}.viewed-box{padding:4px 7px}.sec-head{align-items:flex-start;flex-wrap:wrap}}
</style></head><body>
<div class="wrap"><header class="top"><h1>${escapeHtml(title)}</h1><div class="sub"><a href="${escapeHtml(config.pr)}" target="_blank" rel="noopener">${rich(prLabel)}</a> · ${files.length} files · <span class="a">+${totalAdded}</span> <span class="d">−${totalRemoved}</span> · ${rich(config.subtitle)}</div></header>
<div class="progressbar"><svg class="ring" viewBox="0 0 22 22" aria-hidden="true"><circle class="track" cx="11" cy="11" r="9"></circle><circle class="fill" id="ringFill" cx="11" cy="11" r="9" stroke-dasharray="56.55" stroke-dashoffset="56.55"></circle></svg><div class="pb-label" id="progressText"><b>0</b> / <b>${files.length}</b> viewed</div><div class="pb-track"><div class="pb-fill" id="progressFill"></div></div><button id="reset" type="button">Reset</button></div>
<div class="hint">${rich(config.intro)}</div><div class="controls"><button id="collapse" type="button">Collapse all</button><button id="expand" type="button">Expand all</button><button id="collapseNoise" type="button">Collapse tests &amp; docs</button></div><nav class="toc"><ol>${navigation}</ol></nav><main>${sections}</main></div>
<script>
const STORE=${safeJson(storageKey)};
const RING=56.55;
const allFiles=()=>[...document.querySelectorAll('.file')];
const load=()=>{try{return new Set(JSON.parse(localStorage.getItem(STORE)||'[]'))}catch{return new Set()}};
const save=(seen)=>{try{localStorage.setItem(STORE,JSON.stringify([...seen]))}catch{}};
function applyViewed(file,on){file.classList.toggle('viewed',on);file.querySelector('.file-viewed').checked=on;if(on)file.classList.add('collapsed');else file.classList.remove('collapsed')}
function refresh(){const files=allFiles();const done=files.filter(file=>file.classList.contains('viewed')).length;const pct=files.length?done/files.length:0;document.querySelector('#progressText').innerHTML='<b>'+done+'</b> / <b>'+files.length+'</b> viewed';document.querySelector('#progressFill').style.width=(pct*100)+'%';document.querySelector('#ringFill').setAttribute('stroke-dashoffset',String(RING*(1-pct)));for(const section of document.querySelectorAll('.section')){const inSection=[...section.querySelectorAll('.file')];const sectionDone=inSection.filter(file=>file.classList.contains('viewed')).length;const complete=inSection.length>0&&sectionDone===inSection.length;section.querySelector('.sec-count').textContent=sectionDone+' / '+inSection.length;section.querySelector('.section-viewed').checked=complete;const was=section.dataset.complete==='true';if(complete!==was){section.classList.toggle('folded',complete);section.dataset.complete=String(complete)}}}
function collapseNoise(){allFiles().forEach(file=>{if(file.dataset.defaultFold==='true')file.classList.add('collapsed')})}
document.addEventListener('click',(event)=>{const fileToggle=event.target.closest('.file-toggle');if(fileToggle){fileToggle.closest('.file').classList.toggle('collapsed');return}const sectionToggle=event.target.closest('.section-toggle');if(sectionToggle){sectionToggle.closest('.section').classList.toggle('folded');return}const row=event.target.closest('.line[data-href]');if(row)window.open(row.dataset.href,'_blank','noopener')});
document.addEventListener('change',(event)=>{if(event.target.matches('.file-viewed')){const seen=load();const file=event.target.closest('.file');event.target.checked?seen.add(file.dataset.path):seen.delete(file.dataset.path);applyViewed(file,event.target.checked);save(seen);refresh()}if(event.target.matches('.section-viewed')){const seen=load();event.target.closest('.section').querySelectorAll('.file').forEach(file=>{event.target.checked?seen.add(file.dataset.path):seen.delete(file.dataset.path);applyViewed(file,event.target.checked)});save(seen);refresh()}});
document.querySelector('#expand').onclick=()=>allFiles().forEach(file=>file.classList.remove('collapsed'));
document.querySelector('#collapse').onclick=()=>allFiles().forEach(file=>file.classList.add('collapsed'));
document.querySelector('#collapseNoise').onclick=collapseNoise;
document.querySelector('#reset').onclick=()=>{localStorage.removeItem(STORE);document.querySelectorAll('.section').forEach(section=>{section.classList.remove('folded');section.dataset.complete='false'});allFiles().forEach(file=>{file.classList.remove('viewed','collapsed');file.querySelector('.file-viewed').checked=false});collapseNoise();refresh()};
collapseNoise();load().forEach(filePath=>{const file=allFiles().find(candidate=>candidate.dataset.path===filePath);if(file)applyViewed(file,true)});refresh();
</script></body></html>`;
}

const cli = args(process.argv.slice(2));
let config;
try {
  config = JSON.parse(read(cli.config, 'config'));
} catch (error) {
  fail(`invalid config JSON: ${error.message}`);
}
validateConfig(config);
const base = path.resolve(cli.config).replace(/\.[^.]+$/, '');
const diffPath = cli.diff ?? fetchDiff(config, `${base}.diff`);
const files = parseDiff(read(diffPath, 'diff'));
validatePlacement(config, files);
const output = path.resolve(cli.out ?? config.out ?? `${base}.html`);
fs.mkdirSync(path.dirname(output), { recursive: true });
fs.writeFileSync(output, renderDocument(config, files));
process.stdout.write(`${output}\n`);
