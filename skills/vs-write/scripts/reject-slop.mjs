// Reject closer / comparison slop in a draft.
//
//   node reject-slop.mjs <draft.md>
//
// Exit 0 on clean copy. Exit 1 when a closer or comparison token is present.
// Exit 2 when the draft cannot be checked. Treat 2 as not checked, not a pass.
import { readFileSync } from 'node:fs';

const target = process.argv[2];
if (!target) {
  console.error('Usage: node reject-slop.mjs <draft.md>');
  process.exit(2);
}

let draft;
try {
  draft = readFileSync(target, 'utf8');
} catch (error) {
  console.error(`Cannot read ${target}: ${error.code ?? error.message}`);
  process.exit(2);
}

const RULES = [
  { name: 'closer: In conclusion', re: /In conclusion/i },
  { name: 'closer: Overall uplift', re: /\bOverall\b/ },
  { name: 'closer: the future looks bright', re: /the future looks bright/i },
  { name: 'comparison: not X but Y', re: /not X but Y/i },
  { name: "comparison: if you're coming from", re: /if you'?re coming from/i },
];

const hits = RULES.filter((rule) => rule.re.test(draft)).map((rule) => rule.name);
if (hits.length > 0) {
  for (const name of hits) console.error(`reject-slop: ${name}`);
  process.exit(1);
}

process.exit(0);
