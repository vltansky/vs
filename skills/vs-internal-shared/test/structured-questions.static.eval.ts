import * as fs from 'node:fs';
import * as path from 'node:path';
import { describe, expect, it } from 'vitest';

const SHARED = fs.readFileSync(path.resolve(__dirname, '..', 'SKILL.md'), 'utf8');
const SHAPE_IT = fs.readFileSync(
  path.resolve(__dirname, '..', '..', 'vs-shape-it', 'SKILL.md'),
  'utf8',
);
const PUSHBACK = fs.readFileSync(
  path.resolve(__dirname, '..', '..', 'vs-pushback', 'SKILL.md'),
  'utf8',
);

describe('shared structured-question rendering', () => {
  it('uses the Codex structured question UI when available', () => {
    expect(SHARED).toMatch(/Codex(?:'s)?\s+`request_user_input`/);
    expect(SHARED).toMatch(/when\s+`request_user_input`\s+is listed,\s+call it/i);
    expect(SHARED).toMatch(/do not also print/i);
    expect(SHARED).not.toMatch(/for example Codex today/i);
    expect(SHAPE_IT).toMatch(/`request_user_input` in Codex/);
    expect(PUSHBACK).toMatch(/`request_user_input` in Codex/);
  });

  it('keeps the text fallback vertically scannable', () => {
    expect(SHARED).toMatch(/one\s+option per line/i);
    expect(SHARED).not.toMatch(/Options: A\) \.\.\./);
    // shape-it shows the fallback as a Markdown example (one bullet per option)
    // and defers the prose rule to internal-shared Structured questions.
    expect(SHAPE_IT).toMatch(/Structured questions/);
    expect(SHAPE_IT).toMatch(/^- A\. .+—/m);
    expect(PUSHBACK).toMatch(/one\s+option per line/i);
  });
});
