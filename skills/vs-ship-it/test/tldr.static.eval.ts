import { SHIP_IT_SOURCE } from './ship-it-source';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { describe, expect, it } from 'vitest';

// Static contract for the two-line TL;DR that opens every ship-it PR body.
// `problems(skill, gate)` returns every broken rule; shipped files return none, mutants some.

const SKILL = SHIP_IT_SOURCE;
const GATE = fs.readFileSync(path.resolve(__dirname, '..', '..', 'vs-internal-shared', 'scripts', 'pr-media-gate.mjs'), 'utf8');

function problems(skill: string, gate: string): string[] {
  const out: string[] = [];
  const from = skill.indexOf('**TL;DR first.**');
  const rule = from === -1 ? '' : skill.slice(from, skill.indexOf('\n\n', from));
  if (!rule) return ['TL;DR missing'];
  if (!/The first thing in every PR body is a two-line TL;DR, above\s+Review map/.test(rule)) out.push('TL;DR not first');
  if (!/Write exactly 2 short plain lines/.test(rule)) out.push('line count not 2');
  if (!/Line 1 says what changes and for whom; line 2 says the effect or\s+result/.test(rule)) out.push('line roles missing');
  if (!/No links \(not even a bare `github\.com\/…`\),\s+no code, no badges/.test(rule)) out.push('links or code allowed');
  if (!/no bold or italic inside the lines/.test(rule)) out.push('bold or italic allowed');
  if (!/\(3 to 20 words each\)/.test(rule)) out.push('no word floor');
  if (!/When that rerun reports the TL;DR missing or invalid/.test(skill)
    || !/the problem and result\s+from the existing description/.test(skill)
    || !/prepend them\s+above everything else, rerun the gate, and update only when it passes/.test(skill))
    out.push('refresh does not convert old bodies');
  if (!/Do not echo the PR title/.test(rule)) out.push('title echo allowed');
  if (!/With a repo template, the TL;DR still goes\s+first, before the template content/.test(rule)) out.push('TL;DR after template');
  const at = skill.indexOf('body file starts at the TL;DR)');
  const tpl = at === -1 ? '' : skill.slice(at, skill.indexOf('\n## Review map\n', at) + 1);
  const tlines = tpl.split('\n').filter((l) => /^<[^>]+>$/.test(l));
  if (!/\n\*\*TL;DR\*\*\n<[^>\n]+>\n<[^>\n]+>\n\n$/.test(tpl) || tlines.length !== 2) out.push('template TL;DR not 2 lines before Review map');
  if (!/const valid = rootCauseOk && tldrOk &&/.test(gate)) out.push('gate ignores TL;DR');
  if (!/content\.length !== 2/.test(gate)) out.push('gate does not count lines');
  if (!/has a link/.test(gate) || !/has code/.test(gate) || !/has a badge or image/.test(gate)) out.push('gate allows links, code, or badges');
  if (!/while \(i < lines\.length && !lines\[i\]\.trim\(\)\) i \+= 1;/.test(gate) || !/missing: the body must start with a two-line TL;DR/.test(gate))
    out.push('gate does not require TL;DR first');
  if (!/echoes the PR title/.test(gate)) out.push('gate allows title echo');
  if (!/const NOT_CANDIDATE = /.test(gate) || !/\\\*\\\*\|__\|\[\*_\]/.test(gate)) out.push('gate reports a line count for a bold-led body');
  if (!/if \(words < 3\)/.test(gate)) out.push('gate has no word floor');
  if (!/has bold or italic markup/.test(gate)) out.push('gate allows bold or italic');
  if (!/\\b\[\\w-\]\+\(\?:\\\.\[\\w-\]\+\)\+\\\/\\S\*/.test(gate)) out.push('gate allows bare domain links');
  return out;
}

type P = [string, string];
const mutants: Record<string, (p: P) => P> = {
  'TL;DR missing': ([s, g]) => [s.replace(/\*\*TL;DR first\.\*\*[\s\S]*?(?=\*\*Repo PR template first\.\*\*)/, ''), g],
  'TL;DR not first': ([s, g]) => [s.replace('The first thing in every PR body is a two-line TL;DR, above\nReview map', 'Add a two-line TL;DR after Review map'), g],
  'one line': ([s, g]) => [s.replace('Write exactly 2 short plain lines', 'Write 1 short plain line'), g],
  'three or more lines': ([s, g]) => [s.replace('<the effect or result — one short plain line>\n', '<the effect or result — one short plain line>\n<a third line>\n'), g],
  'template one line': ([s, g]) => [s.replace('<the effect or result — one short plain line>\n', ''), g],
  'links or code allowed': ([s, g]) => [s.replace('No links (not even a bare `github.com/…`),\nno code, no badges, no HTML, no list markers', 'Keep it short'), g],
  'title echo allowed': ([s, g]) => [s.replace('Do not echo the PR title: say\nwhat it means for the reader. ', ''), g],
  'placed after the template': ([s, g]) => [s.replace('With a repo template, the TL;DR still goes\nfirst, before the template content.', 'With a repo template, put the TL;DR after the template.'), g],
  'TL;DR below Review map in template': ([s, g]) => [s.replace(/\n\*\*TL;DR\*\*\n<what changes[^\n]*\n<the effect[^\n]*\n\n## Review map\n/, '\n## Review map\n\n**TL;DR**\n<what changes, for whom>\n<the effect>\n'), g],
  'gate ignores TL;DR': ([s, g]) => [s, g.replace('const valid = rootCauseOk && tldrOk &&', 'const valid = rootCauseOk &&')],
  'gate any line count': ([s, g]) => [s, g.replace('content.length !== 2', 'content.length < 1')],
  'gate allows links': ([s, g]) => [s, g.replace('reasons.push(`${at} has a link`)', 'void 0')],
  'gate allows code': ([s, g]) => [s, g.replace('reasons.push(`${at} has code`)', 'void 0')],
  'gate TL;DR anywhere': ([s, g]) => [s, g.replace('missing: the body must start with a two-line TL;DR', 'missing TL;DR').replace('while (i < lines.length && !lines[i].trim()) i += 1;', 'while (i < lines.length && !/TL;DR/.test(lines[i])) i += 1;')],
  'refresh keeps a body with no TL;DR': ([s, g]) => [s.replace(/ When that rerun reports the TL;DR missing or invalid[\s\S]*?update only when it passes\./, ''), g],
  'refresh TL;DR not from the body': ([s, g]) => [s.replace('the problem and result\nfrom the existing description', 'any two lines'), g],
  'refresh appends instead of prepending': ([s, g]) => [s.replace('prepend them\nabove everything else', 'append them\nat the end'), g],
  'bold or italic allowed (skill)': ([s, g]) => [s.replace(', no bold or italic inside the lines', ''), g],
  'no word floor (skill)': ([s, g]) => [s.replace('(3 to 20 words each)', '(20 words or fewer each)'), g],
  'bare domain allowed (skill)': ([s, g]) => [s.replace('No links (not even a bare `github.com/…`),', 'No Markdown links,'), g],
  'gate line count on bold-led body': ([s, g]) => [s, g.replace('|\\*\\*|__|[*_](?=\\S))/;', ')/;')],
  'gate no word floor': ([s, g]) => [s, g.replace('if (words < 3)', 'if (words < 0)').replace('if (words < 0)', 'if (false)')],
  'gate allows bold or italic': ([s, g]) => [s, g.replace('reasons.push(`${at} has bold or italic markup; write plain text`)', 'void 0').replace('has bold or italic markup', 'x')],
  'gate allows bare domain': ([s, g]) => [s, g.replace('|\\b[\\w-]+(?:\\.[\\w-]+)+\\/\\S*', '')],
  'gate allows title echo': ([s, g]) => [s, g.replace("reasons.push('line 1 echoes the PR title; say what changes and for whom')", 'void 0')],
};

describe('ship-it two-line TL;DR contract', () => {
  it('the shipped skill and gate have no problems', () => {
    expect(problems(SKILL, GATE)).toEqual([]);
  });
  it.each(Object.entries(mutants))('mutant "%s" is caught', (_n, mutate) => {
    const [s, g] = mutate([SKILL, GATE]);
    expect(s + g).not.toBe(SKILL + GATE);
    expect(problems(s, g).length).toBeGreaterThan(0);
  });
});
