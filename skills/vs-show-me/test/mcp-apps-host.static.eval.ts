import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { describe, expect, it } from 'vitest';

const DIR = path.resolve(__dirname, '..');
const ROOT = path.resolve(DIR, '..', '..');
const SKILL = fs.readFileSync(path.join(DIR, 'SKILL.md'), 'utf8');
const REF = fs.readFileSync(
  path.join(ROOT, 'skills', 'vs-internal-shared', 'references', 'mcp-apps-host.md'),
  'utf8',
);
const ELI5 = fs.readFileSync(
  path.join(ROOT, 'skills', 'vs-eli5', 'SKILL.md'),
  'utf8',
);
const SHAPE = path.join(DIR, 'scripts', 'mcp-app-resource-shape.mjs');

describe('vs-show-me MCP Apps progressive enhancement', () => {
  it('loads the shared mcp-apps-host reference from a dedicated skill section', () => {
    expect(SKILL).toMatch(/## MCP Apps host \(progressive enhancement\)/);
    expect(SKILL).toContain(
      '../vs-internal-shared/references/mcp-apps-host.md',
    );
    expect(SKILL).toMatch(/ui:\/\/vs\/show-me/);
    expect(SKILL).toMatch(/text\/html;profile=mcp-app/);
    expect(SKILL).toMatch(/_meta\.ui\.resourceUri|resourceUri/);
    expect(SKILL).toMatch(/openai\/outputTemplate/);
    expect(SKILL).toMatch(/mcp-app-resource-shape\.mjs/);
    expect(SKILL).toMatch(/mcp__vs_artifact__vs_show_me/);
  });

  it('keeps App-when-supported and HTMDX-otherwise as a hard branch', () => {
    expect(SKILL).toMatch(/App-capable host/i);
    expect(SKILL).toMatch(/Non-App host/i);
    expect(SKILL).toMatch(/Grok Bot/);
    expect(SKILL).toMatch(
      /mandatory fallback[\s\S]{0,120}HTMDX file[\s\S]{0,80}URL[\s\S]{0,80}first-screen shot[\s\S]{0,80}TLDR/i,
    );
    expect(SKILL).toMatch(/CDN-pinned HTMDX[\s\S]{0,120}file fallback/i);
    expect(SKILL).toMatch(/do not introduce a bundler/i);
    expect(SKILL).toMatch(/sidebar\/file\/composer[\s\S]{0,40}out of scope/i);
  });

  it('does not replace the portable HTMDX + shot contract', () => {
    expect(SKILL).toMatch(/one portable `\.html` file/);
    expect(SKILL).toMatch(/## First-screen shot/);
    expect(SKILL).toMatch(/Saved:.*clickable absolute path/s);
    // Apps enhance presentation; authoring stays HTMDX-on-disk.
    expect(SKILL).not.toMatch(/React rewrite of HTMDX/i);
    expect(SKILL).not.toMatch(/ChatGPT-only plugin/i);
  });
});

describe('shared mcp-apps-host reference contract', () => {
  it('defines detection, emit path, fallback, and CSP note', () => {
    expect(REF).toMatch(/## Detect or assume host support/);
    expect(REF).toMatch(/io\.modelcontextprotocol\/ui/);
    expect(REF).toMatch(/text\/html;profile=mcp-app/);
    expect(REF).toMatch(/## Emit path/);
    expect(REF).toMatch(/ui:\/\/vs\/show-me/);
    expect(REF).toMatch(/ui:\/\/vs\/eli5/);
    expect(REF).toMatch(/mcp__vs_artifact__vs_show_me/);
    expect(REF).toMatch(/mcp__vs_artifact__vs_eli5/);
    expect(REF).toMatch(/structuredContent/);
    expect(REF).toMatch(/_meta\.ui\.resourceUri/);
    expect(REF).toMatch(/openai\/outputTemplate/);
    expect(REF).toMatch(/## Fallback \(mandatory on non-App hosts\)/);
    expect(REF).toMatch(/Grok Bot/);
    expect(REF).toMatch(/first-screen shot/i);
    expect(REF).toMatch(/## CSP note/);
    expect(REF).toMatch(/cdn\.jsdelivr\.net|CDN-pinned/i);
    expect(REF).toMatch(/keep the file fallback/i);
    expect(REF).toMatch(/no full bundler|do not introduce a full bundler|no bundler/i);
    expect(REF).toMatch(/## Out of scope/);
    expect(REF).toMatch(/sidebar.*file.*composer|OpenAI sidebar/i);
  });

  it('rejects ChatGPT-only or React-HTMDX-rewrite framing', () => {
    expect(REF).toMatch(/not a ChatGPT-only plugin/i);
    expect(REF).toMatch(/not a React rewrite of HTMDX/i);
  });
});

describe('vs-eli5 inherits MCP Apps host via show-me', () => {
  it('points at the shared reference without restating the full branch', () => {
    expect(ELI5).toContain(
      '../vs-internal-shared/references/mcp-apps-host.md',
    );
    expect(ELI5).toMatch(/ui:\/\/vs\/eli5/);
    expect(ELI5).toMatch(/mcp__vs_artifact__vs_eli5/);
    expect(ELI5).toMatch(/inherit/i);
    expect(ELI5).toMatch(/vs-show-me/);
    expect(ELI5).toMatch(/HTMDX file \+ URL \+ shot \+ TLDR/i);
    // Thin pointer: should not paste the full CSP / detection contract.
    expect(ELI5).not.toMatch(/io\.modelcontextprotocol\/ui/);
    expect(ELI5).not.toMatch(/## Detect or assume host support/);
  });
});

describe('mcp-app-resource-shape helper', () => {
  it('emits the App resource wrap for a saved HTML file', () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'vs-mcp-app-'));
    const htmlPath = path.join(tmp, 'artifact.html');
    fs.writeFileSync(
      htmlPath,
      '<!doctype html><html><body><script type="text/htmdx"># hi</script></body></html>\n',
    );
    const result = spawnSync(
      process.execPath,
      [
        SHAPE,
        '--skill',
        'show-me',
        '--html',
        htmlPath,
        '--review-question',
        'Does the wrap include the HTML?',
        '--url',
        'file:///tmp/artifact.html',
      ],
      { encoding: 'utf8' },
    );
    expect(result.status, result.stderr).toBe(0);
    const shape = JSON.parse(result.stdout);
    expect(shape.toolName).toBe('vs.show-me');
    expect(shape.toolInput.path).toBe(htmlPath);
    expect(shape.result.structuredContent.html).toContain('text/htmdx');
    expect(shape.toolMeta.ui.resourceUri).toBe('ui://vs/show-me');
    expect(shape.toolMeta['openai/outputTemplate']).toBe('ui://vs/show-me');
    expect(shape.result.structuredContent.artifactPath).toBe(htmlPath);
    expect(shape.result.content[0].text).toMatch(/Does the wrap include/);
  });

  it('uses ui://vs/eli5 for the eli5 skill key', () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'vs-mcp-app-'));
    const htmlPath = path.join(tmp, 'eli5.html');
    fs.writeFileSync(htmlPath, '<!doctype html><html></html>\n');
    const result = spawnSync(
      process.execPath,
      [SHAPE, '--skill', 'eli5', '--html', htmlPath],
      { encoding: 'utf8' },
    );
    expect(result.status, result.stderr).toBe(0);
    const shape = JSON.parse(result.stdout);
    expect(shape.toolName).toBe('vs.eli5');
    expect(shape.result.structuredContent.skill).toBe('vs-eli5');
  });

  it('exits 2 when required args are missing', () => {
    const result = spawnSync(process.execPath, [SHAPE], { encoding: 'utf8' });
    expect(result.status).toBe(2);
  });
});
