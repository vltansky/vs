import * as fs from 'fs';
import * as path from 'path';
import { describe, expect, it } from 'vitest';

const SKILL = fs.readFileSync(path.resolve(__dirname, '..', 'SKILL.md'), 'utf8');
const AUTHORING = fs.readFileSync(
  path.resolve(__dirname, '..', 'references', 'authoring.md'),
  'utf8',
);
const RENDER_CHECK = fs.readFileSync(
  path.resolve(__dirname, '..', 'assets', 'render-check.mjs'),
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

describe('props and body grammar are checked against the runtime, not by analogy', () => {
  it('states that the report components accept no props', () => {
    expect(AUTHORING).toContain('## The report components take no props');
    expect(AUTHORING).toMatch(/`<Callout type="warning">` fails with\s+`unknown prop "type" for <Callout>`/);
    expect(AUTHORING).toMatch(/an absent `props` key means none are accepted/);
    expect(SKILL).toMatch(
      /every attribute on it\*? ?against the\s+exact-version component manifest/,
    );
  });

  it('overrides the manifest body field with the enforced grammar', () => {
    expect(AUTHORING).toContain('## Body grammar is stricter than the manifest states');
    expect(AUTHORING).toMatch(
      /the manifest under-specifies and the\s+mismatch surfaces at render rather than compile/,
    );
    expect(AUTHORING).toMatch(/\| `MetricStrip`, `Timeline` \| `- label: value` rows only \|/);
    expect(AUTHORING).toMatch(/\| `DataTable`, `DecisionMatrix` \| a GFM table/);
    expect(AUTHORING).toMatch(/Invalid body for <MetricStrip>/);
  });
});

describe('ordered lists are not a usable construct', () => {
  it('documents the collapse and gives the bulleted replacement', () => {
    expect(AUTHORING).toContain('## Ordered lists do not render');
    expect(AUTHORING).toMatch(/collapse\s+into one run-on paragraph/);
    expect(AUTHORING).toContain('- **1.** Navigate to the checkout page');
    expect(AUTHORING).toMatch(/`4\.5\.1` through `4\.9\.0` behave the same/);
  });

  it('keeps ordered lists out of the shipped HTMDX templates', () => {
    const templates = [
      ['..', '..', 'vs-qa', 'references', 'qa-report-template.html'],
      ['..', '..', 'vs-steal', 'references', 'steals-report-template.html'],
      ['..', '..', 'vs-analyze-thread', 'references', 'thread-comparison-template.html'],
      ['..', 'assets', 'artifact.html'],
    ];
    for (const parts of templates) {
      const file = path.resolve(__dirname, ...parts);
      const source = fs.readFileSync(file, 'utf8');
      const block = source.slice(
        source.indexOf('text/htmdx'),
        source.indexOf('</script>'),
      );
      expect(block, `${path.basename(file)} uses an ordered list`).not.toMatch(
        /^\d+\. /m,
      );
    }
  });
});

describe('raw HTML is allowlisted rather than passed through', () => {
  it('names the allowed media and layout elements and the video attributes', () => {
    expect(AUTHORING).toContain('## Raw HTML is allowlisted, not passed through');
    expect(AUTHORING).toMatch(/\| Media \| `video`, `audio`, `source`, `track`, `img` \|/);
    expect(AUTHORING).toMatch(/`video` accepts `src`, `poster`, `controls`, `muted`/);
    expect(AUTHORING).toMatch(/dropped silently/);
  });

  it('states the three rules that decide whether markup survives', () => {
    expect(AUTHORING).toMatch(/\*\*`on\*` attributes fail the compile\*\* with `event-handler-attribute`/);
    expect(AUTHORING).toMatch(/including `javascript:` and `data:`, is dropped/);
    expect(AUTHORING).toMatch(/A relative path resolves against the document/);
    expect(AUTHORING).toMatch(/\*\*A block element opening a line starts an HTML block\*\*/);
  });

  it('keeps raw tags out of markdown-body components', () => {
    expect(AUTHORING).toContain(
      'component <Evidence> with markdown body does not allow nested tags',
    );
    expect(AUTHORING).toMatch(/Put a recording at the top level/);
  });

  it('treats iframe as the element to avoid in evidence artifacts', () => {
    expect(AUTHORING).toMatch(/`iframe` is allowlisted without a forced `sandbox` attribute/);
    expect(AUTHORING).toMatch(/should not also grant those values a frame/);
  });

  it('fails the render check when an old pin escapes raw tags to text', () => {
    expect(RENDER_CHECK).toMatch(/video\|audio\|source\|iframe\|details\|summary\|div\|figure/);
    expect(RENDER_CHECK).toMatch(/Raw HTML rendered as literal text/);
    expect(RENDER_CHECK).toMatch(/predates the raw-HTML allowlist\. Bump the pin/);
  });

  it('refuses to pass a blank page when the runtime never loaded', () => {
    expect(RENDER_CHECK).toMatch(/const blank = body\.length < 40/);
    expect(RENDER_CHECK).toMatch(/the runtime never loaded/);
    expect(RENDER_CHECK).toMatch(/Check the pinned version exists/);
  });

  it('resolves a relative artifact path instead of crashing on it', () => {
    expect(RENDER_CHECK).toMatch(/pathToFileURL\(resolve\(file\)\)\.href/);
    expect(RENDER_CHECK).toMatch(/Treat this as not verified, not as a pass/);
    expect(RENDER_CHECK).not.toMatch(/goto\('file:\/\/' \+ file/);
  });
});

describe('linting gates the artifact before it is rendered', () => {
  it('runs the linter at the pinned version', () => {
    expect(SKILL).toContain('npx @wix/htmdx@4.9.0 lint "$ARTIFACT_PATH"');
    expect(SKILL).toMatch(/Exit `1` means at least one error/);
    expect(SKILL).toMatch(/`--strict` also fails on warnings/);
  });

  it('names the rules so a diagnostic maps to a fix', () => {
    for (const rule of [
      'unknown-prop',
      'body-contract',
      'missing-required-prop',
      'markdown-body-nested-tags',
      'event-handler-attribute',
    ]) {
      expect(SKILL).toContain(rule);
    }
    expect(SKILL).toMatch(/the linter does not\s+stop at the first one/);
  });

  it('does not let linting stand in for rendering', () => {
    expect(SKILL).toMatch(/Linting is not rendering/);
    expect(SKILL).toMatch(/cannot see a CDN that\s+never responds/);
    expect(SKILL).toMatch(/`runtime-version-mismatch` warning/);
    expect(SKILL).toMatch(/before `4\.6\.0` ship no linter at all/);
  });
});

describe('verification ends at a rendered artifact', () => {
  it('renders the file rather than stopping at structure', () => {
    expect(SKILL).toMatch(
      /Render the saved file and confirm it compiled/,
    );
    expect(SKILL).toMatch(
      /a structural check alone does not establish that it\s+renders/,
    );
    expect(SKILL).toMatch(/node assets\/render-check\.mjs "\$ARTIFACT_PATH"/);
    expect(SKILL).toMatch(
      /`Failed step: compile` or `Failed step: render`[\s\S]{0,120}names the exact\s+component and reason/,
    );
    expect(SKILL).toMatch(
      /each pass reveals one\s+error, so expect to iterate/,
    );
    expect(SKILL).toMatch(/open the\s+`file:\/\/` path — no server is needed/);
  });

  it('ships the render check as a runnable asset', () => {
    expect(RENDER_CHECK).toMatch(/Failed step: \\w\+/);
    expect(RENDER_CHECK).toMatch(/process\.exit\(failed \? 1 : 0\)/);
    expect(RENDER_CHECK).toMatch(/ERR_FILE_NOT_FOUND/);
  });

  it('distinguishes "could not check" from "passed"', () => {
    expect(RENDER_CHECK).toMatch(
      /0 all rendered · 1 an artifact failed · 2 could not check/,
    );
    expect(RENDER_CHECK).toMatch(/Do not report rendered proof without one of these/);
    expect(SKILL).toMatch(
      /Exit `2` means the check could not run, not that the artifact is fine/,
    );
  });

  it('keeps the numbered verify list sequential', () => {
    const list = SKILL.slice(SKILL.indexOf('## Verify'), SKILL.indexOf('## Handoff'));
    const numbers = [...list.matchAll(/^(\d+)\. /gm)].map((m) => Number(m[1]));
    expect(numbers).toEqual([...Array(numbers.length)].map((_, i) => i + 1));
  });
});
