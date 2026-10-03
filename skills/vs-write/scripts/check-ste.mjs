#!/usr/bin/env node
// Check a draft against the softened ASD-STE100 rules in ../../vs-internal-shared/references/ste-writing.md.
//
//   node check-ste.mjs <draft.md|artifact.html>
//
// Exit 0: no rule failures (warnings may remain). Exit 1: a sentence is too
// long or uses a rejected word. Exit 2: the file cannot be checked. Treat 2 as
// not checked, not a pass.
import { readFileSync } from 'node:fs';

// Numbered steps are procedural; everything else is descriptive. These are the
// STE limits (20 / 25 words); ste-writing.md documents them, keep the two in sync.
const PROCEDURAL_LIMIT = 20;
const DESCRIPTIVE_LIMIT = 25;

// Rejected word -> replacement. Only words where the simple form never loses
// meaning; the softened mode does not enforce the full STE dictionary.
const REJECTED = new Map([
  ['in order to', 'to'],
  ['prior to', 'before'],
  ['subsequent to', 'after'],
  ['in the event that', 'if'],
  ['due to the fact that', 'because'],
  ['at this point in time', 'now'],
  ['with regard to', 'about'],
  ['a number of', 'some / many'],
  ['utilize', 'use'],
  ['utilise', 'use'],
  ['leverage', 'use'],
  ['commence', 'start'],
  ['initiate', 'start'],
  ['terminate', 'stop'],
  ['subsequently', 'then'],
  ['ensure', 'make sure'],
  ['facilitate', 'help'],
  ['approximately', 'about'],
  ['additionally', 'also'],
  ['assist', 'help'],
  ['obtain', 'get'],
  ['endeavor', 'try'],
  ['sufficient', 'enough'],
  ['numerous', 'many'],
]);

const PASSIVE =
  /\b(?:is|are|was|were|be|been|being)\s+(?:\w+ly\s+)?(?:\w+ed|built|done|made|run|set|shown|seen|given|taken|written|sent|kept|held|found|known)\b/i;

const target = process.argv[2];
if (!target) {
  console.error('Usage: node check-ste.mjs <draft.md|artifact.html>');
  process.exit(2);
}

let text;
try {
  text = readFileSync(target, 'utf8');
} catch (error) {
  console.error(`Cannot read ${target}: ${error.code ?? error.message}`);
  process.exit(2);
}

let lineOffset = 0;
const htmdx = /<script[^>]*type="text\/htmdx"[^>]*>([\s\S]*?)<\/script>/.exec(text);
if (htmdx) {
  lineOffset = text.slice(0, htmdx.index).split('\n').length - 1;
  text = htmdx[1];
} else if (/<html[\s>]/i.test(text)) {
  console.error(`${target}: HTML without an HTMDX source block; check the prose source instead.`);
  process.exit(2);
}

// Blank out non-prose regions while keeping line numbers stable.
const keepLines = (match) => match.replace(/[^\n]/g, ' ');
text = text
  .replace(/^(```|~~~)[\s\S]*?^\1[^\n]*$/gm, keepLines)
  .replace(/<!--[\s\S]*?-->/g, keepLines)
  .replace(/^---\n[\s\S]*?\n---$/m, keepLines);

function prose(line) {
  return line
    .replace(/`[^`]*`/g, 'CODE')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/https?:\/\/\S+/g, 'URL')
    .replace(/<\/?[A-Za-z][^>]*>/g, ' ')
    .replace(/\{[^}]*\}/g, ' ')
    .replace(/[*_]{1,3}([^*_]+)[*_]{1,3}/g, '$1')
    .trim();
}

// Group lines into blocks: a paragraph, or one list item with its wrapped lines.
const blocks = [];
let current = null;
text.split('\n').forEach((raw, index) => {
  const line = raw.trimEnd();
  const lineNo = index + 1 + lineOffset;
  const trimmed = line.trim();
  const skip =
    trimmed === '' ||
    /^#{1,6}\s/.test(trimmed) ||
    trimmed.startsWith('|') ||
    /^[-*_]{3,}$/.test(trimmed) ||
    /^<[^>]+>$/.test(trimmed);
  if (skip) {
    current = null;
    return;
  }
  const item = /^\s*(?:>\s*)?(\d+[.)]|[-*+])\s+(.*)$/.exec(line);
  if (item) {
    current = { line: lineNo, procedural: /\d/.test(item[1]), parts: [prose(item[2])] };
    blocks.push(current);
    return;
  }
  const body = prose(trimmed.replace(/^>\s*/, ''));
  if (!current) {
    current = { line: lineNo, procedural: false, parts: [] };
    blocks.push(current);
  }
  current.parts.push(body);
});

const failures = [];
const warnings = [];
for (const block of blocks) {
  const joined = block.parts.join(' ').replace(/\s+/g, ' ').trim();
  if (!joined) continue;
  const sentences = joined.split(/(?<=[.!?]["')\]]*)\s+(?=[A-Z0-9"'(])/);
  for (const sentence of sentences) {
    const words = sentence.match(/[A-Za-z0-9][\w'’-]*/g) ?? [];
    if (words.length < 3) continue;
    const limit = block.procedural ? PROCEDURAL_LIMIT : DESCRIPTIVE_LIMIT;
    const where = `${target}:${block.line}`;
    const snippet = sentence.length > 90 ? `${sentence.slice(0, 87)}...` : sentence;
    if (words.length > limit) {
      failures.push(
        `${where} sentence has ${words.length} words (limit ${limit}, ${block.procedural ? 'procedural' : 'descriptive'}): "${snippet}"`,
      );
    }
    const lower = ` ${sentence.toLowerCase()} `;
    for (const [word, replacement] of REJECTED) {
      if (new RegExp(`\\b${word.replace(/ /g, '\\s+')}(?:s|d|ed|es|ing)?\\b`).test(lower)) {
        failures.push(`${where} rejected word "${word}" -> use "${replacement}": "${snippet}"`);
      }
    }
    if (PASSIVE.test(sentence)) {
      warnings.push(`${where} possible passive voice; name the actor if it matters: "${snippet}"`);
    }
  }
}

for (const message of failures) console.log(`FAIL ${message}`);
for (const message of warnings) console.log(`WARN ${message}`);
if (failures.length) {
  console.log(`check-ste: ${failures.length} failure(s). Split or rewrite each sentence, then run again.`);
  process.exit(1);
}
console.log(`check-ste: clean (${warnings.length} warning(s)).`);
process.exit(0);
