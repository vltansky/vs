import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { spawnSync } from 'child_process';
import { afterEach, describe, expect, it } from 'vitest';

const DIR = path.resolve(__dirname, '..');
const RENDERER = path.join(DIR, 'scripts', 'render-walkthrough.mjs');
const temporary: string[] = [];

function pair(pathName: string, pseudocode: string) {
  return { path: pathName, pseudocode };
}

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
        pseudocode: 'IF attempts >= limit THEN\n  mark terminal\nELSE\n  enqueue retry',
        watch: ['Three attempts is part of the API contract.'],
        files: [pair('src/policy.ts', 'SET attempts = 3\nKEEP terminal flag')],
      },
      {
        id: 'verification',
        title: 'Step 2 · The screen proves it',
        lede: 'The test verifies the surfaced state.',
        pseudocode: 'WHEN banner mounts\n  ASSERT attempts shown',
        files: [pair('src/screen.spec.ts', 'DESCRIBE screen\n  ASSERT mounts')],
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
  it('renders section spine, pair-file cards, and collapsed real-diff controls (not always-open hunk panels)', () => {
    const files = fixture();
    const result = render(files);
    expect(result.status, result.stderr).toBe(0);
    const html = fs.readFileSync(files.outPath, 'utf8');
    expect(html.indexOf('Step 1 · The retry rule')).toBeLessThan(html.indexOf('Step 2 · The screen proves it'));
    expect(html).toContain('&lt;img src=x onerror=alert(1)&gt; Retry flow');
    expect(html).not.toContain('<img src=x onerror=alert(1)>');
    expect(html).toContain('vs-pr-walkthrough:https://github.com/owner/repo/pull/123@0123456789abcdef0123456789abcdef01234567');
    expect(html).toContain('https://github.com/owner/repo/pull/123');
    expect(html).toMatch(/https:\/\/github\.com\/owner\/repo\/commit\/0123456789abcdef0123456789abcdef01234567/);
    expect(html).toContain('class="section-viewed"');
    expect(html).toMatch(/class="pseudocode"/);

    // Pair-file cards in reading order with blob links and pair pseudocode.
    expect(html).toMatch(/class="file-card"/);
    expect(html).toContain('SET attempts = 3');
    expect(html).toContain('DESCRIBE screen');
    const policyBlob = 'https://github.com/owner/repo/blob/0123456789abcdef0123456789abcdef01234567/src/policy.ts';
    const specBlob = 'https://github.com/owner/repo/blob/0123456789abcdef0123456789abcdef01234567/src/screen.spec.ts';
    expect(html).toContain(policyBlob);
    expect(html).toContain(specBlob);
    expect(html.indexOf(policyBlob)).toBeLessThan(html.indexOf(specBlob));

    // Real hunks present behind collapsed expand control (details without open, or equivalent).
    expect(html).toMatch(/<(details|button)[^>]*(class="[^"]*real-diff|Show real diff)/i);
    expect(html).toMatch(/Show real diff/i);
    expect(html).toMatch(/table class="diff"|class="diff"/);
    expect(html).toMatch(/class="line add"/);
    expect(html).toMatch(/class="line del"/);
    expect(html).toContain('export const attempts = 3;');
    // Default surface is collapsed — no open attribute on real-diff details.
    expect(html).not.toMatch(/<details[^>]*class="[^"]*real-diff[^"]*"[^>]*\sopen[\s>]/i);
    expect(html).not.toMatch(/<details[^>]*\sopen[^>]*class="[^"]*real-diff/i);
  });

  it('uses a single-column walkthrough UI with sections and progress', () => {
    const files = fixture();
    const result = render(files);
    expect(result.status, result.stderr).toBe(0);
    const html = fs.readFileSync(files.outPath, 'utf8');
    expect(html).toContain('class="wrap"');
    expect(html).toContain('class="progressbar"');
    expect(html).toContain('id="ringFill"');
    expect(html).toContain('class="hint"');
    expect(html).toContain('class="toc"');
    expect(html).toContain('class="sec-count"');
  });

  it('preserves rich prose, labels, and watch escaping with pair cards', () => {
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
          pseudocode: 'IF attempts >= limit THEN\n  mark terminal\nELSE\n  enqueue retry',
          watch: ['Keep <em>terminal</em> behavior explicit.', '<strong onclick="bad()">unsafe</strong>'],
          notes: [{ file: 'src/policy.ts', text: 'Read this <b>first</b>.' }],
          files: [pair('src/policy.ts', 'SET attempts = 3')],
        },
        {
          id: 'verification',
          title: 'Step 2 · The screen proves it',
          lede: 'The test verifies the surfaced state.',
          pseudocode: 'WHEN banner mounts\n  ASSERT attempts shown',
          files: [pair('src/screen.spec.ts', 'ASSERT mounts')],
        },
      ],
    });
    const result = renderOriginalCli(files);
    expect(result.status, result.stderr).toBe(0);
    const html = fs.readFileSync(files.outPath, 'utf8');
    expect(html).toContain('Retry PR #123');
    expect(html).toContain('RETRY-123');
    expect(html).toContain('The <code>attempts</code> value');
    expect(html).toContain('&lt;strong onclick=&quot;bad()&quot;&gt;unsafe');
    expect(html).toMatch(/class="pseudocode"/);
    expect(html).toMatch(/class="file-card"/);
    expect(html).toMatch(/Show real diff/i);
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
      sections: [{
        id: 'policy',
        title: 'Step 1 · Policy',
        lede: 'The rule.',
        pseudocode: 'apply policy',
        files: [pair('src/policy.ts', 'apply policy in file')],
      }],
    });
    const result = render(files);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('missing changed files: src/screen.spec.ts');
    expect(fs.existsSync(files.outPath)).toBe(false);
  });

  it('fails on duplicate and stale paths with object file entries', () => {
    const files = fixture({
      sections: [
        {
          id: 'one',
          title: 'Step 1 · One',
          lede: 'One.',
          pseudocode: 'step one',
          files: [pair('src/policy.ts', 'one'), pair('missing.ts', 'missing')],
        },
        {
          id: 'two',
          title: 'Step 2 · Two',
          lede: 'Two.',
          pseudocode: 'step two',
          files: [pair('src/policy.ts', 'dup'), pair('src/screen.spec.ts', 'spec')],
        },
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
          pseudocode: 'step one',
          notes: [{ file: 'policy.ts', text: 'Ambiguous basename.' }],
          files: [pair('src/policy.ts', 'policy file')],
        },
        {
          id: 'two',
          title: 'Step 2 · Two',
          lede: 'Two.',
          pseudocode: 'step two',
          files: [pair('src/screen.spec.ts', 'spec file')],
        },
      ],
    });
    const result = render(files);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('note paths must exactly match a file in their section: policy.ts');
  });

  it('renders per-section spine and per-file pair pseudocode', () => {
    const files = fixture();
    const result = render(files);
    expect(result.status, result.stderr).toBe(0);
    const html = fs.readFileSync(files.outPath, 'utf8');
    expect(html).toMatch(/class="pseudocode"/);
    expect(html).toContain('IF attempts &gt;= limit THEN');
    expect(html).toContain('mark terminal');
    expect(html).toContain('SET attempts = 3');
    expect(html).toMatch(/class="file-card"[^>]*data-path="src\/policy\.ts"|data-path="src\/policy\.ts"/);
  });

  it('rejects section pseudocode longer than about 12 lines', () => {
    const long = Array.from({ length: 13 }, (_, i) => `step ${i + 1}`).join('\n');
    const files = fixture({
      sections: [
        {
          id: 'policy',
          title: 'Step 1 · Policy',
          lede: 'Rule.',
          pseudocode: long,
          files: [pair('src/policy.ts', 'short')],
        },
        {
          id: 'verification',
          title: 'Step 2 · Proof',
          lede: 'Proof.',
          pseudocode: 'assert shown',
          files: [pair('src/screen.spec.ts', 'short')],
        },
      ],
    });
    const result = render(files);
    expect(result.status).toBe(1);
    expect(result.stderr).toMatch(/pseudocode.*12|12.*lines/i);
  });

  it('rejects pair-file pseudocode longer than about 12 lines', () => {
    const long = Array.from({ length: 13 }, (_, i) => `file step ${i + 1}`).join('\n');
    const files = fixture({
      sections: [
        {
          id: 'policy',
          title: 'Step 1 · Policy',
          lede: 'Rule.',
          pseudocode: 'apply policy',
          files: [pair('src/policy.ts', long)],
        },
        {
          id: 'verification',
          title: 'Step 2 · Proof',
          lede: 'Proof.',
          pseudocode: 'assert shown',
          files: [pair('src/screen.spec.ts', 'short')],
        },
      ],
    });
    const result = render(files);
    expect(result.status).toBe(1);
    expect(result.stderr).toMatch(/pseudocode.*12|12.*lines|pair.*pseudocode/i);
  });

  it('requires per-section pseudocode', () => {
    const files = fixture({
      sections: [
        {
          id: 'policy',
          title: 'Step 1 · Policy',
          lede: 'Rule.',
          files: [pair('src/policy.ts', 'file spine')],
        },
        {
          id: 'verification',
          title: 'Step 2 · Proof',
          lede: 'Proof.',
          pseudocode: 'assert shown',
          files: [pair('src/screen.spec.ts', 'spec')],
        },
      ],
    });
    const result = render(files);
    expect(result.status).toBe(1);
    expect(result.stderr).toMatch(/pseudocode/i);
  });

  it('fail-closed requires pair-file pseudocode when a diff is present (legacy string paths)', () => {
    const files = fixture({
      sections: [
        {
          id: 'policy',
          title: 'Step 1 · Policy',
          lede: 'Rule.',
          pseudocode: 'apply policy',
          files: ['src/policy.ts'],
        },
        {
          id: 'verification',
          title: 'Step 2 · Proof',
          lede: 'Proof.',
          pseudocode: 'assert shown',
          files: ['src/screen.spec.ts'],
        },
      ],
    });
    const result = render(files);
    expect(result.status).toBe(1);
    expect(result.stderr).toMatch(/pair.*pseudocode|file.*pseudocode|pseudocode.*required/i);
    expect(fs.existsSync(files.outPath)).toBe(false);
  });

  it('does not use always-visible pre-#64 file panels as the default surface', () => {
    const files = fixture();
    const result = render(files);
    expect(result.status, result.stderr).toBe(0);
    const html = fs.readFileSync(files.outPath, 'utf8');
    // Hunks exist only behind expand; no always-open article.file with visible body as the primary surface.
    expect(html).toMatch(/Show real diff/i);
    expect(html).toMatch(/<(details)[^>]*class="[^"]*real-diff/i);
    // Pre-#64 always-open pattern: article.file without collapsed and without wrapping details — reject that as default.
    expect(html).not.toMatch(/<article class="file(?![-])[^"]*"[^>]*(?<!collapsed)>\s*<div class="file-head">/i);
  });
});
