import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import * as path from 'node:path';

import { describe, expect, it } from 'vitest';

const ROOT = path.resolve(__dirname, '..');
const CONTRACT = readFileSync(
  path.join(ROOT, 'skills', 'vs-ponytail', 'references', 'contract.md'),
  'utf8',
).trim();

// Each host has its own hook contract. Claude Code auto-loads hooks/hooks.json
// (PascalCase events) and takes raw stdout as context. Codex uses the same
// event schema but dropped plugin-manifest hooks, so the installer registers
// the hook in ~/.codex/hooks.json, and the response must be
// hookSpecificOutput JSON. Cursor discovers plugin hooks from the manifest
// (camelCase events) and takes {additional_context} JSON.
const CLAUDE_CODEX_EVENTS = new Set(['SessionStart', 'SubagentStart']);
const CURSOR_EVENTS = new Set([
  'sessionStart',
  'sessionEnd',
  'preToolUse',
  'postToolUse',
  'subagentStart',
  'subagentStop',
  'beforeSubmitPrompt',
  'stop',
  'workspaceOpen',
]);

type HookEntry = { hooks?: Array<{ command: string }>; command?: string };
type HooksFile = { hooks: Record<string, HookEntry[]> };

function readJson(relative: string) {
  return JSON.parse(readFileSync(path.join(ROOT, relative), 'utf8'));
}

function sharedHookCommands(): string[] {
  const file = readJson('hooks/hooks.json') as HooksFile;
  return Object.values(file.hooks)
    .flat()
    .flatMap((entry) => entry.hooks ?? [])
    .map((hook) => hook.command);
}

function runHookCommand(
  command: string,
  options: { cwd: string; env?: Record<string, string>; stdin?: string },
) {
  return spawnSync('/bin/sh', ['-c', command], {
    cwd: options.cwd,
    encoding: 'utf8',
    input: options.stdin ?? '',
    env: {
      PATH: `${path.dirname(process.execPath)}:/usr/bin:/bin`,
      ...options.env,
    },
  });
}

describe('ponytail hook wiring per host', () => {
  it('lets Claude Code auto-load the standard hooks file without a duplicate manifest reference', () => {
    expect(readJson('.claude-plugin/plugin.json')).not.toHaveProperty('hooks');
  });

  it('points the Cursor manifest at the Cursor-format hooks file', () => {
    // Without this override Cursor would auto-discover hooks/hooks.json, whose
    // PascalCase event names it cannot match.
    expect(readJson('.cursor-plugin/plugin.json').hooks).toBe(
      './hooks/cursor-hooks.json',
    );
  });

  it('declares only events Claude Code and Codex support in the shared hooks file', () => {
    const file = readJson('hooks/hooks.json') as HooksFile;
    for (const event of Object.keys(file.hooks)) {
      expect(CLAUDE_CODEX_EVENTS).toContain(event);
    }
  });

  it('declares only documented camelCase events in the Cursor hooks file', () => {
    const file = readJson('hooks/cursor-hooks.json') as HooksFile;
    const events = Object.keys(file.hooks);
    expect(events).toContain('sessionStart');
    for (const event of events) {
      expect(CURSOR_EVENTS).toContain(event);
    }
  });

  it('emits the contract as raw stdout for Claude Code sessions', () => {
    const commands = sharedHookCommands();
    expect(commands.length).toBeGreaterThan(0);

    for (const command of commands) {
      const result = runHookCommand(command, {
        // Claude does not guarantee the plugin root as cwd; only the env var.
        cwd: mkdtempSync(path.join(tmpdir(), 'vs-hook-')),
        env: { CLAUDE_PLUGIN_ROOT: ROOT },
        stdin: JSON.stringify({
          hook_event_name: 'SessionStart',
          source: 'startup',
          session_id: 'eval',
        }),
      });
      expect(result.status).toBe(0);
      expect(result.stdout).toBe(CONTRACT);
    }
  });

  it('emits hookSpecificOutput JSON for Codex sessions', () => {
    // permission_mode plus a PascalCase event name is what distinguishes a
    // Codex payload from Claude's.
    const result = runHookCommand(`node '${ROOT}/hooks/ponytail.mjs'`, {
      cwd: mkdtempSync(path.join(tmpdir(), 'vs-hook-')),
      stdin: JSON.stringify({
        hook_event_name: 'SessionStart',
        permission_mode: 'default',
        session_id: 'eval',
      }),
    });
    expect(result.status).toBe(0);
    expect(JSON.parse(result.stdout)).toEqual({
      hookSpecificOutput: {
        hookEventName: 'SessionStart',
        additionalContext: CONTRACT,
      },
    });
  });

  it('emits Cursor JSON with additional_context when Cursor runs its hook commands', () => {
    const file = readJson('hooks/cursor-hooks.json') as HooksFile;
    const commands = Object.values(file.hooks).map((entries) => entries[0].command!);
    expect(commands.length).toBeGreaterThan(0);

    for (const command of commands) {
      // Cursor resolves relative hook commands from the plugin root and passes
      // the event payload on stdin; it sets no plugin-root env var.
      const result = runHookCommand(command, {
        cwd: ROOT,
        stdin: JSON.stringify({
          hook_event_name: 'sessionStart',
          cursor_version: '2.0.0',
          session_id: 'eval',
        }),
      });
      expect(result.status).toBe(0);
      expect(JSON.parse(result.stdout)).toEqual({ additional_context: CONTRACT });
    }
  });

  it('registers the Codex user-level hook idempotently and preserves existing hooks', () => {
    const codexHome = mkdtempSync(path.join(tmpdir(), 'vs-codex-home-'));
    const existing = {
      hooks: {
        SessionStart: [
          { hooks: [{ type: 'command', command: 'echo preexisting' }] },
        ],
      },
    };
    writeFileSync(path.join(codexHome, 'hooks.json'), JSON.stringify(existing));

    const register = () =>
      runHookCommand(`node '${ROOT}/hooks/install-codex-hook.mjs'`, {
        cwd: codexHome,
        env: { CODEX_HOME: codexHome },
      });

    expect(register().stdout).toBe('registered');
    expect(register().stdout).toBe('unchanged');

    const merged = JSON.parse(
      readFileSync(path.join(codexHome, 'hooks.json'), 'utf8'),
    ) as HooksFile;
    expect(merged.hooks.SessionStart[0].hooks![0].command).toBe('echo preexisting');

    for (const event of ['SessionStart', 'SubagentStart']) {
      const commands = merged.hooks[event][0].hooks!.map((hook) => hook.command);
      const ponytail = commands.filter((command) =>
        command.includes('/hooks/ponytail.mjs'),
      );
      expect(ponytail).toHaveLength(1);

      // The registered command must produce Codex's expected response shape.
      const result = runHookCommand(ponytail[0], {
        cwd: codexHome,
        stdin: JSON.stringify({
          hook_event_name: event,
          permission_mode: 'default',
        }),
      });
      expect(result.status).toBe(0);
      expect(JSON.parse(result.stdout).hookSpecificOutput.additionalContext).toBe(
        CONTRACT,
      );
    }
  });

  it('stays silent when disabled via VS_PONYTAIL=off', () => {
    const result = runHookCommand('node ./hooks/ponytail.mjs', {
      cwd: ROOT,
      env: { VS_PONYTAIL: 'off' },
    });
    expect(result.status).toBe(0);
    expect(result.stdout).toBe('');
  });
});
