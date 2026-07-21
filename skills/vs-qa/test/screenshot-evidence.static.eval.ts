import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { spawnSync } from 'child_process';
import { describe, expect, it } from 'vitest';

const DIR = path.resolve(__dirname, '..');
const QA = fs.readFileSync(path.join(DIR, 'SKILL.md'), 'utf8');
const MARKDOWN_TEMPLATE = fs.readFileSync(
  path.join(DIR, 'references', 'qa-report-template.md'),
  'utf8',
);
const HTML_TEMPLATE = fs.readFileSync(
  path.join(DIR, 'references', 'qa-report-template.html'),
  'utf8',
);
const VALIDATOR = path.join(DIR, 'scripts', 'validate-screenshot-evidence.mjs');

describe('vs-qa screenshot evidence', () => {
  it('keeps screenshot bytes out of model context and references retained files', () => {
    expect(QA).toMatch(/metadata only|metadata-only/i);
    expect(QA).toMatch(/do not.*base64|never.*base64/i);
    expect(QA).toMatch(/every retained screenshot.*referenced|one-to-one invariant/is);
    expect(QA).not.toMatch(/read (?:every|the|before\/after) screenshots? inline/i);
    expect(QA).not.toMatch(/show screenshots inline/i);
  });

  it('includes an overview screenshot in both report formats', () => {
    expect(MARKDOWN_TEMPLATE).toContain('![Initial state](screenshots/initial.png)');
    expect(HTML_TEMPLATE).toContain('![Initial state](screenshots/initial.png)');
  });

  it('validates evidence using metadata without returning image bytes', () => {
    const fixtureDir = fs.mkdtempSync(path.join(os.tmpdir(), 'vs-qa-evidence-'));
    const screenshotsDir = path.join(fixtureDir, 'screenshots');
    fs.mkdirSync(screenshotsDir);
    fs.writeFileSync(
      path.join(screenshotsDir, 'initial.png'),
      Buffer.from(
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
        'base64',
      ),
    );
    const reportPath = path.join(fixtureDir, 'report.md');
    fs.writeFileSync(reportPath, '![Initial state](screenshots/initial.png)\n');

    const result = spawnSync(process.execPath, [VALIDATOR, reportPath], {
      encoding: 'utf8',
    });

    expect(result.status).toBe(0);
    expect(result.stdout).toContain('"referenced":1');
    expect(result.stdout).not.toContain('iVBOR');
  });

  it('rejects retained screenshots that the report does not reference', () => {
    const fixtureDir = fs.mkdtempSync(path.join(os.tmpdir(), 'vs-qa-orphan-'));
    const screenshotsDir = path.join(fixtureDir, 'screenshots');
    fs.mkdirSync(screenshotsDir);
    const png = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
      'base64',
    );
    fs.writeFileSync(path.join(screenshotsDir, 'initial.png'), png);
    fs.writeFileSync(path.join(screenshotsDir, 'orphan.png'), png);
    const reportPath = path.join(fixtureDir, 'report.md');
    fs.writeFileSync(reportPath, '![Initial state](screenshots/initial.png)\n');

    const result = spawnSync(process.execPath, [VALIDATOR, reportPath], {
      encoding: 'utf8',
    });

    expect(result.status).toBe(1);
    expect(result.stdout).toContain('"orphaned":["screenshots/orphan.png"]');
  });
});
