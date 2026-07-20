import * as fs from 'fs';
import * as path from 'path';
import { describe, expect, it } from 'vitest';

const CONTRACT = fs.readFileSync(
  path.resolve(__dirname, '..', 'references', 'rich-artifacts.md'),
  'utf8',
);

describe('rich artifact security boundary', () => {
  it('selects the runtime from actual artifact content rather than its subject', () => {
    expect(CONTRACT).toMatch(/actual artifact content|actual report content/is);
    expect(CONTRACT).toMatch(/sanitized.*pinned remote runtime/is);
    expect(CONTRACT).toMatch(/sensitive data must remain.*trusted local/is);
    expect(CONTRACT).toMatch(/replace.*runtime `src`.*before inserting/is);
    expect(CONTRACT).toMatch(/edit-only-source-block rule.*after/is);
    expect(CONTRACT).toMatch(/user or repository provides.*exact pinned runtime/is);
    expect(CONTRACT).toMatch(/Do not.*install.*during report generation/is);
  });
});
