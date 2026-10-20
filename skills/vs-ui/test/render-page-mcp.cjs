// Minimal stdio MCP server that gives the eval agent eyes. Codex's
// workspace-write sandbox blocks the socket calls Chrome needs, so the agent
// cannot run a browser itself. MCP servers run outside that command sandbox,
// so this one renders a page with the host's Chrome and returns the PNG,
// the same capability the real chat agent had ("you can take screenshots").
// Usage in .pathgrade-mcp.json: node render-page-mcp.cjs <puppeteer-core dir>
const path = require('node:path');
const fs = require('node:fs');
const readline = require('node:readline');

const puppeteer = require(process.argv[2] || 'puppeteer-core');
const CHROME = process.env.CHROME_PATH || '/usr/bin/google-chrome';

const TOOL = {
  name: 'render_page',
  description:
    'Render a local HTML file in headless Chrome, save a PNG screenshot, and return the image. Paths are relative to the workspace.',
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
  annotations: { readOnlyHint: true },
};

function send(msg) {
  process.stdout.write(`${JSON.stringify(msg)}\n`);
}

async function render({ file, out, width = 1200, height = 640 }) {
  const root = process.env.RENDER_ROOT || process.cwd();
  const src = path.resolve(root, file);
  const dest = path.resolve(root, out);
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  const browser = await puppeteer.launch({ executablePath: CHROME, args: ['--no-sandbox'], headless: true });
  try {
    const page = await browser.newPage();
    await page.setViewport({ width, height });
    await page.goto(`file://${src}`, { waitUntil: 'load' });
    const png = await page.screenshot({ path: dest });
    return { png: Buffer.from(png).toString('base64'), dest };
  } finally {
    await browser.close();
  }
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
          serverInfo: { name: 'render-page', version: '1.0.0' },
        },
      });
    } else if (method === 'tools/list') {
      send({ jsonrpc: '2.0', id, result: { tools: [TOOL] } });
    } else if (method === 'tools/call') {
      const { png, dest } = await render(params?.arguments ?? {});
      send({
        jsonrpc: '2.0',
        id,
        result: {
          content: [
            { type: 'text', text: `Saved ${dest}` },
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
    send({ jsonrpc: '2.0', id, result: { isError: true, content: [{ type: 'text', text: String(error) }] } });
  }
});
