import * as fs from 'fs';
import * as path from 'path';
import { describe, expect, it } from 'vitest';

const SKILL_DIR = path.resolve(__dirname, '..');
const SKILL = fs.readFileSync(path.join(SKILL_DIR, 'SKILL.md'), 'utf8');
const RENDER_CHECK = fs.readFileSync(
  path.join(SKILL_DIR, 'assets', 'render-check.mjs'),
  'utf8',
);
describe('the component catalog is read from the runtime, not from the skill', () => {
  it('loads the guidance with the skill command before authoring', () => {
    expect(SKILL).toContain('## Load the guidance');
    expect(SKILL).toContain('npx -y @wix/htmdx@4 skill');
    expect(SKILL).toMatch(
      /versioned with the\s+runtime, so read them from the runtime rather than from memory/,
    );
    expect(SKILL).toMatch(
      /Follow that output as the source of truth for the artifact contract, component\s+choice, body grammar/,
    );
  });

  it('reads the guidance at the version an existing artifact pins', () => {
    expect(SKILL).toContain('npx -y @wix/htmdx@<pinned-version> skill');
    expect(SKILL).toMatch(
      /read the guidance from \*that\*\s+version instead, so it matches what the artifact actually loads/,
    );
  });

  it('names the too-old signature and refuses to guess when nothing loads', () => {
    expect(SKILL).toMatch(
      /exits `2` with `unknown command "skill"` predates the command/,
    );
    expect(SKILL).toMatch(
      /say in the handoff that the guidance is newer than\s+the runtime the artifact pins/,
    );
    expect(SKILL).toMatch(/do not reconstruct the component catalog from memory/);
  });

  it('ships no vendored catalog that can drift from the runtime', () => {
    expect(fs.existsSync(path.join(SKILL_DIR, 'references'))).toBe(false);
    // A component-choice table here would be a second catalog to keep in sync.
    expect(SKILL).not.toMatch(/^\| Information shape/m);
    expect(SKILL).not.toMatch(/^\| `MetricStrip`/m);
  });

  it('routes the companion topics rather than restating them', () => {
    for (const topic of ['skill --list', 'skill components', 'skill integration']) {
      expect(SKILL).toContain(`npx -y @wix/htmdx@4 ${topic}`);
    }
    expect(SKILL).toMatch(/at the same version that answered the first call/);
  });
});

describe('ordered lists render only from 4.10.1 onward', () => {
  // Ordered lists collapsed to a paragraph before 4.10.1, and a list nested
  // under a bullet lost its lines outright (wix-incubator/htmdx#77). Any
  // template using `1.` has to pin a runtime that renders it — the `@4` major
  // line resolves to the newest 4.x, which is past that fix.
  const templates = [
    ['..', '..', 'vs-qa', 'references', 'qa-report-template.html'],
    ['..', '..', 'vs-steal', 'references', 'steals-report-template.html'],
    ['..', '..', 'vs-search-threads', 'references', 'thread-comparison-template.html'],
    ['..', 'assets', 'artifact.html'],
  ];

  it('pins a runtime that renders an ordered list wherever one is used', () => {
    for (const parts of templates) {
      const file = path.resolve(__dirname, ...parts);
      const source = fs.readFileSync(file, 'utf8');
      const block = source.slice(
        source.indexOf('text/htmdx'),
        source.indexOf('</script>'),
      );
      if (!/^\d+\. /m.test(block)) continue;
      expect(source, `${path.basename(file)} predates the ordered-list fix`).toMatch(
        /@wix\/htmdx@4(?![.\d])/,
      );
    }
  });

  it('drops the bolded-bullet workaround the collapse forced', () => {
    for (const parts of templates) {
      const file = path.resolve(__dirname, ...parts);
      const source = fs.readFileSync(file, 'utf8');
      expect(source, `${path.basename(file)} still fakes a numbered list`).not.toMatch(
        /^- \*\*(?:Step )?\d+\.\*\* /m,
      );
    }
  });
});

describe('linting gates the artifact before it is rendered', () => {
  it('runs the linter at the pinned version, strictly', () => {
    expect(SKILL).toContain(
      'npx -y @wix/htmdx@4 lint "$ARTIFACT_PATH" --strict',
    );
    expect(SKILL).toMatch(
      /Exit `0` is clean, `1` means problems were found, and `2` means the check never\s+ran/,
    );
    expect(SKILL).toMatch(/do not read a `2` as a pass/);
  });

  it('expects iteration rather than one clean pass', () => {
    expect(SKILL).toMatch(/one\s+malformed body can mask the diagnostics after it/);
    expect(SKILL).toMatch(
      /a clean run is the only\s+evidence that the file is clean/,
    );
  });

  it('treats a version mismatch as a wrong answer, not noise', () => {
    expect(SKILL).toMatch(/`runtime-version-mismatch` finding/);
    expect(SKILL).toMatch(
      /the results describe a runtime the artifact does not load/,
    );
    expect(SKILL).toMatch(/rather than ignoring it/);
  });

  it('does not let linting stand in for rendering', () => {
    expect(SKILL).toMatch(/Linting is not rendering/);
    expect(SKILL).toMatch(/cannot see a CDN that\s+never responds/);
  });
});

describe('verification ends at a rendered artifact', () => {
  it('renders the file rather than stopping at structure', () => {
    expect(SKILL).toMatch(/Render the saved file and confirm it compiled/);
    expect(SKILL).toMatch(
      /a structural check alone does not establish that it\s+renders/,
    );
    expect(SKILL).toMatch(/node assets\/render-check\.mjs "\$ARTIFACT_PATH"/);
    expect(SKILL).toMatch(
      /`Failed step: compile` or `Failed step: render`[\s\S]{0,120}names the exact\s+component and reason/,
    );
    expect(SKILL).toMatch(/each pass reveals one\s+error, so expect to iterate/);
    expect(SKILL).toMatch(/open the\s+`file:\/\/` path — no server is needed/);
  });

  it('ships the render check as a runnable asset', () => {
    expect(RENDER_CHECK).toMatch(/Failed step: \\w\+/);
    expect(RENDER_CHECK).toMatch(/process\.exit\(failed \? 1 : 0\)/);
  });

  it('fails an artifact whose evidence images never loaded', () => {
    // This check used to filter the load failure out as "a stale path, not a
    // compile failure", which passed artifacts whose screenshots the reader
    // never saw. See vs-internal-shared/test/visual-evidence.static.eval.ts.
    expect(RENDER_CHECK).toMatch(/naturalWidth === 0/);
    expect(RENDER_CHECK).toMatch(/image\(s\) did not load/);
    expect(RENDER_CHECK).not.toMatch(/!\/ERR_FILE_NOT_FOUND\/\.test/);
  });

  it('fails the render check when an old pin escapes raw tags to text', () => {
    expect(RENDER_CHECK).toMatch(
      /video\|audio\|source\|iframe\|details\|summary\|div\|figure/,
    );
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
