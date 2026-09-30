#!/usr/bin/env node
/**
 * Documents / shapes an MCP App UI resource wrap around a saved HTMDX artifact.
 * Does not start an MCP server. Exit 0 prints JSON; exit 2 on usage errors.
 *
 * Usage:
 *   node mcp-app-resource-shape.mjs --skill show-me|eli5 --html <path> \
 *     [--review-question <text>] [--url <url>] [--shot <path>]
 */
import * as fs from 'node:fs';
import * as path from 'node:path';

const MIME = 'text/html;profile=mcp-app';
const URIS = {
  'show-me': 'ui://vs/show-me',
  eli5: 'ui://vs/eli5',
};

function usage(msg) {
  if (msg) console.error(msg);
  console.error(
    'Usage: node mcp-app-resource-shape.mjs --skill show-me|eli5 --html <path> [--review-question <text>] [--url <url>] [--shot <path>]',
  );
  process.exit(2);
}

const args = process.argv.slice(2);
const opts = {};
for (let i = 0; i < args.length; i++) {
  const a = args[i];
  if (a === '--skill') opts.skill = args[++i];
  else if (a === '--html') opts.html = args[++i];
  else if (a === '--review-question') opts.reviewQuestion = args[++i];
  else if (a === '--url') opts.url = args[++i];
  else if (a === '--shot') opts.shot = args[++i];
  else if (a === '--help' || a === '-h') usage();
  else usage(`Unknown argument: ${a}`);
}

if (!opts.skill || !URIS[opts.skill]) usage('--skill must be show-me or eli5');
if (!opts.html) usage('--html is required');

const htmlPath = path.resolve(opts.html);
if (!fs.existsSync(htmlPath)) {
  console.error(`HTML not found: ${htmlPath}`);
  process.exit(2);
}

const html = fs.readFileSync(htmlPath, 'utf8');
const uri = URIS[opts.skill];
const reviewQuestion = opts.reviewQuestion ?? '';
const tldrLine = reviewQuestion
  ? `Review question: ${reviewQuestion}`
  : `HTMDX artifact ready (${opts.skill}).`;

const shape = {
  resource: {
    uri,
    name: opts.skill === 'eli5' ? 'vs-eli5' : 'vs-show-me',
    mimeType: MIME,
    text: html,
    _meta: {
      ui: {
        prefersBorder: true,
        // CDN-pinned HTMDX may need these; hosts that omit CSP stay restrictive.
        csp: {
          resourceDomains: [
            'https://cdn.jsdelivr.net',
            'https://cdn.jsdelivr.net/npm',
          ],
        },
      },
    },
  },
  toolMeta: {
    ui: { resourceUri: uri },
    // Optional ChatGPT compatibility alias — never the only association key.
    'openai/outputTemplate': uri,
  },
  result: {
    content: [{ type: 'text', text: tldrLine }],
    structuredContent: {
      skill: opts.skill === 'eli5' ? 'vs-eli5' : 'vs-show-me',
      resourceUri: uri,
      mimeType: MIME,
      artifactPath: htmlPath,
      reviewQuestion: reviewQuestion || undefined,
      url: opts.url || undefined,
      shotPath: opts.shot || undefined,
    },
    _meta: {
      ui: { resourceUri: uri },
      'openai/outputTemplate': uri,
    },
  },
  notes: [
    'Present this shape only when the host supports MCP Apps (io.modelcontextprotocol/ui).',
    'Non-App hosts must keep the portable .html + URL + first-screen shot + TLDR fallback.',
    'If CDN-pinned HTMDX cannot load in the App iframe, keep the file fallback; no bundler required.',
  ],
};

process.stdout.write(`${JSON.stringify(shape, null, 2)}\n`);
