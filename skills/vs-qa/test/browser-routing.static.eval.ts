import * as fs from 'fs';
import * as path from 'path';
import { describe, expect, it } from 'vitest';

const QA = fs.readFileSync(path.resolve(__dirname, '..', 'SKILL.md'), 'utf8');
const BROWSER_API = fs.readFileSync(
  path.resolve(__dirname, '..', 'references', 'browser-api.md'),
  'utf8',
);

describe('vs-qa control surface routing', () => {
  it('prefers harness-native authenticated browser control', () => {
    expect(QA).toMatch(
      /harness-native in-app browser or extension.*authenticated/is,
    );
    expect(QA).toMatch(/Codex.*Claude Code/is);
    expect(QA).toMatch(/preserves\s+the\s+user's existing session/is);
  });

  it('falls back through Playwright before other browser automation', () => {
    expect(QA).toMatch(/1\..*in-app browser or extension/is);
    expect(QA).toMatch(/2\..*Playwright/is);
    expect(QA).toMatch(/3\..*agent-browser.*available browser fallback/is);
    expect(QA).toMatch(/Do not stop merely because `agent-browser` is missing/is);
  });

  it('uses computer use for non-browser surfaces', () => {
    expect(QA).toMatch(/non-browser desktop or native-app surface/is);
    expect(QA).toMatch(/harness-native computer use/is);
    expect(QA).toMatch(/Codex computer use.*Claude Code computer use/is);
  });

  it('labels agent-browser documentation as fallback syntax', () => {
    expect(BROWSER_API).toMatch(/fallback reference/is);
    expect(BROWSER_API).toMatch(/selected control surface/is);
  });
});
