import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { describe, expect, it } from 'vitest';

const PLAYBOOK = fs.readFileSync(
  path.resolve(__dirname, '..', 'references', 'review-playbook.md'),
  'utf8',
);

function run(cmd: string, cwd: string) {
  return spawnSync('bash', ['-lc', cmd], {
    cwd,
    encoding: 'utf8',
    env: {
      ...process.env,
      GIT_AUTHOR_NAME: 't',
      GIT_AUTHOR_EMAIL: 't@t.com',
      GIT_COMMITTER_NAME: 't',
      GIT_COMMITTER_EMAIL: 't@t.com',
    },
  });
}

/** Extract the co-change pipeline from the playbook fence (git-log | while read …). */
function playbookCoChangePipeline(pathA: string): string {
  const fence = PLAYBOOK.match(/```bash\n([\s\S]*?)```/);
  if (!fence) throw new Error('no bash fence in playbook');
  const body = fence[1];
  const commands = body
    .split('\n')
    .filter((line) => line.trim() && !line.trimStart().startsWith('#'))
    .join('\n');
  expect(commands).toMatch(/git log[^\n]*--format=%H/);
  expect(commands).not.toMatch(/--pretty=format:%H/);
  const pipeline = commands.match(
    /git log[^\n]*--format=%H[^\n]*\|[\s\S]*?sort -rn \| head/,
  );
  if (!pipeline) throw new Error('co-change pipeline not found in playbook');
  return pipeline[0]
    .replace(/path\/A/g, pathA)
    .replace(/--since='6 months ago'\s+/g, '');
}

describe('vs-architect co-change recipe is executable', () => {
  it('counts the single shared commit when A and B change together', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'vs-cochange-'));
    try {
      expect(run('git init -q', root).status).toBe(0);
      fs.writeFileSync(path.join(root, 'pathA'), 'a\n');
      fs.writeFileSync(path.join(root, 'pathB'), 'b\n');
      expect(run('git add pathA pathB && git commit -qm both', root).status).toBe(
        0,
      );

      const pipeline = playbookCoChangePipeline('pathA');
      const result = run(pipeline, root);
      expect(result.status).toBe(0);
      expect(result.stderr).toBe('');
      // uniq -c pads the count; require pathB once from that one commit
      expect(result.stdout).toMatch(/^\s*1\s+pathB$/m);
      expect(result.stdout).toMatch(/^\s*1\s+pathA$/m);

      // Regression: --pretty=format:%H / format=format:%H leave the final hash
      // unterminated, so while-read drops the only commit.
      const broken = run(
        `git log --pretty=format:%H -- pathA | while read c; do git diff-tree --no-commit-id --name-only -r "$c"; done | sort | uniq -c`,
        root,
      );
      expect(broken.stdout.trim()).toBe('');
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });
});
