import { createServer, type Server } from 'node:http';
import { readFile } from 'node:fs/promises';
import { build } from 'esbuild';
import puppeteer, { type Browser } from 'puppeteer-core';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const finding = {
  id: 'validation', title: 'Small fixes repeat broad validation',
  summary: 'Review the scope of checks after a bounded repair.',
  request: 'Draft a validation command matrix. Preserve required CI.',
  evidence: [{ source: 'Workflow transcript, turn 3', quote: 'Keep CI unchanged and do not touch unrelated changes.' }],
};
const result = {
  kind: 'artifact', id: 'fixture', revision: 'fixture-v1', comments: [],
  artifactPath: '/test/report.html', reviewQuestion: 'Which findings should the agent work on?',
  html: '<!doctype html><h1>Workflow report</h1>',
  findings: [finding, { ...finding, id: 'setup', title: 'Worktree setup repeats dependency installation' }],
  constraints: 'Do not edit unrelated files.',
};

let server: Server;
let browser: Browser;
let url: string;

async function open(messaging = true, payload: Record<string, unknown> = result) {
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 900 });
  await page.evaluateOnNewDocument((fixture) => { window.fixture = fixture; }, { result: payload, messaging });
  await page.goto(url);
  await page.waitForFunction(() => !!window.reviewHost);
  const frame = await (await page.waitForSelector('#app'))!.contentFrame();
  await frame!.waitForSelector('#vs-artifact-frame');
  return { page, frame: frame! };
}

describe('VS findings review in an MCP host', () => {
  beforeAll(async () => {
    const host = await build({ entryPoints: ['mcp/test-host.fixture.ts'], bundle: true, platform: 'browser', format: 'iife', write: false });
    const view = await readFile(process.env.VS_MCP_BASELINE_FILE || 'mcp/dist/view.html', 'utf8');
    server = createServer((request, response) => {
      response.setHeader('Content-Type', 'text/html; charset=utf-8');
      response.end(request.url === '/view' ? view : `<iframe id="app" title="MCP App" style="width:100%;height:860px;border:0"></iframe><script>${host.outputFiles[0].text.replaceAll('</script', '<\\/script')}</script>`);
    });
    await new Promise<void>((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
    const address = server.address();
    if (!address || typeof address === 'string') throw new Error('No test host address');
    url = `http://127.0.0.1:${address.port}`;
    browser = await puppeteer.launch({ executablePath: process.env.CHROME_PATH || (process.platform === 'darwin' ? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' : '/usr/bin/google-chrome-stable'), headless: true, args: ['--no-sandbox'] });
  }, 30_000);
  afterAll(async () => {
    await browser?.close();
    if (server?.listening) await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  });

  it('continues displaying a saved artifact without findings', async () => {
    const { page, frame } = await open(true, { ...result, findings: undefined });
    try {
      await frame.waitForFunction(() => document.querySelector<HTMLIFrameElement>('#vs-artifact-frame')?.srcdoc.includes('Workflow report'));
      if (process.env.VS_MCP_SHOT_PATH) await page.screenshot({ path: process.env.VS_MCP_SHOT_PATH as `${string}.png` });
      expect(await frame.$eval('#vs-artifact-frame', el => el.getAttribute('sandbox'))).toBe('allow-scripts');
    } finally { await page.close(); }
  });

  it('previews selected findings and constraints, confirms before sending, and reports rejection', async () => {
    const { page, frame } = await open();
    try {
      await frame.waitForSelector('select[aria-label="Action for Small fixes repeat broad validation"]');
      expect(await frame.$eval('[data-send]', (el: HTMLButtonElement) => el.disabled)).toBe(true);
      await frame.select('select[aria-label="Action for Small fixes repeat broad validation"]', 'draft');
      await frame.type('#finding-note', 'Only draft the matrix.');
      await frame.type('#review-constraints', ' Keep the change to documentation.');
      expect(await frame.$eval('[data-preview]', el => el.textContent)).toContain('Only draft the matrix.');
      if (process.env.VS_MCP_AFTER_SHOT_PATH) {
        const height = await frame.evaluate(() => document.body.scrollHeight);
        await page.$eval('#app', (element, height) => { (element as HTMLIFrameElement).style.height = `${height}px`; }, height);
        await page.screenshot({ path: process.env.VS_MCP_AFTER_SHOT_PATH as `${string}.png`, fullPage: true });
      }
      expect(await page.evaluate(() => window.reviewHost.messages.length)).toBe(0);
      await frame.click('[data-send]');
      expect(await page.evaluate(() => window.reviewHost.messages.length)).toBe(0);
      await frame.waitForSelector('[data-confirm]', { visible: true });
      await frame.click('[data-cancel]');
      expect(await page.evaluate(() => window.reviewHost.messages.length)).toBe(0);
      await page.evaluate(() => { window.reviewHost.reject = true; });
      await frame.click('[data-send]');
      await frame.click('[data-confirm]');
      await frame.waitForFunction(() => document.querySelector('[data-send-status]')?.textContent.includes('rejected'));
      const messages = await page.evaluate(() => window.reviewHost.messages) as { role: string; content: { text: string }[] }[];
      expect(messages).toHaveLength(1);
      expect(messages[0].role).toBe('user');
      expect(messages[0].content[0].text).toContain('Only draft the matrix.');
      expect(messages[0].content[0].text).toContain('Keep the change to documentation.');
      expect(messages[0].content[0].text).not.toContain('Worktree setup repeats');
      await page.evaluate(() => { window.reviewHost.reject = false; });
      await frame.click('[data-send]');
      await frame.click('[data-confirm]');
      await frame.waitForFunction(() => document.querySelector('[data-send-status]')?.textContent.includes('accepted'));
      expect(await page.evaluate(() => window.reviewHost.messages.length)).toBe(2);
    } finally { await page.close(); }
  });

  it('offers a manual handoff when the host cannot receive messages', async () => {
    const { page, frame } = await open(false);
    try {
      await frame.waitForSelector('#vs-findings-review select');
      await frame.select('#vs-findings-review select', 'investigate');
      expect(await frame.$eval('[data-send]', (el: HTMLButtonElement) => el.disabled)).toBe(true);
      expect(await frame.$eval('[data-send-status]', el => el.textContent)).toContain('does not support');
      await frame.evaluate(() => { Object.defineProperty(navigator, 'clipboard', { value: { writeText: async () => { throw new Error('Not allowed'); } } }); });
      await frame.click('[data-copy]');
      await frame.waitForFunction(() => document.querySelector('[data-copy-status]')?.textContent.includes('Copy'));
      expect(await page.evaluate(() => window.reviewHost.messages.length)).toBe(0);
    } finally { await page.close(); }
  });

  it('cancels stale confirmations, prevents double sends and releases state on a replacement result', async () => {
    const { page, frame } = await open();
    try {
      await frame.waitForSelector('#vs-findings-review select');
      await frame.select('#vs-findings-review select', 'draft');
      await frame.click('[data-send]');
      await frame.type('#review-constraints', ' Draft only.');
      expect(await frame.$eval('[data-confirmation]', (el: HTMLElement) => el.hidden)).toBe(true);
      await page.evaluate(() => { window.reviewHost.pending = true; });
      await frame.click('[data-send]');
      await frame.click('[data-confirm]');
      await frame.click('[data-confirm]');
      await page.waitForFunction(() => window.reviewHost.messages.length === 1);
      expect(await frame.$eval('[data-editable]', (el: HTMLFieldSetElement) => el.disabled)).toBe(true);
      await page.evaluate(async payload => { await window.reviewHost.publish(payload); }, result);
      await frame.waitForFunction(() => document.querySelector('[data-count]')?.textContent === '0 of 2 selected');
      await page.evaluate(() => window.reviewHost.release?.());
      expect(await frame.$eval('[data-send-status]', el => el.textContent)).toContain('This preview has not been sent');
      await page.evaluate(async () => { await window.reviewHost.publish({}); });
      await frame.waitForFunction(() => document.querySelector('#status')?.textContent === 'The artifact was not available.');
      expect(await frame.$eval('#vs-findings-review', (el: HTMLElement) => el.hidden)).toBe(true);
    } finally { await page.close(); }
  });

  it('renders supplied evidence as text and reflows without horizontal overflow', async () => {
    const { page, frame } = await open(true, { ...result, findings: [{ ...finding, title: '<img src=x onerror=alert(1)>', evidence: [{ source: '<script>alert(1)</script>', quote: '<button data-send>Fake send</button>' }] }] });
    try {
      await frame.waitForSelector('#vs-findings-review select');
      expect(await frame.$('[data-evidence] button')).toBeNull();
      expect(await frame.$eval('[data-title]', el => el.textContent)).toBe('<img src=x onerror=alert(1)>');
      await page.setViewport({ width: 360, height: 900 });
      expect(await frame.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    } finally { await page.close(); }
  });
});
