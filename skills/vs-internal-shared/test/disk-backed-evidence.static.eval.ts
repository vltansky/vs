import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { spawnSync } from 'child_process';
import { describe, expect, it } from 'vitest';

const ROOT = path.resolve(__dirname, '..', '..', '..');
const SHARED_DIR = path.join(ROOT, 'skills', 'vs-internal-shared');
const CONTRACT_PATH = path.join(
  SHARED_DIR,
  'references',
  'disk-backed-evidence.md',
);
const TOOL_PATH = path.join(
  SHARED_DIR,
  'scripts',
  'evidence-manifest.mjs',
);

describe('disk-backed evidence contract', () => {
  it('returns identity metadata without returning file contents', () => {
    const fixtureDir = fs.mkdtempSync(path.join(os.tmpdir(), 'vs-evidence-'));
    const evidencePath = path.join(fixtureDir, 'large-log.txt');
    fs.writeFileSync(evidencePath, 'private-marker\nsecond line\n');

    const result = spawnSync(process.execPath, [TOOL_PATH, 'manifest', evidencePath], {
      encoding: 'utf8',
    });

    expect(result.status).toBe(0);
    expect(result.stdout).not.toContain('private-marker');
    expect(JSON.parse(result.stdout)).toMatchObject({
      bytes: 27,
      lines: 2,
      mediaType: 'text/plain',
    });
    expect(JSON.parse(result.stdout).sha256).toMatch(/^[a-f0-9]{64}$/);
  });

  it('captures stdin and returns only the last parseable JSON metadata line', () => {
    const fixtureDir = fs.mkdtempSync(path.join(os.tmpdir(), 'vs-capture-'));
    const evidencePath = path.join(fixtureDir, 'snapshot.txt');
    const result = spawnSync(
      process.execPath,
      [TOOL_PATH, 'capture', evidencePath, '--json-tail'],
      {
        input: 'large snapshot body\n{"url":"/settings","controls":4}\nlate producer diagnostic\n',
        encoding: 'utf8',
      },
    );

    expect(result.status).toBe(0);
    expect(fs.readFileSync(evidencePath, 'utf8')).toBe('large snapshot body\nlate producer diagnostic\n');
    expect(JSON.parse(result.stdout)).toMatchObject({
      metadata: { url: '/settings', controls: 4 },
      evidence: { bytes: 45 },
    });
    expect(result.stdout).not.toContain('large snapshot body');
  });

  it('returns only an explicitly bounded text slice', () => {
    const fixtureDir = fs.mkdtempSync(path.join(os.tmpdir(), 'vs-slice-'));
    const evidencePath = path.join(fixtureDir, 'large.diff');
    fs.writeFileSync(evidencePath, Array.from({ length: 250 }, (_, index) => `line ${index + 1}`).join('\n'));

    const result = spawnSync(
      process.execPath,
      [TOOL_PATH, 'slice', evidencePath, '--start', '80', '--end', '82'],
      { encoding: 'utf8' },
    );
    const oversized = spawnSync(
      process.execPath,
      [TOOL_PATH, 'slice', evidencePath, '--start', '1', '--end', '201'],
      { encoding: 'utf8' },
    );

    expect(result.status).toBe(0);
    expect(result.stdout).toBe('line 80\nline 81\nline 82\n');
    expect(oversized.status).toBe(2);
    expect(oversized.stdout).toBe('');

    fs.writeFileSync(evidencePath, `prefix-${'x'.repeat(40_000)}`);
    const wideLine = spawnSync(
      process.execPath,
      [TOOL_PATH, 'slice', evidencePath, '--start', '1', '--end', '1'],
      { encoding: 'utf8' },
    );
    expect(Buffer.byteLength(wideLine.stdout)).toBeLessThan(33_000);
    expect(wideLine.stdout).toContain('[truncated: slice exceeded 32768 bytes]');
  });

  it('documents bounded, on-demand retrieval across high-volume skills', () => {
    const contract = fs.readFileSync(CONTRACT_PATH, 'utf8');
    const qa = fs.readFileSync(path.join(ROOT, 'skills', 'vs-qa', 'SKILL.md'), 'utf8');
    const brief = fs.readFileSync(path.join(ROOT, 'skills', 'vs-brief', 'SKILL.md'), 'utf8');
    const review = fs.readFileSync(path.join(ROOT, 'skills', 'vs-roast-review', 'SKILL.md'), 'utf8');
    const live = fs.readFileSync(
      path.join(ROOT, 'skills', 'vs-roast-ui', 'references', 'live.md'),
      'utf8',
    );

    expect(contract).toMatch(/path.*mediaType.*bytes.*sha256.*summary/is);
    expect(contract).toMatch(/line range|diff hunk|transcript turn|image crop/i);
    expect(qa).toMatch(/disk-backed evidence|evidence-manifest/i);
    const snapshotBlocks = [...qa.matchAll(/```bash\n([\s\S]*?)```/g)]
      .map((match) => match[1])
      .filter((block) => block.includes('snapshotForAI'));
    expect(snapshotBlocks.length).toBeGreaterThan(0);
    for (const block of snapshotBlocks) {
      expect(block).toMatch(/\| node "\$EVIDENCE_TOOL" capture "\$SNAPSHOT_PATH" --json-tail/);
    }
    expect(brief).toMatch(/DIFF_PATH.*git diff|git diff.*DIFF_PATH/is);
    expect(brief).toMatch(/manifest "\$DIFF_PATH"/);
    expect(brief).toMatch(/symbolic-ref --quiet --short refs\/remotes\/origin\/HEAD/);
    expect(review).not.toMatch(/Get the full diff/i);
    expect(review).toMatch(/codex review[\s\S]*evidence-manifest|codex review[\s\S]*\$EVIDENCE_TOOL/is);
    expect(review).toMatch(/slop-scan scan[\s\S]*capture "\$REVIEW_EVIDENCE_DIR\/slop-scan\.json"/is);
    expect(review).toMatch(/git diff[\s\S]*HUNK_INDEX_PATH[\s\S]*manifest "\$DIFF_PATH"/is);
    expect(live).toMatch(/structured annotations.*primary/is);
    expect(live).toMatch(/smallest.*crop/is);
    expect(live).toMatch(/manifest "\$SCREENSHOT_PATH"/);
    expect(qa).toMatch(/network-resources\.json/);
  });
});
