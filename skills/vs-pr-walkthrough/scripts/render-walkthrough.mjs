#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const RICH_TAGS = /&lt;(\/?)((?:b|i|em|strong|code|br))\s*\/?&gt;/gi;

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

function countNonEmptyLines(text) {
  return String(text).split('\n').filter((line) => line.trim().length > 0).length;
}

function assertPseudocode(text, label) {
  if (typeof text !== 'string' || !text.trim()) {
    fail(`${label} pseudocode is required`);
  }
  const lines = countNonEmptyLines(text);
  if (lines > 12) {
    fail(`${label} pseudocode exceeds 12 lines (${lines})`);
  }
}

function normalizeFileEntry(entry, sectionId, index) {
  if (typeof entry === 'string') {
    if (!entry) fail(`section ${sectionId}.files[${index}] path must be non-empty`);
    return { path: entry, pseudocode: null, legacy: true };
  }
  if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
    fail(`section ${sectionId}.files[${index}] must be a path string or {path, pseudocode} object`);
  }
  if (typeof entry.path !== 'string' || !entry.path) {
    fail(`section ${sectionId}.files[${index}].path must be a non-empty string`);
  }
  if (entry.pseudocode !== undefined && entry.pseudocode !== null && typeof entry.pseudocode !== 'string') {
    fail(`section ${sectionId}.files[${index}].pseudocode must be a string`);
  }
  return {
    path: entry.path,
    pseudocode: typeof entry.pseudocode === 'string' ? entry.pseudocode : null,
    legacy: false,
  };
}

function filePaths(section) {
  return (section.files ?? []).map((entry) => entry.path);
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
    assertPseudocode(section.pseudocode, `section ${section.id}`);
    if (section.files !== undefined) {
      if (!Array.isArray(section.files)) fail(`section ${section.id}.files must be an array`);
      section.files = section.files.map((entry, fileIndex) => normalizeFileEntry(entry, section.id, fileIndex));
    } else {
      section.files = [];
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

function requirePairFilePseudocode(config) {
  for (const section of config.sections) {
    for (const entry of section.files) {
      if (entry.pseudocode === null || entry.pseudocode === undefined || !String(entry.pseudocode).trim()) {
        fail(`section ${section.id} file ${entry.path}: pair-file pseudocode is required when a diff is present`);
      }
      assertPseudocode(entry.pseudocode, `section ${section.id} file ${entry.path} pair-file`);
    }
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
    const paths = filePaths(section);
    const sectionFiles = new Set(paths);
    for (const file of paths) {
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

function renderPseudocode(text, extraClass = '') {
  const cls = extraClass ? `pseudocode ${extraClass}` : 'pseudocode';
  return `<pre class="${cls}"><code>${escapeHtml(text.trimEnd())}</code></pre>`;
}

function blobUrl(owner, repo, headSha, filePath) {
  const encoded = filePath.split('/').map(encodeURIComponent).join('/');
  return `https://github.com/${owner}/${repo}/blob/${headSha}/${encoded}`;
}

function renderHunks(file) {
  if (file.binary) return '<p class="empty">Binary diff — open this file on GitHub.</p>';
  if (file.hunks.length === 0) return '<p class="empty">No textual hunks.</p>';
  const rows = [];
  for (const hunk of file.hunks) {
    rows.push(`<tr class="hunk"><td></td><td></td><td><code>@@ ${escapeHtml(hunk.context)}</code></td></tr>`);
    for (const row of hunk.rows) {
      const mark = row.kind === 'add' ? '+' : row.kind === 'del' ? '−' : ' ';
      rows.push(
        `<tr class="line ${row.kind}">` +
        `<td class="ln">${row.old ?? ''}</td><td class="ln">${row.new ?? ''}</td>` +
        `<td><code><span class="mark">${mark}</span>${escapeHtml(row.text)}</code></td></tr>`,
      );
    }
  }
  return `<table class="diff"><tbody>${rows.join('')}</tbody></table>`;
}

function renderFileCard(entry, diffFile, section, config, owner, repo) {
  const displayPath = config.path_prefix && entry.path.startsWith(config.path_prefix)
    ? entry.path.slice(config.path_prefix.length)
    : entry.path;
  const badge = !diffFile || diffFile.status === 'modified'
    ? ''
    : `<span class="pill pill-${diffFile.status}">${escapeHtml(diffFile.status)}</span>`;
  const stats = diffFile
    ? `<span class="stat"><span class="a">+${diffFile.added}</span> <span class="d">−${diffFile.removed}</span></span>`
    : '';
  const href = blobUrl(owner, repo, config.headSha, entry.path);
  const note = section.notes?.find((candidate) => candidate.file === entry.path);
  const noteHtml = note ? `<div class="note">${rich(note.text)}</div>` : '';
  const hunkBody = diffFile ? renderHunks(diffFile) : '<p class="empty">No diff for this path.</p>';
  return `${noteHtml}<article class="file-card" data-path="${escapeHtml(entry.path)}">
    <div class="file-card-head">
      <strong class="fname">${escapeHtml(displayPath)}</strong>
      ${badge}${stats}
      <a class="ghlink" href="${escapeHtml(href)}" target="_blank" rel="noopener">GitHub ↗</a>
    </div>
    ${renderPseudocode(entry.pseudocode, 'pair-pseudocode')}
    <details class="real-diff">
      <summary>Show real diff</summary>
      <div class="file-body">${hunkBody}</div>
    </details>
  </article>`;
}

function renderSection(section, byPath, config, owner, repo) {
  const lede = section.lede?.trim()
    ? `<div class="lede">${rich(section.lede)}</div>`
    : '';
  const watch = section.watch?.length
    ? `<aside class="watch"><strong>What to look at</strong><ul>${section.watch.map((item) => `<li>${rich(item)}</li>`).join('')}</ul></aside>`
    : '';
  const cards = section.files.map((entry) => renderFileCard(entry, byPath.get(entry.path), section, config, owner, repo)).join('\n');
  const folded = section.fold ? ' folded' : '';
  const fileCount = section.files.length;
  return `<section class="section${folded}" id="${escapeHtml(section.id)}" data-complete="false">
    <div class="sec-head"><button class="section-toggle" type="button"><span class="sec-chev">▾</span><h2>${escapeHtml(section.title)}</h2></button><span class="sec-count">${fileCount} files</span><label class="viewed-box"><input class="section-viewed" type="checkbox"> Section read</label></div>
    ${lede}${renderPseudocode(section.pseudocode)}${cards}${watch}
  </section>`;
}

function renderDocument(config, files) {
  const byPath = new Map(files.map((file) => [file.path, file]));
  const storageKey = `vs-pr-walkthrough:${config.pr}@${config.headSha}`;
  const number = config.pr.split('/').at(-1);
  const repo = config.pr.split('/')[4];
  const owner = config.pr.split('/')[3];
  const title = config.title || 'PR review';
  const prLabel = config.pr_label || `${repo} PR #${number}`;
  const commitUrl = `https://github.com/${owner}/${repo}/commit/${config.headSha}`;
  const shortSha = config.headSha.slice(0, 7);
  const sectionCount = config.sections.length;
  const navigation = config.sections.map((section) => {
    const chosen = section.files.map((entry) => byPath.get(entry.path)).filter(Boolean);
    const added = chosen.reduce((sum, file) => sum + file.added, 0);
    const removed = chosen.reduce((sum, file) => sum + file.removed, 0);
    const fileHint = section.files.length
      ? `${section.files.length} files · <span class="a">+${added}</span> <span class="d">−${removed}</span>`
      : 'story';
    return `<li><a href="#${escapeHtml(section.id)}">${escapeHtml(section.title)}</a><span class="toc-stat">${fileHint}</span></li>`;
  }).join('');
  const sections = config.sections.map((section) => renderSection(section, byPath, config, owner, repo)).join('\n');
  const fileCount = files.length;
  const totalAdded = files.reduce((sum, file) => sum + file.added, 0);
  const totalRemoved = files.reduce((sum, file) => sum + file.removed, 0);

  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escapeHtml(title)} · PR walkthrough</title>
<style>
:root{--bg:#fff;--bg-alt:#f6f8fa;--fg:#1f2328;--muted:#59636e;--border:#d1d9e0;--accent:#0969da;--add-bg:#e6ffec;--add-ln:#ccffd8;--del-bg:#ffebe9;--del-ln:#ffd7d5;--hunk-bg:#f6f8fa;--viewed-bg:#eef6ef;--pill:#ddf4ff;--shadow:0 1px 3px rgba(31,35,40,.08)}
@media(prefers-color-scheme:dark){:root:not([data-theme="light"]){--bg:#0d1117;--bg-alt:#151b23;--fg:#e6edf3;--muted:#9198a1;--border:#3d444d;--accent:#4493f8;--add-bg:#12261e;--add-ln:#1b4721;--del-bg:#25171c;--del-ln:#542426;--hunk-bg:#151b23;--viewed-bg:#12261e;--pill:#121d2f;--shadow:none}}
*{box-sizing:border-box}html{scroll-behavior:smooth}body{margin:0;background:var(--bg);color:var(--fg);font:14px/1.55 -apple-system,BlinkMacSystemFont,"Segoe UI",Noto Sans,Helvetica,Arial,sans-serif}a{color:var(--accent);text-decoration:none}a:hover{text-decoration:underline}button{font:inherit;color:inherit}code{font-family:ui-monospace,SFMono-Regular,"SF Mono",Menlo,Consolas,monospace;font-size:.92em;background:var(--bg-alt);padding:.12em .4em;border-radius:6px}.wrap{max-width:960px;margin:0 auto;padding:24px 16px 96px}.top{border-bottom:1px solid var(--border);padding-bottom:16px;margin-bottom:8px}.top h1{font-size:22px;margin:0 0 6px}.sub{color:var(--muted)}.a{color:#1a7f37}.d{color:#cf222e}.progressbar{position:sticky;top:0;z-index:20;background:var(--bg);border-bottom:1px solid var(--border);padding:10px 0 12px;margin-bottom:18px;display:flex;align-items:center;gap:12px}.ring{width:22px;height:22px;flex:none;transform:rotate(-90deg)}.ring circle{fill:none;stroke-width:3}.ring .track{stroke:var(--border)}.ring .fill{stroke:#1f883d;stroke-linecap:round;transition:stroke-dashoffset .25s ease}.pb-label{font-size:13px;color:var(--muted);white-space:nowrap}.pb-label b{color:var(--fg)}.pb-track{flex:1;height:5px;border-radius:20px;background:var(--bg-alt);border:1px solid var(--border);overflow:hidden}.pb-fill{height:100%;width:0;background:#1f883d;transition:width .25s}.hint{background:var(--pill);border:1px solid var(--border);border-radius:6px;padding:10px 12px;margin:16px 0 24px}.controls{display:flex;gap:10px;margin:0 0 18px;flex-wrap:wrap}.controls button,.progressbar button{font-size:13px;padding:5px 12px;border:1px solid var(--border);background:var(--bg-alt);border-radius:6px;cursor:pointer}.toc{background:var(--bg-alt);border:1px solid var(--border);border-radius:6px;padding:12px 16px;margin-bottom:32px}.toc ol{margin:0;padding-left:20px}.toc li{margin:4px 0}.toc-stat{color:var(--muted);font-size:12px;margin-left:8px}.section{margin-bottom:40px;scroll-margin-top:60px}.sec-head{display:flex;align-items:center;gap:12px;border-bottom:1px solid var(--border);padding-bottom:8px;margin:0 0 10px}.section-toggle{display:flex;align-items:center;gap:12px;min-width:0;flex:1;border:0;background:transparent;padding:0;text-align:left;cursor:pointer}.section-toggle h2{font-size:19px;margin:0}.sec-count{font-size:12px;color:var(--muted);white-space:nowrap}.sec-chev{color:var(--muted);width:12px;flex:none;display:inline-block;transition:transform .15s}.section.folded .sec-chev{transform:rotate(-90deg)}.section.folded>.lede,.section.folded>.pseudocode,.section.folded>.file-card,.section.folded>.note,.section.folded>.watch{display:none}.section.folded{margin-bottom:18px}.lede{background:var(--bg-alt);border-left:3px solid var(--accent);padding:12px 14px;border-radius:0 6px 6px 0;margin-bottom:12px;font-size:14.5px}.pseudocode{background:var(--bg-alt);border:1px solid var(--border);border-left:3px solid var(--accent);border-radius:0 6px 6px 0;padding:12px 14px;margin:0 0 12px;overflow-x:auto;font:13px/1.45 ui-monospace,SFMono-Regular,"SF Mono",Menlo,Consolas,monospace}.pseudocode code{background:none;padding:0;font:inherit;white-space:pre}.pair-pseudocode{border-left-color:var(--muted);margin-bottom:10px;font-size:12.5px}.file-card{border:1px solid var(--border);border-radius:6px;margin:10px 0 16px;box-shadow:var(--shadow);padding:0 0 10px;background:var(--bg)}.file-card-head{display:flex;align-items:center;gap:10px;background:var(--bg-alt);padding:8px 12px;border-bottom:1px solid var(--border);border-radius:5px 5px 0 0;flex-wrap:wrap}.fname{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font:600 12.5px ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;flex:1;min-width:0}.pill{font-size:11px;padding:1px 7px;border-radius:20px;border:1px solid var(--border)}.pill-added{background:var(--add-bg)}.pill-deleted{background:var(--del-bg)}.pill-renamed{background:var(--pill)}.stat{font-size:12px;white-space:nowrap}.ghlink{font-size:12px;white-space:nowrap}.file-card>.pseudocode{margin:10px 12px}.real-diff{margin:0 12px}.real-diff>summary{cursor:pointer;font-size:13px;color:var(--accent);user-select:none;padding:4px 0}.real-diff>summary:hover{text-decoration:underline}.file-body{overflow-x:auto;margin-top:8px;border:1px solid var(--border);border-radius:6px}.diff{border-collapse:collapse;width:100%;font:12px/1.45 ui-monospace,SFMono-Regular,"SF Mono",Menlo,Consolas,monospace}.diff td{vertical-align:top}.diff .ln{width:1%;min-width:44px;text-align:right;padding:0 10px;color:var(--muted);user-select:none;border-right:1px solid var(--border)}.diff td:last-child{padding:0 10px;white-space:pre-wrap;word-break:break-word}.diff td code{font:inherit;background:none;padding:0;border-radius:0}.line.add td:last-child{background:var(--add-bg)}.line.add .ln{background:var(--add-ln)}.line.del td:last-child{background:var(--del-bg)}.line.del .ln{background:var(--del-ln)}.hunk td{background:var(--hunk-bg);color:var(--muted);padding:4px 10px;border-top:1px solid var(--border);border-bottom:1px solid var(--border)}.mark{display:inline-block;width:1ch;margin-right:6px;color:var(--muted)}.empty{padding:14px;color:var(--muted)}.watch{border:1px solid var(--border);border-radius:6px;padding:10px 16px 12px;margin:16px 0 8px}.watch strong{font-size:12px;text-transform:uppercase;letter-spacing:.05em;color:var(--muted)}.watch ul{margin:6px 0 0;padding-left:20px}.note{color:var(--muted);margin:12px 12px 0;padding-left:12px;border-left:2px solid var(--border)}.viewed-box{display:inline-flex;align-items:center;gap:6px;font-size:12px;white-space:nowrap;border:1px solid var(--border);border-radius:6px;padding:4px 10px;background:var(--bg);cursor:pointer}.viewed-box input{margin:0;accent-color:var(--accent)}.section[data-complete="true"] .sec-head{background:var(--viewed-bg);border-radius:6px;padding:8px 10px;margin-left:-10px;margin-right:-10px;border-bottom-color:transparent}.gh-links{font-size:13px;margin-top:6px}.gh-links a{margin-right:12px}
@media(max-width:720px){.wrap{padding:14px 10px 64px}.sec-head{align-items:flex-start;flex-wrap:wrap}}
</style></head><body>
<div class="wrap"><header class="top"><h1>${escapeHtml(title)}</h1><div class="sub"><a href="${escapeHtml(config.pr)}" target="_blank" rel="noopener">${rich(prLabel)}</a> · ${fileCount} files · <span class="a">+${totalAdded}</span> <span class="d">−${totalRemoved}</span> · ${rich(config.subtitle)}</div><div class="gh-links"><a href="${escapeHtml(config.pr)}" target="_blank" rel="noopener">Open PR on GitHub ↗</a><a href="${escapeHtml(commitUrl)}" target="_blank" rel="noopener">Head ${escapeHtml(shortSha)} ↗</a></div></header>
<div class="progressbar"><svg class="ring" viewBox="0 0 22 22" aria-hidden="true"><circle class="track" cx="11" cy="11" r="9"></circle><circle class="fill" id="ringFill" cx="11" cy="11" r="9" stroke-dasharray="56.55" stroke-dashoffset="56.55"></circle></svg><div class="pb-label" id="progressText"><b>0</b> / <b>${sectionCount}</b> sections</div><div class="pb-track"><div class="pb-fill" id="progressFill"></div></div><button id="reset" type="button">Reset</button></div>
<div class="hint">${rich(config.intro || 'Read the section spine and pair-file pseudocode, then expand Show real diff only when you need the hunks.')}</div><div class="controls"><button id="collapse" type="button">Collapse all</button><button id="expand" type="button">Expand all</button></div><nav class="toc"><ol>${navigation}</ol></nav><main>${sections}</main></div>
<script>
const STORE=${safeJson(storageKey)};
const RING=56.55;
const allSections=()=>[...document.querySelectorAll('.section')];
const load=()=>{try{return new Set(JSON.parse(localStorage.getItem(STORE)||'[]'))}catch{return new Set()}};
const save=(seen)=>{try{localStorage.setItem(STORE,JSON.stringify([...seen]))}catch{}};
function applyRead(section,on){section.dataset.complete=String(on);section.classList.toggle('folded',on);section.querySelector('.section-viewed').checked=on}
function refresh(){const sections=allSections();const done=sections.filter(section=>section.dataset.complete==='true').length;const pct=sections.length?done/sections.length:0;document.querySelector('#progressText').innerHTML='<b>'+done+'</b> / <b>'+sections.length+'</b> sections';document.querySelector('#progressFill').style.width=(pct*100)+'%';document.querySelector('#ringFill').setAttribute('stroke-dashoffset',String(RING*(1-pct)));}
document.addEventListener('click',(event)=>{const sectionToggle=event.target.closest('.section-toggle');if(sectionToggle){sectionToggle.closest('.section').classList.toggle('folded')}});
document.addEventListener('change',(event)=>{if(event.target.matches('.section-viewed')){const seen=load();const section=event.target.closest('.section');event.target.checked?seen.add(section.id):seen.delete(section.id);applyRead(section,event.target.checked);save(seen);refresh()}});
document.querySelector('#expand').onclick=()=>allSections().forEach(section=>section.classList.remove('folded'));
document.querySelector('#collapse').onclick=()=>allSections().forEach(section=>section.classList.add('folded'));
document.querySelector('#reset').onclick=()=>{localStorage.removeItem(STORE);allSections().forEach(section=>{section.classList.remove('folded');applyRead(section,false)});refresh()};
load().forEach(id=>{const section=allSections().find(candidate=>candidate.id===id);if(section)applyRead(section,true)});refresh();
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
requirePairFilePseudocode(config);
const output = path.resolve(cli.out ?? config.out ?? `${base}.html`);
fs.mkdirSync(path.dirname(output), { recursive: true });
fs.writeFileSync(output, renderDocument(config, files));
process.stdout.write(`${output}\n`);
