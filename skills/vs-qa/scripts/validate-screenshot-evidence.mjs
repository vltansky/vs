import { open, readFile, readdir, stat } from 'node:fs/promises';
import path from 'node:path';

const PNG_SIGNATURE = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
const IMAGE_PATTERN = /!\[[^\]]*\]\((?:<([^>]+)>|([^\s)]+))(?:\s+['"][^'"]*['"])?\)/g;

async function listPngFiles(directory, prefix = '') {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const relativePath = path.posix.join(prefix, entry.name);
    if (entry.isDirectory()) {
      files.push(...await listPngFiles(path.join(directory, entry.name), relativePath));
      continue;
    }
    if (entry.isFile() && entry.name.toLowerCase().endsWith('.png')) {
      files.push(relativePath);
    }
  }

  return files;
}

async function readPngMetadata(filePath) {
  const handle = await open(filePath, 'r');
  try {
    const header = Buffer.alloc(24);
    const { bytesRead } = await handle.read(header, 0, header.length, 0);
    const valid = bytesRead === header.length
      && header.subarray(0, 8).equals(PNG_SIGNATURE)
      && header.subarray(12, 16).toString('ascii') === 'IHDR';

    if (!valid) return null;
    return {
      width: header.readUInt32BE(16),
      height: header.readUInt32BE(20),
    };
  } finally {
    await handle.close();
  }
}

const reportPath = process.argv[2] ? path.resolve(process.argv[2]) : null;
if (!reportPath) {
  console.error('Usage: node validate-screenshot-evidence.mjs <report.md|report.html>');
  process.exit(2);
}

const report = await readFile(reportPath, 'utf8');
const reportDirectory = path.dirname(reportPath);
const screenshotsDirectory = path.join(reportDirectory, 'screenshots');
const references = new Set();

for (const match of report.matchAll(IMAGE_PATTERN)) {
  const rawReference = decodeURIComponent(match[1] ?? match[2]);
  const normalized = rawReference.replaceAll('\\', '/').replace(/^\.\//, '');
  if (normalized.startsWith('screenshots/')) references.add(normalized);
}

let retainedFiles = [];
try {
  retainedFiles = await listPngFiles(screenshotsDirectory);
} catch {
  retainedFiles = [];
}

const retained = new Set(retainedFiles.map(file => `screenshots/${file}`));
const missing = [...references].filter(reference => !retained.has(reference));
const orphaned = [...retained].filter(file => !references.has(file));
const invalid = [];
const images = [];

for (const reference of references) {
  if (!retained.has(reference)) continue;
  const filePath = path.join(reportDirectory, ...reference.split('/'));
  const metadata = await readPngMetadata(filePath);
  const fileStat = await stat(filePath);
  if (!metadata || fileStat.size === 0 || metadata.width === 0 || metadata.height === 0) {
    invalid.push(reference);
    continue;
  }
  images.push({ path: reference, bytes: fileStat.size, ...metadata });
}

const valid = references.size > 0
  && missing.length === 0
  && orphaned.length === 0
  && invalid.length === 0;
const result = {
  valid,
  referenced: references.size,
  retained: retained.size,
  missing,
  orphaned,
  invalid,
  images,
};

console.log(JSON.stringify(result));
if (!valid) process.exitCode = 1;
