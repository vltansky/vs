import { spawnSync } from 'node:child_process';
import { closeSync, existsSync, mkdtempSync, mkdirSync, openSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { it, expect } from 'vitest';

it('reports discovery and measurement before blocking commands without mixing progress into the result', () => {
  const root = mkdtempSync(join(tmpdir(), 'vs-disk-scan-'));
  const home = join(root, 'home');
  const bin = join(root, 'bin');
  const progress = join(root, 'progress.log');
  mkdirSync(join(home, '.npm'), { recursive: true });
  mkdirSync(bin);
  const stub = (name: string, body: string) => writeFileSync(join(bin, name), `#!/bin/sh\n${body}\n`, { mode: 0o755 });
  // Snapshot stderr inside each subprocess: a final log alone cannot prove progress arrived before the wait.
  stub('find', 'cp "$PROGRESS_LOG" "$PROGRESS_AT_FIND"');
  stub('du', 'cp "$PROGRESS_LOG" "$PROGRESS_AT_DU"; printf "256000\\ttotal\\n"');
  stub('df', 'printf "Filesystem 1024-blocks Used Available Capacity Mounted\\nfixture 1000000 900000 100000 90%% /data\\n"');
  const fd = openSync(progress, 'w');
  try {
    const result = spawnSync(process.execPath, [resolve(__dirname, '../scripts/disk-report/scan.mts')], {
      cwd: root,
      env: { ...process.env, HOME: home, PATH: `${bin}:${process.env.PATH}`,
        PROGRESS_LOG: progress, PROGRESS_AT_FIND: join(root, 'at-find.log'), PROGRESS_AT_DU: join(root, 'at-du.log') },
      encoding: 'utf8', stdio: ['ignore', 'pipe', fd], timeout: 10_000,
    });
    expect(result.status, readFileSync(progress, 'utf8')).toBe(0);
    expect(readFileSync(join(root, 'at-find.log'), 'utf8')).toContain('Discovering project build artifacts');
    expect(readFileSync(join(root, 'at-du.log'), 'utf8')).toMatch(/Measuring \d+\/\d+: npm cache/);
    expect(result.stdout).toContain('Scanned 1 items');
    expect(result.stdout).not.toContain('[scan]');
    const report = JSON.parse(readFileSync(join(home, 'disk-report/latest.json'), 'utf8'));
    expect(report.items.map((item: { id: string }) => item.id)).toEqual(['npm-cache']);
    expect(existsSync(join(home, 'disk-report/index.html'))).toBe(true);
  } finally {
    closeSync(fd);
    rmSync(root, { recursive: true, force: true });
  }
});
