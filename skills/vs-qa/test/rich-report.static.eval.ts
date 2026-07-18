import * as fs from 'fs';
import * as path from 'path';
import { describe, expect, it } from 'vitest';

const DIR = path.resolve(__dirname, '..');
const QA = fs.readFileSync(path.join(DIR, 'SKILL.md'), 'utf8');
const HTML_TEMPLATE = fs.readFileSync(
  path.join(DIR, 'references', 'qa-report-template.html'),
  'utf8',
);

describe('vs-qa report format selection', () => {
  it('defaults to Markdown and reserves HTMDX for visual regression or exhaustive evidence', () => {
    expect(QA).toMatch(/Markdown.*default/is);
    expect(QA).toMatch(/regression|exhaustive/i);
    expect(QA).toMatch(/multiple.*screenshots|multiple.*visual states/is);
    expect(QA).toMatch(/HTMDX/);
    expect(QA).toMatch(/not.*length|length alone/is);
  });

  it('provides both report templates and protects sensitive reports from remote runtime code', () => {
    expect(fs.existsSync(path.join(DIR, 'references', 'qa-report-template.md'))).toBe(true);
    expect(fs.existsSync(path.join(DIR, 'references', 'qa-report-template.html'))).toBe(true);
    expect(QA).toMatch(/sensitive|credentials|PII/i);
    expect(QA).toMatch(/trusted local runtime|remain in Markdown/i);
  });

  it('does not use brace placeholders that HTMDX parses as expressions', () => {
    const source = HTML_TEMPLATE.match(
      /<script type="text\/htmdx"[^>]*>([\s\S]*?)<\/script>/,
    )?.[1];

    expect(source).toBeDefined();
    expect(source).not.toMatch(/\{[A-Z][A-Z0-9_ ]*\}/);
  });
});
