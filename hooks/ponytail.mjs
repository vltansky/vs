#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const disabled = [
  process.env.VS_PONYTAIL,
  process.env.VS_MINIMUM_SOLUTION,
].some((value) => value?.toLowerCase() === 'off');

if (disabled) process.exit(0);

const pluginRoot =
  process.env.PLUGIN_ROOT ||
  process.env.CLAUDE_PLUGIN_ROOT ||
  path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const instructionsPath = path.join(
  pluginRoot,
  'skills',
  'vs-ponytail',
  'references',
  'contract.md',
);

function readHookInput() {
  try {
    const raw = fs.readFileSync(0, 'utf8').trim();
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

let contract;
try {
  contract = fs.readFileSync(instructionsPath, 'utf8').trim();
} catch {
  process.exit(0);
}

// Each host expects a different hook response: Cursor takes
// {additional_context}, Codex takes {hookSpecificOutput.additionalContext},
// and Claude Code takes raw stdout. Host is detected from the stdin payload:
// Cursor sends cursor_version / camelCase event names, Codex is the only host
// sending permission_mode with PascalCase events.
const input = readHookInput();
const event = input.hook_event_name ?? '';
const isCursor =
  input.cursor_version !== undefined ||
  event === 'sessionStart' ||
  event === 'subagentStart' ||
  !!process.env.CURSOR_PROJECT_DIR;
const isCodex = !isCursor && input.permission_mode !== undefined;

if (isCursor) {
  process.stdout.write(JSON.stringify({ additional_context: contract }));
} else if (isCodex) {
  process.stdout.write(
    JSON.stringify({
      hookSpecificOutput: {
        hookEventName: event || 'SessionStart',
        additionalContext: contract,
      },
    }),
  );
} else {
  process.stdout.write(contract);
}
