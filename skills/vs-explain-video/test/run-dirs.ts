import fs from 'node:fs';
import path from 'node:path';

// A live eval run may write its video work dir outside its sandbox root (an agent has
// picked /tmp/.vs). /tmp is shared with other agents and parallel evals, so a dir there
// counts as this run's only when its crate names this run's own VS_FF_CACHE (every run
// gets a fresh one, and fframes.mjs init writes it into ff/Cargo.toml). Read-only search.
export function findRunWorkDirs(root: string, cache: string, depth = 0): string[] {
  if (!cache || depth > 6 || !fs.existsSync(root)) return [];
  const toml = path.join(root, 'ff', 'Cargo.toml');
  try {
    if (fs.readFileSync(toml, 'utf8').includes(`${cache.replace(/\/+$/, '')}/`)) return [root];
  } catch { /* not a work dir */ }
  return fs.readdirSync(root, { withFileTypes: true })
    .filter((e) => e.isDirectory() && !e.isSymbolicLink() && !['node_modules', 'target', '.git', 'ff'].includes(e.name))
    .flatMap((e) => findRunWorkDirs(path.join(root, e.name), cache, depth + 1));
}

// Remove only the work dirs findRunWorkDirs attributes to this run; parents and every
// other entry stay.
export function removeRunWorkDirs(root: string, cache: string): string[] {
  const dirs = findRunWorkDirs(root, cache);
  for (const dir of dirs) fs.rmSync(dir, { recursive: true, force: true });
  return dirs;
}
