import * as fs from 'node:fs';
import * as path from 'node:path';
import { describe, expect, it } from 'vitest';

// No vs skill, shared doc, script, hook, or agent file may rename the host chat/thread
// (for example a `[babysit] ` / `[ready] ` prefix via `set_thread_title`). PR titles are fine.
// `problems(files)` returns each offending file:line; the repo returns none, mutants some.

const ROOT = path.resolve(__dirname, '..', '..', '..');
const SCAN_DIRS = ['skills', 'hooks', 'commands', 'agents', '.claude-plugin', '.codex-plugin', '.cursor-plugin'];
const SCAN_FILES = ['README.md', 'CONTEXT.md', 'AGENTS.md', 'CLAUDE.md'];
const EXT = /\.(?:md|mdx|mjs|js|ts|mts|py|sh|json|ya?ml|toml)$/;
const SELF = path.relative(ROOT, __filename);

function walk(dir: string, out: string[]) {
  if (!fs.existsSync(dir)) return;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name === 'node_modules' || e.name === 'vendor' || e.name === 'dist') continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (EXT.test(e.name)) out.push(p);
  }
}

function collect(): Record<string, string> {
  const files: string[] = [];
  for (const d of SCAN_DIRS) walk(path.join(ROOT, d), files);
  for (const f of SCAN_FILES) if (fs.existsSync(path.join(ROOT, f))) files.push(path.join(ROOT, f));
  const out: Record<string, string> = {};
  for (const f of files) {
    const rel = path.relative(ROOT, f);
    if (rel !== SELF) out[rel] = fs.readFileSync(f, 'utf8');
  }
  return out;
}

const RENAME = [
  /set_thread_title|setThreadTitle|rename_thread|renameThread/i,
  /\b(?:rename|retitle|re-title)\b[^\n.]{0,40}\b(?:thread|chat|conversation|session|tab)\b/i,
  /\b(?:thread|chat|conversation|session)\s+(?:title|name)\b/i,
  /`\[(?:babysit|ready|shipping|building|watching)\]\s?`|\[(?:babysit|ready)\] /i,
];
const PR_TITLE = /\bPR\b[^\n]{0,20}\btitle\b|--title|gh pr/i;

function problems(files: Record<string, string>): string[] {
  const out: string[] = [];
  for (const [rel, text] of Object.entries(files)) {
    text.split('\n').forEach((line, n) => {
      // A negative assertion (`.not.toMatch(...)`) guards the rule; it is not an instruction.
      if (/\.not\.to/.test(line)) return;
      if (RENAME.some((re) => re.test(line)) && !(PR_TITLE.test(line) && !/thread|chat|conversation|session/i.test(line)))
        out.push(`${rel}:${n + 1}: ${line.trim().slice(0, 100)}`);
    });
  }
  return out;
}

const FILES = collect();
const BABY = 'skills/vs-baby-sit/SKILL.md';

const mutants: Record<string, (f: Record<string, string>) => Record<string, string>> = {
  'set_thread_title restored': (f) => ({ ...f, [BABY]: f[BABY] + '\nIn Codex, use `set_thread_title` to mark the thread.\n' }),
  'babysit prefix restored': (f) => ({ ...f, [BABY]: f[BABY] + '\nAt startup, prefix the title with `[babysit] `.\n' }),
  'ready prefix restored': (f) => ({ ...f, [BABY]: f[BABY] + '\nWhen merge-ready, retitle to [ready] Fix upload timeout.\n' }),
  'rename the chat in another skill': (f) => ({ ...f, 'skills/vs-ship-it/SKILL.md': f['skills/vs-ship-it/SKILL.md'] + '\nRename the current chat to the PR number.\n' }),
  'thread title in a script': (f) => ({ ...f, 'skills/vs-baby-sit/scripts/watch_pr.py': (f['skills/vs-baby-sit/scripts/watch_pr.py'] ?? '') + '\n# update the thread title on ready\n' }),
  'shared doc renames the session': (f) => ({ ...f, 'README.md': (f['README.md'] ?? '') + '\nSkills rename the session tab while they run.\n' }),
};

describe('no skill renames the host thread', () => {
  it('scans the skill tree', () => {
    expect(Object.keys(FILES)).toContain(BABY);
    expect(Object.keys(FILES).length).toBeGreaterThan(50);
  });
  it('the repo has no thread-rename instruction or helper', () => {
    expect(problems(FILES)).toEqual([]);
  });
  it('PR title instructions stay allowed', () => {
    expect(problems({ 'x.md': 'Pass the PR title with `--title "<PR title>"` to the gate.\n' })).toEqual([]);
  });
  it.each(Object.entries(mutants))('mutant "%s" is caught', (_n, mutate) => {
    expect(problems(mutate(FILES)).length).toBeGreaterThan(0);
  });
});
