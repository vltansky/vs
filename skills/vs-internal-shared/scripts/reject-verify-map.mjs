#!/usr/bin/env node
// Score a verify-map directory (.vs/verify-map or a fixture copy).
//
//   node reject-verify-map.mjs <map-dir>
//
// Exit 0 clean. Exit 1 reject. Exit 2 cannot check. Treat 2 as not a pass.
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { basename, join, relative } from 'node:path';

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
  !hasHeading(text, 'Evidence') ||
  !hasHeading(text, 'Cleanup') ||
  !hasHeading(text, 'Isolate')
) {
  console.error('reject-verify-map: missing Launch/Doctor/Drive/Evidence/Cleanup/Isolate');
  process.exit(1);
}

function sectionAfter(body, name) {
  const heading = new RegExp('^#{1,3}\\s+' + name + '\\b[^\\n]*', 'im');
  const found = heading.exec(body);
  if (!found) return '';
  const rest = body.slice(found.index + found[0].length);
  const next = rest.search(/^#{1,3}\s+/m);
  return (next === -1 ? rest : rest.slice(0, next)).trim();
}

const readmePath = join(target, 'README.md');
const launchBody = existsSync(readmePath) && statSync(readmePath).isFile()
  ? sectionAfter(read(readmePath), 'Launch')
  : sectionAfter(text, 'Launch');

function launchIsStub(body) {
  if (!body) return true;
  if (/\bTODO\b/i.test(body) || /\bTBD\b/i.test(body)) return true;
  if (/<[^>\n]+>/.test(body)) return true;
  if (!/ready when/i.test(body) || !/teardown\s*:/i.test(body)) return true;
  return false;
}

if (launchIsStub(launchBody)) {
  console.error('reject-verify-map: Launch is slogan or missing ready signal/teardown');
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

function isMapMetaEvidence(absPath, root) {
  const base = basename(absPath);
  if (/^readme\.md$/i.test(base)) return true;
  if (base === 'LIVE_DRIVE.md') return true;
  const fromRoot = relative(root, absPath).replace(/\\/g, '/');
  if (/^features\/[^/]+\.md$/i.test(fromRoot)) return true;
  return false;
}

function existingEvidence(body, root) {
  const matches = [...String(body).matchAll(/[A-Za-z0-9_./-]+\/[A-Za-z0-9_.-]+/g)];
  for (const match of matches) {
    const rel = match[0];
    const candidate = rel.startsWith("/") ? rel : join(root, rel);
    try {
      const info = statSync(candidate);
      if (!info.isFile() || info.size <= 0) continue;
      if (isMapMetaEvidence(candidate, root)) continue;
      return candidate;
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
