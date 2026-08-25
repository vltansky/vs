// Check that a report artifact shows the visual evidence it stands on.
//
//   node check-visual-evidence.mjs <report.html|report.md> [--require-images]
//
// The failure this catches is silent by construction: the artifact renders, the
// linter is clean, and the reader simply never sees the screenshot — because it
// was never referenced, because the reference does not resolve, or because it
// points at a path that only exists on the machine that wrote it.
//
// Exit codes: 0 clean · 1 the artifact fails the contract · 2 could not check.
// Treat 2 as "not checked" — never as a pass.
import { open, readFile, readdir, stat } from 'node:fs/promises';
import path from 'node:path';

const PNG_SIGNATURE = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
const IMAGE_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.webp', '.gif', '.svg'];
const CLIP_EXTENSIONS = ['.webm', '.mp4'];
const MEDIA_EXTENSIONS = [...IMAGE_EXTENSIONS, ...CLIP_EXTENSIONS];

// Directories an artifact owns. A shared evidence folder that several artifacts
// sit beside is not one of these — ignoring a neighbour's captures is not this
// artifact's defect.
const EVIDENCE_DIRECTORIES = ['screenshots', 'clips', 'evidence', 'assets'];

const IMAGE_PATTERN = /!\[[^\]]*\]\((?:<([^>]+)>|([^\s)]+))(?:\s+['"][^'"]*['"])?\)/g;
const ATTRIBUTE_PATTERN = /\b(?:src|poster)\s*=\s*["']([^"']+)["']/g;

// Standard viewport shapes. A capture at exactly one of these proves only what
// was above the fold: everything below it was cut off, which is how a "review
// step" screenshot ends up sliced through the card it was meant to prove.
const VIEWPORT_SIZES = new Set([
  '1280x720', '1280x800', '1280x577', '1440x900', '1440x1000', '1512x982',
  '1536x864', '1920x1080', '1600x1000', '390x844', '393x852', '375x812',
  '414x896', '360x800', '768x1024', '820x1180',
]);

const [target, ...flags] = process.argv.slice(2);
if (!target) {
  console.error('Usage: node check-visual-evidence.mjs <report.html|report.md> [--require-images]');
  process.exit(2);
}

const requireImages = flags.includes('--require-images');
const reportPath = path.resolve(target);
const reportDirectory = path.dirname(reportPath);

let report;
try {
  report = await readFile(reportPath, 'utf8');
} catch (error) {
  console.error(`Cannot read ${reportPath}: ${error.code ?? error.message}`);
  console.error('Treat this as not checked, not as a pass.');
  process.exit(2);
}

function normalize(rawReference) {
  let decoded = rawReference;
  try {
    decoded = decodeURIComponent(rawReference);
  } catch {
    // A reference that is not valid percent-encoding is still a path to check.
  }
  return decoded.replaceAll('\\', '/').trim();
}

function isMedia(reference) {
  const withoutQuery = reference.split(/[?#]/)[0].toLowerCase();
  return MEDIA_EXTENSIONS.some((extension) => withoutQuery.endsWith(extension));
}

async function listMedia(directory, prefix) {
  let entries;
  try {
    entries = await readdir(directory, { withFileTypes: true });
  } catch {
    return [];
  }

  const files = [];
  for (const entry of entries) {
    const relative = path.posix.join(prefix, entry.name);
    if (entry.isDirectory()) {
      files.push(...await listMedia(path.join(directory, entry.name), relative));
      continue;
    }
    if (entry.isFile() && isMedia(entry.name)) files.push(relative);
  }
  return files;
}

async function readPngSize(filePath) {
  let handle;
  try {
    handle = await open(filePath, 'r');
  } catch {
    return null;
  }
  try {
    const header = Buffer.alloc(24);
    const { bytesRead } = await handle.read(header, 0, header.length, 0);
    const valid = bytesRead === header.length
      && header.subarray(0, 8).equals(PNG_SIGNATURE)
      && header.subarray(12, 16).toString('ascii') === 'IHDR';
    if (!valid) return null;
    return { width: header.readUInt32BE(16), height: header.readUInt32BE(20) };
  } finally {
    await handle.close();
  }
}

// An HTMDX artifact renders only its source block; the shell's inline catalog
// carries component example strings (e.g. Figure's src="./onboarding.png")
// that never reach the reader, so scanning the whole file reports phantom
// missing evidence. Plain HTML and Markdown reports still scan in full.
const HTMDX_SOURCE_PATTERN =
  /<(script|template)\b[^>]*type=["']text\/htmdx["'][^>]*>([\s\S]*?)<\/\1>/gi;
const htmdxBlocks = [...report.matchAll(HTMDX_SOURCE_PATTERN)].map((match) => match[2]);
const scanned = htmdxBlocks.length ? htmdxBlocks.join('\n') : report;

const references = new Set();
for (const pattern of [IMAGE_PATTERN, ATTRIBUTE_PATTERN]) {
  for (const match of scanned.matchAll(pattern)) {
    const reference = normalize(match[1] ?? match[2]);
    if (reference && isMedia(reference)) references.add(reference);
  }
}

const missing = [];
const absolute = [];
const invalid = [];
const viewportSized = [];
const resolved = new Set();
let remote = 0;

for (const reference of references) {
  if (/^(?:https?:|data:)/i.test(reference)) {
    remote += 1;
    continue;
  }

  // `/Users/...` resolves under `file://` on the machine that wrote it and
  // nowhere else — not once the artifact is served, shared, or moved.
  if (path.posix.isAbsolute(reference) || path.win32.isAbsolute(reference)) {
    absolute.push(reference);
    continue;
  }

  const relative = reference.replace(/^\.\//, '');
  const filePath = path.join(reportDirectory, ...relative.split('/'));
  let size;
  try {
    size = await stat(filePath);
  } catch {
    missing.push(relative);
    continue;
  }

  resolved.add(relative);
  if (size.size === 0) {
    invalid.push(relative);
    continue;
  }

  const dimensions = await readPngSize(filePath);
  if (dimensions) {
    if (dimensions.width === 0 || dimensions.height === 0) invalid.push(relative);
    else if (VIEWPORT_SIZES.has(`${dimensions.width}x${dimensions.height}`)) {
      viewportSized.push(relative);
    }
  }
}

const onDisk = [];
for (const directory of EVIDENCE_DIRECTORIES) {
  onDisk.push(...await listMedia(path.join(reportDirectory, directory), directory));
}

// Evidence was captured and saved beside the artifact, and the artifact shows
// none of it. This is the common shape of the defect: the run did the work, the
// report never carried it to the reader.
const ignoredEvidence = resolved.size === 0 && references.size === 0 ? onDisk : [];
const unreferenced = onDisk.filter((file) => !resolved.has(file));

const result = {
  artifact: reportPath,
  referenced: references.size,
  remote,
  resolved: resolved.size,
  missing,
  absolute,
  invalid,
  ignoredEvidence,
  unreferenced,
  viewportSized,
  valid: true,
};

if (missing.length || absolute.length || invalid.length || ignoredEvidence.length) {
  result.valid = false;
}
if (requireImages && references.size === 0) result.valid = false;

console.log(JSON.stringify(result));

if (!result.valid) {
  if (missing.length) {
    console.error(`Missing evidence: ${missing.join(', ')} — the reader sees a broken image.`);
  }
  if (absolute.length) {
    console.error(`Absolute reference: ${absolute.join(', ')} — resolves only on this machine.`);
  }
  if (invalid.length) {
    console.error(`Unreadable evidence: ${invalid.join(', ')}.`);
  }
  if (ignoredEvidence.length) {
    console.error(
      `Evidence saved but never shown: ${ignoredEvidence.join(', ')} — embed it or delete it.`,
    );
  }
  if (requireImages && references.size === 0) {
    console.error('The artifact makes a visual claim and shows no image.');
  }
  process.exitCode = 1;
} else if (viewportSized.length) {
  console.error(
    `Viewport-sized capture: ${viewportSized.join(', ')} — confirm the page is not cut off at the fold.`,
  );
}
