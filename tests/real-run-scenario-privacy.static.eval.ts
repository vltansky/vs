import * as fs from 'node:fs';
import * as path from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = path.resolve(__dirname, '..');
const SCENARIOS = [
  path.join(
    ROOT,
    'skills',
    'vs-fix-pr',
    'test',
    'fixtures',
    'ci-and-review',
    'handoff.md',
  ),
];

describe('real-run scenario privacy', () => {
  it('keeps source identities and infrastructure out of public fixtures', () => {
    const content = SCENARIOS.map((file) => fs.readFileSync(file, 'utf8')).join(
      '\n',
    );

    expect(content).not.toMatch(/codex:\/\/threads|\/home\/|Users\//i);
    expect(content).not.toMatch(/vltansky|wix|falcon|reportan/i);
    expect(content).not.toMatch(/github\.com|@[a-z0-9_-]+/i);
    expect(content).not.toMatch(/\b[0-9a-f]{7,40}\b/i);
  });
});
