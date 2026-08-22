// Reject try/catch theater, ceremony wrappers, and leftover slop
// after one flatten pass.
//
//   node reject-code-slop.mjs <file.ts>
//
// Exit 0 on clean code. Exit 1 when a theater, ceremony, or second-miss
// smell is present. Exit 2 when the file cannot be checked. Treat 2 as
// not checked, not a pass.
import { readFileSync } from "node:fs";

const target = process.argv[2];
if (!target) {
  console.error("Usage: node reject-code-slop.mjs <file.ts>");
  process.exit(2);
}

let source;
try {
  source = readFileSync(target, "utf8");
} catch (error) {
  console.error("Cannot read " + target + ": " + (error.code ?? error.message));
  process.exit(2);
}

const RULES = [
  { name: "try/catch theater marker", re: /\/\*\s*theater\s*\*\// },
  { name: "try/catch around addNonThrowingPair", re: /addNonThrowingPair/ },
  {
    name: "empty or comment-only catch",
    re: /catch(?:\s*\([^)]*\))?\s*\{\s*(?:\/\*[\s\S]*?\*\/|\/\/[^\n]*)?\s*\}/,
  },
  { name: "ceremony Manager class", re: /class\s+\w*Manager\b/ },
  { name: "ceremony Factory class", re: /class\s+\w*Factory\b/ },
  { name: "ceremony Helper class", re: /class\s+\w*Helper\b/ },
  { name: "ceremony Service class", re: /class\s+\w*Service\b/ },
  { name: "invented WidgetFactory.ts", re: /WidgetFactory\.ts/ },
  { name: "invented WidgetUtils.ts", re: /WidgetUtils\.ts/ },
  {
    name: "boolean mode flag leftover",
    re: /\bmode\s*(?::|===?)\s*(true|false|'strict'|'loose'|"strict"|"loose")/,
  },
];

const hits = RULES.filter((rule) => rule.re.test(source)).map((rule) => rule.name);
if (hits.length > 0) {
  for (const name of hits) console.error("reject-code-slop: " + name);
  process.exit(1);
}

process.exit(0);
