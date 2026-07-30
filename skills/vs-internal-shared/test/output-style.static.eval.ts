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
  it('puts every user action in one zone, first', () => {
    expect(CONTRACT).toMatch(
      /everything the user must do appears in one\s+zone, first/i,
    );
    expect(CONTRACT).toMatch(/nothing actionable appears outside it/i);
    expect(CONTRACT).toMatch(
      /blocker that the user must clear is an action: it goes in `YOU DO`/i,
    );
    expect(CONTRACT).toMatch(
      /Never\s+repeat a `YOU DO` action as a `NOT PROVEN` item/i,
    );
  });

  it('defines the three zones with their fixed gutters', () => {
    for (const zone of ['YOU DO', 'DONE', 'NOT PROVEN']) {
      expect(CONTRACT, `zone ${zone}`).toContain(zone);
    }
    expect(CONTRACT).toMatch(/Unicode `▶` means you\s+act/);
    expect(CONTRACT).toMatch(
      /ASCII `!` marks an\s+unproven or blocked claim/,
    );
    expect(CONTRACT).toMatch(/No emoji/);
  });

  it('keeps dividers portable and cheap rather than full-width', () => {
    expect(CONTRACT).toMatch(
      /fixed three-character `━━━` lead.*left-anchored and never padded/is,
    );
    expect(CONTRACT).toMatch(/Never draw a box, a right border/i);
    expect(CONTRACT).toMatch(/cannot reliably count columns/i);
    expect(CONTRACT).toMatch(/full-width `━` run costs 20 to 30 tokens/i);
    expect(CONTRACT).toMatch(/under roughly 15 tokens per message/i);
    expect(CONTRACT).toMatch(/Skip zones entirely for messages under four lines/i);
  });

  it('survives an HTML markdown renderer, not only a terminal', () => {
    expect(CONTRACT).toMatch(/Zone bodies are markdown lists/i);
    expect(CONTRACT).toMatch(/HTML collapses a run of spaces to one/i);
    expect(CONTRACT).toMatch(
      /single newline is a soft break, so\s+consecutive bare lines can join/i,
    );
    expect(CONTRACT).toMatch(/Lists and bold labels\s+survive both/i);
  });

  it('forbids host detection and routes host branching to capability', () => {
    expect(CONTRACT).toMatch(/Do not detect the host/i);
    expect(CONTRACT).toMatch(
      /Do not shell out for `CLAUDE_CODE_ENTRYPOINT`, `TERM_PROGRAM`/i,
    );
    expect(CONTRACT).toMatch(/branch on capability instead/i);
    expect(CONTRACT).toMatch(/`request_user_input` is listed/);
  });

  it('constrains procedural sentences without flattening rationale', () => {
    expect(CONTRACT).toMatch(/One action per sentence, imperative/i);
    expect(CONTRACT).toMatch(/Keep the article/i);
    expect(CONTRACT).toMatch(/Under 20 words per step/i);
    expect(CONTRACT).toMatch(/warning comes before the step/i);
    expect(CONTRACT).toMatch(/Use "must" for a required check/i);
    expect(CONTRACT).toMatch(
      /They do not\s+apply to rationale, decisions, or trade-off prose/i,
    );
  });

  it('exempts decisions from the list cap', () => {
    expect(CONTRACT).toMatch(/the options are the answer/i);
    expect(CONTRACT).toMatch(
      /Do not compress a\s+decision into a single recommended path/i,
    );
  });

  it('bans preamble, recap, and closers by name', () => {
    expect(CONTRACT).toMatch(/No preamble, no recap, no closers/i);
    expect(CONTRACT).toMatch(/Great question/);
    expect(CONTRACT).toMatch(/Hope this\s+helps/);
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
        entry.name !== 'vs-internal-shared',
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
