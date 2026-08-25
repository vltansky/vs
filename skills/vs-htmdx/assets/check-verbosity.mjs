// Check an HTMDX artifact's prose against the Create budgets in SKILL.md.
//
//   node check-verbosity.mjs <file.html> [more.html ...]
//
// Reads only the source block's paragraph prose — frontmatter, headings,
// lists, tables, blockquotes, fenced code, and component bodies are exempt.
// Budgets: lede ≤ 2 sentences; paragraphs ≤ 3 sentences and ≤ 80 words;
// a section's total prose ≤ 250 words.
//
// Exit codes: 0 within budget · 1 overruns listed · 2 could not check.
// Treat 2 as "not verified" — never as a pass.
import { readFileSync } from 'node:fs';

const BUDGET = { ledeSentences: 2, paragraphSentences: 3, paragraphWords: 80, sectionWords: 250 };
const SOURCE_BLOCK = /<script[^>]*type="text\/htmdx"[^>]*>([\s\S]*?)<\/script>/;

const files = process.argv.slice(2);
if (!files.length) {
  console.error('usage: node check-verbosity.mjs <file.html> [...]');
  process.exit(2);
}

const countSentences = (text) =>
  // Sentence ends: . ! ? followed by space or end — but not inside e.g./i.e.,
  // decimals, or version numbers, which the following-capital requirement skips.
  (text.match(/[.!?](?=\s+[A-Z"'(\[]|\s*$)/g) || []).length || 1;
const countWords = (text) => text.split(/\s+/).filter(Boolean).length;

let anyFindings = false;

for (const file of files) {
  let html;
  try {
    html = readFileSync(file, 'utf8');
  } catch (e) {
    console.error(`${file}: cannot read (${e.message})`);
    process.exit(2);
  }
  const match = SOURCE_BLOCK.exec(html);
  if (!match) {
    console.error(`${file}: no <script type="text/htmdx"> source block found`);
    process.exit(2);
  }
  // 1-based line of the source block's first line, so findings point at the
  // saved file, not the extracted text.
  const offset = html.slice(0, match.index + match[0].indexOf(match[1])).split('\n').length;
  const lines = match[1].split('\n');

  const findings = [];
  let inFrontmatter = false;
  let frontmatterDone = false;
  let inFence = false;
  let inComponent = false;
  let sawLede = false;
  let section = { name: 'lede', words: 0, line: offset };
  let paragraph = null;

  const flushParagraph = () => {
    if (!paragraph) return;
    const text = paragraph.text.trim();
    const sentences = countSentences(text);
    const words = countWords(text);
    section.words += words;
    const isLede = !sawLede && section.name === 'lede';
    if (isLede) {
      sawLede = true;
      if (sentences > BUDGET.ledeSentences)
        findings.push(`${file}:${paragraph.line} lede runs ${sentences} sentences (budget ${BUDGET.ledeSentences})`);
    } else {
      if (sentences > BUDGET.paragraphSentences)
        findings.push(`${file}:${paragraph.line} paragraph runs ${sentences} sentences (budget ${BUDGET.paragraphSentences})`);
      if (words > BUDGET.paragraphWords)
        findings.push(`${file}:${paragraph.line} paragraph runs ${words} words (budget ${BUDGET.paragraphWords})`);
    }
    paragraph = null;
  };
  const flushSection = () => {
    flushParagraph();
    if (section.words > BUDGET.sectionWords)
      findings.push(
        `${file}:${section.line} section "${section.name}" runs ${section.words} prose words (budget ${BUDGET.sectionWords})`,
      );
  };

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    const line = raw.trim();
    const at = offset + i;

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
    // Component blocks are structured grammar, not prose. Self-closing or
    // single-line pairs never open a block.
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
      flushSection();
      section = { name: line.replace(/^#+\s*/, ''), words: 0, line: at };
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
    if (!paragraph) paragraph = { text: line, line: at };
    else paragraph.text += ' ' + line;
  }
  flushSection();

  if (findings.length) {
    anyFindings = true;
    for (const finding of findings) console.log(finding);
  } else {
    console.log(`${file}: prose within budget`);
  }
}

process.exit(anyFindings ? 1 : 0);
