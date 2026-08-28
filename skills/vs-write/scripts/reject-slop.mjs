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
  '95053fab36e9dad83f155f5cd4f66042e0f7ed4af976e44a5734aca12a0933d6';
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

function hasChain(text, head, headTest) {
  const item = head + CHAIN_BODY;
  const chain = new RegExp(String.raw`\b${item}(?:${CHAIN_SEP}${item})+`, 'gi');
  for (const m of text.matchAll(chain)) {
    const count = m[0].split(CHAIN_SPLIT).filter((part) => headTest.test(part.trim())).length;
    if (count >= 2) return true;
  }
  return false;
}

function hasNoChain(text) {
  return hasChain(text, String.raw`no[-\s]`, /^no[-\s]/i);
}

function hasDidNotChain(text) {
  return hasChain(
    text,
    String.raw`(?:did\s+not|didn['\u2019]t)\s`,
    /^(?:did\s+not|didn['\u2019]t)\s/i,
  );
}

const hits = RULES.filter((rule) => rule.re.test(draft)).map((rule) => rule.name);
function hasDontVerbIt(text) {
  return /\b(?:do\s+not|don['\u2019]t)\s+(?:just\s+|simply\s+|merely\s+)?(\w+)(?:\s+(?:of|about|at|on|for|with|to))?\s+it\b[^.!?\n]*?[.!?;,:\u2013\u2014]['"\u201d\u2019]*\s*(?:just\s+|simply\s+|merely\s+)?\1(?:\s+(?:of|about|at|on|for|with|to))?\s+it\b/i.test(text);
}

if (hasNoChain(draft)) hits.push('structural: no-chain');
if (hasDidNotChain(draft)) hits.push('structural: did-not-chain');
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
function hasAlreadyKnow(text) {
  return /\byou\s+already\s+knows?\s+(?:the\s+answer|what|how|why|this|that|it|who|where)\b|\byou\s+already\s+knows?\b(?![ \t]+\w)/i.test(text);
}
if (hasAlreadyKnow(draft)) hits.push('structural: already-know');

function hasPunchline(text) {
  return /\bthe\s+punchline(?:\s+(?:is|was|being)\b|\s*[:?])/i.test(text);
}
if (hasPunchline(draft)) hits.push('structural: punchline');

function hasHeresTheTwist(text) {
  return /\bhere(?:['\u2019]s|\s+is)\s+(?:the|a|my|one)\s+(?:twist|thing|catch|kicker|rub)\b[\w\s-]{0,20}[:.]/i.test(text);
}
if (hasHeresTheTwist(draft)) hits.push('structural: heres-the-twist');

function hasNotNothing(text) {
  return /\b(?:that|this|it|which)(?:['\u2019]s|\s+(?:is|was))\s+not\s+nothing\b/i.test(text);
}
if (hasNotNothing(draft)) hits.push('structural: not-nothing');

function hasWorthNaming(text) {
  return /(?:\b(?:is|are|was|were|feels?|felt|seems?|seemed)|['\u2019]s)\s+(?:\w+\s+){0,2}?worth\s+naming\b(?!\s+names\b)|\bworth\s+naming\s*:/i.test(text);
}
if (hasWorthNaming(draft)) hits.push('structural: worth-naming');

function hasPerformativeHonesty(text) {
  return /\bI\s+(?:will\s+not|won['\u2019]t)\s+pretend\b|\b(?:I['\u2019]ll|let['\u2019]s)\s+be\s+honest\b|\bto\s+be\s+clear\b|(?:^|[.!?\u2013\u2014]\s+|\n)(?:Honestly|Look)\s*,/i.test(text);
}
if (hasPerformativeHonesty(draft)) hits.push('structural: performative-honesty');

function hasTakeMyWord(text) {
  return /\b(?:you\s+)?(?:do\s+not|don['\u2019]t)\s+(?:have\s+to\s+)?take\s+my\s+word\s+for\s+(?:it|any\s+of\s+(?:it|this|that))\b/i.test(text);
}
if (hasTakeMyWord(draft)) hits.push('structural: take-my-word');

function hasTurnsOut(text) {
  return /(?:^|[.!?\u2013\u2014]\s+|\n)Turns\s+out\b|\bit\s+turns\s+out\s+that\b/i.test(text);
}
if (hasTurnsOut(draft)) hits.push('structural: turns-out');

const ANAPHORA_SKIP = /^(?:i|it|the|a|an|this|that|we|you|they|he|she|there|but|and|so|in|as|if|my|his|her|their|its|these|those|for|at|on|of|to|is|was)$/i;
function hasSentenceAnaphora(text) {
  const SENT = /[^.!?\n]+[.!?]/g;
  const sents = [];
  for (const m of text.matchAll(SENT)) {
    const w = m[0].match(/[A-Za-z'\u2019-]+/);
    if (w) {
      sents.push({
        start: m.index + m[0].indexOf(w[0]),
        end: m.index + m[0].length,
        head: w[0].toLowerCase(),
      });
    }
  }
  for (let i = 0; i < sents.length; i++) {
    let j = i;
    while (
      j + 1 < sents.length &&
      sents[j + 1].head === sents[i].head &&
      sents[j + 1].start - sents[j].end < 4
    ) {
      j += 1;
    }
    if (j - i + 1 >= 3 && !ANAPHORA_SKIP.test(sents[i].head)) return true;
  }
  return false;
}
if (hasSentenceAnaphora(draft)) hits.push('structural: sentence-anaphora');

function hasNotJust(text) {
  return /\bnot\s+(?:just|only)\s+[^.!?\n;]*?\bbut(?:\s+also)?\b/i.test(text);
}
if (hasNotJust(draft)) hits.push('structural: not-just');

function hasAiLeftovers(text) {
  return /\bas\s+an\s+ai(?:\s+language)?\s+model\b|\bas\s+of\s+my\s+last\s+(?:update|training)\b|\bknowledge\s+cutoff\b|contentReference|oaicite|turn0(?:search|news|image)\d*/i.test(text);
}
if (hasAiLeftovers(draft)) hits.push('structural: ai-leftovers');

function hasDespiteChallenges(text) {
  return /\bdespite\s+(?:these|those|such|its|their|the|numerous|significant|ongoing)\s+(?:\w+\s+)?challenges\b|\bfac(?:e|es|ed|ing)\s+(?:several|numerous|many|significant|various|a\s+number\s+of)\s+challenges\b|\bchallenges\s+remain\b|\bremains\s+to\s+be\s+seen\b|\b(?:only\s+)?time\s+will\s+tell\b/i.test(text);
}
if (hasDespiteChallenges(draft)) hits.push('structural: despite-challenges');

function hasParticipleTail(text) {
  return /,\s+(?:highlighting|underscoring|showcasing|reflecting)\s+(?:its|his|her|their|our|the|a|an|how|that|what|both)\b/i.test(text);
}
if (hasParticipleTail(draft)) hits.push('structural: participle-tail');

function hasVagueExperts(text) {
  return /\b(?:many|some|several|most|numerous)?\s*(?:experts|critics|observers|scholars|analysts|commentators)\s+(?:have\s+|often\s+|widely\s+)?(?:argu(?:e|es|ed)|not(?:e|es|ed)|suggest(?:s|ed)?|believ(?:e|es|ed)|agree[ds]?|contend(?:s|ed)?|observ(?:e|es|ed)|caution(?:s|ed)?|claim(?:s|ed)?|cit(?:e|es|ed)|point(?:s|ed)?\s+out)\b|\bindustry\s+reports?\s+(?:suggest|indicate|show)\w*\b/i.test(text);
}
if (hasVagueExperts(draft)) hits.push('structural: vague-experts');

if (hits.length > 0) {
  for (const name of hits) console.error(`reject-slop: ${name}`);
  process.exit(1);
}

process.exit(0);
