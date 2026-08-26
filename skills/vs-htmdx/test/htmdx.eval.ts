import * as fs from 'fs';
import * as path from 'path';
import { describe, expect, it } from 'vitest';

const SKILL_DIR = path.resolve(__dirname, '..');
const SKILL = fs.readFileSync(path.join(SKILL_DIR, 'SKILL.md'), 'utf8');
const TEMPLATE = fs.readFileSync(path.join(SKILL_DIR, 'assets/artifact.html'), 'utf8');

describe('vs-htmdx', () => {
  it('defines a focused HTMDX trigger and portable single-file output', () => {
    expect(SKILL).toMatch(
      /user wants a complex topic explained or shown visually[\s\S]{0,300}create, render, or edit an HTMDX artifact/i,
    );
    expect(SKILL).toMatch(/one portable `\.html` file/i);
    expect(SKILL).toMatch(/no generated HTML body and no Markdown twin/i);
  });

  it('separates HTMDX from native visualization and ordinary Markdown', () => {
    expect(SKILL).toMatch(/Skip conditions:[\s\S]{0,120}native visualization/i);
    expect(SKILL).toMatch(/routine\s+prose, plans, and machine-consumed state/i);
  });

  it('supports create and edit modes without silently migrating artifacts', () => {
    expect(SKILL).toMatch(/\*\*Create:\*\*/);
    expect(SKILL).toMatch(/\*\*Edit:\*\*/);
    expect(SKILL).toMatch(/Do not\s+silently upgrade an existing artifact/i);
    expect(SKILL).toMatch(/ordinary HTML/i);
  });

  it('keeps every vs template on one pinned runtime', () => {
    expect(SKILL).toMatch(/@wix\/htmdx@4(?![.\d])/);
    expect(SKILL).toMatch(
      /Every `vs` template pins one major line — do not diverge from it/,
    );
    for (const parts of [
      ['..', '..', 'vs-qa', 'references', 'qa-report-template.html'],
      ['..', '..', 'vs-steal', 'references', 'steals-report-template.html'],
      ['..', '..', 'vs-search-threads', 'references', 'thread-comparison-template.html'],
      ['..', '..', 'vs-internal-shared', 'references', 'rich-artifacts.md'],
    ]) {
      const file = path.resolve(__dirname, ...parts);
      // Bare `@4` only. An exact `@4.11.1` here would freeze the template on a
      // minor that @wix/htmdx supersedes on its next merge.
      expect(fs.readFileSync(file, 'utf8'), path.basename(file)).not.toMatch(
        /@wix\/htmdx@(?!4(?![.\d]))[0-9]/,
      );
    }
    // The QA evidence validator rejects reports off this major line, so it moves
    // with the templates rather than outliving them.
    const validator = path.resolve(
      __dirname, '..', '..', 'vs-qa', 'scripts', 'validate-screenshot-evidence.mjs',
    );
    expect(fs.readFileSync(validator, 'utf8')).toContain("EXPECTED_RUNTIME_MAJOR = '4'");
  });

  it('ships a single-source template with no host element', () => {
    expect(TEMPLATE.match(/<script\s[^>]*type="text\/htmdx"/g)).toHaveLength(1);
    expect(TEMPLATE).toContain('data-vs-source="primary"');
    expect(TEMPLATE).toContain('@wix/htmdx@4/dist/browser.js');
    expect(TEMPLATE).not.toContain('<htmdx-code');
  });

  it('requires structural and rendered proof to remain separate', () => {
    expect(SKILL).toMatch(/structural validation as such/i);
    expect(SKILL).toMatch(/do not\s+claim rendered proof/i);
    expect(SKILL).toMatch(/no server is needed/i);
  });
});
