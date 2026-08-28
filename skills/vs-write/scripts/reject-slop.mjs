// Reject closer / comparison / structural slop in a draft.
//
//   node reject-slop.mjs <draft.md|skill.md>
//
// Exit 0 on clean copy. Exit 1 when a closer, comparison, or structural
// tell is present. Exit 2 when the draft cannot be checked. Treat 2 as
// not checked, not a pass.
// Exclusive is the live skills/vs-write/SKILL.md path or a published
// skill-bytes pair.
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const SELF = fileURLToPath(import.meta.url);
const PUBLISHED_REJECTOR_SHA256 =
  '1f965a949876a793a12319e4ce0b2b085fe82796363eb30d01c016356a8f5ee3';
const PUBLISHED_SKILL_SHA256 =
  '2ad0ebfd93640d3d9e277f1d98020dfd1fcbcbef0e9212bcc794917100411cc2';

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

const target = process.argv[2];
if (!target) {
  console.error('Usage: node reject-slop.mjs <draft.md|skill.md>');
  process.exit(2);
}

let draft;
try {
  draft = readFileSync(target, 'utf8');
} catch (error) {
  console.error(`Cannot read ${target}: ${error.code ?? error.message}`);
  process.exit(2);
}

const looksLikeSkill = /^name:\s*/m.test(draft) && /SKILL\.md$/i.test(target);
if (looksLikeSkill) {
  if (isLiveOrPublished(target)) process.exit(0);
  console.error('reject-slop: slogan-only skill');
  process.exit(1);
}

const RULES = [
  { name: 'closer: In conclusion', re: /In conclusion/i },
  { name: 'closer: Overall uplift', re: /\bOverall\b/ },
  { name: 'closer: the future looks bright', re: /the future looks bright/i },
  { name: 'comparison: not X but Y', re: /not X but Y/i },
  { name: "comparison: if you're coming from", re: /if you'?re coming from/i },
];

const CHAIN_BODY = String.raw`[^,.;:!?\n\u2013\u2014\u2026]*`;
const CHAIN_SEP = String.raw`(?:\s*,\s*(?:and\s+|or\s+)?|\s+(?:and|or)\s+|\s*[;&\u2013\u2014]\s*(?:and\s+|or\s+)?|\s+-{1,2}\s+)`;
const CHAIN_SPLIT = new RegExp(CHAIN_SEP, 'i');

function hasNoChain(text) {
  const head = String.raw`no[-\s]`;
  const item = head + CHAIN_BODY;
  const chain = new RegExp(String.raw`\b${item}(?:${CHAIN_SEP}${item})+`, 'gi');
  const headTest = /^no[-\s]/i;
  for (const m of text.matchAll(chain)) {
    const count = m[0].split(CHAIN_SPLIT).filter((part) => headTest.test(part.trim())).length;
    if (count >= 2) return true;
  }
  return false;
}

const hits = RULES.filter((rule) => rule.re.test(draft)).map((rule) => rule.name);
function hasDontVerbIt(text) {
  return /\b(?:do\s+not|don['\u2019]t)\s+(?:just\s+|simply\s+|merely\s+)?(\w+)(?:\s+(?:of|about|at|on|for|with|to))?\s+it\b[^.!?\n]*?[.!?;,:\u2013\u2014]['"\u201d\u2019]*\s*(?:just\s+|simply\s+|merely\s+)?\1(?:\s+(?:of|about|at|on|for|with|to))?\s+it\b/i.test(text);
}

if (hasNoChain(draft)) hits.push('structural: no-chain');
if (hasDontVerbIt(draft)) hits.push('structural: dont-verb-it');

function hasSitWith(text) {
  return /\bsit(?:s|ting)?\s+with\s+(?:that|this|it|(?:the|your)\s+(?:discomfort|feelings?|tension|weight|uncertainty|ambiguity|grief|silence|unease))\b(?:\s+for\s+a\s+\w+)?/i.test(text);
}
if (hasSitWith(draft)) hits.push('structural: sit-with');

function hasWholeOrEntire(text) {
  return (
    /\b(?:that|this)(?:['\u2019]s|\s+(?:is|was))\s+the\s+(?:whole|entire)\b/i.test(text) ||
    /(?:\b(?:is|was|are|were)|['\u2019]s)\s+the\s+entire\b/i.test(text)
  );
}
if (hasWholeOrEntire(draft)) hits.push('structural: whole-or-entire');

function hasStackedQuestions(text) {
  return /[^.!?\n]+\?(?:\s+[^.!?\n]+\?)+/.test(text);
}
if (hasStackedQuestions(draft)) hits.push('structural: stacked-questions');

function hasEchoRun(text) {
  const SENT = /[^.!?\n]+[.!?]?/g;
  const grams = (s) => {
    const words = s.toLowerCase().match(/[a-z0-9'’-]+/g) || [];
    const out = new Set();
    for (let i = 0; i + 4 <= words.length; i++) out.add(words.slice(i, i + 4).join(' '));
    return out;
  };
  const sents = [];
  for (const m of text.matchAll(SENT)) {
    if ((m[0].match(/\S+/g) || []).length >= 4) {
      sents.push({ start: m.index, end: m.index + m[0].length, text: m[0] });
    }
  }
  for (let i = 0; i < sents.length; i++) {
    let j = i;
    let shared = null;
    while (j + 1 < sents.length) {
      if (sents[j + 1].start - sents[j].end > 3) break;
      const common = [...grams(sents[j].text)].filter((g) => grams(sents[j + 1].text).has(g));
      if (!common.length) break;
      shared = common[0];
      j += 1;
    }
    if (j - i + 1 >= 2 && shared) return true;
  }
  return false;
}
if (hasEchoRun(draft)) hits.push('structural: echo-run');

function hasColonTriple(text) {
  return /:\s+[^.!?;:\n]{2,40},\s+[^.!?;:\n]{2,40},\s+(?:and\s+|or\s+)?[^.!?;:\n]{2,40}(?=[.!?\n])/.test(text);
}
if (hasColonTriple(draft)) hits.push('structural: colon-triple');
if (hits.length > 0) {
  for (const name of hits) console.error(`reject-slop: ${name}`);
  process.exit(1);
}

process.exit(0);
