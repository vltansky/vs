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
const IN_APP_BROWSER_RECORDING = fs.readFileSync(
  path.join(DIR, 'references', 'in-app-browser-recording.md'),
  'utf8',
);
const VALIDATOR = path.join(DIR, 'scripts', 'validate-screenshot-evidence.mjs');
// A clipless report must state why, so every fixture that should pass carries it.
const RECORDING_STATUS = '| **Recording** | 0 (no sequence defects) |\n\n';

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
    fs.writeFileSync(reportPath, RECORDING_STATUS + '![Initial state](screenshots/initial.png)\n');

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
    expect(QA).toMatch(/A run whose issues are all static is complete/);
    expect(QA).toMatch(/`recording unavailable on this control surface`/);
    expect(QA).toMatch(/Do not\s+describe a sequence in prose and\s+present it as proof/);
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
    expect(QA).toMatch(/`frames: 0` or\s+`No frames captured` as no evidence/);
    expect(QA).toMatch(/Record over `http:\/\/`, not `file:\/\/`/);
    expect(BROWSER_API).toMatch(/captured no frames in testing and\s+left `record stop` hanging/);
    expect(QA).toMatch(/carries cookies across, but not\s+localStorage/);
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

    fs.writeFileSync(reportPath, RECORDING_STATUS + '![Initial state](screenshots/initial.png)\n');
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

  it('routes recording by capability rather than by the driving surface', () => {
    expect(QA).toMatch(/Recording is the exception/);
    expect(QA).toMatch(/capability, not a property of the surface\s+driving the run/);
    expect(QA).toMatch(/selecting a higher-priority surface does not put recording\s+out of reach/i);
    expect(QA).toMatch(/Probe for tab-scoped CDP and an attachable CDP endpoint/);
    expect(QA).toMatch(/`Page\.startScreencast`/);
    expect(QA).toMatch(/`Page\.screencastFrameAck`/);
    expect(QA).toMatch(/encode the retained frames to WebM/);
    expect(QA).toMatch(/does not show the pointer or an interaction that\s+leaves pixels unchanged/);
    expect(IN_APP_BROWSER_RECORDING).toContain('var qaFrameDir = "<absolute-frame-directory>"');
    expect(IN_APP_BROWSER_RECORDING).toContain('Page.screencastFrameAck');
    expect(IN_APP_BROWSER_RECORDING).toMatch(/qaFrameIndex < 2/);
    expect(IN_APP_BROWSER_RECORDING).toContain('ffprobe');
    expect(QA).toMatch(/its own `recordVideo` — do not bridge/);
    expect(QA).toMatch(/`agent-browser connect <port-or-ws-url>`, then `record`/);
  });

  it('warns that a recording context inherits cookies but not localStorage', () => {
    expect(QA).toMatch(/Cookies\s+survive `record start`; \*\*localStorage does\s+not\*\*/);
    expect(QA).toMatch(/records logged out while\s+one holding a cookie\s+records signed in/);
    expect(QA).toMatch(/carry `context\.storageState\(\)` into/);
    expect(BROWSER_API).toMatch(/preserves cookies, but \*\*not\*\*\s+localStorage/);
    // The upstream --help text claims both; the skill must not repeat it.
    expect(QA).not.toMatch(/carries cookies and\s+localStorage across/);
    expect(BROWSER_API).not.toMatch(/preserves cookies and localStorage/);
  });

  it('names the sequence defects that default to a recording', () => {
    expect(QA).toMatch(/Read that as a default, not permission to skip/);
    expect(QA).toMatch(/a\s+navigation that does not happen/);
    expect(QA).toMatch(/whose before frame is blank or identical to its after frame/);
    expect(QA).toMatch(/A run whose issues are all static is complete\s+with no clips/);
  });

  it('requires a clipless run to state its recording status', () => {
    expect(HTML_TEMPLATE).toContain('| Recording |');
    expect(MARKDOWN_TEMPLATE).toContain('| **Recording** |');
    expect(MARKDOWN_TEMPLATE).toContain('| **Control surface** |');

    const fixtureDir = fs.mkdtempSync(path.join(os.tmpdir(), 'vs-qa-recstatus-'));
    fs.mkdirSync(path.join(fixtureDir, 'screenshots'));
    fs.writeFileSync(
      path.join(fixtureDir, 'screenshots', 'initial.png'),
      Buffer.from(
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
        'base64',
      ),
    );
    const reportPath = path.join(fixtureDir, 'report.md');
    const run = () =>
      spawnSync(process.execPath, [VALIDATOR, reportPath], { encoding: 'utf8' });

    fs.writeFileSync(reportPath, '![Initial state](screenshots/initial.png)\n');
    const silent = run();
    expect(silent.status).toBe(1);
    expect(silent.stdout).toContain('"statusStated":false');

    fs.writeFileSync(
      reportPath,
      '| **Recording** | recording unavailable on this control surface (desktop computer use) |\n\n'
        + '![Initial state](screenshots/initial.png)\n',
    );
    const stated = run();
    expect(stated.status).toBe(0);
    expect(stated.stdout).toContain('"statusStated":true');
  });

  it('rejects an HTML report pinned to a runtime that cannot render its evidence', () => {
    const fixtureDir = fs.mkdtempSync(path.join(os.tmpdir(), 'vs-qa-pin-'));
    fs.mkdirSync(path.join(fixtureDir, 'screenshots'));
    fs.writeFileSync(
      path.join(fixtureDir, 'screenshots', 'initial.png'),
      Buffer.from(
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
        'base64',
      ),
    );
    const reportPath = path.join(fixtureDir, 'report.html');
    const write = (pin: string) =>
      fs.writeFileSync(
        reportPath,
        RECORDING_STATUS
          + `<script src="https://cdn.jsdelivr.net/npm/@wix/htmdx@${pin}/dist/browser.js" defer></script>\n`
          + '![Initial state](screenshots/initial.png)\n',
      );
    const run = () =>
      spawnSync(process.execPath, [VALIDATOR, reportPath], { encoding: 'utf8' });

    write('2.2.1');
    const stale = run();
    expect(stale.status).toBe(1);
    expect(stale.stdout).toContain('"stale":["2.2.1"]');

    write('4.11.1');
    const current = run();
    expect(current.status).toBe(0);
    expect(current.stdout).toContain('"stale":[]');
  });

  it('skips the pin check for reports with no htmdx runtime', () => {
    const fixtureDir = fs.mkdtempSync(path.join(os.tmpdir(), 'vs-qa-nopin-'));
    fs.mkdirSync(path.join(fixtureDir, 'screenshots'));
    fs.writeFileSync(
      path.join(fixtureDir, 'screenshots', 'initial.png'),
      Buffer.from(
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
        'base64',
      ),
    );
    const reportPath = path.join(fixtureDir, 'report.md');
    fs.writeFileSync(reportPath, RECORDING_STATUS + '![Initial state](screenshots/initial.png)\n');

    const result = spawnSync(process.execPath, [VALIDATOR, reportPath], {
      encoding: 'utf8',
    });

    expect(result.status).toBe(0);
    expect(result.stdout).not.toContain('"runtime"');
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
    fs.writeFileSync(reportPath, RECORDING_STATUS + '![Initial state](screenshots/initial.png)\n');

    const result = spawnSync(process.execPath, [VALIDATOR, reportPath], {
      encoding: 'utf8',
    });

    expect(result.status).toBe(1);
    expect(result.stdout).toContain('"orphaned":["screenshots/orphan.png"]');
  });
});
