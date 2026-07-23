import * as fs from 'fs';
import * as path from 'path';
import { describe, expect, it } from 'vitest';

const SKILL_DIR = path.resolve(__dirname, '..');
const SKILL = fs.readFileSync(path.join(SKILL_DIR, 'SKILL.md'), 'utf8');
const TEMPLATE = fs.readFileSync(path.join(SKILL_DIR, 'assets/artifact.html'), 'utf8');
const AUTHORING = fs.readFileSync(path.join(SKILL_DIR, 'references/authoring.md'), 'utf8');

describe('vs-htmdx', () => {
  it('defines a focused HTMDX trigger and portable single-file output', () => {
    expect(SKILL).toMatch(/create, visualize, render, or edit an HTMDX artifact/i);
    expect(SKILL).toMatch(/one portable `\.html` file/i);
    expect(SKILL).toMatch(/no generated HTML body and no Markdown twin/i);
  });

  it('separates HTMDX from native visualization and ordinary Markdown', () => {
    expect(SKILL).toMatch(/unqualified request to "visualize"/i);
    expect(SKILL).toMatch(/host's visualization capability/i);
    expect(SKILL).toMatch(/routine\s+prose, plans, and machine-consumed state/i);
  });

  it('supports create and edit modes without silently migrating artifacts', () => {
    expect(SKILL).toMatch(/\*\*Create:\*\*/);
    expect(SKILL).toMatch(/\*\*Edit:\*\*/);
    expect(SKILL).toMatch(/Do not\s+silently upgrade an existing artifact/i);
    expect(SKILL).toMatch(/ordinary HTML/i);
  });

  it('pins the runtime and validates authored components against its manifest', () => {
    expect(SKILL).toMatch(/@wix\/htmdx@4\.5\.1/);
    expect(SKILL).toMatch(/exact-version component manifest/i);
    expect(AUTHORING).toContain('@wix/htmdx@4.5.1');
    expect(AUTHORING).toContain('/@wix/htmdx@4.5.1/dist/components.json');
  });

  it('does not misroute generic blockers into the four-tier RiskTable grammar', () => {
    expect(SKILL).toMatch(/Blocker, warning, or general risk[\s\S]+`Callout`/i);
    expect(SKILL).toMatch(
      /every row starts\s+with exactly `Must-have`, `Differentiator`, `Not now`, or `Won't do`/i,
    );
    expect(AUTHORING).toMatch(/Do not use it for\s+generic risks, blockers/i);
  });

  it('ships a single-source template with no host element', () => {
    expect(TEMPLATE.match(/<script\s[^>]*type="text\/htmdx"/g)).toHaveLength(1);
    expect(TEMPLATE).toContain('data-vs-source="primary"');
    expect(TEMPLATE).toContain('@wix/htmdx@4.5.1/dist/browser.js');
    expect(TEMPLATE).not.toContain('<htmdx-code');
  });

  it('requires structural and rendered proof to remain separate', () => {
    expect(SKILL).toMatch(/structural validation as such/i);
    expect(SKILL).toMatch(/do not claim rendered proof/i);
    expect(SKILL).toMatch(/Do not start a dev server/i);
  });
});
