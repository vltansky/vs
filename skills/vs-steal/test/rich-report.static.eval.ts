import * as fs from 'fs';
import * as path from 'path';
import { describe, expect, it } from 'vitest';

const DIR = path.resolve(__dirname, '..');
const SKILL = fs.readFileSync(path.join(DIR, 'SKILL.md'), 'utf8');
const TEMPLATE_PATH = path.join(DIR, 'references', 'steals-report-template.html');

describe('vs-steal report format', () => {
  it('uses one HTMDX report by default for the ranked candidate comparison', () => {
    expect(SKILL).toMatch(/HTMDX.*default/is);
    expect(SKILL).toMatch(/value.*cost.*citation/is);
    expect(SKILL).toMatch(/steals\/YYYY-MM-DD-<target-slug>\.html/);
    expect(SKILL).toMatch(/target slug.*owner.*repo/is);
    expect(SKILL).toMatch(/already exists.*numeric suffix|numeric suffix.*already exists/is);
    expect(SKILL).toMatch(/no Markdown twin/i);
  });

  it('keeps a Markdown fallback for explicit requests or retained sensitive content', () => {
    expect(SKILL).toMatch(/explicitly requests Markdown|Markdown.*explicit/is);
    expect(SKILL).toMatch(/sensitive data must remain/is);
    expect(SKILL).toMatch(/trusted local runtime|remain in Markdown/is);
    expect(SKILL).toMatch(/steals\/YYYY-MM-DD-<target-slug>\.md/);
  });

  it('provides a pinned, single-source HTMDX template for the comparison axes', () => {
    expect(fs.existsSync(TEMPLATE_PATH)).toBe(true);
    const template = fs.readFileSync(TEMPLATE_PATH, 'utf8');
    const sources = template.match(/<script type="text\/htmdx"/g) ?? [];

    expect(template).toContain('@wix/htmdx@2.2.1/dist/browser.js');
    expect(sources).toHaveLength(1);
    expect(template).toContain('<MetricStrip>');
    expect(template).toContain('<DataTable>');
    expect(template).not.toMatch(/\{[A-Z][A-Z0-9_ ]*\}/);
  });
});
