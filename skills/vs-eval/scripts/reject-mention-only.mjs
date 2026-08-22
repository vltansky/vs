// Reject a slogan-only skill plus a mention-only CASE.
//
//   node reject-mention-only.mjs <skill.md> <case.static.eval.ts>
//   node reject-mention-only.mjs <files>
//
// Exit 0 on a clean exclusive pair (or a clean exclusive CASE alone).
// Exit 1 when the skill is slogan-only or the CASE is mention-only.
// Exit 2 when the files cannot be checked. Treat 2 as not checked, not a pass.
import { readFileSync } from 'node:fs';

const targets = process.argv.slice(2);
if (targets.length === 0) {
  console.error('Usage: node reject-mention-only.mjs <skill.md> <case.eval.ts>');
  process.exit(2);
}

const files = [];
for (const target of targets) {
  try {
    files.push({ path: target, text: readFileSync(target, 'utf8') });
  } catch (error) {
    console.error(`Cannot read ${target}: ${error.code ?? error.message}`);
    process.exit(2);
  }
}

const SLOGAN_PIN = /toMatch\(\s*\/(?:self-audit|exclusive|fixture)/;
const NOT_TO_MATCH = /not\.toMatch/;
const EXCLUSIVE_ALT = /exclusive alternative|reject-[\w.-]+\.mjs/;
const SLOGAN_TRIO =
  /\bexclusive\b[\s\S]*\bfixture\b[\s\S]*\bself-audit\b|\bfixture\b[\s\S]*\bexclusive\b[\s\S]*\bself-audit\b|\bself-audit\b[\s\S]*\bexclusive\b[\s\S]*\bfixture\b/;

function isCase(file) {
  return /\.(static\.)?eval\.ts$/.test(file.path) || /toMatch\(/.test(file.text);
}

function classifyCase(text) {
  const sloganPins = SLOGAN_PIN.test(text);
  const notToMatch = NOT_TO_MATCH.test(text);
  const exclusiveAlt = EXCLUSIVE_ALT.test(text);
  if (sloganPins && !notToMatch) return 'mention-only';
  if (notToMatch || exclusiveAlt) return 'exclusive';
  return 'unknown';
}

function classifySkill(text) {
  const slogans = SLOGAN_TRIO.test(text);
  const notToMatch = NOT_TO_MATCH.test(text);
  const exclusiveAlt = EXCLUSIVE_ALT.test(text);
  if (slogans && !notToMatch && !exclusiveAlt) return 'slogan-only';
  if (notToMatch || exclusiveAlt) return 'clean';
  if (!slogans) return 'clean';
  return 'unknown';
}

const hits = [];
for (const file of files) {
  if (isCase(file)) {
    const kind = classifyCase(file.text);
    if (kind === 'mention-only') hits.push(`mention-only CASE: ${file.path}`);
    else if (kind === 'unknown') {
      console.error(`Cannot classify CASE: ${file.path}`);
      process.exit(2);
    }
  } else {
    const kind = classifySkill(file.text);
    if (kind === 'slogan-only') hits.push(`slogan-only skill: ${file.path}`);
    else if (kind === 'unknown') {
      console.error(`Cannot classify skill: ${file.path}`);
      process.exit(2);
    }
  }
}

if (hits.length > 0) {
  for (const name of hits) console.error(`reject-mention-only: ${name}`);
  process.exit(1);
}

process.exit(0);
