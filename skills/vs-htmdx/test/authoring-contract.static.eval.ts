import * as fs from 'fs';
import * as path from 'path';
import { describe, expect, it } from 'vitest';

const SKILL = fs.readFileSync(path.resolve(__dirname, '..', 'SKILL.md'), 'utf8');
const AUTHORING = fs.readFileSync(
  path.resolve(__dirname, '..', 'references', 'authoring.md'),
  'utf8',
);

describe('compound components are authored as a complete set', () => {
  it('names the required props and children per parent', () => {
    expect(AUTHORING).toMatch(/These are compound components/);
    expect(AUTHORING).toMatch(
      /\| `Tabs` \| `defaultValue`.*\| `TabsList` > `TabsTrigger`/,
    );
    expect(AUTHORING).toMatch(/\| `Accordion` \| `type` \|/);
    expect(AUTHORING).toMatch(/each `value` to\s+appear exactly twice/);
  });

  it('states that an incomplete parent fails at compile time', () => {
    expect(AUTHORING).toMatch(
      /rejects an incomplete one at compile time rather than degrading/,
    );
    expect(AUTHORING).toMatch(/Author the whole set in one edit/);
  });

  it('verifies completeness before the artifact is presented', () => {
    expect(SKILL).toMatch(/Check every compound component is complete/);
    expect(SKILL).toMatch(
      /A parent without its children is a compile error, not a\s+degraded render/,
    );
  });
});

describe('angle brackets inside an htmdx body are parsed as tags', () => {
  it('warns that code fences do not protect their contents there', () => {
    expect(AUTHORING).toContain('## Angle brackets are parsed as tags');
    expect(AUTHORING).toMatch(/a code fence\s+does not protect its contents/);
    expect(AUTHORING).toMatch(/unknown component <OBSERVABLE>/);
  });

  it('routes placeholder-heavy content to the top level', () => {
    expect(AUTHORING).toMatch(
      /belongs at the top level of the document, where fenced blocks are literal/,
    );
    expect(AUTHORING).toMatch(
      /Do not wrap that section in `Card`, `Tabs`, `Accordion`/,
    );
    expect(AUTHORING).toMatch(/`PREVIEW_URL`, `\{\{port\}\}`/);
  });

  it('checks for the mistake before the artifact is presented', () => {
    expect(SKILL).toMatch(
      /Check no `<angle bracket>` placeholder sits inside an `htmdx` body/,
    );
    expect(SKILL).toMatch(/Code\s+fences do not protect their contents there/);
  });
});

describe('composition is opt-in, not the default', () => {
  it('defaults to plain sections and gives Tabs a negative test', () => {
    expect(AUTHORING).toMatch(/Prefer plain `###` sections/);
    expect(AUTHORING).toMatch(
      /one panel \*instead of\* another/,
    );
    expect(AUTHORING).toMatch(
      /are not alternate\s+views, and tabbing them hides content behind clicks/,
    );
    expect(SKILL).toMatch(
      /\| Views the reader picks between, rather than reads in order \| `Tabs` \|/,
    );
    expect(SKILL).toMatch(/Default to ordinary `###` sections/);
  });
});

describe('verification ends at a rendered artifact', () => {
  it('requires opening the file rather than stopping at structure', () => {
    expect(SKILL).toMatch(
      /Open the saved file in a browser and confirm it compiled/,
    );
    expect(SKILL).toMatch(
      /a structural check alone does not establish that\s+it renders/,
    );
    expect(SKILL).toMatch(/No server is needed — it is a `file:\/\/` path/);
  });

  it('keeps the numbered verify list sequential', () => {
    const list = SKILL.slice(SKILL.indexOf('## Verify'), SKILL.indexOf('## Handoff'));
    const numbers = [...list.matchAll(/^(\d+)\. /gm)].map((m) => Number(m[1]));
    expect(numbers).toEqual([...Array(numbers.length)].map((_, i) => i + 1));
  });
});
