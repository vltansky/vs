import { open, readFile, readdir, stat } from 'node:fs/promises';
import path from 'node:path';

const PNG_SIGNATURE = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
const WEBM_SIGNATURE = Buffer.from([0x1a, 0x45, 0xdf, 0xa3]);
const IMAGE_PATTERN = /!\[[^\]]*\]\((?:<([^>]+)>|([^\s)]+))(?:\s+['"][^'"]*['"])?\)/g;
const LINK_PATTERN = /(?<!!)\[[^\]]*\]\((?:<([^>]+)>|([^\s)]+))(?:\s+['"][^'"]*['"])?\)/g;
// Raw HTML became renderable in HTMDX, so src/poster now reference evidence too.
const ATTRIBUTE_PATTERN = /\b(?:src|poster)\s*=\s*["']([^"']+)["']/g;

const MEDIA = {
  screenshots: { extension: '.png' },
  clips: { extension: '.webm' },
};

async function listFiles(directory, extension, prefix = '') {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const relativePath = path.posix.join(prefix, entry.name);
    if (entry.isDirectory()) {
      files.push(...await listFiles(path.join(directory, entry.name), extension, relativePath));
      continue;
    }
    if (entry.isFile() && entry.name.toLowerCase().endsWith(extension)) {
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

// WebM duration lives behind a full EBML parse; the signature is enough to prove
// the file is a real recording rather than a truncated or renamed placeholder.
async function readWebmMetadata(filePath) {
  const handle = await open(filePath, 'r');
  try {
    const header = Buffer.alloc(WEBM_SIGNATURE.length);
    const { bytesRead } = await handle.read(header, 0, header.length, 0);
    if (bytesRead !== header.length || !header.equals(WEBM_SIGNATURE)) return null;
    return {};
  } finally {
    await handle.close();
  }
}

const READERS = {
  screenshots: readPngMetadata,
  clips: readWebmMetadata,
};

const reportPath = process.argv[2] ? path.resolve(process.argv[2]) : null;
if (!reportPath) {
  console.error('Usage: node validate-screenshot-evidence.mjs <report.md|report.html>');
  process.exit(2);
}

const report = await readFile(reportPath, 'utf8');
const reportDirectory = path.dirname(reportPath);

function normalize(rawReference) {
  let decoded = rawReference;
  try {
    decoded = decodeURIComponent(rawReference);
  } catch {
    // A reference that is not valid percent-encoding is still a path we must check.
  }
  return decoded.replaceAll('\\', '/').replace(/^\.\//, '');
}

const references = { screenshots: new Set(), clips: new Set() };
const patterns = [IMAGE_PATTERN, LINK_PATTERN, ATTRIBUTE_PATTERN];

for (const pattern of patterns) {
  for (const match of report.matchAll(pattern)) {
    const normalized = normalize(match[1] ?? match[2]);
    for (const [directory, { extension }] of Object.entries(MEDIA)) {
      if (normalized.startsWith(`${directory}/`) && normalized.toLowerCase().endsWith(extension)) {
        references[directory].add(normalized);
      }
    }
  }
}

const result = { valid: true };

for (const [directory, { extension }] of Object.entries(MEDIA)) {
  let retainedFiles = [];
  try {
    retainedFiles = await listFiles(path.join(reportDirectory, directory), extension);
  } catch {
    retainedFiles = [];
  }

  const referenced = references[directory];
  const retained = new Set(retainedFiles.map(file => `${directory}/${file}`));
  const missing = [...referenced].filter(reference => !retained.has(reference));
  const orphaned = [...retained].filter(file => !referenced.has(file));
  const invalid = [];
  const files = [];

  for (const reference of referenced) {
    if (!retained.has(reference)) continue;
    const filePath = path.join(reportDirectory, ...reference.split('/'));
    const metadata = await READERS[directory](filePath);
    const fileStat = await stat(filePath);
    if (!metadata || fileStat.size === 0 || metadata.width === 0 || metadata.height === 0) {
      invalid.push(reference);
      continue;
    }
    files.push({ path: reference, bytes: fileStat.size, ...metadata });
  }

  result[directory] = {
    referenced: referenced.size,
    retained: retained.size,
    missing,
    orphaned,
    invalid,
    files,
  };

  if (missing.length || orphaned.length || invalid.length) result.valid = false;
}

// Screenshots are mandatory for every completed run; clips never are.
if (result.screenshots.referenced === 0) result.valid = false;

// Retained at the top level so existing callers reading `referenced`/`images`
// against the screenshot contract keep working.
result.referenced = result.screenshots.referenced;
result.retained = result.screenshots.retained;
result.missing = result.screenshots.missing;
result.orphaned = result.screenshots.orphaned;
result.invalid = result.screenshots.invalid;
result.images = result.screenshots.files;

console.log(JSON.stringify(result));
if (!result.valid) process.exitCode = 1;
