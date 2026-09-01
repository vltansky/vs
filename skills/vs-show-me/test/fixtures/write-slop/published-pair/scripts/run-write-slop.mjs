#!/usr/bin/env node
// Extract HTMDX source-block paragraph prose and score it with
// ../vs-write/scripts/reject-slop.mjs. Also scores a skill.md exclusive
// (live path or published pair) or inherit (pointer + runner, no paste),
// and passes a chat TLDR through to reject-slop.
//
//   node run-write-slop.mjs <artifact.html|tldr.md|skill.md>
//
// Exit 0 clean. Exit 1 rewrite the tells / exclusive fail. Exit 2 cannot
// check. Treat 2 as not checked, not a pass.
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  existsSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const SELF = fileURLToPath(import.meta.url);
const PUBLISHED_REJECTOR_SHA256 =
  '76955fec80dace5a96afcc65d9c694ee044349c8646b62899496a53eb2061e08';
const PUBLISHED_SKILL_SHA256 =
  '146204530b06276439ec26cc1a70af1f2f57244dae6a0c13f56ff9b7d0ea926b';

const SOURCE_BLOCK = /<script[^>]*type="text\/htmdx"[^>]*>([\s\S]*?)<\/script>/;
const REJECT_SLOP = join(
  dirname(SELF),
  '..',
  '..',
  'vs-write',
  'scripts',
  'reject-slop.mjs',
);

function sha256(buf) {
  return createHash('sha256').update(buf).digest('hex');
}
function identityBytes(buf) {
  return Buffer.from(String(buf).replace(/[a-f0-9]{64}/g, ''));
}

function repoSkillPath() {
  let dir = dirname(SELF);
  for (let i = 0; i < 10; i++) {
    const pkgPath = join(dir, 'package.json');
    if (existsSync(pkgPath)) {
      try {
        const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));
        if (pkg.name === 'vs') {
          const skillName = dirname(dirname(SELF)).split(/[\\/]/).filter(Boolean).pop();
          return resolve(join(dir, 'skills', skillName, 'SKILL.md'));
        }
      } catch {
      }
    }
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return '';
}
function isPublishedPair(skillFile) {
  const rejector = join(dirname(skillFile), 'scripts', SELF.split(/[\\/]/).pop());
  if (!existsSync(rejector) || !statSync(rejector).isFile()) return false;
  let rejectorBytes;
  let skillBytes;
  try {
    rejectorBytes = readFileSync(rejector);
    skillBytes = readFileSync(skillFile);
  } catch {
    return false;
  }
  return (
    sha256(identityBytes(rejectorBytes)) === PUBLISHED_REJECTOR_SHA256 &&
    sha256(skillBytes) === PUBLISHED_SKILL_SHA256 &&
    PUBLISHED_REJECTOR_SHA256.length === 64
  );
}
function isLiveOrPublished(skillFile) {
  const live = repoSkillPath();
  if (live && resolve(skillFile) === live) return true;
  return isPublishedPair(skillFile);
}

function hasRunner(body) {
  return /run-write-slop\.mjs|reject-slop\.mjs/.test(body);
}
function hasPointer(body) {
  return /vs-show-me\/SKILL\.md|\/vs-show-me(?!\/)/.test(body);
}
function ownerPaste(body) {
  return /source-block paragraphs only/.test(body) && /rewrite the tells/.test(body);
}
function noReadyWithoutRunner(body) {
  return (
    /do not (?:report|pretend|claim)\s+`?(?:READY_FOR_REVIEW|CLEAN)`/i.test(body) &&
    hasRunner(body)
  );
}
function inheritBehavior(body) {
  return hasPointer(body) && hasRunner(body) && noReadyWithoutRunner(body) && !ownerPaste(body);
}
function mentionOnly(body) {
  return /(?:use vs-write|\/vs-write)/i.test(body) && !hasRunner(body);
}

function extractParagraphs(html) {
  const match = SOURCE_BLOCK.exec(html);
  if (!match) return { error: 'no <script type="text/htmdx"> source block found' };
  const lines = match[1].split('\n');
  const paragraphs = [];
  let inFrontmatter = false;
  let frontmatterDone = false;
  let inFence = false;
  let inComponent = false;
  let paragraph = null;

  const flushParagraph = () => {
    if (!paragraph) return;
    const text = paragraph.text.trim();
    if (text) paragraphs.push(text);
    paragraph = null;
  };

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    const line = raw.trim();

    if (!frontmatterDone && line === '---') {
      if (!inFrontmatter && !paragraph) {
        inFrontmatter = true;
        continue;
      }
      inFrontmatter = false;
      frontmatterDone = true;
      continue;
    }
    if (inFrontmatter) continue;
    if (/^```/.test(line)) {
      flushParagraph();
      inFence = !inFence;
      continue;
    }
    if (inFence) continue;
    if (/^<[A-Z][A-Za-z]*(\s[^>]*)?>/.test(line) && !/<\/[A-Z][A-Za-z]*>\s*$/.test(line) && !/\/>\s*$/.test(line)) {
      flushParagraph();
      inComponent = true;
      continue;
    }
    if (inComponent) {
      if (/^<\/[A-Z][A-Za-z]*>/.test(line)) inComponent = false;
      continue;
    }
    if (/^#{1,6}\s/.test(line)) {
      flushParagraph();
      continue;
    }
    if (!line) {
      flushParagraph();
      continue;
    }
    if (/^([-*+]\s|\d+\.\s|\||>)/.test(line)) {
      flushParagraph();
      continue;
    }
    if (/^<[A-Za-z!/]/.test(line)) continue;
    if (!paragraph) paragraph = { text: line };
    else paragraph.text += ' ' + line;
  }
  flushParagraph();
  return { paragraphs };
}

function scoreDraft(text) {
  if (!existsSync(REJECT_SLOP)) {
    console.error('run-write-slop: cannot find reject-slop.mjs');
    process.exit(2);
  }
  const dir = mkdtempSync(join(tmpdir(), 'vs-write-slop-'));
  const draft = join(dir, 'prose.md');
  try {
    writeFileSync(draft, text);
    const result = spawnSync(process.execPath, [REJECT_SLOP, draft], {
      encoding: 'utf8',
    });
    if (result.error) {
      console.error(`run-write-slop: cannot run reject-slop (${result.error.message})`);
      process.exit(2);
    }
    if (result.stderr) process.stderr.write(result.stderr);
    if (result.stdout) process.stdout.write(result.stdout);
    process.exit(result.status ?? 2);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

const target = process.argv[2];
if (!target) {
  console.error('Usage: node run-write-slop.mjs <artifact.html|tldr.md|skill.md>');
  process.exit(2);
}

let stat;
try {
  stat = statSync(target);
} catch (error) {
  console.error(`Cannot read ${target}: ${error.code ?? error.message}`);
  process.exit(2);
}
if (!stat.isFile()) {
  console.error(`run-write-slop: not a file: ${target}`);
  process.exit(2);
}

let text;
try {
  text = readFileSync(target, 'utf8');
} catch (error) {
  console.error(`Cannot read ${target}: ${error.code ?? error.message}`);
  process.exit(2);
}

const looksLikeSkill = /^name:\s*/m.test(text) && /SKILL\.md$/i.test(target);
if (looksLikeSkill) {
  if (isLiveOrPublished(target) || inheritBehavior(text)) {
    process.exit(0);
  }
  if (mentionOnly(text)) {
    console.error('run-write-slop: mention-only inherit');
    process.exit(1);
  }
  if (ownerPaste(text)) {
    console.error('run-write-slop: paragraph paste');
    process.exit(1);
  }
  console.error('run-write-slop: slogan-only skill');
  process.exit(1);
}

const hasSourceBlock = SOURCE_BLOCK.test(text);
if (hasSourceBlock || /\.html?$/i.test(target)) {
  const extracted = extractParagraphs(text);
  if (extracted.error) {
    console.error(`run-write-slop: ${extracted.error}`);
    process.exit(2);
  }
  scoreDraft(extracted.paragraphs.join('\n\n'));
}

scoreDraft(text);
