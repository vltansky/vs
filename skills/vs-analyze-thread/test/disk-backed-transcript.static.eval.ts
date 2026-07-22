import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { spawnSync } from 'child_process';
import { describe, expect, it } from 'vitest';

const DIR = path.resolve(__dirname, '..');
const NORMALIZER = path.join(DIR, 'scripts', 'normalize-transcript.mjs');
const SKILL = fs.readFileSync(path.join(DIR, 'SKILL.md'), 'utf8');

describe('vs-analyze-thread disk-backed transcripts', () => {
  it('writes normalized text and a turn index without printing transcript bodies', () => {
    const fixtureDir = fs.mkdtempSync(path.join(os.tmpdir(), 'vs-transcript-'));
    const inputPath = path.join(fixtureDir, 'thread.jsonl');
    const outputPath = path.join(fixtureDir, 'normalized.md');
    fs.writeFileSync(
      inputPath,
      [
        JSON.stringify({ type: 'user', message: { role: 'user', content: 'private user request\nwith another line' } }),
        JSON.stringify({ type: 'assistant', message: { role: 'assistant', content: 'private assistant response' } }),
      ].join('\n'),
    );

    const result = spawnSync(
      process.execPath,
      [NORMALIZER, '--output', outputPath, inputPath],
      { encoding: 'utf8' },
    );

    expect(result.status).toBe(0);
    expect(result.stdout).not.toContain('private user request');
    expect(result.stdout).not.toContain('private assistant response');
    expect(JSON.parse(result.stdout)).toMatchObject({ turns: 2, outputPath });
    expect(fs.existsSync(`${outputPath}.index.json`)).toBe(true);
    const index = JSON.parse(fs.readFileSync(`${outputPath}.index.json`, 'utf8'));
    expect(index).toHaveLength(2);
    expect(index[0].sourcePath).toBe(inputPath);
    expect(index[1].startLine).toBeGreaterThan(index[0].startLine + 3);
  });

  it('makes disk-backed normalization the default workflow', () => {
    expect(SKILL).toMatch(/--output.*normalized/is);
    expect(SKILL).toMatch(/turn index|index\.json/i);
    expect(SKILL).toMatch(/targeted.*turn|turn.*targeted/is);
    expect(SKILL).toMatch(/rg -n.*NORMALIZED_PATH/is);
  });
});
