import * as fs from 'node:fs';
import * as path from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = path.resolve(__dirname, '..');
const SCENARIO_ROOTS = [
  path.join(ROOT, 'skills', 'vs-fix-pr', 'test', 'fixtures', 'ci-and-review'),
  path.join(ROOT, 'skills', 'vs-fix-pr', 'test', 'fixtures', 'ci-ownership-dirty'),
  path.join(
    ROOT,
    'skills',
    'vs-fix-pr',
    'test',
    'fixtures',
    'review-body-approval-dirty',
  ),
  path.join(
    ROOT,
    'skills',
    'vs-build-it',
    'test',
    'fixtures',
    'real-world-minimum',
  ),
  path.join(
    ROOT,
    'skills',
    'vs-shape-it',
    'test',
    'fixtures',
    'publishing-project',
  ),
  path.join(
    ROOT,
    'skills',
    'vs-shape-it',
    'test',
    'fixtures',
    'suggestion-project',
  ),
];

function listFiles(root: string): string[] {
  return fs.readdirSync(root, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = path.join(root, entry.name);
    return entry.isDirectory() ? listFiles(entryPath) : [entryPath];
  });
}

describe('real-run scenario privacy', () => {
  it('keeps source identities and infrastructure out of public fixtures', () => {
    const content = SCENARIO_ROOTS.flatMap(listFiles)
      .map((file) => fs.readFileSync(file, 'utf8'))
      .join('\n');

    expect(content).not.toMatch(/codex:\/\/threads|\/home\/|Users\//i);
    expect(content).not.toMatch(/vltansky|wix|falcon|reportan/i);
    expect(content).not.toMatch(/github\.com|["'\s]@[a-z0-9_-]+/i);
    expect(content).not.toMatch(
      /[a-z0-9._%+-]+@(?!example\.(?:test|invalid)\b)[a-z0-9.-]+\.[a-z]{2,}/i,
    );
    expect(content).not.toMatch(/https?:\/\/|\b(?:sk|ghp)_[a-z0-9_-]+/i);
    expect(content).not.toMatch(/\b[0-9a-f]{7,40}\b/i);
  });
});
