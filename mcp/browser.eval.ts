import { createServer, type Server } from 'node:http';
import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { build } from 'esbuild';
import puppeteer, { type Browser } from 'puppeteer-core';
import { Client, InMemoryTransport } from '@modelcontextprotocol/client';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createVsServer } from './server.ts';

let browser: Browser;
let http: Server;
let client: Client;
let server: ReturnType<typeof createVsServer>;
let url: string;
let root: string;
let failNextSave = false;
const calls: string[] = [];
const consoleErrors: string[] = [];

// Use the production MCP Apps host bridge, not a mock of App's window globals.
const hostSource = `import { AppBridge, PostMessageTransport } from '@modelcontextprotocol/ext-apps/app-bridge';
const frame=document.querySelector('iframe');
const bridge=new AppBridge(null,{name:'VS eval host',version:'1'}, {serverTools:{}});
window.inject=data=>bridge.sendToolResult({content:[],structuredContent:data});
bridge.oncalltool=async params=>{const r=await fetch('/call',{method:'POST',body:JSON.stringify(params)});return r.json();};
bridge.oninitialized=async()=>{await bridge.sendToolInput({arguments:{}});const r=await fetch('/call',{method:'POST',body:JSON.stringify({name:'vs.library',arguments:{}})});await bridge.sendToolResult(await r.json());};
await bridge.connect(new PostMessageTransport(frame.contentWindow,frame.contentWindow));frame.src='/view';`;

beforeAll(async () => {
  root = await mkdtemp(join(tmpdir(), 'vs-browser-'));
  await mkdir(join(root, 'vs', 'specs'), { recursive: true });
  await mkdir(join(root, 'stash', 'reviews'), { recursive: true });
  // A pre-bridge generated shell exercises the compatibility replacement path.
  const artifact = '<!doctype html><title>MCP feature proposal</title><meta name="vs-artifact-id" content="browser-fixture"><style>body{background:#f8f7f3;color:#202b2a;padding:38px;font:18px Georgia;line-height:1.6}h1{font:600 36px Arial}p{max-width:65ch}</style><h1>MCP feature proposal</h1><p id="feedback-target">Comment events deliver artifact feedback to a subscribed ChatGPT chat.</p><h2>Review the delivery flow</h2><p>Leave a comment to ask how retries work.</p><script>\n// vs-review:begin\ndocument.documentElement.setAttribute("data-old-overlay", "removed");\n// vs-review:end\n</script><script type="text/htmdx"># MCP feature proposal</script>';
  await writeFile(join(root, 'vs', 'specs', 'proposal.html'), artifact);
  await writeFile(join(root, 'stash', 'reviews', 'release.html'), '<title>Release review</title><script type="text/htmdx"># Release</script>');
  server = createVsServer(root);
  client = new Client({ name: 'vs-browser', version: '1' });
  const [c, s] = InMemoryTransport.createLinkedPair();
  await Promise.all([client.connect(c), server.connect(s)]);
  const host = await build({ stdin: { contents: hostSource, resolveDir: process.cwd(), sourcefile: 'eval-host.ts' }, bundle: true, platform: 'browser', format: 'esm', write: false });
  http = createServer(async (request, response) => {
    try {
      if (request.url === '/call') {
        let body = ''; for await (const chunk of request) body += chunk;
        const params = JSON.parse(body); calls.push(params.name);
        let result: unknown;
        if (params.name === 'vs.save-comment' && failNextSave) { failNextSave = false; result = { isError: true, content: [{ type: 'text', text: 'Temporary storage failure' }] }; }
        else result = await client.callTool(params);
        response.setHeader('Content-Type', 'application/json'); response.end(JSON.stringify(result));
      } else if (request.url === '/view') { response.setHeader('Content-Type', 'text/html'); response.end(await readFile(new URL('./dist/view.html', import.meta.url), 'utf8')); }
      else if (request.url === '/host.js') { response.setHeader('Content-Type', 'text/javascript'); response.end(host.outputFiles[0].text); }
      else { response.setHeader('Content-Type', 'text/html'); response.end('<!doctype html><style>body{margin:0}iframe{border:0;width:100%;height:800px}</style><iframe title="VS App"></iframe><script type="module" src="/host.js"></script>'); }
    } catch (error) { response.statusCode = 500; response.end(String(error)); }
  });
  await new Promise<void>(resolve => http.listen(0, '127.0.0.1', resolve));
  url = `http://127.0.0.1:${(http.address() as any).port}`;
  browser = await puppeteer.launch({ executablePath: process.env.CHROME_PATH || (process.platform === 'darwin' ? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' : '/usr/bin/google-chrome-stable'), headless: true, args: ['--no-sandbox'] });
}, 30_000);

afterAll(async () => {
  await browser?.close();
  if (http) await new Promise<void>(resolve => http.close(() => resolve()));
  await client?.close(); await server?.close();
});

async function openLibrary() {
  const page = await browser.newPage();
  page.setDefaultTimeout(5000);
  await page.setViewport({ width: 1280, height: 800 });
  page.on('pageerror', error => { consoleErrors.push(String(error)); console.error('VS browser:', String(error)); });
  await page.goto(url);
  const app = await (await page.$('iframe'))!.contentFrame();
  await app!.waitForSelector('.artifact');
  return { page, app: app! };
}

describe('VS artifact library browser flow', () => {
  it('browses projects, searches, and opens an older artifact with the current review overlay', async () => {
    const { page, app } = await openLibrary();
    try {
      expect(await app.$$eval('.artifact', nodes => nodes.length)).toBe(2);
      if (process.env.VS_MCP_EVIDENCE_DIR) await writeFile(join(process.env.VS_MCP_EVIDENCE_DIR, 'after-library.png'), await page.screenshot());
      await app.select('#project', 'stash');
      await app.waitForFunction(() => document.querySelectorAll('.artifact').length === 1);
      expect(await app.$eval('.artifact', node => node.textContent)).toContain('Release review');
      await app.select('#project', '');
      await app.type('#search', 'MCP');
      await app.waitForFunction(() => document.querySelectorAll('.artifact').length === 1 && document.querySelector('.artifact')!.textContent!.includes('MCP'));
      await app.click('.artifact');
      await app.waitForSelector('#vs-artifact-frame:not([hidden])');
      const artifact = await (await app.$('#vs-artifact-frame'))!.contentFrame();
      await artifact!.waitForFunction(() => [...document.querySelectorAll('div')].some(n => n.shadowRoot?.querySelector('.vs-review-note')?.textContent?.includes('Saved in VS')));
      expect(await artifact!.evaluate(() => document.documentElement.hasAttribute('data-old-overlay'))).toBe(false);
      if (process.env.VS_MCP_EVIDENCE_DIR) await writeFile(join(process.env.VS_MCP_EVIDENCE_DIR, 'after-artifact.png'), await page.screenshot());
      await app.click('#back');
      await app.waitForSelector('.artifact');
    } finally { await page.close(); }
  });

  it('persists human feedback, retries a visible save failure, and restores it after reopening', async () => {
    const { page, app } = await openLibrary();
    try {
      const button = await app.$$('.artifact');
      for (const candidate of button) if ((await candidate.evaluate(n => n.textContent))?.includes('MCP feature proposal')) { await candidate.click(); break; }
      await app.waitForSelector('#vs-artifact-frame:not([hidden])');
      const artifact = await (await app.$('#vs-artifact-frame'))!.contentFrame();
      await artifact!.waitForFunction(() => Boolean((window as any).vsMcpReview?.revision));
      failNextSave = true;
      await artifact!.evaluate(() => { const root = [...document.querySelectorAll('div')].find(n => n.shadowRoot)?.shadowRoot; (root!.querySelector('.vs-review-fab') as HTMLElement).click(); (root!.querySelector('[data-add]') as HTMLElement).click(); });
      await artifact!.click('#feedback-target');
      await artifact!.evaluate(() => { const root = [...document.querySelectorAll('div')].find(n => n.shadowRoot)!.shadowRoot!; const field = root.querySelector('textarea')!; field.value = 'Explain how retries work.'; field.dispatchEvent(new Event('input')); (root.querySelector('[data-primary]') as HTMLButtonElement).click(); });
      await artifact!.waitForFunction(() => [...document.querySelectorAll('div')].some(n => n.shadowRoot?.querySelector('.vs-review-note')?.textContent?.includes('Feedback not saved')));
      await artifact!.evaluate(() => { const root = [...document.querySelectorAll('div')].find(n => n.shadowRoot)!.shadowRoot!; [...root.querySelectorAll('button')].find(b => b.textContent === 'Retry')!.click(); });
      await artifact!.waitForFunction(() => [...document.querySelectorAll('div')].some(n => n.shadowRoot?.querySelector('.vs-review-note')?.textContent === 'Saved in VS. Subscribed chats receive new comments.'));
      await app.click('#back');
      await app.waitForSelector('.artifact');
      const list = await client.callTool({ name: 'vs.library', arguments: { query: 'MCP' } });
      const entry = (list.structuredContent as any).artifacts[0];
      expect(entry.openComments).toBe(1);
      const saved = await client.callTool({ name: 'vs.comments', arguments: { artifactId: entry.id } });
      expect(saved.structuredContent).toMatchObject({ comments: [{ comment: 'Explain how retries work.', anchor: { selector: 'p#feedback-target' }, revision: entry.revision }] });
      await app.evaluate(() => [...document.querySelectorAll<HTMLButtonElement>('.artifact')].find(n => n.textContent.includes('MCP feature proposal'))!.click());
      const reopened = await (await app.waitForSelector('#vs-artifact-frame:not([hidden])'))!.contentFrame();
      await reopened!.waitForFunction(() => [...document.querySelectorAll('div')].some(n => n.shadowRoot?.querySelector('.vs-review-thread p')?.textContent === 'Explain how retries work.'));
      await reopened!.evaluate(() => ([...document.querySelectorAll('div')].find(n => n.shadowRoot)!.shadowRoot!.querySelector('.vs-review-fab') as HTMLButtonElement).click());
      await reopened!.waitForFunction(() => [...document.querySelectorAll('div')].some(n => { const panel = n.shadowRoot?.querySelector('.vs-review-panel'); return panel && getComputedStyle(panel).opacity === '1' && panel.getBoundingClientRect().right <= innerWidth; }));
      if (process.env.VS_MCP_EVIDENCE_DIR) await writeFile(join(process.env.VS_MCP_EVIDENCE_DIR, 'after-comments.png'), await page.screenshot());
      expect(consoleErrors).toEqual([]);
    } finally { await page.close(); }
  });

  it('ignores feedback messages from a window other than the selected artifact', async () => {
    const { page, app } = await openLibrary();
    try {
      await app.click('.artifact');
      await app.waitForSelector('#vs-artifact-frame:not([hidden])');
      const before = calls.filter(name => name === 'vs.save-comment').length;
      await app.evaluate(() => window.postMessage({ channel: 'vs-review', requestId: 'forged', action: 'save', comment: { comment: 'forged' } }, '*'));
      await page.waitForNetworkIdle({ idleTime: 100 });
      expect(calls.filter(name => name === 'vs.save-comment').length).toBe(before);
      await page.setViewport({ width: 390, height: 844 });
      await app.click('#back');
      await app.waitForSelector('.artifact');
      expect(await app.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    } finally { await page.close(); }
  });

  it('rejects departing document feedback when the same iframe opens another artifact', async () => {
    const { page, app } = await openLibrary();
    try {
      const list = await client.callTool({ name: 'vs.library', arguments: {} });
      const entries = (list.structuredContent as any).artifacts;
      const original = await client.callTool({ name: 'vs.open-artifact', arguments: { artifactId: entries[0].id } });
      const departing = { ...original.structuredContent as any };
      departing.html += `<script>window.addEventListener('pagehide',()=>parent.postMessage({channel:'vs-review',requestId:'departing',action:'save',comment:{id:'departing',comment:'Feedback from a closed artifact',intent:'comment',status:'open',createdAt:new Date().toISOString(),anchor:{kind:'html',selector:'body'}}},'*'));</script>`;
      await page.evaluate(data => (window as any).inject(data), departing);
      await app.waitForSelector('#vs-artifact-frame:not([hidden])');
      const artifact = await (await app.$('#vs-artifact-frame'))!.contentFrame();
      await artifact!.waitForFunction(() => Boolean((window as any).vsMcpReview?.revision));
      await app.evaluate(() => { (window as any).departures = 0; window.addEventListener('message', event => { if (event.data?.requestId === 'departing') (window as any).departures++; }); });
      const next = await client.callTool({ name: 'vs.open-artifact', arguments: { artifactId: entries[1].id } });
      await page.evaluate(data => (window as any).inject(data), next.structuredContent);
      await page.waitForNetworkIdle({ idleTime: 150 });
      expect(await app.evaluate(() => (window as any).departures)).toBe(1);
      const comments = await client.callTool({ name: 'vs.comments', arguments: { artifactId: entries[1].id } });
      expect((comments.structuredContent as any).comments.some(c => c.id === 'departing')).toBe(false);
    } finally { await page.close(); }
  });

  it('keeps authored WebMCP scripts after the generated registry during an overlay upgrade', async () => {
    const { page, app } = await openLibrary();
    try {
      const list = await client.callTool({ name: 'vs.library', arguments: {} });
      const original = await client.callTool({ name: 'vs.open-artifact', arguments: { artifactId: (list.structuredContent as any).artifacts[0].id } });
      const data = { ...original.structuredContent as any };
      data.html = '<title>Authored tools</title><p>Choose a retry policy.</p><script type="text/htmdx"># Authored tools</script><script>\n// vs-webmcp:begin\nwindow.vsArtifact={registerTool:()=>({ready:Promise.resolve()})};\n// vs-webmcp:end\n</script><script data-vs-webmcp>window.vsArtifact.registerTool({name:"choose",description:"choose",inputSchema:{type:"object"},execute:()=>({})});document.documentElement.dataset.authoredReady="true";</script>';
      await page.evaluate(data => (window as any).inject(data), data);
      await app.waitForSelector('#vs-artifact-frame:not([hidden])');
      const artifact = await (await app.$('#vs-artifact-frame'))!.contentFrame();
      await artifact!.waitForFunction(() => Boolean((window as any).vsMcpReview?.revision));
      expect(await artifact!.evaluate(() => document.documentElement.dataset.authoredReady)).toBe('true');
    } finally { await page.close(); }
  });
});
