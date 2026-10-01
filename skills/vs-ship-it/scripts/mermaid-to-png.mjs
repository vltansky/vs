#!/usr/bin/env node
// Local mermaid → PNG for vs-ship-it Endpoint/Schema data-flow visuals.
// No hosted image service: renders on this machine via Playwright + Mermaid CDN
// (or mmdc when @mermaid-js/mermaid-cli is on PATH / resolvable).
//
//   node mermaid-to-png.mjs <input.mmd|-> [--out <file.png>] [--width <px>] [--theme default|neutral|dark|forest]
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

const args = process.argv.slice(2);
const inputArg = args.find((a) => !a.startsWith('--'));
const outIdx = args.indexOf('--out');
const widthIdx = args.indexOf('--width');
const themeIdx = args.indexOf('--theme');
const outPath = outIdx === -1 ? null : path.resolve(args[outIdx + 1] ?? '');
const width = widthIdx === -1 ? 960 : Number(args[widthIdx + 1]);
const theme = themeIdx === -1 ? 'neutral' : String(args[themeIdx + 1] ?? 'neutral');

if (!inputArg) {
  fail(
    'Usage: mermaid-to-png.mjs <input.mmd|-> [--out file.png] [--width 960] [--theme neutral]\n' +
      'Renders a local PNG from mermaid source (flowchart LR data-flow, optional ER).',
  );
}
if (!Number.isFinite(width) || width < 200) fail('--width must be a number ≥ 200.');
if (!['default', 'neutral', 'dark', 'forest'].includes(theme)) {
  fail('--theme must be default, neutral, dark, or forest.');
}

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

const tryMmdc = () => {
  const which = spawnSync('mmdc', ['--version'], { encoding: 'utf8' });
  if (which.status !== 0) return false;
  const mmd = path.join(os.tmpdir(), `vs-mermaid-${process.pid}.mmd`);
  fs.writeFileSync(mmd, `${source}\n`);
  const run = spawnSync(
    'mmdc',
    ['-i', mmd, '-o', pngOut, '-t', theme, '-b', 'transparent', '-w', String(width)],
    { encoding: 'utf8' },
  );
  try {
    fs.unlinkSync(mmd);
  } catch {
    // ignore
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
  // Fall back to this package's node_modules when agents run from a bare repo.
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

  // Escape for embedding inside a JS template literal in the page.
  const escaped = source
    .replace(/\\/g, '\\\\')
    .replace(/`/g, '\\`')
    .replace(/\$\{/g, '\\${');

  const html = `<!DOCTYPE html>
<html><head>
<meta charset="utf-8"/>
<script type="module">
  import mermaid from 'https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.esm.min.mjs';
  mermaid.initialize({ startOnLoad: false, theme: ${JSON.stringify(theme)}, securityLevel: 'strict' });
  const def = \`${escaped}\`;
  try {
    const { svg } = await mermaid.render('vs-mermaid-diagram', def);
    document.getElementById('host').innerHTML = svg;
    document.documentElement.dataset.ready = 'ok';
  } catch (err) {
    document.documentElement.dataset.ready = 'err';
    document.documentElement.dataset.error = String(err && err.message ? err.message : err);
  }
</script>
<style>
  html, body { margin: 0; padding: 16px; background: #fff; }
  #host { display: inline-block; }
  #host svg { max-width: none; height: auto; }
</style>
</head><body><div id="host"></div></body></html>`;

  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({
      viewport: { width: Math.max(width, 400), height: 800 },
      deviceScaleFactor: 2,
    });
    await page.setContent(html, { waitUntil: 'networkidle' });
    await page.waitForFunction(
      () => document.documentElement.dataset.ready === 'ok' || document.documentElement.dataset.ready === 'err',
      { timeout: 30000 },
    );
    const status = await page.evaluate(() => ({
      ready: document.documentElement.dataset.ready,
      error: document.documentElement.dataset.error || '',
    }));
    if (status.ready !== 'ok') fail(`Mermaid render failed: ${status.error || 'unknown error'}`);

    const host = page.locator('#host');
    const box = await host.boundingBox();
    if (!box || box.width < 2 || box.height < 2) fail('Rendered diagram has empty bounds.');
    await host.screenshot({ path: pngOut, type: 'png', omitBackground: false });
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
