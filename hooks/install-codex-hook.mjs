#!/usr/bin/env node

// Codex removed plugin-manifest hooks (feature `plugin_hooks`), so the
// always-on Ponytail hook must be registered in the user's
// ~/.codex/hooks.json. Installers run this script from the installed plugin;
// the merge is idempotent and updates the entry in place when the plugin
// path changes.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const script = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  'ponytail.mjs',
);
// The existence guard keeps sessions silent instead of erroring if the plugin
// cache is wiped before the hook entry is removed. Windows hooks run without
// a POSIX shell, so they get the bare command.
const command =
  process.platform === 'win32'
    ? `node "${script}"`
    : `[ -f '${script}' ] || exit 0; node '${script}'`;

const codexHome = process.env.CODEX_HOME || path.join(os.homedir(), '.codex');
const file = path.join(codexHome, 'hooks.json');
const config = fs.existsSync(file)
  ? JSON.parse(fs.readFileSync(file, 'utf8'))
  : {};
config.hooks ??= {};

let changed = false;
for (const event of ['SessionStart', 'SubagentStart']) {
  const groups = (config.hooks[event] ??= []);
  if (groups.length === 0) groups.push({ hooks: [] });
  const hooks = (groups[0].hooks ??= []);
  const existing = hooks.find((hook) =>
    /[/\\]hooks[/\\]ponytail\.mjs/.test(hook.command ?? ''),
  );
  if (existing?.command === command) continue;
  if (existing) existing.command = command;
  else hooks.push({ type: 'command', command, timeout: 5 });
  changed = true;
}

if (changed) {
  fs.mkdirSync(codexHome, { recursive: true });
  fs.writeFileSync(file, JSON.stringify(config, null, 2) + '\n');
}
process.stdout.write(changed ? 'registered' : 'unchanged');
