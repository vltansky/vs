#!/usr/bin/env node
// Runs vitest with HOME pointed at a sanitized copy of the real home.
//
// On macOS pathgrade authenticates evals with the Claude Code Keychain OAuth
// login, and that path copies `~/.claude.json` verbatim into every trial's
// sandbox HOME (see @wix/pathgrade providers/credentials.ts -> copyFromHome).
// That file carries the host's MCP server list, so every eval agent boots the
// full personal MCP setup and stalls on interactive logins for servers the
// evals never use.
//
// pathgrade resolves both the copy source and the Keychain link through
// os.homedir(), which honors $HOME, so redirecting HOME at the vitest process
// is enough: it copies our stripped .claude.json instead of the real one.
// Keychains are symlinked back so `security find-generic-password` still
// resolves the OAuth login.

import { spawn } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const EVAL_HOME = path.join(REPO_ROOT, '.pathgrade', 'eval-home');
const STRIPPED_KEYS = ['mcpServers', 'projects', 'claudeAiMcpEverConnected', 'mcpContextUris'];

function buildEvalHome() {
  fs.rmSync(EVAL_HOME, { recursive: true, force: true });
  fs.mkdirSync(path.join(EVAL_HOME, 'Library'), { recursive: true });

  const realHome = process.env.PATHGRADE_REAL_HOME ?? os.homedir();
  const keychains = path.join(realHome, 'Library', 'Keychains');
  if (fs.existsSync(keychains)) {
    fs.symlinkSync(keychains, path.join(EVAL_HOME, 'Library', 'Keychains'));
  }

  const hostConfig = path.join(realHome, '.claude.json');
  if (!fs.existsSync(hostConfig)) return { stripped: [] };

  const config = JSON.parse(fs.readFileSync(hostConfig, 'utf8'));
  const stripped = STRIPPED_KEYS.filter((key) => key in config);
  for (const key of STRIPPED_KEYS) delete config[key];
  config.mcpServers = {};
  config.projects = {};
  fs.writeFileSync(path.join(EVAL_HOME, '.claude.json'), JSON.stringify(config));
  return { stripped };
}

const { stripped } = buildEvalHome();
console.log(`eval HOME: ${EVAL_HOME}${stripped.length ? ` (stripped: ${stripped.join(', ')})` : ''}`);

const child = spawn('npx', ['vitest', ...process.argv.slice(2)], {
  cwd: REPO_ROOT,
  stdio: 'inherit',
  env: { ...process.env, HOME: EVAL_HOME, PATHGRADE_REAL_HOME: process.env.PATHGRADE_REAL_HOME ?? os.homedir() },
});

child.on('exit', (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  process.exit(code ?? 1);
});
