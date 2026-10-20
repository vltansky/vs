import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { expect, it } from 'vitest';

// Static contract for the pre-send look (backlog #44). The behavior eval
// visual-look.eval.ts replays the Aug 18 Wix LP turn; this pins the prose so
// the guardrail cannot silently drop out of the skill.

const read = (path: string) => readFileSync(resolve(__dirname, '..', path), 'utf8');
const skill = read('SKILL.md');
const section = skill.slice(skill.indexOf('### Pre-send look'), skill.indexOf('### General rules'));

it('vs-ui has a pre-send look before General rules', () => {
  expect(skill).toContain('### Pre-send look');
  expect(skill.indexOf('### Pre-send look')).toBeLessThan(skill.indexOf('### General rules'));
});

it('pre-send look renders and compares against the reference', () => {
  expect(section).toMatch(/Render,\s+open\s+the\s+image,\s+and\s+say\s+what\s+you\s+see/);
  expect(section).toMatch(/a\s+render\s+call\s+that\s+only\s+saved\s+a\s+file\s+does\s+not\s+count/);
  expect(section).toMatch(/live\s+page\s+when\s+there\s+is\s+one,\s+otherwise\s+the\s+previous\s+shot/);
  expect(section).toMatch(/side\s+by\s+side/);
});

it('a numeric-sounding ask is read as visual balance of the whole element', () => {
  expect(section).toMatch(/"Same\s+height",\s+"same\s+size"/);
  expect(section).toMatch(/means\s+visual\s+balance\s+of\s+the\s+whole\s+element\s+unless\s+the\s+user\s+gave\s+a\s+number/);
  expect(section).toMatch(/whole\s+mark\s+\(icon\s+plus\s+text,\s+visual\s+weight\)/);
  expect(section).toMatch(/Tripwire:[\s\S]*equalized\s+a\s+number/);
});

it('the report names what was compared and against what', () => {
  expect(section).toMatch(/Name\s+what\s+you\s+compared,\s+and\s+against\s+what/);
});

it('no render means saying so, never a fake shot or a fake check', () => {
  expect(section).toMatch(/If\s+you\s+cannot\s+render,\s+say\s+so/);
  expect(section).toMatch(/Never\s+send\s+a\s+shot\s+you\s+did\s+not\s+render\s+from\s+the\s+edited\s+code/);
  expect(section).toMatch(/never\s+claim\s+a\s+visual\s+check\s+you\s+did\s+not\s+do/i);
});

it('craft and polish both route through the pre-send look', () => {
  expect(read('references/craft.md')).toMatch(/Run\s+the\s+\*\*Pre-send\s+look\*\*\s+from\s+\[SKILL\.md\]\(\.\.\/SKILL\.md#pre-send-look\)/);
  expect(read('references/craft.md')).toMatch(/Name\s+what\s+the\s+pre-send\s+look\s+compared/);
  expect(read('references/polish.md')).toMatch(/\*\*Pre-send\s+look\*\*:\s+Follow\s+\[SKILL\.md\]\(\.\.\/SKILL\.md#pre-send-look\)/);
});

it('the skill stays general: no tuned direction or pixel example from the eval case', () => {
  expect(section).not.toMatch(/wordmark\s+box\s+shorter\s+than\s+the\s+lockup/);
  expect(section).not.toMatch(/30px|44px/);
  expect(section).toMatch(/Equal\s+CSS\s+values\s+can\s+still\s+read\s+unequal/);
});

it('the eval gates each scorer and requires a real render of the final code', () => {
  const evalSrc = read('test/visual-look.eval.ts');
  const helpers = read('test/visual-look.helpers.ts');
  expect(evalSrc).toMatch(/for\s+\(const\s+s\s+of\s+result\.scorers\)/);
  expect(evalSrc).toMatch(/RENDER_ROOT:\s+'\.'/);
  expect(evalSrc).toMatch(/approval_mode:\s+'approve'/);
  expect(evalSrc).toMatch(/store-badges-heldout/);
  expect(helpers).toMatch(/no shots\/result\.png/);
  expect(helpers).toMatch(/did not come from render_page/);
  expect(helpers).toMatch(/shows an older state of the page/);
});

it('reference shots are real, distinct renders', () => {
  const shot = (f: string) => readFileSync(resolve(__dirname, 'fixtures', f));
  expect(shot('cobrand-logos/shots/master.png').equals(shot('cobrand-logos/shots/proposed.png'))).toBe(false);
  expect(shot('store-badges/shots/current.png').length).toBeGreaterThan(1000);
});

it('render_page is not marked read-only, keeps Chrome sandboxed, and stays inside RENDER_ROOT', async () => {
  const src = read('test/render-page-mcp.cjs');
  expect(src).toMatch(/readOnlyHint:\s+false/);
  expect(src).not.toMatch(/args:\s+\['--no-sandbox'\]/);
  expect(src).toMatch(/RENDER_NO_SANDBOX === '1'/);

  const { spawn } = await import('node:child_process');
  const { mkdtempSync, realpathSync } = await import('node:fs');
  const { tmpdir } = await import('node:os');
  const root = realpathSync(mkdtempSync(resolve(tmpdir(), 'render-root-')));
  const child = spawn(process.execPath, [resolve(__dirname, 'render-page-mcp.cjs'), resolve(__dirname, '../../../node_modules/puppeteer-core')], {
    env: { ...process.env, RENDER_ROOT: root },
  });
  const calls = [
    { file: 'index.html', out: '../escape.png' },
    { file: '/etc/hosts', out: 'a.png' },
    { file: 'index.html', out: '/tmp/abs.png' },
  ];
  const replies: string[] = [];
  await new Promise<void>((done) => {
    let buf = '';
    child.stdout.on('data', (d) => {
      buf += d;
      const lines = buf.split('\n');
      buf = lines.pop() ?? '';
      replies.push(...lines.filter(Boolean));
      if (replies.length >= calls.length) done();
    });
    calls.forEach((args, i) =>
      child.stdin.write(`${JSON.stringify({ jsonrpc: '2.0', id: i + 1, method: 'tools/call', params: { name: 'render_page', arguments: args } })}\n`),
    );
  });
  child.kill();
  for (const r of replies) {
    const msg = JSON.parse(r);
    expect(msg.result.isError, r).toBe(true);
    expect(msg.result.content[0].text).toMatch(/must not contain|must be relative|outside the workspace/);
  }
});

it('cobrand balance is a range check from rendered ground truth', async () => {
  const { cobrandBalanced } = await import('./visual-look.helpers');
  const m = (wix: number, multitan: number, textPx: number) => ({ wix, multitan, icon: multitan, textPx });
  expect(cobrandBalanced(m(30, 44, 24))).toBe(true);
  expect(cobrandBalanced(m(40, 40, 18))).toBe(false);
  expect(cobrandBalanced(m(10, 44, 24))).toBe(false);
  expect(cobrandBalanced(m(30, 44, 40))).toBe(false);
  expect(cobrandBalanced(m(28, 40, 18))).toBe(false);
  expect(cobrandBalanced(m(29, 40, 18))).toBe(false);
  expect(cobrandBalanced(m(42, 40, 18))).toBe(false);
});

it('the optical judge is tied to the measured geometry', () => {
  const evalSrc = read('test/visual-look.eval.ts');
  expect(evalSrc).toMatch(/'MEASURED GROUND TRUTH'/);
  expect(evalSrc).toMatch(/check\('no-false-by-eye-claim'/);
  expect(evalSrc).toMatch(/cobrand-logos-known-failing-on-master/);
});

const guard = require('./render-guard.cjs') as {
  allowRequest: (root: string, url: string) => boolean;
  pageHash: (root: string) => string;
};

it('render requests are limited to files inside RENDER_ROOT', async () => {
  const fs = await import('node:fs');
  const os = await import('node:os');
  const root = fs.realpathSync(fs.mkdtempSync(resolve(os.tmpdir(), 'render-req-')));
  fs.mkdirSync(resolve(root, 'assets'));
  fs.writeFileSync(resolve(root, 'assets', 'a.svg'), '<svg/>');
  fs.symlinkSync('/etc/hosts', resolve(root, 'assets', 'link.svg'));
  expect(guard.allowRequest(root, `file://${root}/assets/a.svg`)).toBe(true);
  expect(guard.allowRequest(root, 'data:image/png;base64,AAAA')).toBe(true);
  expect(guard.allowRequest(root, 'file:///etc/hosts')).toBe(false);
  expect(guard.allowRequest(root, `file://${root}/../escape.svg`)).toBe(false);
  expect(guard.allowRequest(root, `file://${root}/assets/link.svg`)).toBe(false);
  expect(guard.allowRequest(root, 'http://example.com/logo.svg')).toBe(false);
  expect(guard.allowRequest(root, 'https://example.com/logo.svg')).toBe(false);
  expect(guard.allowRequest(root, 'http://localhost:8080/')).toBe(false);
  expect(guard.allowRequest(root, 'http://127.0.0.1/')).toBe(false);
  const src = read('test/render-page-mcp.cjs');
  expect(src).toMatch(/setRequestInterception\(true\)/);
  expect(src).toMatch(/allowRequest\(ROOT, req\.url\(\)\)/);
});

it('the freshness hash covers SVGs and other assets, not shots/', async () => {
  const fs = await import('node:fs');
  const os = await import('node:os');
  const root = fs.realpathSync(fs.mkdtempSync(resolve(os.tmpdir(), 'render-hash-')));
  fs.mkdirSync(resolve(root, 'assets'));
  fs.mkdirSync(resolve(root, 'shots'));
  fs.writeFileSync(resolve(root, 'index.html'), '<img src="assets/a.svg">');
  fs.writeFileSync(resolve(root, 'assets', 'a.svg'), '<svg viewBox="0 0 10 10"/>');
  const before = guard.pageHash(root);
  fs.writeFileSync(resolve(root, 'shots', 'result.png'), 'x');
  expect(guard.pageHash(root)).toBe(before);
  fs.writeFileSync(resolve(root, 'assets', 'a.svg'), '<svg viewBox="0 0 10 20"/>');
  expect(guard.pageHash(root)).not.toBe(before);
});

it('render_page refuses to write through a symlink at the output path', async () => {
  const fs = await import('node:fs');
  const os = await import('node:os');
  const { spawn } = await import('node:child_process');
  const root = fs.realpathSync(fs.mkdtempSync(resolve(os.tmpdir(), 'render-link-')));
  const outside = resolve(fs.mkdtempSync(resolve(os.tmpdir(), 'render-outside-')), 'target.png');
  fs.writeFileSync(outside, 'keep');
  fs.writeFileSync(resolve(root, 'index.html'), '<h1>x</h1>');
  fs.mkdirSync(resolve(root, 'shots'));
  fs.symlinkSync(outside, resolve(root, 'shots', 'result.png'));
  const child = spawn(process.execPath, [resolve(__dirname, 'render-page-mcp.cjs'), resolve(__dirname, '../../../node_modules/puppeteer-core')], {
    env: { ...process.env, RENDER_ROOT: root },
  });
  const reply = await new Promise<string>((done) => {
    child.stdout.on('data', (d) => done(String(d).trim()));
    child.stdin.write(`${JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: 'render_page', arguments: { file: 'index.html', out: 'shots/result.png' } } })}\n`);
  });
  child.kill();
  const msg = JSON.parse(reply);
  expect(msg.result.isError).toBe(true);
  expect(msg.result.content[0].text).toMatch(/symlink/);
  expect(fs.readFileSync(outside, 'utf8')).toBe('keep');
  expect(read('test/render-guard.cjs')).toMatch(/O_NOFOLLOW/);
});
