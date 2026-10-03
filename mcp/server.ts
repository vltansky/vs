import { readFile, realpath, stat } from 'node:fs/promises';
import { homedir } from 'node:os';
import { isAbsolute, join, relative, sep } from 'node:path';
import { McpServer } from '@modelcontextprotocol/server';
import { registerAppResource, registerAppTool, RESOURCE_MIME_TYPE } from '@modelcontextprotocol/ext-apps/server';
import { z } from 'zod';

const views = [
  { tool: 'vs.show-me', uri: 'ui://vs/show-me', skill: 'vs-show-me' },
  { tool: 'vs.eli5', uri: 'ui://vs/eli5', skill: 'vs-eli5' },
] as const;
// Keep tool results bounded: the entire HTML travels through MCP structuredContent.
const maxArtifactBytes = 3 * 1024 * 1024;

async function readArtifact(root: string, artifactPath: string) {
  const [realRoot, realArtifact] = await Promise.all([realpath(root), realpath(artifactPath)]);
  // Real paths keep a symlinked artifact from escaping the user's VS artifact directory.
  const withinRoot = relative(realRoot, realArtifact);
  if (!isAbsolute(artifactPath) || !realArtifact.endsWith('.html') || withinRoot === '..' || withinRoot.startsWith(`..${sep}`) || isAbsolute(withinRoot)) {
    throw new Error('Choose an HTML artifact under ~/.vs.');
  }
  if ((await stat(realArtifact)).size > maxArtifactBytes) throw new Error('Artifact exceeds the 3 MB limit.');
  const html = await readFile(realArtifact, 'utf8');
  if (!/<(?:script|template)\b[^>]*type=["']text\/htmdx["']/i.test(html)) throw new Error('The file is not an HTMDX artifact.');
  return html;
}

export function createVsServer(root = join(homedir(), '.vs')) {
  const server = new McpServer({ name: 'vs-artifact', version: '1.0.0' });

  for (const view of views) {
    registerAppTool(server, view.tool, {
      description: `Present a saved ${view.skill} HTMDX artifact as an MCP App.`,
      inputSchema: z.object({
        path: z.string().min(1),
        reviewQuestion: z.string().optional(),
        url: z.string().optional(),
        shotPath: z.string().optional(),
      }),
      _meta: { ui: { resourceUri: view.uri } },
    }, async ({ path, reviewQuestion, url, shotPath }) => {
      try {
        const html = await readArtifact(root, path);
        return {
          content: [{ type: 'text' as const, text: `${reviewQuestion ? `Review question: ${reviewQuestion}\n` : ''}${view.skill} artifact ready: ${path}${url ? `\nURL: ${url}` : ''}` }],
          structuredContent: { skill: view.skill, artifactPath: path, reviewQuestion, url, shotPath, html },
        };
      } catch (error) {
        return { isError: true, content: [{ type: 'text' as const, text: error instanceof Error ? error.message : 'Unable to read artifact.' }] };
      }
    });

    registerAppResource(server, view.skill, view.uri, {
      mimeType: RESOURCE_MIME_TYPE,
      _meta: { ui: { prefersBorder: true, csp: { resourceDomains: ['https://cdn.jsdelivr.net'] } } },
    }, async () => ({
      contents: [{ uri: view.uri, mimeType: RESOURCE_MIME_TYPE, text: await readFile(new URL('./view.html', import.meta.url), 'utf8') }],
    }));
  }
  return server;
}
