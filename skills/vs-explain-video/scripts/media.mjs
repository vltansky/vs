// Shared probes for the explain-video scripts: tool lookup, media duration,
// and Playwright resolution and provisioning. Plain Node, no dependencies.
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { homedir } from 'node:os';
import path from 'node:path';

export const which = (name) => {
  const result = spawnSync('/bin/sh', ['-c', `command -v ${name}`], { encoding: 'utf8' });
  const found = result.status === 0 ? result.stdout.trim() : '';
  return found || null;
};

export const run = (cmd, args, options = {}) =>
  spawnSync(cmd, args, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, ...options });

// Seconds as a float, or null when ffprobe cannot read the file.
export const probeDuration = (file) => {
  const result = run('ffprobe', [
    '-v', 'error', '-show_entries', 'format=duration', '-of', 'default=nw=1:nk=1', file,
  ]);
  const seconds = Number.parseFloat(result.stdout);
  return result.status === 0 && Number.isFinite(seconds) ? seconds : null;
};

// The skill owns its browser driver: a pinned playwright-core in a shared
// tool cache outside any project, installed on first use. Bump the pin only
// to a release at least two weeks old; the version is part of the cache path,
// so a bump installs fresh instead of reusing a stale tree.
export const PLAYWRIGHT_CORE_VERSION = '1.63.0';
export const toolingDir = () =>
  process.env.VS_TOOLING_DIR ?? path.join(homedir(), '.vs', 'tooling', `playwright-core-${PLAYWRIGHT_CORE_VERSION}`);

// Resolve an explicit PLAYWRIGHT_MODULE, then the project's, the work dir's,
// the skill's tool cache, or a global install.
export const resolvePlaywright = (extraRoots = []) => {
  const roots = [process.cwd(), ...extraRoots, toolingDir()];
  const globalRoot = run('npm', ['root', '-g']).stdout?.trim();
  if (globalRoot) roots.push(globalRoot);
  const explicit = process.env.PLAYWRIGHT_MODULE;
  if (explicit) {
    const entry = existsSync(explicit) ? tryResolve(explicit, process.cwd()) : null;
    if (entry) return entry;
  }
  for (const root of roots) {
    for (const name of ['playwright', 'playwright-core']) {
      const entry = tryResolve(name, root);
      if (entry) return entry;
    }
  }
  return null;
};

// Resolve Playwright, installing the pinned playwright-core into the tool
// cache when nothing resolves. It drives the installed Chrome, so no browser
// download happens. VS_EXPLAIN_VIDEO_NO_INSTALL=1 turns the install off.
// Returns { entry, error }; error names why the install did not help.
export const ensurePlaywright = (extraRoots = []) => {
  const found = resolvePlaywright(extraRoots);
  if (found) return { entry: found, error: null };
  if (process.env.VS_EXPLAIN_VIDEO_NO_INSTALL === '1') return { entry: null, error: 'auto-install is off (VS_EXPLAIN_VIDEO_NO_INSTALL=1)' };
  if (!which('npm')) return { entry: null, error: 'npm is not on PATH' };
  const dir = toolingDir();
  mkdirSync(dir, { recursive: true });
  process.stderr.write(`Installing playwright-core@${PLAYWRIGHT_CORE_VERSION} into ${dir} (one time)...\n`);
  const result = run('npm', [
    'install', '--prefix', dir, '--no-audit', '--no-fund', '--loglevel=error',
    `playwright-core@${PLAYWRIGHT_CORE_VERSION}`,
  ]);
  const entry = tryResolve('playwright-core', dir);
  if (entry) return { entry, error: null };
  const reason = (result.stderr || result.error?.message || `npm exited ${result.status}`).trim().split('\n')[0];
  return { entry: null, error: `npm install failed: ${reason}` };
};

const tryResolve = (spec, root) => {
  try {
    return createRequire(path.join(root, 'explain-video-resolver.js')).resolve(spec);
  } catch {
    return null;
  }
};

export const fail = (message) => {
  process.stderr.write(`${message}\n`);
  process.exit(2);
};
