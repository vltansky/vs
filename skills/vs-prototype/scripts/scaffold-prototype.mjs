#!/usr/bin/env node
// Scaffold a throwaway prototype from the vs-prototype assets.
//
//   node scaffold-prototype.mjs --kind ui|logic --topic <slug> [--variants 3] [--labels "A,B,C"] [--out <dir>]
//
// ui    -> <topic>-prototype.html (lookalike + inlined variant switcher)
// logic -> <topic>-prototype.ts   (reducer + terminal harness)
// Default out: ~/.vs/$PROJECT_ID/prototypes/<topic>/. Never overwrites.
// Exit 0 written. Exit 1 refused (file exists). Exit 2 bad usage.
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';

const ASSETS = join(dirname(fileURLToPath(import.meta.url)), '..', 'assets');
const MAX_VARIANTS = 5;
const USAGE =
  'Usage: node scaffold-prototype.mjs --kind ui|logic --topic <slug> [--variants 3] [--labels "A,B,C"] [--out <dir>]';

function fail(message, code = 2) {
  console.error(`${message}\n${USAGE}`);
  process.exit(code);
}

let args;
try {
  ({ values: args } = parseArgs({
    options: {
      kind: { type: 'string' },
      topic: { type: 'string' },
      variants: { type: 'string', default: '3' },
      labels: { type: 'string' },
      out: { type: 'string' },
    },
  }));
} catch (error) {
  fail(error.message);
}

const { kind, topic } = args;
if (kind !== 'ui' && kind !== 'logic') fail(`--kind must be ui or logic, got ${kind ?? 'nothing'}`);
if (!topic || !/^[a-z0-9][a-z0-9-]*$/.test(topic)) fail('--topic must be a lowercase slug like checkout-steps');

// Same resolution as vs-internal-shared: git remote slug, else cwd basename.
function projectId() {
  try {
    const url = execFileSync('git', ['config', '--get', 'remote.origin.url'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
    const slug = url.replace(/\.git$/, '').replace(/.*[:/]([^/]+\/[^/]+)$/, '$1').replace(/\//g, '-');
    if (slug) return slug;
  } catch {
    // No git or no remote: fall through to the directory name.
  }
  return basename(process.cwd());
}

const outDir = resolve(args.out ?? join(homedir(), '.vs', projectId(), 'prototypes', topic));
const files = new Map();

if (kind === 'ui') {
  let count = Number.parseInt(args.variants, 10);
  if (!Number.isFinite(count) || count < 1) fail(`--variants must be a positive number, got ${args.variants}`);
  if (count > MAX_VARIANTS) {
    console.error(`Capping variants at ${MAX_VARIANTS} (asked for ${count}).`);
    count = MAX_VARIANTS;
  }
  const labels = (args.labels ?? '').split(',').map((s) => s.trim());
  const ids = Array.from({ length: count }, (_, i) => String.fromCharCode(97 + i));

  const page = readFileSync(join(ASSETS, 'lookalike.html'), 'utf8');
  const switcher = readFileSync(join(ASSETS, 'variant-switcher.js'), 'utf8');
  const slot = page.match(/<!-- variant-slot:begin -->\n([\s\S]*?)\s*<!-- variant-slot:end -->/);
  if (!slot) fail('assets/lookalike.html lost its variant-slot markers', 2);
  const slots = ids
    .map((id, i) =>
      slot[1]
        .replaceAll('[[VARIANT_ID]]', id)
        .replaceAll('[[VARIANT_LABEL]]', labels[i] || `Direction ${id.toUpperCase()}`),
    )
    .join('\n');
  const html = page
    .replace(slot[0], slots.trimEnd())
    .replaceAll('[[TOPIC]]', topic)
    // Inline the switcher so the page stays a single file that opens from file://.
    .replace('<script src="./variant-switcher.js"></script>', () => `<script>\n${switcher}</script>`);
  files.set(join(outDir, `${topic}-prototype.html`), html);
} else {
  const file = join(outDir, `${topic}-prototype.ts`);
  const harness = readFileSync(join(ASSETS, 'logic-harness.ts'), 'utf8')
    .replaceAll('[[TOPIC]]', topic)
    .replaceAll('[[FILE]]', file);
  files.set(file, harness);
}

const existing = [...files.keys()].filter((file) => existsSync(file));
if (existing.length) {
  console.error(`Refusing to overwrite existing prototype file(s):\n  ${existing.join('\n  ')}`);
  console.error('Edit the existing prototype, or pick another --topic or --out.');
  process.exit(1);
}

mkdirSync(outDir, { recursive: true });
for (const [file, content] of files) writeFileSync(file, content, { flag: 'wx' });

const [written] = files.keys();
console.log(`Wrote ${written}`);
if (kind === 'ui') {
  console.log(`Run: open "${written}"   (variants: ?variant=a … ; fixtures: ?fixture=<name>)`);
  console.log('Edit: product CSS, fixtures, actions, and each <template data-variant> body.');
} else {
  console.log(`Run: node "${written}"`);
  console.log('Edit: State, initialState, Action, reducer, controls.');
}
