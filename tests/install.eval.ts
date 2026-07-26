import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

const EXPECTED_CALLS = [
  'claude plugin marketplace add vltansky/vs',
  'claude plugin marketplace update vs',
  'claude plugin install vs@vs',
  'claude plugin update vs@vs',
  'codex plugin marketplace add vltansky/vs',
  'codex plugin marketplace upgrade vs',
  'codex plugin add vs@vs',
];

// The PowerShell installer is exercised wherever a shell is available, not just
// on Windows. $PSHOME gives us a PATH entry so the run does not inherit the
// caller's PATH (which could leak a real `cursor` into the stubbed environment).
const pwsh = (() => {
  for (const name of ['pwsh', 'powershell']) {
    const probe = spawnSync(name, ['-NoProfile', '-Command', '[Console]::Out.Write($PSHOME)'], {
      encoding: 'utf8',
    });
    if (probe.status === 0 && probe.stdout.trim()) return { name, home: probe.stdout.trim() };
  }
  return undefined;
})();

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

    expect(readFileSync(callsFile, 'utf8').trim().split('\n')).toEqual(EXPECTED_CALLS);
  });

  it.skipIf(!pwsh)('drives the same CLI sequence from the PowerShell installer', () => {
    const home = mkdtempSync(join(tmpdir(), 'vs-install-ps-'));
    const bin = join(home, 'bin');
    const callsFile = join(home, 'calls.log');
    mkdirSync(bin);

    const windows = process.platform === 'win32';
    for (const cli of ['claude', 'codex']) {
      const stub = windows
        ? `@echo off\r\n>>"%CALLS_FILE%" echo ${cli} %*\r\n`
        : `#!/bin/sh\nprintf '%s %s\\n' "$(basename "$0")" "$*" >> "$CALLS_FILE"\n`;
      writeFileSync(join(bin, windows ? `${cli}.cmd` : cli), stub, { mode: 0o755 });
    }

    const path = windows
      ? [bin, pwsh!.home, 'C:\\Windows\\System32'].join(';')
      : [bin, pwsh!.home, '/usr/bin', '/bin'].join(':');

    const env: NodeJS.ProcessEnv = {};
    for (const [key, value] of Object.entries(process.env)) {
      // Windows PowerShell derives $HOME from HOMEDRIVE+HOMEPATH before USERPROFILE.
      if (/^(path|homedrive|homepath)$/i.test(key)) continue;
      env[key] = value;
    }
    Object.assign(env, {
      CALLS_FILE: callsFile,
      HOME: home,
      USERPROFILE: home,
      [windows ? 'Path' : 'PATH']: path,
    });

    execFileSync(pwsh!.name, ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', 'install.ps1'], {
      cwd: process.cwd(),
      env,
    });

    expect(readFileSync(callsFile, 'utf8').trim().split(/\r?\n/)).toEqual(EXPECTED_CALLS);
  });
});
