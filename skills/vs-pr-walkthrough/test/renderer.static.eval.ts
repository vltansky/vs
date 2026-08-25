import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { spawnSync } from 'child_process';
import { afterEach, describe, expect, it } from 'vitest';

const DIR = path.resolve(__dirname, '..');
const RENDERER = path.join(DIR, 'scripts', 'render-walkthrough.mjs');
const temporary: string[] = [];

function fixture(configOverride: Record<string, unknown> = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'vs-walkthrough-'));
  temporary.push(root);
  const diff = `diff --git a/src/policy.ts b/src/policy.ts
index 1111111..2222222 100644
--- a/src/policy.ts
+++ b/src/policy.ts
@@ -1,2 +1,2 @@
-export const attempts = 2;
+export const attempts = 3;
 export const terminal = true;
diff --git a/src/screen.spec.ts b/src/screen.spec.ts
new file mode 100644
--- /dev/null
+++ b/src/screen.spec.ts
@@ -0,0 +1,2 @@
+describe('screen', () => {
+});
`;
  const config = {
    pr: 'https://github.com/owner/repo/pull/123',
    headSha: '0123456789abcdef0123456789abcdef01234567',
    title: '<img src=x onerror=alert(1)> Retry flow',
    intro: 'Read this as policy → verification.',
    sections: [
      {
        id: 'policy',
        title: 'Step 1 · The retry rule',
        lede: 'This rule shapes the UI.',
        watch: ['Three attempts is part of the API contract.'],
        files: ['src/policy.ts'],
      },
      {
        id: 'verification',
        title: 'Step 2 · The screen proves it',
        lede: 'The test verifies the surfaced state.',
        files: ['src/screen.spec.ts'],
      },
    ],
    ...configOverride,
  };
  const configPath = path.join(root, 'config.json');
  const diffPath = path.join(root, 'pr.diff');
  const outPath = path.join(root, 'walkthrough.html');
  fs.writeFileSync(configPath, JSON.stringify(config));
  fs.writeFileSync(diffPath, diff);
  return { root, configPath, diffPath, outPath };
}

function render(files: ReturnType<typeof fixture>) {
  return spawnSync(process.execPath, [RENDERER, '--config', files.configPath, '--diff', files.diffPath, '--out', files.outPath], {
    encoding: 'utf8',
  });
}

function renderOriginalCli(files: ReturnType<typeof fixture>, includeOut = true) {
  const argv = [RENDERER, files.configPath, '--diff', files.diffPath];
  if (includeOut) argv.push('--out', files.outPath);
  return spawnSync(process.execPath, argv, { encoding: 'utf8' });
}

afterEach(() => {
  for (const directory of temporary.splice(0)) fs.rmSync(directory, { recursive: true, force: true });
});

describe('walkthrough renderer', () => {
  it('renders the complete diff in story order with escaped content and exact-head progress', () => {
    const files = fixture();
    const result = render(files);
    expect(result.status, result.stderr).toBe(0);
    const html = fs.readFileSync(files.outPath, 'utf8');
    expect(html.indexOf('Step 1 · The retry rule')).toBeLessThan(html.indexOf('Step 2 · The screen proves it'));
    expect(html).toContain('&lt;img src=x onerror=alert(1)&gt; Retry flow');
    expect(html).not.toContain('<img src=x onerror=alert(1)>');
    expect(html).toContain('vs-pr-walkthrough:https://github.com/owner/repo/pull/123@0123456789abcdef0123456789abcdef01234567');
    expect(html).toContain('class="file-viewed"');
    expect(html).toContain('class="section-viewed"');
    expect(html).toContain('diff-');
    expect(html).toContain('/files#');
    expect(html.replace(/<[^>]+>/g, '')).toContain('export const attempts = 3;');
  });

  it('uses the original GitHub-native single-column review UI', () => {
    const files = fixture();
    const result = render(files);
    expect(result.status, result.stderr).toBe(0);
    const html = fs.readFileSync(files.outPath, 'utf8');
    expect(html).toContain('class="wrap"');
    expect(html).toContain('class="progressbar"');
    expect(html).toContain('id="ringFill"');
    expect(html).toContain('class="hint"');
    expect(html).toContain('id="collapseNoise"');
    expect(html).toContain('class="toc"');
    expect(html).toContain('class="sec-count"');
    expect(html).toContain('top:var(--topbar)');
  });

  it('preserves Oren feature parity for rich prose, notes, path shortening, folding, labels, and highlighting', () => {
    const files = fixture({
      subtitle: 'RETRY-123',
      pr_label: 'Retry PR #123',
      path_prefix: 'src/',
      fold: 'policy\\.ts$',
      intro: 'Read <strong>policy</strong>, then <code>proof</code>.',
      sections: [
        {
          id: 'policy',
          title: 'Step 1 · The retry rule',
          lede: 'The <code>attempts</code> value shapes the UI.',
          watch: ['Keep <em>terminal</em> behavior explicit.', '<strong onclick="bad()">unsafe</strong>'],
          notes: [{ file: 'src/policy.ts', text: 'Read this <b>first</b>.' }],
          files: ['src/policy.ts'],
        },
        {
          id: 'verification',
          title: 'Step 2 · The screen proves it',
          lede: 'The test verifies the surfaced state.',
          files: ['src/screen.spec.ts'],
        },
      ],
    });
    const result = renderOriginalCli(files);
    expect(result.status, result.stderr).toBe(0);
    const html = fs.readFileSync(files.outPath, 'utf8');
    expect(html).toContain('Retry PR #123');
    expect(html).toContain('RETRY-123');
    expect(html).toContain('class="fname">policy.ts</strong>');
    expect(html).toContain('<div class="note">Read this <b>first</b>.</div>');
    expect(html).toContain('The <code>attempts</code> value');
    expect(html).toContain('<span class="tk-k">export</span>');
    expect(html).toContain('&lt;strong onclick=&quot;bad()&quot;&gt;unsafe');
    expect(html).toMatch(/class="file collapsed" data-path="src\/policy\.ts"/);
  });

  it('supports the original positional CLI and default output path', () => {
    const files = fixture();
    const defaultOut = files.configPath.replace(/\.json$/, '.html');
    const result = renderOriginalCli(files, false);
    expect(result.status, result.stderr).toBe(0);
    expect(fs.existsSync(defaultOut)).toBe(true);
  });

  it('preserves renderer-side diff fetching but verifies the exact PR head first', () => {
    const files = fixture();
    const bin = path.join(files.root, 'bin');
    fs.mkdirSync(bin);
    const gh = path.join(bin, 'gh');
    fs.writeFileSync(gh, `#!/bin/sh
case "$*" in
  *"pr view"*) printf '%s\\n' '0123456789abcdef0123456789abcdef01234567' ;;
  *"pr diff"*) /bin/cat "$FAKE_DIFF" ;;
esac
`);
    fs.chmodSync(gh, 0o755);
    const result = spawnSync(process.execPath, [RENDERER, files.configPath, '--out', files.outPath], {
      encoding: 'utf8',
      env: { ...process.env, PATH: `${bin}:${process.env.PATH}`, FAKE_DIFF: files.diffPath },
    });
    expect(result.status, result.stderr).toBe(0);
    expect(fs.existsSync(files.outPath)).toBe(true);

    const config = JSON.parse(fs.readFileSync(files.configPath, 'utf8'));
    config.headSha = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
    fs.writeFileSync(files.configPath, JSON.stringify(config));
    const stale = spawnSync(process.execPath, [RENDERER, files.configPath, '--out', files.outPath], {
      encoding: 'utf8',
      env: { ...process.env, PATH: `${bin}:${process.env.PATH}`, FAKE_DIFF: files.diffPath },
    });
    expect(stale.status).toBe(1);
    expect(stale.stderr).toContain('PR head moved');
  });

  it('fails when a changed file is not placed', () => {
    const files = fixture({
      sections: [{ id: 'policy', title: 'Step 1 · Policy', lede: 'The rule.', files: ['src/policy.ts'] }],
    });
    const result = render(files);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('missing changed files: src/screen.spec.ts');
    expect(fs.existsSync(files.outPath)).toBe(false);
  });

  it('fails on duplicate and stale paths', () => {
    const files = fixture({
      sections: [
        { id: 'one', title: 'Step 1 · One', lede: 'One.', files: ['src/policy.ts', 'missing.ts'] },
        { id: 'two', title: 'Step 2 · Two', lede: 'Two.', files: ['src/policy.ts', 'src/screen.spec.ts'] },
      ],
    });
    const result = render(files);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('files listed more than once: src/policy.ts');
    expect(result.stderr).toContain('listed files absent from diff: missing.ts');
  });

  it('requires per-file notes to use an exact path in their own section', () => {
    const files = fixture({
      sections: [
        {
          id: 'one',
          title: 'Step 1 · One',
          lede: 'One.',
          notes: [{ file: 'policy.ts', text: 'Ambiguous basename.' }],
          files: ['src/policy.ts'],
        },
        { id: 'two', title: 'Step 2 · Two', lede: 'Two.', files: ['src/screen.spec.ts'] },
      ],
    });
    const result = render(files);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('note paths must exactly match a file in their section: policy.ts');
  });
});
