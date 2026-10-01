#!/usr/bin/env node
// Local Endpoint/Schema contract-card → PNG for vs-ship-it.
// Dark GitHub-card look: method+path or table name, before→after shapes with
// highlighted added/changed/removed fields. No hosted image service.
//
//   node contract-card-to-png.mjs --kind endpoint|schema <card.json|-> [--out file.png] [--width 720]
//
// Endpoint JSON:
//   { "method":"POST", "path":"/v1/tokens/refresh",
//     "before": { "token":"t_456" },
//     "after":  { "token":"t_456", "expiresAt":"2026-09-30T12:00:00Z" } }
//
// Schema JSON:
//   { "name":"tokens",
//     "before": [{ "name":"id", "type":"text", "attrs":"PRIMARY KEY" }],
//     "after":  [{ "name":"id", "type":"text", "attrs":"PRIMARY KEY" },
//                { "name":"expires_at", "type":"timestamptz", "attrs":"NOT NULL" }] }
//
// Diff is derived: keys/columns only in after = added; only in before = removed;
// present in both with different type/attrs/value = changed.
// Exit: 0 wrote PNG; 2 usage / missing Playwright / render failure.
import fs from 'node:fs';
import { createRequire } from 'node:module';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const CARD_BG = '#0d1117';
const PANEL_BG = '#161b22';
const BORDER = '#30363d';
const TEXT = '#e6edf3';
const MUTED = '#8b949e';
const ADD = '#3fb950';
const ADD_BG = 'rgba(63, 185, 80, 0.12)';
const CHG = '#d29922';
const CHG_BG = 'rgba(210, 153, 34, 0.12)';
const DEL = '#f85149';
const DEL_BG = 'rgba(248, 81, 73, 0.12)';

const fail = (message) => {
  process.stderr.write(`contract-card-to-png: ${message}\n`);
  process.exit(2);
};

const args = process.argv.slice(2);
const kindIdx = args.indexOf('--kind');
const outIdx = args.indexOf('--out');
const widthIdx = args.indexOf('--width');
const kind = kindIdx === -1 ? null : String(args[kindIdx + 1] ?? '');
const outPath = outIdx === -1 ? null : path.resolve(args[outIdx + 1] ?? '');
const width = widthIdx === -1 ? 720 : Number(args[widthIdx + 1]);
const inputArg = args.find((a, i) => {
  if (a.startsWith('--')) return false;
  // skip values of known flags
  if (i > 0 && ['--kind', '--out', '--width'].includes(args[i - 1])) return false;
  return true;
});

if (!kind || !['endpoint', 'schema'].includes(kind) || !inputArg) {
  fail(
    'Usage: contract-card-to-png.mjs --kind endpoint|schema <card.json|-> [--out file.png] [--width 720]\n' +
      'Renders a dark before→after contract card (not a flowchart).',
  );
}
if (!Number.isFinite(width) || width < 320) fail('--width must be a number ≥ 320.');

let raw;
if (inputArg === '-') {
  raw = fs.readFileSync(0, 'utf8');
} else {
  const abs = path.resolve(inputArg);
  if (!fs.existsSync(abs)) fail(`Input not found: ${abs}`);
  raw = fs.readFileSync(abs, 'utf8');
}

let card;
try {
  card = JSON.parse(raw);
} catch (err) {
  fail(`card JSON is invalid: ${err.message}`);
}

const pngOut =
  outPath ??
  path.join(
    os.tmpdir(),
    `vs-contract-${kind}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.png`,
  );
fs.mkdirSync(path.dirname(pngOut), { recursive: true });

const esc = (s) =>
  String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

const formatValue = (v) => {
  if (v === undefined) return '';
  if (typeof v === 'string') return JSON.stringify(v);
  return JSON.stringify(v, null, 2);
};

const diffEndpoint = (before, after) => {
  const b = before && typeof before === 'object' && !Array.isArray(before) ? before : {};
  const a = after && typeof after === 'object' && !Array.isArray(after) ? after : {};
  const keys = [...new Set([...Object.keys(b), ...Object.keys(a)])].sort();
  return keys.map((key) => {
    const inB = Object.prototype.hasOwnProperty.call(b, key);
    const inA = Object.prototype.hasOwnProperty.call(a, key);
    if (inB && !inA) return { key, change: 'removed', before: b[key], after: undefined };
    if (!inB && inA) return { key, change: 'added', before: undefined, after: a[key] };
    const same = JSON.stringify(b[key]) === JSON.stringify(a[key]);
    return {
      key,
      change: same ? 'same' : 'changed',
      before: b[key],
      after: a[key],
    };
  });
};

const colKey = (c) => String(c?.name ?? '');
const colSig = (c) => `${c?.type ?? ''}|${c?.attrs ?? ''}`;

const diffSchema = (before, after) => {
  const bList = Array.isArray(before) ? before : [];
  const aList = Array.isArray(after) ? after : [];
  const bMap = new Map(bList.map((c) => [colKey(c), c]));
  const aMap = new Map(aList.map((c) => [colKey(c), c]));
  const names = [...new Set([...bMap.keys(), ...aMap.keys()])].filter(Boolean);
  // Preserve after order, then removed-only columns.
  const ordered = [
    ...aList.map(colKey).filter(Boolean),
    ...bList.map(colKey).filter((n) => n && !aMap.has(n)),
  ];
  const seen = new Set();
  const unique = ordered.filter((n) => (seen.has(n) ? false : (seen.add(n), true)));
  for (const n of names) if (!seen.has(n)) unique.push(n);

  return unique.map((name) => {
    const b = bMap.get(name);
    const a = aMap.get(name);
    if (b && !a) return { name, change: 'removed', before: b, after: undefined };
    if (!b && a) return { name, change: 'added', before: undefined, after: a };
    const same = colSig(b) === colSig(a);
    return { name, change: same ? 'same' : 'changed', before: b, after: a };
  });
};

const badge = (change) => {
  if (change === 'added') return `<span class="badge add">+ added</span>`;
  if (change === 'changed') return `<span class="badge chg">~ changed</span>`;
  if (change === 'removed') return `<span class="badge del">− removed</span>`;
  return `<span class="badge same">unchanged</span>`;
};

const renderEndpointHtml = (c) => {
  const method = String(c.method ?? 'GET').toUpperCase();
  const p = String(c.path ?? '/');
  const rows = diffEndpoint(c.before, c.after);
  const rowHtml = rows
    .map((r) => {
      const cls = r.change;
      const beforeCell =
        r.change === 'added'
          ? `<span class="ghost">—</span>`
          : `<code>${esc(formatValue(r.before))}</code>`;
      const afterCell =
        r.change === 'removed'
          ? `<span class="ghost">—</span>`
          : `<code>${esc(formatValue(r.after))}</code>`;
      return `<tr class="${cls}">
  <td class="key"><code>${esc(r.key)}</code> ${badge(r.change)}</td>
  <td class="before">${beforeCell}</td>
  <td class="after">${afterCell}</td>
</tr>`;
    })
    .join('\n');

  return `
<header>
  <div class="kind">Endpoint</div>
  <div class="title"><span class="method">${esc(method)}</span> <span class="path">${esc(p)}</span></div>
  <div class="sub">Response shape · before → after</div>
</header>
<table>
  <thead><tr><th>Field</th><th>Before</th><th>After</th></tr></thead>
  <tbody>
${rowHtml}
  </tbody>
</table>`;
};

const colCell = (col) => {
  if (!col) return `<span class="ghost">—</span>`;
  const attrs = col.attrs ? ` <span class="attrs">${esc(col.attrs)}</span>` : '';
  return `<code class="col">${esc(col.name)}</code> <span class="type">${esc(col.type ?? '')}</span>${attrs}`;
};

const renderSchemaHtml = (c) => {
  const name = String(c.name ?? 'table');
  const rows = diffSchema(c.before, c.after);
  const rowHtml = rows
    .map((r) => {
      return `<tr class="${r.change}">
  <td class="key">${badge(r.change)}</td>
  <td class="before">${colCell(r.before)}</td>
  <td class="after">${colCell(r.after)}</td>
</tr>`;
    })
    .join('\n');

  return `
<header>
  <div class="kind">Schema</div>
  <div class="title"><span class="path">${esc(name)}</span></div>
  <div class="sub">Columns · before → after</div>
</header>
<table>
  <thead><tr><th></th><th>Before</th><th>After</th></tr></thead>
  <tbody>
${rowHtml}
  </tbody>
</table>`;
};

const bodyInner = kind === 'endpoint' ? renderEndpointHtml(card) : renderSchemaHtml(card);

const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"/>
<style>
  html, body { margin: 0; background: ${CARD_BG}; }
  #card {
    display: inline-block;
    box-sizing: border-box;
    min-width: 560px;
    max-width: ${width}px;
    padding: 28px 32px 24px;
    background: ${CARD_BG};
    color: ${TEXT};
    font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", Helvetica, Arial, sans-serif;
    border-radius: 12px;
  }
  header { margin-bottom: 18px; }
  .kind {
    font-size: 12px;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: ${MUTED};
    margin-bottom: 6px;
  }
  .title { font-size: 22px; font-weight: 650; line-height: 1.3; }
  .method {
    display: inline-block;
    padding: 2px 8px;
    border-radius: 6px;
    background: ${PANEL_BG};
    border: 1px solid ${BORDER};
    font-size: 14px;
    font-weight: 700;
    color: #79c0ff;
    vertical-align: middle;
  }
  .path { font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; }
  .sub { margin-top: 6px; font-size: 14px; color: ${MUTED}; }
  table {
    width: 100%;
    border-collapse: separate;
    border-spacing: 0;
    background: ${PANEL_BG};
    border: 1px solid ${BORDER};
    border-radius: 10px;
    overflow: hidden;
    font-size: 15px;
  }
  th {
    text-align: left;
    font-size: 12px;
    font-weight: 650;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    color: ${MUTED};
    padding: 10px 14px;
    border-bottom: 1px solid ${BORDER};
    background: #0d1117;
  }
  td {
    padding: 12px 14px;
    border-bottom: 1px solid ${BORDER};
    vertical-align: top;
    line-height: 1.45;
  }
  tr:last-child td { border-bottom: none; }
  tr.added td { background: ${ADD_BG}; }
  tr.changed td { background: ${CHG_BG}; }
  tr.removed td { background: ${DEL_BG}; }
  code {
    font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
    font-size: 14px;
    white-space: pre-wrap;
    word-break: break-word;
  }
  .type { color: #79c0ff; font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; font-size: 13px; }
  .attrs { color: ${MUTED}; font-size: 12px; font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; }
  .ghost { color: ${MUTED}; }
  .badge {
    display: inline-block;
    margin-left: 8px;
    padding: 1px 7px;
    border-radius: 999px;
    font-size: 11px;
    font-weight: 650;
    letter-spacing: 0.02em;
    vertical-align: middle;
  }
  .badge.add { color: ${ADD}; background: ${ADD_BG}; border: 1px solid rgba(63,185,80,0.35); }
  .badge.chg { color: ${CHG}; background: ${CHG_BG}; border: 1px solid rgba(210,153,34,0.35); }
  .badge.del { color: ${DEL}; background: ${DEL_BG}; border: 1px solid rgba(248,81,73,0.35); }
  .badge.same { color: ${MUTED}; background: transparent; border: 1px solid ${BORDER}; }
  .key code { font-weight: 650; }
</style>
</head><body><div id="card">${bodyInner}</div></body></html>`;

const resolvePlaywright = () => {
  const spec = process.env.PLAYWRIGHT_MODULE || 'playwright';
  const from = createRequire(path.join(process.cwd(), 'contract-card-resolver.js'));
  for (const candidate of [spec, 'playwright-core']) {
    try {
      return from.resolve(candidate);
    } catch {
      // try next
    }
  }
  try {
    return createRequire(import.meta.url).resolve('playwright');
  } catch {
    try {
      return createRequire(import.meta.url).resolve('playwright-core');
    } catch {
      return null;
    }
  }
};

const entry = resolvePlaywright();
if (!entry) {
  fail(
    'Playwright is required for contract cards. Install with:\n' +
      '  npm i -D playwright && npx playwright install chromium\n' +
      'Or set PLAYWRIGHT_MODULE=/abs/path/node_modules/playwright',
  );
}

const playwright = await import(pathToFileURL(entry).href);
const chromium = playwright.chromium ?? playwright.default?.chromium;
if (!chromium) fail(`${entry} exports no chromium launcher.`);

const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage({
    viewport: { width: Math.max(width + 64, 640), height: 1200 },
    deviceScaleFactor: 2,
  });
  await page.setContent(html, { waitUntil: 'domcontentloaded' });
  const cardEl = page.locator('#card');
  const box = await cardEl.boundingBox();
  if (!box || box.width < 2 || box.height < 2) fail('Rendered card has empty bounds.');
  await cardEl.screenshot({ path: pngOut, type: 'png', omitBackground: false });
} finally {
  await browser.close();
}

if (!fs.existsSync(pngOut) || fs.statSync(pngOut).size === 0) {
  fail(`PNG was not written: ${pngOut}`);
}
process.stdout.write(`${pngOut}\n`);
