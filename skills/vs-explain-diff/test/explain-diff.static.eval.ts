import * as fs from 'fs';
import * as path from 'path';
import { describe, expect, it } from 'vitest';

const DIR = path.resolve(__dirname, '..');
const ROOT = path.resolve(DIR, '..', '..');
const SKILL = fs.readFileSync(path.join(DIR, 'SKILL.md'), 'utf8');

describe('vs-explain-diff boundary', () => {
  it('routes shallower reader needs to the cheaper skills', () => {
    expect(SKILL).toMatch(/\/vs-brief/);
    expect(SKILL).toMatch(/\/vs-recap/);
    expect(SKILL).toMatch(/\/vs-roast-code/);
    expect(SKILL).toMatch(/typo.*version bump.*config|does not need an explainer/is);
  });

  it('requires reading beyond the diff before explaining', () => {
    expect(SKILL).toMatch(/callers and callees/i);
    expect(SKILL).toMatch(/single core idea/i);
    expect(SKILL).toMatch(/Mark inference as inference/i);
  });
});

describe('vs-explain-diff document spine', () => {
  it('keeps the four ordered sections with two background layers', () => {
    const spine = ['Background', 'Intuition', 'Code', 'Self-check'];
    for (const section of spine) {
      expect(SKILL).toContain(`**${section}**`);
    }
    expect(SKILL).toMatch(/marked skippable/i);
    expect(SKILL).toMatch(/small invented values/i);
    expect(SKILL).toMatch(/grouped by idea, not by file/i);
  });

  it('reuses a small set of diagram families instead of inventing per section', () => {
    expect(SKILL).toMatch(/two or three diagram families/i);
    expect(SKILL).toMatch(/example values/i);
    expect(SKILL).toMatch(/Reuse beats novelty/i);
  });
});

describe('vs-explain-diff self-check questions', () => {
  it('specifies five derivable, non-gotcha questions with revealed answers', () => {
    expect(SKILL).toMatch(/[Ff]ive questions/);
    expect(SKILL).toMatch(/not gotchas/i);
    expect(SKILL).toMatch(/derivable from the explainer plus the diff/i);
    expect(SKILL).toMatch(/reveals, not inline text/i);
  });

  it('does not promise scoring the runtime cannot do', () => {
    expect(SKILL).toMatch(/AccordionTrigger/);
    expect(SKILL).toMatch(/AccordionContent/);
    expect(SKILL).toMatch(/no scored quiz component|not grading/i);
    expect(SKILL).not.toMatch(/\bscore(s|d)? the reader\b/i);
  });
});

describe('vs-explain-diff rendering', () => {
  it('delegates the artifact to vs-htmdx with a dated path outside the repo', () => {
    expect(SKILL).toMatch(/\.\.\/vs-htmdx\/SKILL\.md/);
    expect(SKILL).toContain('~/.vs/$PROJECT_ID/explanations/YYYY-MM-DD-<change-slug>.html');
    expect(SKILL).toMatch(/\.\.\/vs-internal-shared\/SKILL\.md/);
    expect(SKILL).toMatch(/numeric suffix rather than overwriting/i);
    expect(SKILL).toMatch(/not produce a Markdown twin/i);
  });

  it('is registered in the Claude plugin manifest and the README skill table', () => {
    const manifest = fs.readFileSync(path.join(ROOT, '.claude-plugin', 'plugin.json'), 'utf8');
    const readme = fs.readFileSync(path.join(ROOT, 'README.md'), 'utf8');

    expect(JSON.parse(manifest).skills).toContain('./skills/vs-explain-diff');
    expect(readme).toMatch(/\| `\/vs-explain-diff` \|/);
  });

  it('has a self-check authoring pattern to render against', () => {
    expect(SKILL).toMatch(/## Step 5: Write self-check questions/);
    expect(SKILL).toMatch(
      /Render each as one `AccordionItem`: the question in `AccordionTrigger`, the\s+answer and reasoning in `AccordionContent`/,
    );
    expect(SKILL).toMatch(
      /no scored\s+quiz component, so this is reveal-on-click, not grading/,
    );
  });
});
