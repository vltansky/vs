import * as fs from 'fs';
import * as path from 'path';
import { describe, expect, it } from 'vitest';

const DIR = path.resolve(__dirname, '..');
const SKILL = fs.readFileSync(path.join(DIR, 'SKILL.md'), 'utf8');
const TEMPLATE_PATH = path.join(
  DIR,
  'references',
  'thread-comparison-template.html',
);

describe('vs-analyze-thread report format', () => {
  it('keeps a single-thread analysis compact in Markdown', () => {
    expect(SKILL).toMatch(/single.thread.*Markdown/is);
    expect(SKILL).toMatch(/compact/i);
  });

  it('uses HTMDX for cross-session comparisons and writes one canonical artifact', () => {
    expect(SKILL).toMatch(/cross.session.*HTMDX/is);
    expect(SKILL).toMatch(/thread-analysis/);
    expect(SKILL).toMatch(/comparison slug.*session/is);
    expect(SKILL).toMatch(/REPORT_BASE=.*thread-comparison-\$REPORT_DATE-\$COMPARISON_SLUG/);
    expect(SKILL).toMatch(/REPORT_EXTENSION="html"/);
    expect(SKILL).toMatch(/set -C; : > "\$REPORT_PATH"/);
    expect(SKILL).toMatch(/atomically reserves|atomic.*reserve/is);
    expect(SKILL).toMatch(/already exists.*numeric suffix|numeric suffix.*already exists/is);
    expect(SKILL).toMatch(/no\s+Markdown twin/i);
  });

  it('provides a pinned comparison template and a sensitive-content fallback', () => {
    expect(fs.existsSync(TEMPLATE_PATH)).toBe(true);
    const template = fs.readFileSync(TEMPLATE_PATH, 'utf8');
    const sources = template.match(/<script type="text\/htmdx"/g) ?? [];

    expect(template).toContain('@wix/htmdx@2.2.1/dist/browser.js');
    expect(sources).toHaveLength(1);
    expect(template).toContain('<Timeline>');
    expect(template).toContain('<DataTable>');
    expect(SKILL).toMatch(/actual report content|sensitive data must remain/is);
    expect(SKILL).toMatch(/thread-comparison-\$REPORT_DATE-\$COMPARISON_SLUG\.md/);
    expect(SKILL).toMatch(/REPORT_EXTENSION="md"/);
  });
});
