#!/usr/bin/env node

import { createHash } from 'node:crypto';
import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';

const MEDIA_TYPES = new Map([
  ['.html', 'text/html'],
  ['.json', 'application/json'],
  ['.jsonl', 'application/x-ndjson'],
  ['.log', 'text/plain'],
  ['.md', 'text/markdown'],
  ['.diff', 'text/x-diff'],
  ['.patch', 'text/x-diff'],
  ['.png', 'image/png'],
  ['.txt', 'text/plain'],
  ['.webp', 'image/webp'],
]);
const MAX_SLICE_BYTES = 32 * 1024;

const usage = () => {
  console.error(
    'Usage: evidence-manifest.mjs manifest <file...> | capture <file> [--json-tail] | slice <file> --start N --end N',
  );
  process.exitCode = 2;
};

const lineCount = (buffer, mediaType) => {
  if (!mediaType.startsWith('text/') && !mediaType.includes('json')) return undefined;
  if (buffer.length === 0) return 0;
  const text = buffer.toString('utf8');
  return text.split('\n').length - (text.endsWith('\n') ? 1 : 0);
};

const describe = async (filePath) => {
  const absolutePath = path.resolve(filePath);
  const buffer = await readFile(absolutePath);
  const fileStat = await stat(absolutePath);
  const mediaType = MEDIA_TYPES.get(path.extname(absolutePath).toLowerCase())
    ?? 'application/octet-stream';
  const lines = lineCount(buffer, mediaType);

  return {
    path: absolutePath,
    mediaType,
    bytes: fileStat.size,
    ...(lines === undefined ? {} : { lines }),
    sha256: createHash('sha256').update(buffer).digest('hex'),
  };
};

const readStdin = async () => {
  const chunks = [];
  for await (const chunk of process.stdin) chunks.push(chunk);
  return Buffer.concat(chunks);
};

const manifest = async (paths) => {
  if (paths.length === 0) return usage();
  const entries = await Promise.all(paths.map(describe));
  console.log(JSON.stringify(entries.length === 1 ? entries[0] : entries));
};

const capture = async (args) => {
  const filePath = args.find((arg) => !arg.startsWith('--'));
  if (!filePath) return usage();
  const input = await readStdin();
  let body = input;
  let metadata;

  if (args.includes('--json-tail')) {
    const text = input.toString('utf8');
    const lines = text.split('\n');
    while (lines.at(-1) === '') lines.pop();
    let metadataIndex = -1;
    for (let index = lines.length - 1; index >= 0; index -= 1) {
      try {
        const candidate = JSON.parse(lines[index]);
        if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) continue;
        metadata = candidate;
        metadataIndex = index;
        break;
      } catch {
        // Producer diagnostics after the metadata remain part of the evidence.
      }
    }
    if (metadataIndex < 0) throw new Error('--json-tail requires a JSON metadata line');
    lines.splice(metadataIndex, 1);
    body = Buffer.from(`${lines.join('\n')}${lines.length ? '\n' : ''}`);
  }

  const absolutePath = path.resolve(filePath);
  await mkdir(path.dirname(absolutePath), { recursive: true });
  await writeFile(absolutePath, body);
  console.log(JSON.stringify({ evidence: await describe(absolutePath), ...(metadata ? { metadata } : {}) }));
};

const slice = async (args) => {
  const filePath = args.find((arg) => !arg.startsWith('--') && !/^\d+$/.test(arg));
  const startIndex = args.indexOf('--start');
  const endIndex = args.indexOf('--end');
  const start = Number(args[startIndex + 1]);
  const end = Number(args[endIndex + 1]);
  if (!filePath || startIndex < 0 || endIndex < 0 || start < 1 || end < start || end - start + 1 > 200) {
    return usage();
  }

  const lines = (await readFile(path.resolve(filePath), 'utf8')).split(/\r?\n/);
  const selected = lines.slice(start - 1, end).join('\n');
  const buffer = Buffer.from(selected);
  if (buffer.length <= MAX_SLICE_BYTES) {
    process.stdout.write(`${selected}\n`);
    return;
  }

  process.stdout.write(buffer.subarray(0, MAX_SLICE_BYTES).toString('utf8'));
  process.stdout.write('\n[truncated: slice exceeded 32768 bytes]\n');
};

const [command, ...args] = process.argv.slice(2);
try {
  if (command === 'manifest') await manifest(args);
  else if (command === 'capture') await capture(args);
  else if (command === 'slice') await slice(args);
  else usage();
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
