import fs from 'node:fs';
import path from 'node:path';

// A live eval run may write its video work dir outside its sandbox root (an agent has
// picked /tmp/.vs). /tmp is shared with other agents and parallel evals, so a dir there
// counts as this run's only when its crate's vs_fframes_kit path is a kit inside this
// run's own VS_FF_CACHE (every run gets a fresh one; fframes.mjs init writes the path).
// Read-only: nothing under /tmp/.vs is ever deleted; the caller logs what it scored.
const kitPath = (toml: string) => /^\s*vs_fframes_kit\s*=\s*\{[^}]*\bpath\s*=\s*"([^"]+)"/m.exec(toml)?.[1];

const kitDirOf = (dir: string) => {
  try { return kitPath(fs.readFileSync(path.join(dir, 'ff', 'Cargo.toml'), 'utf8')); } catch { return undefined; }
};
const inCache = (kit: string, cache: string) => path.dirname(path.resolve(kit)) === path.resolve(cache);

// A work dir whose crate names another cache: another run's video, never this run's.
export function namesOtherCache(dir: string, cache: string): boolean {
  const kit = kitDirOf(dir);
  return !!kit && !!cache && !inCache(kit, cache);
}

export function findRunWorkDirs(root: string, cache: string): string[] {
  if (!cache) return [];
  const want = path.resolve(cache);
  const found: string[] = [];
  const walk = (dir: string, depth: number) => {
    if (depth > 8) return;
    const kit = kitDirOf(dir);
    if (kit && inCache(kit, want)) found.push(dir);
    let entries: fs.Dirent[] = [];
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
    for (const e of entries) {
      if (e.isDirectory() && !['node_modules', 'target', '.git', 'ff'].includes(e.name)) walk(path.join(dir, e.name), depth + 1);
    }
  };
  walk(root, 0);
  // The deepest match is the video dir: drop any match that only contains another one.
  return found.filter((d) => !found.some((o) => o !== d && o.startsWith(d + path.sep)));
}
