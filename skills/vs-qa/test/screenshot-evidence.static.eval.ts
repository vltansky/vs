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
const BROWSER_API = fs.readFileSync(
  path.join(DIR, 'references', 'browser-api.md'),
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

  it('keeps recordings optional and tied to sequence evidence', () => {
    expect(QA).toContain('### Recording evidence contract');
    expect(QA).toMatch(/Screenshots prove state; a recording proves sequence/);
    expect(QA).toMatch(/a run with none is complete/);
    expect(QA).toMatch(/recording\s+unavailable on this control surface/);
    expect(QA).toMatch(/Do not describe a sequence in prose and present it as proof/);
    expect(QA).toContain('mkdir -p "$RUN_DIR/screenshots" "$RUN_DIR/evidence" "$RUN_DIR/clips"');
  });

  it('gives a runnable capture sequence rather than declaring recording blocked', () => {
    expect(QA).toContain('agent-browser record start "$RUN_DIR/clips/issue-001.webm" "$URL"');
    expect(QA).toContain('agent-browser record stop');
    expect(BROWSER_API).toContain('## Record a sequence (subcommand CLI)');
    expect(BROWSER_API).toContain('`record restart <path> [url]`');
    // The old text claimed no control surface could record at all.
    expect(QA).not.toMatch(/Recording depends on the control surface creating the browser\s+context/);
  });

  it('treats an empty capture as no evidence and records over http', () => {
    expect(QA).toMatch(/`frames: 0` or `No frames captured` as\s+no evidence/);
    expect(QA).toMatch(/Record over `http:\/\/`, not `file:\/\/`/);
    expect(BROWSER_API).toMatch(/captured no frames in testing and\s+left `record stop` hanging/);
    expect(QA).toMatch(/carries cookies and\s+localStorage across/);
  });

  it('defaults recordings to controls without autoplay and refuses secret flows', () => {
    expect(QA).toMatch(/`controls` and `muted` without `autoplay` is the default/);
    expect(QA).toMatch(/redact in the DOM before capture, never after/);
    expect(QA).toMatch(/do not record it/);
    expect(QA).toMatch(/cannot live inside\s+`Evidence` or `Compare`/);
  });

  it('offers a recording slot in both report formats', () => {
    expect(HTML_TEMPLATE).toContain('<video src="clips/issue-001.webm"');
    expect(HTML_TEMPLATE).toContain('controls muted playsinline');
    expect(HTML_TEMPLATE).not.toMatch(/<video[^>]*\bautoplay\b/);
    expect(MARKDOWN_TEMPLATE).toContain('](clips/issue-001.webm)');
    expect(MARKDOWN_TEMPLATE).not.toContain('<video');
  });

  it('holds clips to the same one-to-one invariant as screenshots', () => {
    const fixtureDir = fs.mkdtempSync(path.join(os.tmpdir(), 'vs-qa-clips-'));
    fs.mkdirSync(path.join(fixtureDir, 'screenshots'));
    fs.mkdirSync(path.join(fixtureDir, 'clips'));
    fs.writeFileSync(
      path.join(fixtureDir, 'screenshots', 'initial.png'),
      Buffer.from(
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
        'base64',
      ),
    );
    // EBML magic — enough to prove the file is a recording, not a renamed stub.
    fs.writeFileSync(
      path.join(fixtureDir, 'clips', 'issue-001.webm'),
      Buffer.from([0x1a, 0x45, 0xdf, 0xa3, 0x00]),
    );
    const reportPath = path.join(fixtureDir, 'report.html');
    const run = () =>
      spawnSync(process.execPath, [VALIDATOR, reportPath], { encoding: 'utf8' });

    fs.writeFileSync(reportPath, '![Initial state](screenshots/initial.png)\n');
    const orphan = run();
    expect(orphan.status).toBe(1);
    expect(orphan.stdout).toContain('"orphaned":["clips/issue-001.webm"]');

    fs.writeFileSync(
      reportPath,
      '![Initial state](screenshots/initial.png)\n\n<video src="clips/issue-001.webm" controls muted></video>\n',
    );
    const referenced = run();
    expect(referenced.status).toBe(0);
    expect(referenced.stdout).toContain('"clips":{"referenced":1');

    fs.writeFileSync(
      reportPath,
      '![Initial state](screenshots/initial.png)\n\n<video src="clips/gone.webm" controls></video>\n',
    );
    const dangling = run();
    expect(dangling.status).toBe(1);
    expect(dangling.stdout).toContain('"missing":["clips/gone.webm"]');
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
