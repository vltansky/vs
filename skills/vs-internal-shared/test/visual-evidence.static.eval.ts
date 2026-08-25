import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { spawnSync } from 'child_process';
import { describe, expect, it } from 'vitest';

// Reproduces two defects measured across the 46 HTMDX artifacts under `~/.vs`:
//
//   1. 36 of them (78%) contain no image at all. Every artifact that does carry
//      screenshots came from vs-qa, the only skill with an evidence contract and
//      a validator. Everything else starts from the shared rich-artifact
//      contract, which named screenshots as a *reason to choose* HTMDX without
//      ever requiring the artifact to show one.
//   2. The screenshots that do land are captured at the viewport, so they cut
//      off the content they claim to prove — a QA "review step" shot sliced
//      through the card it was proving, a mobile "after fix" shot ended
//      mid-row. The documented capture was a bare `page.screenshot()`.
//
// The contract assertions below pin the rules; the fixture runs pin the check
// that enforces them.

const SHARED_DIR = path.resolve(__dirname, '..');
const SKILLS_DIR = path.resolve(SHARED_DIR, '..');
const RICH_ARTIFACTS = fs.readFileSync(
  path.join(SHARED_DIR, 'references', 'rich-artifacts.md'),
  'utf8',
);
const CHECK = path.join(SHARED_DIR, 'scripts', 'check-visual-evidence.mjs');
const HTMDX_SKILL = fs.readFileSync(
  path.join(SKILLS_DIR, 'vs-htmdx', 'SKILL.md'),
  'utf8',
);
const RENDER_CHECK = fs.readFileSync(
  path.join(SKILLS_DIR, 'vs-htmdx', 'assets', 'render-check.mjs'),
  'utf8',
);
const BROWSER_API = fs.readFileSync(
  path.join(SKILLS_DIR, 'vs-qa', 'references', 'browser-api.md'),
  'utf8',
);
const QA_SKILL = fs.readFileSync(
  path.join(SKILLS_DIR, 'vs-qa', 'SKILL.md'),
  'utf8',
);

const PNG_1X1 = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
  'base64',
);

function fixture(name: string) {
  return fs.mkdtempSync(path.join(os.tmpdir(), `vs-visual-${name}-`));
}

function run(reportPath: string, ...args: string[]) {
  return spawnSync(process.execPath, [CHECK, reportPath, ...args], {
    encoding: 'utf8',
  });
}

describe('a rich artifact shows the evidence it stands on', () => {
  it('requires the artifact to embed the visual evidence, not just cite it', () => {
    expect(RICH_ARTIFACTS).toContain('## Visual evidence');
    expect(RICH_ARTIFACTS).toMatch(
      /A report about something visible that shows no picture of it is not\s+evidence/,
    );
    // The old text only listed screenshots as a reason to pick HTMDX.
    expect(RICH_ARTIFACTS).toMatch(/embed(s|ded)? (?:it|them|the capture)/i);
  });

  it('keeps the reference relative so the artifact stays portable', () => {
    expect(RICH_ARTIFACTS).toMatch(
      /Reference (?:it|each image|images) by a relative path/,
    );
    expect(RICH_ARTIFACTS).toMatch(
      /absolute[^.]{0,60}path[\s\S]{0,160}breaks the moment the artifact/,
    );
  });

  it('names the check that enforces the contract', () => {
    expect(RICH_ARTIFACTS).toContain('scripts/check-visual-evidence.mjs');
    expect(HTMDX_SKILL).toContain('check-visual-evidence.mjs');
  });
});

describe('a capture proves the whole page, not the fold', () => {
  it('captures full page by default on both control surfaces', () => {
    expect(BROWSER_API).toContain('fullPage: true');
    expect(BROWSER_API).toContain('agent-browser screenshot --full');
    // A bare viewport capture is what cut the evidence off at the fold.
    expect(BROWSER_API).not.toMatch(/await page\.screenshot\(\);/);
  });

  it('states why a viewport capture is not evidence', () => {
    expect(QA_SKILL).toMatch(
      /viewport capture[\s\S]{0,200}cuts the page off at the fold/,
    );
    expect(QA_SKILL).toMatch(/say\s+so in the alt text/);
  });
});

describe('render-check stops passing an artifact whose images never loaded', () => {
  it('no longer suppresses the broken-image signal it promised to catch', () => {
    // The skill promised rendering catches "a referenced screenshot that is not
    // on disk"; the check filtered exactly that error out.
    expect(RENDER_CHECK).not.toMatch(/!\/ERR_FILE_NOT_FOUND\/\.test/);
    expect(RENDER_CHECK).toMatch(/naturalWidth/);
    expect(RENDER_CHECK).toMatch(/did not load/i);
  });
});

describe('check-visual-evidence enforces the contract', () => {
  it('passes an artifact that references a screenshot that exists', () => {
    const dir = fixture('ok');
    fs.mkdirSync(path.join(dir, 'screenshots'));
    fs.writeFileSync(path.join(dir, 'screenshots', 'initial.png'), PNG_1X1);
    const report = path.join(dir, 'report.html');
    fs.writeFileSync(report, '![Initial state](screenshots/initial.png)\n');

    const result = run(report);
    expect(result.status).toBe(0);
    expect(result.stdout).toContain('"valid":true');
  });

  it('scans only the source block of an HTMDX artifact, not the shell catalog', () => {
    // The template shells inline the vs catalog, whose Figure example carries
    // src="./onboarding.png"; that string never renders, so it must not count
    // as a missing-evidence reference.
    const dir = fixture('htmdx');
    const report = path.join(dir, 'report.html');
    fs.writeFileSync(
      report,
      [
        '<script>',
        "const example = '<Figure src=\"./onboarding.png\" caption=\"x\">';",
        '</script>',
        '<script type="text/htmdx">',
        '# Report',
        '',
        'No visual claim here.',
        '</script>',
      ].join('\n'),
    );

    const result = run(report);
    expect(result.status).toBe(0);
    expect(result.stdout).toContain('"referenced":0');
  });

  it('fails an artifact whose screenshot is not on disk', () => {
    const dir = fixture('missing');
    const report = path.join(dir, 'report.html');
    fs.writeFileSync(report, '![After the fix](screenshots/after.png)\n');

    const result = run(report);
    expect(result.status).toBe(1);
    expect(result.stdout).toContain('"missing":["screenshots/after.png"]');
  });

  it('fails an artifact that ignores the evidence saved beside it', () => {
    const dir = fixture('ignored');
    fs.mkdirSync(path.join(dir, 'screenshots'));
    fs.writeFileSync(path.join(dir, 'screenshots', 'initial.png'), PNG_1X1);
    const report = path.join(dir, 'report.html');
    fs.writeFileSync(report, '# Report\n\nThe layout is fixed.\n');

    const result = run(report);
    expect(result.status).toBe(1);
    expect(result.stdout).toContain('"ignoredEvidence":["screenshots/initial.png"]');
  });

  it('fails an absolute reference that breaks once the artifact moves', () => {
    const dir = fixture('absolute');
    fs.mkdirSync(path.join(dir, 'screenshots'));
    const absolute = path.join(dir, 'screenshots', 'initial.png');
    fs.writeFileSync(absolute, PNG_1X1);
    const report = path.join(dir, 'report.html');
    fs.writeFileSync(report, `![Initial state](${absolute})\n`);

    const result = run(report);
    expect(result.status).toBe(1);
    expect(result.stdout).toContain('"absolute":[');
  });

  it('fails --require-images when the artifact shows nothing', () => {
    const dir = fixture('require');
    const report = path.join(dir, 'report.html');
    fs.writeFileSync(report, '# Report\n\nThe button is now aligned.\n');

    const bare = run(report);
    expect(bare.status).toBe(0);

    const required = run(report, '--require-images');
    expect(required.status).toBe(1);
    expect(required.stdout).toContain('"referenced":0');
  });

  it('reports a fold-sized capture so the author can see it was cropped', () => {
    const dir = fixture('fold');
    fs.mkdirSync(path.join(dir, 'screenshots'));
    // 1280x720 — the default Playwright viewport, the exact shape of the
    // captures that sliced through the content they were proving.
    fs.writeFileSync(path.join(dir, 'screenshots', 'fold.png'), png(1280, 720));
    const report = path.join(dir, 'report.html');
    fs.writeFileSync(report, '![Review step](screenshots/fold.png)\n');

    const result = run(report);
    expect(result.stdout).toContain('"viewportSized":["screenshots/fold.png"]');
  });

  it('accepts a remote or data source without touching the disk', () => {
    const dir = fixture('remote');
    const report = path.join(dir, 'report.html');
    fs.writeFileSync(report, '![Chart](https://example.com/chart.png)\n');

    const result = run(report);
    expect(result.status).toBe(0);
    expect(result.stdout).toContain('"remote":1');
  });

  it('reports a missing artifact as unchecked rather than clean', () => {
    const result = run(path.join(fixture('gone'), 'nope.html'));
    expect(result.status).toBe(2);
  });
});

// A valid PNG header is all the check reads, so the fixture can synthesize any
// dimensions without a real encoder.
function png(width: number, height: number) {
  const ihdr = Buffer.alloc(25);
  ihdr.writeUInt32BE(13, 0);
  ihdr.write('IHDR', 4, 'ascii');
  ihdr.writeUInt32BE(width, 8);
  ihdr.writeUInt32BE(height, 12);
  ihdr[16] = 8;
  ihdr[17] = 6;
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    ihdr,
  ]);
}
