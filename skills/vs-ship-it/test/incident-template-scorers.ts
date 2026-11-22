import * as fs from 'fs';
import * as path from 'path';

// Scorers for the ship-it incident-hotfix case. Pure functions over the returned PR body so
// `incident-template-scorers.static.eval.ts` can prove that wrong bodies fail.

export const INCIDENT_FIXTURE = path.join(__dirname, 'fixtures', 'incident-hotfix');
export const INCIDENT_TEMPLATE = fs.readFileSync(path.join(INCIDENT_FIXTURE, '.github', 'pull_request_template.md'), 'utf8');
const SECTIONS = [...INCIDENT_TEMPLATE.matchAll(/^#{1,6}\s+(.+?)\s*$/gm)].map((m) => m[1]);
const CHECKS = [...INCIDENT_TEMPLATE.matchAll(/^- \[ \] ([^:<\n]+)/gm)].map((m) => m[1].trim());
const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&');

// What each section must say for this incident: the facts the prompt gave. `N/A` is right only
// where nothing applies (no UI, no ADR). A template label left unfilled is not content.
const FACTS: Record<string, RegExp[]> = {
  Why: [/\b500\b|throw|retr/i, /payment|webhook|provider/i],
  'Merge danger': [/Door:\s*(?:\*\*)?\s*(?:one|two)-way/i, /Blast radius:\s*(?:\*\*)?\s*[A-Za-z]/i],
  ADR: [],
  'Before / after': [/\S/],
  Evidence: [/replay/i, /\b400\b/],
  'Rollback plan': [/revert|roll ?back|redeploy|previous/i],
  'How to verify': [/^\s*1\.\s+\S/m, /\b400\b/],
};

/** Each template heading's offset in the body, -1 when missing. */
export function sectionStarts(body: string) {
  return SECTIONS.map((name) => body.search(new RegExp(`^#{1,6}\\s+${esc(name)}\\s*$`, 'm')));
}

/** The returned body: the fenced block with the most template headings, or the whole answer. */
export function fencedBody(output: string) {
  const blocks = [...output.matchAll(/^(\x60{3,})[^\n]*\n([\s\S]*?)^\1[ \t]*$/gm)].map((m) => m[2]);
  const found = (text: string) => sectionStarts(text).filter((i) => i >= 0).length;
  return [...blocks, output].reduce((best, text) => (found(text) > found(best) ? text : best), blocks[0] ?? output).trim();
}

/** Section text with comments, template label lines, and bare list markers removed. */
export function sectionText(body: string, name: string) {
  const at = sectionStarts(body);
  const k = SECTIONS.indexOf(name);
  if (at[k] < 0) return '';
  const next = at.filter((i) => i > at[k]).sort((a, b) => a - b)[0];
  const end = Math.min(next ?? body.length, ...[body.indexOf('</details>', at[k])].filter((i) => i > at[k]));
  return body.slice(at[k], end).split('\n').slice(1).join('\n')
    .replace(/<!--[\s\S]*?-->/g, '')
    .split('\n')
    .filter((l) => !/^\s*(?:[-*]|\d+\.)?\s*(?:Door|Blast radius):?\s*$/i.test(l) && !/^\s*(?:[-*]|\d+\.)\s*$/.test(l))
    .join('\n').trim();
}

export function scoreIncidentBody(body: string) {
  const at = sectionStarts(body);
  return {
    sectionsInOrder: at.every((i) => i >= 0) && at.every((i, k) => k === 0 || i > at[k - 1]),
    checklistKept: CHECKS.every((item) => new RegExp(`^\\s*- \\[[ xX]\\] ${esc(item)}`, 'm').test(body)),
    sectionsCarryFacts: SECTIONS.every((name) => {
      const text = sectionText(body, name);
      return text.length > 0 && (FACTS[name] ?? []).every((re) => re.test(text));
    }),
  };
}
