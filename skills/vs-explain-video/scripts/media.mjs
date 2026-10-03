// Shared probes for the explain-video scripts: tool lookup, media duration,
// and Playwright resolution. Plain Node, no dependencies.
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { createRequire } from 'node:module';
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

// The vs plugin ships no browser dependency: resolve an explicit
// PLAYWRIGHT_MODULE, then the project's, the work dir's, or a global install.
export const resolvePlaywright = (extraRoots = []) => {
  const roots = [process.cwd(), ...extraRoots];
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
