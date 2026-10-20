// Minimal stdio MCP server that lets the eval agent see its own page. Codex's
// workspace-write sandbox blocks the socket calls Chrome needs, so the agent
// cannot run a browser itself. MCP servers run outside that command sandbox,
// so this one renders a page with the host's Chrome and returns the PNG,
// the same capability the real chat agent had ("you can take screenshots").
//
// Usage (from the eval's MCP config):
//   node render-page-mcp.cjs <puppeteer-core dir>
// Env:
//   RENDER_ROOT  required. Every input and output path must resolve inside it.
//                "." means the directory the agent runtime starts this server
//                in (Codex starts it in the agent's workspace, which the eval
//                cannot know up front because PathGrade copies the workspace).
//   RENDER_LOG   optional. One JSON line per successful render (outside the
//                workspace, so the eval can tell a real render from a copied file).
//   CHROME_PATH  optional. Defaults to the first Chrome/Chromium found.
//   RENDER_NO_SANDBOX=1  only for hosts where Chrome's sandbox cannot start
//                (for example a root CI container). Off by default.
//
// The tool writes one PNG, so it is not marked read-only. The eval allows it
// through Codex's per-server approval setting instead.
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const readline = require('node:readline');
const { insideRoot, assertNotSymlink, writeNoFollow, allowRequest, pageHash } = require('./render-guard.cjs');

const puppeteer = require(process.argv[2] || 'puppeteer-core');

function resolveChrome() {
  if (process.env.CHROME_PATH) return process.env.CHROME_PATH;
  const candidates = [
    '/usr/bin/google-chrome',
    '/usr/bin/google-chrome-stable',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  ];
  const found = candidates.find((c) => fs.existsSync(c));
  if (!found) throw new Error('No Chrome found. Set CHROME_PATH.');
  return found;
}

const ROOT = process.env.RENDER_ROOT ? fs.realpathSync(path.resolve(process.env.RENDER_ROOT)) : null;
if (ROOT && (ROOT === path.parse(ROOT).root || ROOT === require('node:os').homedir())) {
  process.stderr.write(`render-page: refusing RENDER_ROOT=${ROOT}\n`);
  process.exit(1);
}

const TOOL = {
  name: 'render_page',
  description:
    'Render an HTML file from the workspace in headless Chrome, save a PNG screenshot inside the workspace, and return the image. Paths are relative to the workspace.',
  inputSchema: {
    type: 'object',
    properties: {
      file: { type: 'string', description: 'HTML file to render, e.g. index.html' },
      out: { type: 'string', description: 'PNG path to write, e.g. shots/result.png' },
      width: { type: 'number', default: 1200 },
      height: { type: 'number', default: 640 },
    },
    required: ['file', 'out'],
  },
  annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
};

async function render({ file, out, width = 1200, height = 640 }) {
  const src = insideRoot(ROOT, file, 'file');
  // Reject a symlink planted at the output path before resolving it.
  if (ROOT && typeof out === 'string' && !path.isAbsolute(out) && !out.split(/[\\/]/).includes('..')) {
    assertNotSymlink(path.join(ROOT, out), 'out');
  }
  const dest = insideRoot(ROOT, out, 'out');
  if (!/\.html?$/i.test(src)) throw new Error('file must be an .html file');
  if (!/\.png$/i.test(dest)) throw new Error('out must be a .png file');
  assertNotSymlink(dest, 'out');
  // Hash the workspace as rendered, so the eval can check the shot shows the
  // final edit.
  const sourceHash = pageHash(ROOT);
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  const browser = await puppeteer.launch({
    executablePath: resolveChrome(),
    args: process.env.RENDER_NO_SANDBOX === '1' ? ['--no-sandbox'] : [],
    headless: true,
  });
  try {
    const page = await browser.newPage();
    // Only files inside RENDER_ROOT and data: URLs load; other local files,
    // http(s) and localhost are blocked.
    await page.setRequestInterception(true);
    page.on('request', (req) => (allowRequest(ROOT, req.url()) ? req.continue() : req.abort('accessdenied')));
    await page.setViewport({ width: Math.min(width, 2400), height: Math.min(height, 2400) });
    await page.goto(`file://${src}`, { waitUntil: 'load' });
    const png = Buffer.from(await page.screenshot());
    assertNotSymlink(dest, 'out');
    writeNoFollow(dest, png);
    if (process.env.RENDER_LOG) {
      fs.appendFileSync(
        process.env.RENDER_LOG,
        `${JSON.stringify({
          file: path.relative(ROOT, src),
          out: path.relative(ROOT, dest),
          pngSha: crypto.createHash('sha256').update(png).digest('hex'),
          sourceHash,
          at: Date.now(),
        })}\n`,
      );
    }
    return { png: png.toString('base64'), rel: path.relative(ROOT, dest) };
  } finally {
    await browser.close();
  }
}

function send(msg) {
  process.stdout.write(`${JSON.stringify(msg)}\n`);
}

const rl = readline.createInterface({ input: process.stdin });
rl.on('line', async (line) => {
  let msg;
  try {
    msg = JSON.parse(line);
  } catch {
    return;
  }
  const { id, method, params } = msg;
  if (id === undefined) return;
  try {
    if (method === 'initialize') {
      send({
        jsonrpc: '2.0',
        id,
        result: {
          protocolVersion: params?.protocolVersion ?? '2025-06-18',
          capabilities: { tools: {} },
          serverInfo: { name: 'render-page', version: '1.1.0' },
        },
      });
    } else if (method === 'tools/list') {
      send({ jsonrpc: '2.0', id, result: { tools: [TOOL] } });
    } else if (method === 'tools/call') {
      const { png, rel } = await render(params?.arguments ?? {});
      send({
        jsonrpc: '2.0',
        id,
        result: {
          content: [
            { type: 'text', text: `Saved ${rel}` },
            { type: 'image', data: png, mimeType: 'image/png' },
          ],
        },
      });
    } else if (method === 'ping') {
      send({ jsonrpc: '2.0', id, result: {} });
    } else {
      send({ jsonrpc: '2.0', id, error: { code: -32601, message: `Unknown method ${method}` } });
    }
  } catch (error) {
    send({ jsonrpc: '2.0', id, result: { isError: true, content: [{ type: 'text', text: String(error.message ?? error) }] } });
  }
});
