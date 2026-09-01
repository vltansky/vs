#!/usr/bin/env node
// Score a verify-map directory (.vs/verify-map or a fixture copy).
//
//   node reject-verify-map.mjs <map-dir>
//
// Exit 0 clean. Exit 1 reject. Exit 2 cannot check. Treat 2 as not a pass.
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { basename, join } from 'node:path';

const target = process.argv[2];
if (!target) {
  console.error('Usage: node reject-verify-map.mjs <map-dir>');
  process.exit(2);
}

let stat;
try {
  stat = statSync(target);
} catch (error) {
  console.error(`Cannot read ${target}: ${error.code ?? error.message}`);
  process.exit(2);
}

if (!stat.isDirectory()) {
  console.error(`Cannot check non-directory: ${target}`);
  process.exit(2);
}

function walk(dir, files = []) {
  for (const name of readdirSync(dir)) {
    const next = join(dir, name);
    const nextStat = statSync(next);
    if (nextStat.isDirectory()) walk(next, files);
    else files.push(next);
  }
  return files;
}

const files = walk(target);
if (files.length === 0) {
  console.error(`Cannot check empty directory: ${target}`);
  process.exit(2);
}

function read(file) {
  try {
    return readFileSync(file, 'utf8');
  } catch (error) {
    console.error(`Cannot read ${file}: ${error.code ?? error.message}`);
    process.exit(2);
  }
}

let text = "";
for (const file of files) {
  if (/\.(png|webp|jpe?g)$/i.test(file)) continue;
  text += `\n${read(file)}`;
}

function hasHeading(body, name) {
  return new RegExp('^#{1,3}\\s+' + name + '\\b', 'im').test(body);
}

if (
  !hasHeading(text, 'Launch') ||
  !hasHeading(text, 'Doctor') ||
  !hasHeading(text, 'Drive') ||
  !hasHeading(text, 'Evidence')
) {
  console.error('reject-verify-map: missing Launch/Doctor/Drive/Evidence');
  process.exit(1);
}

const featureDir = join(target, 'features');
let featureFiles = [];
if (existsSync(featureDir) && statSync(featureDir).isDirectory()) {
  featureFiles = readdirSync(featureDir).filter((name) => {
    if (!name.endsWith('.md')) return false;
    if (name.toLowerCase() === "readme.md") return false;
    return statSync(join(featureDir, name)).isFile();
  });
}

if (featureFiles.length < 3 || featureFiles.length > 5) {
  console.error('reject-verify-map: seed feature map must have 3-5 feature files');
  process.exit(1);
}

const liveDrivePath = join(target, 'LIVE_DRIVE.md');
if (!existsSync(liveDrivePath) || !statSync(liveDrivePath).isFile()) {
  console.error('reject-verify-map: never live-driven');
  process.exit(1);
}

const liveDrive = read(liveDrivePath);
const stems = featureFiles.map((name) => basename(name, '.md'));
const namedFeature = stems.find((stem) =>
  new RegExp('\\b' + stem.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b', 'i').test(liveDrive),
);
if (!namedFeature) {
  console.error('reject-verify-map: LIVE_DRIVE.md does not name a mapped feature');
  process.exit(1);
}

function existingEvidence(body, root) {
  const matches = [...String(body).matchAll(/[A-Za-z0-9_./-]+\/[A-Za-z0-9_.-]+/g)];
  for (const match of matches) {
    const rel = match[0];
    const candidate = rel.startsWith("/") ? rel : join(root, rel);
    try {
      const info = statSync(candidate);
      if (info.isFile() && info.size > 0) return candidate;
    } catch {
    }
  }
  return "";
}

if (!existingEvidence(liveDrive, target)) {
  console.error('reject-verify-map: named evidence path is missing or was cleaned away');
  process.exit(1);
}

process.exit(0);

