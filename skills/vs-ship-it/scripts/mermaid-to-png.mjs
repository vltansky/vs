#!/usr/bin/env node
// Local mermaid → PNG for vs-ship-it ER visuals (relations/tables only).
// Default Endpoint/Schema picture is contract-card-to-png.mjs — use this script
// only when an erDiagram helps. No hosted image service.
//
// Locked look (Vlad 2026-10-02): dark GitHub-card (#0d1117), larger type, less
// chrome — theme: base + themeVariables (mmdc -c / Playwright init).
//
//   node mermaid-to-png.mjs <input.mmd|-> [--out <file.png>] [--width <px>]
//
// stdin: pass "-" as the input path. Prints the absolute PNG path on stdout.
// Exit: 0 wrote PNG; 2 usage / missing Playwright / render failure.
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const fail = (message) => {
  process.stderr.write(`mermaid-to-png: ${message}\n`);
  process.exit(2);
};

// Near GitHub dark canvas. theme: base + themeVariables keeps mermaid chrome quiet
// (no busy default/forest palettes); fontSize is readable when the PNG sits in a PR.
const CARD_BG = '#0d1117';
const THEME_VARIABLES = {
  darkMode: true,
  background: CARD_BG,
  fontFamily:
    'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Helvetica, Arial, sans-serif',
  fontSize: '20px',
  primaryColor: '#21262d',
  primaryTextColor: '#e6edf3',
  primaryBorderColor: '#484f58',
  secondaryColor: '#161b22',
  secondaryTextColor: '#e6edf3',
  secondaryBorderColor: '#30363d',
  tertiaryColor: '#0d1117',
  tertiaryTextColor: '#e6edf3',
  tertiaryBorderColor: '#30363d',
  lineColor: '#8b949e',
  textColor: '#e6edf3',
  mainBkg: '#21262d',
  nodeBorder: '#484f58',
  clusterBkg: '#161b22',
  clusterBorder: '#30363d',
  titleColor: '#e6edf3',
  edgeLabelBackground: CARD_BG,
  actorBkg: '#21262d',
  actorBorder: '#484f58',
  actorTextColor: '#e6edf3',
  actorLineColor: '#8b949e',
  labelBoxBkgColor: '#21262d',
  labelBoxBorderColor: '#484f58',
  labelTextColor: '#e6edf3',
  loopTextColor: '#e6edf3',
  noteBkgColor: '#21262d',
  noteTextColor: '#e6edf3',
  noteBorderColor: '#484f58',
  // erDiagram
  attributeBackgroundColorOdd: '#21262d',
  attributeBackgroundColorEven: '#161b22',
};

const MERMAID_INIT = {
  startOnLoad: false,
  securityLevel: 'strict',
  theme: 'base',
  themeVariables: THEME_VARIABLES,
  flowchart: {
    htmlLabels: true,
    curve: 'basis',
    padding: 16,
    nodeSpacing: 48,
    rankSpacing: 56,
  },
  er: {
    fontSize: 18,
    layoutDirection: 'LR',
  },
};

const args = process.argv.slice(2);
const inputArg = args.find((a) => !a.startsWith('--'));
const outIdx = args.indexOf('--out');
const widthIdx = args.indexOf('--width');
const outPath = outIdx === -1 ? null : path.resolve(args[outIdx + 1] ?? '');
const width = widthIdx === -1 ? 960 : Number(args[widthIdx + 1]);

if (!inputArg) {
  fail(
    'Usage: mermaid-to-png.mjs <input.mmd|-> [--out file.png] [--width 960]\n' +
      'Renders a local dark-card PNG from mermaid (prefer erDiagram; not the default Endpoint/Schema visual).',
  );
}
if (!Number.isFinite(width) || width < 200) fail('--width must be a number ≥ 200.');

let source;
if (inputArg === '-') {
  source = fs.readFileSync(0, 'utf8');
} else {
  const abs = path.resolve(inputArg);
  if (!fs.existsSync(abs)) fail(`Input not found: ${abs}`);
  source = fs.readFileSync(abs, 'utf8');
}
source = source.replace(/^\uFEFF/, '').trim();
if (!source) fail('Mermaid source is empty.');

const pngOut =
  outPath ??
  path.join(
    os.tmpdir(),
    `vs-mermaid-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.png`,
  );
fs.mkdirSync(path.dirname(pngOut), { recursive: true });

const writeMmdcConfig = () => {
  const cfgPath = path.join(os.tmpdir(), `vs-mermaid-config-${process.pid}.json`);
  fs.writeFileSync(
    cfgPath,
    `${JSON.stringify(
      {
        theme: MERMAID_INIT.theme,
        themeVariables: MERMAID_INIT.themeVariables,
        flowchart: MERMAID_INIT.flowchart,
        er: MERMAID_INIT.er,
      },
      null,
      2,
    )}\n`,
  );
  return cfgPath;
};

const tryMmdc = () => {
  const which = spawnSync('mmdc', ['--version'], { encoding: 'utf8' });
  if (which.status !== 0) return false;
  const mmd = path.join(os.tmpdir(), `vs-mermaid-${process.pid}.mmd`);
  const cfg = writeMmdcConfig();
  fs.writeFileSync(mmd, `${source}\n`);
  const run = spawnSync(
    'mmdc',
    [
      '-i',
      mmd,
      '-o',
      pngOut,
      '-c',
      cfg,
      '-b',
      CARD_BG,
      '-w',
      String(width),
      '-s',
      '2',
    ],
    { encoding: 'utf8' },
  );
  for (const tmp of [mmd, cfg]) {
    try {
      fs.unlinkSync(tmp);
    } catch {
      // ignore
    }
  }
  if (run.status !== 0) {
    process.stderr.write(run.stderr || run.stdout || 'mmdc failed\n');
    return false;
  }
  return fs.existsSync(pngOut) && fs.statSync(pngOut).size > 0;
};

const resolvePlaywright = () => {
  const spec = process.env.PLAYWRIGHT_MODULE || 'playwright';
  const from = createRequire(path.join(process.cwd(), 'mermaid-to-png-resolver.js'));
  for (const candidate of [spec, 'playwright-core']) {
    try {
      return from.resolve(candidate);
    } catch {
      // try next
    }
  }
  try {
    const here = createRequire(import.meta.url);
    return here.resolve('playwright');
  } catch {
    try {
      const here = createRequire(import.meta.url);
      return here.resolve('playwright-core');
    } catch {
      return null;
    }
  }
};

const renderWithPlaywright = async () => {
  const entry = resolvePlaywright();
  if (!entry) {
    fail(
      'Neither mmdc nor Playwright is available. Install one of:\n' +
        '  npm i -D @mermaid-js/mermaid-cli   # provides mmdc\n' +
        '  npm i -D playwright && npx playwright install chromium\n' +
        'Or set PLAYWRIGHT_MODULE=/abs/path/node_modules/playwright',
    );
  }
  const playwright = await import(pathToFileURL(entry).href);
  const chromium = playwright.chromium ?? playwright.default?.chromium;
  if (!chromium) fail(`${entry} exports no chromium launcher.`);

  const escaped = source
    .replace(/\\/g, '\\\\')
    .replace(/`/g, '\\`')
    .replace(/\$\{/g, '\\${');

  const initJson = JSON.stringify(MERMAID_INIT);
  const html = `<!DOCTYPE html>
<html><head>
<meta charset="utf-8"/>
<script type="module">
  import mermaid from 'https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.esm.min.mjs';
  mermaid.initialize(${initJson});
  const def = \`${escaped}\`;
  try {
    const { svg } = await mermaid.render('vs-mermaid-diagram', def);
    document.getElementById('diagram').innerHTML = svg;
    document.documentElement.dataset.ready = 'ok';
  } catch (err) {
    document.documentElement.dataset.ready = 'err';
    document.documentElement.dataset.error = String(err && err.message ? err.message : err);
  }
</script>
<style>
  html, body {
    margin: 0;
    background: ${CARD_BG};
  }
  /* Dark card with roomy padding; screenshot frames #card so the PNG is the card. */
  #card {
    display: inline-block;
    box-sizing: border-box;
    padding: 28px 32px;
    background: ${CARD_BG};
    border-radius: 12px;
  }
  #diagram { display: inline-block; }
  #diagram svg { max-width: none; height: auto; }
  /* Less chrome: quiet strokes, no drop-shadow clutter, larger edge labels. */
  #diagram .node rect,
  #diagram .node polygon,
  #diagram .node circle,
  #diagram .node path {
    filter: none !important;
  }
  #diagram .edgeLabel foreignObject,
  #diagram .edgeLabel span,
  #diagram .edgeLabel p {
    font-size: 16px !important;
    color: #e6edf3 !important;
  }
  #diagram .nodeLabel,
  #diagram .nodeLabel span,
  #diagram .label B,
  #diagram .label {
    font-size: 20px !important;
    color: #e6edf3 !important;
  }
  #diagram .edgePath .path,
  #diagram .flowchart-link {
    stroke-width: 1.75px !important;
  }
</style>
</head><body><div id="card"><div id="diagram"></div></div></body></html>`;

  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({
      viewport: { width: Math.max(width + 80, 480), height: 900 },
      deviceScaleFactor: 2,
    });
    await page.setContent(html, { waitUntil: 'networkidle' });
    await page.waitForFunction(
      () =>
        document.documentElement.dataset.ready === 'ok' ||
        document.documentElement.dataset.ready === 'err',
      { timeout: 30000 },
    );
    const status = await page.evaluate(() => ({
      ready: document.documentElement.dataset.ready,
      error: document.documentElement.dataset.error || '',
    }));
    if (status.ready !== 'ok') fail(`Mermaid render failed: ${status.error || 'unknown error'}`);

    const card = page.locator('#card');
    const box = await card.boundingBox();
    if (!box || box.width < 2 || box.height < 2) fail('Rendered diagram has empty bounds.');
    await card.screenshot({ path: pngOut, type: 'png', omitBackground: false });
  } finally {
    await browser.close();
  }
};

if (!tryMmdc()) {
  await renderWithPlaywright();
}

if (!fs.existsSync(pngOut) || fs.statSync(pngOut).size === 0) {
  fail(`PNG was not written: ${pngOut}`);
}
process.stdout.write(`${pngOut}\n`);
