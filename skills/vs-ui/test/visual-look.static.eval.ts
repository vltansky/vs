import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { expect, it } from 'vitest';

// Static contract for the pre-send look (backlog #44). The behavior eval
// visual-look.eval.ts replays the Aug 18 Wix LP turn; this pins the prose so
// the guardrail cannot silently drop out of the skill.

const read = (path: string) => readFileSync(resolve(__dirname, '..', path), 'utf8');
const skill = read('SKILL.md');
const section = skill.slice(skill.indexOf('### Pre-send look'), skill.indexOf('### General rules'));

it('vs-ui has a pre-send look before General rules', () => {
  expect(skill).toContain('### Pre-send look');
  expect(skill.indexOf('### Pre-send look')).toBeLessThan(skill.indexOf('### General rules'));
});

it('pre-send look renders and compares against the reference', () => {
  expect(section).toMatch(/Render\s+and\s+read\s+the\s+shot\s+back/);
  expect(section).toMatch(/live\s+page\s+when\s+there\s+is\s+one,\s+otherwise\s+the\s+previous\s+shot/);
  expect(section).toMatch(/side\s+by\s+side/);
});

it('a numeric-sounding ask is read as visual balance of the whole element', () => {
  expect(section).toMatch(/"Same\s+height",\s+"same\s+size"/);
  expect(section).toMatch(/means\s+visual\s+balance\s+of\s+the\s+whole\s+element\s+unless\s+the\s+user\s+gave\s+a\s+number/);
  expect(section).toMatch(/whole\s+mark\s+\(icon\s+plus\s+text,\s+visual\s+weight\)/);
  expect(section).toMatch(/Tripwire:[\s\S]*equalized\s+a\s+number/);
});

it('the report names what was compared and against what', () => {
  expect(section).toMatch(/Name\s+what\s+you\s+compared,\s+and\s+against\s+what/);
});

it('no render means saying so, never a fake shot or a fake check', () => {
  expect(section).toMatch(/If\s+you\s+cannot\s+render,\s+say\s+so/);
  expect(section).toMatch(/Never\s+send\s+a\s+shot\s+you\s+did\s+not\s+render\s+from\s+the\s+edited\s+code/);
  expect(section).toMatch(/never\s+claim\s+a\s+visual\s+check\s+you\s+did\s+not\s+do/i);
});

it('craft and polish both route through the pre-send look', () => {
  expect(read('references/craft.md')).toMatch(/Run\s+the\s+\*\*Pre-send\s+look\*\*\s+from\s+\[SKILL\.md\]\(\.\.\/SKILL\.md#pre-send-look\)/);
  expect(read('references/craft.md')).toMatch(/Name\s+what\s+the\s+pre-send\s+look\s+compared/);
  expect(read('references/polish.md')).toMatch(/\*\*Pre-send\s+look\*\*:\s+Follow\s+\[SKILL\.md\]\(\.\.\/SKILL\.md#pre-send-look\)/);
});
