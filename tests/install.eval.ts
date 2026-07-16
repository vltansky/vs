import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

describe('plugin installer', () => {
  it('publishes a new version so installed plugins can detect the update', () => {
    const manifests = [
      'package.json',
      'package-lock.json',
      '.claude-plugin/plugin.json',
      '.codex-plugin/plugin.json',
      '.cursor-plugin/plugin.json',
    ];

    const versions = manifests.map((path) => JSON.parse(readFileSync(path, 'utf8')).version);
    expect(new Set(versions)).toEqual(new Set([versions[0]]));
    expect(versions[0]).not.toBe('1.0.1');
  });

  it('refreshes configured marketplaces and installed plugins', () => {
    const home = mkdtempSync(join(tmpdir(), 'vs-install-'));
    const bin = join(home, 'bin');
    const callsFile = join(home, 'calls.log');
    mkdirSync(bin);

    const cliStub = `#!/bin/sh\nprintf '%s %s\\n' "$(basename "$0")" "$*" >> "$CALLS_FILE"\n`;
    for (const cli of ['claude', 'codex']) {
      const path = join(bin, cli);
      writeFileSync(path, cliStub, { mode: 0o755 });
    }

    execFileSync('/bin/bash', ['install.sh'], {
      cwd: process.cwd(),
      env: {
        ...process.env,
        CALLS_FILE: callsFile,
        HOME: home,
        PATH: `${bin}:/usr/bin:/bin`,
      },
    });

    expect(readFileSync(callsFile, 'utf8').trim().split('\n')).toEqual([
      'claude plugin marketplace add vltansky/vs',
      'claude plugin marketplace update vs',
      'claude plugin install vs@vs',
      'claude plugin update vs@vs',
      'codex plugin marketplace add vltansky/vs',
      'codex plugin marketplace upgrade vs',
      'codex plugin add vs@vs',
    ]);
  });
});
