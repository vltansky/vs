import * as fs from 'fs';
import * as path from 'path';
import { describe, expect, it } from 'vitest';

const SKILLS_DIR = path.resolve(__dirname, '..', '..');
const SHARED = fs.readFileSync(path.resolve(__dirname, '..', 'SKILL.md'), 'utf8');
const SKILL_NAMES = fs
  .readdirSync(SKILLS_DIR)
  .filter((name) => name.startsWith('vs-'))
  .filter((name) => name !== 'vs-internal-shared')
  .filter((name) => fs.existsSync(path.join(SKILLS_DIR, name, 'SKILL.md')))
  .sort();

const SKILLS = new Map(
  SKILL_NAMES.map((name) => [
    name,
    fs.readFileSync(path.join(SKILLS_DIR, name, 'SKILL.md'), 'utf8'),
  ]),
);

function routeLine(skill: string, field: 'Prev' | 'Next' | 'Relevant') {
  return skill.match(new RegExp(`^\\*\\*${field}:\\*\\* .+$`, 'gm')) ?? [];
}

function linkedSkills(line: string) {
  return [...line.matchAll(/`\/(vs-[a-z0-9-]+)`/g)].map((match) => match[1]);
}

describe('framework routing', () => {
  it('routes standalone use without interrupting composed workflows', () => {
    expect(SHARED).toMatch(/standalone.*emit.*Next/is);
    expect(SHARED).toMatch(/composed.*return to the caller/is);
    expect(SHARED).toMatch(/Relevant.*reciprocal.*two/is);
  });

  it('gives every user-facing skill one compact route', () => {
    for (const [name, skill] of SKILLS) {
      expect(skill, `${name} runtime route`).toMatch(
        /## Workflow\s+Direct: emit \*\*Next\*\* only\. Composed: return to caller\.\s+\*\*Prev:\*\*/,
      );
      expect(routeLine(skill, 'Prev'), `${name} Prev`).toHaveLength(1);
      expect(routeLine(skill, 'Next'), `${name} Next`).toHaveLength(1);
      expect(routeLine(skill, 'Relevant'), `${name} Relevant`).toHaveLength(1);
    }
  });

  it('keeps Next to one standalone destination or done', () => {
    for (const [name, skill] of SKILLS) {
      const [next] = routeLine(skill, 'Next');
      const links = linkedSkills(next);

      expect(links.length, `${name} Next`).toBeLessThanOrEqual(1);
      expect(
        links.length === 1 || /\bdone\b/i.test(next),
        `${name} Next must name one skill or done`,
      ).toBe(true);
    }
  });

  it('keeps Relevant reciprocal and bounded', () => {
    for (const [name, skill] of SKILLS) {
      const [relevant] = routeLine(skill, 'Relevant');
      const links = linkedSkills(relevant);
      const routeLinks = new Set([
        ...linkedSkills(routeLine(skill, 'Prev')[0]),
        ...linkedSkills(routeLine(skill, 'Next')[0]),
      ]);

      expect(links.length, `${name} Relevant count`).toBeLessThanOrEqual(2);
      expect(
        links.length > 0 || /\bnone\b/i.test(relevant),
        `${name} Relevant must name skills or none`,
      ).toBe(true);

      for (const target of links) {
        expect(
          routeLinks.has(target),
          `${name} Relevant must be lateral, not Prev or Next`,
        ).toBe(false);

        const targetSkill = SKILLS.get(target);
        expect(targetSkill, `${name} links to missing ${target}`).toBeDefined();

        const [targetRelevant] = routeLine(targetSkill!, 'Relevant');
        expect(
          linkedSkills(targetRelevant),
          `${name} and ${target} must link both ways`,
        ).toContain(name);
      }
    }
  });
});
