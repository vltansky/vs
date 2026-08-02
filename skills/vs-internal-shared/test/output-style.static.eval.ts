import * as fs from 'fs';
import * as path from 'path';
import { describe, expect, it } from 'vitest';

const SKILLS_DIR = path.resolve(__dirname, '..', '..');
const REFERENCES_DIR = path.resolve(__dirname, '..', 'references');
const CONTRACT_PATH = path.join(REFERENCES_DIR, 'output-style.md');

const CONTRACT = fs.readFileSync(CONTRACT_PATH, 'utf8');
const SHARED_SKILL = fs.readFileSync(
  path.resolve(__dirname, '..', 'SKILL.md'),
  'utf8',
);
const COMMUNICATION = fs.readFileSync(
  path.join(REFERENCES_DIR, 'communication.md'),
  'utf8',
);

function markdownFiles(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory() && entry.name === 'pathgrade-debug') return [];
    if (entry.isDirectory()) return markdownFiles(full);
    return entry.isFile() && entry.name.endsWith('.md') ? [full] : [];
  });
}

// The contract quotes the banned phrases in order to ban them, and any line
// that names a phrase as forbidden is teaching, not violating.
const TEACHING_LINE =
  /\b(bad|forbidden|never|not|avoid|instead of|rather than|delete|no)\b/i;

const BANNED_CLOSERS =
  /hope (this|that) helps|let me know if|feel free to (ask|reach)|anything else\?|happy to (clarify|help)/i;

const BANNED_IDIOMS =
  /circle back|get the ball rolling|on the same page|low-hanging fruit|under the hood/i;

describe('output style contract', () => {
  it('leads with the answer and keeps required actions together', () => {
    expect(CONTRACT).toMatch(
      /first line is the answer: the outcome, decision, or blocker/i,
    );
    expect(CONTRACT).toMatch(
      /everything the user must do now appears in one optional `Your action`\s+section/i,
    );
    expect(CONTRACT).toMatch(/nothing required appears outside it/i);
    expect(CONTRACT).toMatch(
      /Never\s+repeat a `Your action` item under `Still unverified`/i,
    );
    expect(CONTRACT).toMatch(
      /conditional rollback.*belongs\s+in `Your action`/is,
    );
  });

  it('uses quiet optional sections without decorative chrome', () => {
    for (const section of ['Your action', 'Verified', 'Still unverified']) {
      expect(CONTRACT, `section ${section}`).toContain(section);
    }
    expect(CONTRACT).toMatch(/omitting every section that is empty/i);
    expect(CONTRACT).toMatch(/plain bold Markdown labels/i);
    expect(CONTRACT).toMatch(/Do not add dividers, item counts, gutter\s+symbols/i);
    expect(CONTRACT).not.toContain('━━━');
    expect(CONTRACT).not.toContain('▶');
  });

  it('keeps formatting portable and compact', () => {
    expect(CONTRACT).toMatch(/Never draw a box, a right border/i);
    expect(CONTRACT).toMatch(/Skip sections entirely for messages under four lines/i);
    expect(CONTRACT).toMatch(/at most three bullets/i);
    expect(CONTRACT).toMatch(
      /Do not show a wall-clock estimate unless the\s+user explicitly asks/i,
    );
    expect(CONTRACT).not.toMatch(/About \d+ minutes|items · ~\d+[mhd]/i);
  });

  it('survives an HTML markdown renderer, not only a terminal', () => {
    expect(CONTRACT).toMatch(/Section bodies are markdown lists/i);
    expect(CONTRACT).toMatch(/HTML collapses a run of spaces to one/i);
    expect(CONTRACT).toMatch(
      /single newline is a soft break, so\s+consecutive bare lines can join/i,
    );
    expect(CONTRACT).toMatch(/Lists and bold labels\s+survive both/i);
  });

  it('forbids host detection and routes host branching to capability', () => {
    expect(CONTRACT).toMatch(/Do not\s+probe the host to choose formatting/i);
    expect(CONTRACT).toMatch(/branch on capability instead/i);
    expect(CONTRACT).toMatch(/`request_user_input` is listed/);
  });

  it('constrains procedural sentences without flattening rationale', () => {
    expect(CONTRACT).toMatch(/One action per sentence, imperative/i);
    expect(CONTRACT).toMatch(/Keep the article/i);
    expect(CONTRACT).toMatch(/under 20 words/i);
    expect(CONTRACT).toMatch(/warning before the step/i);
    expect(CONTRACT).toMatch(/Use "must" for a required check/i);
    expect(CONTRACT).toMatch(
      /They do not\s+apply to rationale, decisions, or trade-off prose/i,
    );
  });

  it('exempts decisions from the list cap', () => {
    expect(CONTRACT).toMatch(/the options are the answer/i);
    expect(CONTRACT).toMatch(
      /Do not compress a\s+decision into one path/i,
    );
  });

  it('bans preamble, recap, and closers by name', () => {
    expect(CONTRACT).toMatch(/No preamble, duplicate recap, or closers/i);
    expect(CONTRACT).toMatch(/Great\s+question/);
    expect(CONTRACT).toMatch(/Hope this helps/);
  });

  it('is reachable from the shared index and the communication contract', () => {
    expect(SHARED_SKILL).toContain('references/output-style.md');
    expect(SHARED_SKILL).toMatch(/applies to chat messages, not just workflow/i);
    expect(COMMUNICATION).toContain('output-style.md');
  });
});

describe('skill text obeys its own output style', () => {
  const files = markdownFiles(SKILLS_DIR).filter(
    (file) => file !== CONTRACT_PATH,
  );
  const userFacingSkillFiles = fs
    .readdirSync(SKILLS_DIR, { withFileTypes: true })
    .filter(
      (entry) =>
        entry.isDirectory() &&
        entry.name.startsWith('vs-') &&
        entry.name !== 'vs-internal-shared' &&
        fs.existsSync(path.join(SKILLS_DIR, entry.name, 'SKILL.md')),
    )
    .map((entry) => path.join(SKILLS_DIR, entry.name, 'SKILL.md'));

  it('finds skill markdown to check', () => {
    expect(files.length).toBeGreaterThan(30);
  });

  it('is directly reachable from every user-facing skill', () => {
    for (const file of userFacingSkillFiles) {
      expect(
        fs.readFileSync(file, 'utf8'),
        path.relative(SKILLS_DIR, file),
      ).toContain('vs-internal-shared/references/output-style.md');
    }
  });

  it('removes the old zone chrome from every user-facing skill', () => {
    for (const file of userFacingSkillFiles) {
      expect(
        fs.readFileSync(file, 'utf8'),
        path.relative(SKILLS_DIR, file),
      ).not.toMatch(/`YOU DO`|`NOT PROVEN`|━━━|▶/);
    }
  });

  it('has no closing pleasantries in authored templates', () => {
    for (const file of files) {
      const offenders = fs
        .readFileSync(file, 'utf8')
        .split('\n')
        .filter((line) => BANNED_CLOSERS.test(line) && !TEACHING_LINE.test(line));
      expect(offenders, path.relative(SKILLS_DIR, file)).toEqual([]);
    }
  });

  it('has no figurative idioms in authored templates', () => {
    for (const file of files) {
      const offenders = fs
        .readFileSync(file, 'utf8')
        .split('\n')
        .filter((line) => BANNED_IDIOMS.test(line) && !TEACHING_LINE.test(line));
      expect(offenders, path.relative(SKILLS_DIR, file)).toEqual([]);
    }
  });
});
