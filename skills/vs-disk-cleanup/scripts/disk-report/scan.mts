// Disk report: measures dev leftovers with `du` (sizes only, never reads file contents),
// appends to sizes.csv, flags growth vs the previous scan, and writes index.html + latest.json
// into ~/disk-report (data lives there; code lives in the vs-disk-cleanup skill).
// Run: node <vs-disk-cleanup>/scripts/disk-report/scan.mts
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, appendFileSync, writeFileSync, readdirSync, statSync, mkdirSync, realpathSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, relative, dirname } from 'node:path';

const HOME = homedir();
const OUT_DIR = join(HOME, 'disk-report');
const CSV = join(OUT_DIR, 'sizes.csv');
const HTML = join(OUT_DIR, 'index.html');
const LATEST = join(OUT_DIR, 'latest.json');
mkdirSync(OUT_DIR, { recursive: true });
const h = (p: string) => join(HOME, p);
const VS_ARTIFACTS = join(import.meta.dirname, '..', 'vs-artifacts.sh');
const SCAN_CMD = `node ${join(import.meta.dirname, 'scan.mts')}`;
const tilde = (p: string) => (p.startsWith(HOME) ? '~' + p.slice(HOME.length) : p);
const q = (p: string) => `"${tilde(p).replace(/^~/, '$HOME').replace(/"/g, '\\"')}"`;

// Never descend into these: iCloud, Photos, TCC-protected folders (they trigger permission prompts).
const PROTECTED = ['Desktop', 'Documents', 'Downloads', 'Pictures', 'Movies', 'Music', '.Trash',
  'Library/Mobile Documents', 'Library/Mail', 'Library/Messages', 'Library/Safari',
  'Library/Containers', 'Library/Group Containers', 'Library/CloudStorage'].map(h);
const isProtected = (p: string) => PROTECTED.some((x) => p === x || p.startsWith(x + '/'));

type Group = 'safe' | 'review';
type Item = {
  id: string; label: string; group: Group; tag: string;
  paths: string[]; effect: string; clean: (paths: string[]) => string[];
  rebuilds?: boolean; // package-manager cache: refills on the next install, so never offered for cleanup
};

const trash = (paths: string[]) => paths.map((p) => `rm_safe ${q(p)}`);
const exists = (p: string) => existsSync(p) && !isProtected(p);
const lsDirs = (p: string) => (existsSync(p) ? readdirSync(p).filter((n) => !n.startsWith('.') && statSync(join(p, n)).isDirectory()) : []);

const items: Item[] = [
  // ---- safe to remove: caches that the owning tool re-downloads on demand
  { id: 'npm-cache', rebuilds: true, label: 'npm cache', group: 'safe', tag: 'cache', paths: [h('.npm')],
    effect: 'Next npm/npx install re-downloads packages. No project data lost.', clean: () => ['npm cache clean --force'] },
  { id: 'yarn-berry-cache', rebuilds: true, label: 'Yarn Berry global cache', group: 'safe', tag: 'cache', paths: [h('.yarn/berry/cache')],
    effect: 'Yarn 2+ re-fetches packages on next install (slower first install).', clean: () => ['(cd "$HOME" && yarn cache clean --mirror)'] },
  { id: 'pnpm-store', rebuilds: true, label: 'pnpm content store', group: 'safe', tag: 'cache', paths: [h('Library/pnpm/store')],
    effect: 'prune only drops packages no project references; referenced ones stay.', clean: () => ['pnpm store prune'] },
  { id: 'pnpm-meta', rebuilds: true, label: 'pnpm metadata cache', group: 'safe', tag: 'cache', paths: [h('Library/Caches/pnpm')],
    effect: 'Registry metadata is re-fetched on next install.', clean: trash },
  { id: 'uv-cache', rebuilds: true, label: 'uv cache', group: 'safe', tag: 'cache', paths: [h('.cache/uv')],
    effect: 'uv re-downloads wheels; existing venvs keep working.', clean: () => ['uv cache clean'] },
  { id: 'pip-cache', rebuilds: true, label: 'pip cache', group: 'safe', tag: 'cache', paths: [h('Library/Caches/pip')],
    effect: 'pip re-downloads wheels on next install.', clean: () => ['pip3 cache purge'] },
  { id: 'gradle-caches', rebuilds: true, label: 'Gradle caches', group: 'safe', tag: 'cache', paths: [h('.gradle/caches')],
    effect: 'Next Gradle/Android build re-downloads dependencies (slow first build). Gradle has no global clean command.',
    clean: (p) => ['gradle --stop || true', ...trash(p)] },
  { id: 'cocoapods-cache', rebuilds: true, label: 'CocoaPods cache', group: 'safe', tag: 'cache', paths: [h('Library/Caches/CocoaPods')],
    effect: 'pod install re-downloads pods.', clean: () => ['pod cache clean --all'] },
  { id: 'playwright', label: 'Playwright browsers', group: 'safe', tag: 'cache', paths: [h('Library/Caches/ms-playwright')],
    effect: 'E2E tests fail until `npx playwright install` runs again.', clean: () => ['npx -y playwright uninstall --all'] },
  { id: 'puppeteer', label: 'Puppeteer browsers', group: 'safe', tag: 'cache', paths: [h('.cache/puppeteer')],
    effect: 'Puppeteer re-downloads Chrome on next install.', clean: trash },
  { id: 'node-gyp', rebuilds: true, label: 'node-gyp headers', group: 'safe', tag: 'cache', paths: [h('Library/Caches/node-gyp')],
    effect: 'Native modules re-download Node headers on next build. No clean command exists.', clean: trash },
  { id: 'electron-cache', rebuilds: true, label: 'Electron downloads', group: 'safe', tag: 'cache', paths: [h('Library/Caches/electron')],
    effect: 'Electron binaries re-download on next install. No clean command exists.', clean: trash },
  { id: 'homebrew-cache', rebuilds: true, label: 'Homebrew downloads', group: 'safe', tag: 'cache', paths: [h('Library/Caches/Homebrew')],
    effect: 'Old bottles/downloads removed; installed formulae untouched.', clean: () => ['brew cleanup --prune=all'] },
  { id: 'go-modcache', rebuilds: true, label: 'Go module cache', group: 'safe', tag: 'cache', paths: [h('go/pkg/mod')],
    effect: 'Go re-downloads modules on next build.', clean: () => ['go clean -modcache'] },
  { id: 'cargo-registry', rebuilds: true, label: 'Cargo registry', group: 'safe', tag: 'cache', paths: [h('.cargo/registry')],
    effect: 'Crates re-download on next build. Stable cargo has no clean command for this.', clean: trash },
  { id: 'bun-cache', rebuilds: true, label: 'Bun install cache', group: 'safe', tag: 'cache', paths: [h('.bun/install/cache')],
    effect: 'bun install re-downloads packages.', clean: () => ['bun pm cache rm'] },
  { id: 'xcode-deriveddata', label: 'Xcode DerivedData', group: 'safe', tag: 'build', paths: [h('Library/Developer/Xcode/DerivedData')],
    effect: 'Next Xcode build is a full rebuild; indexes rebuild. Quit Xcode first.', clean: trash },
  { id: 'ios-devicesupport', label: 'iOS DeviceSupport', group: 'safe', tag: 'cache', paths: [h('Library/Developer/Xcode/iOS DeviceSupport')],
    effect: 'Xcode re-copies symbols the next time each physical device is plugged in (a few minutes).', clean: trash },
  { id: 'codex-app-cache', label: 'Codex app caches', group: 'safe', tag: 'cache', paths: [h('Library/Caches/Codex'), h('Library/Caches/com.openai.codex')],
    effect: 'App caches only; rebuilt on launch. Quit Codex first.', clean: trash },

  // ---- let me review first
  { id: 'codex-tmp', label: 'Codex .tmp', group: 'review', tag: 'session', paths: [h('.codex/.tmp')],
    effect: 'Codex scratch space. Safe only while Codex is fully quit; a running task would lose its temp files.', clean: trash },
  { id: 'codex-sessions', label: 'Codex session history', group: 'review', tag: 'session',
    paths: [h('.codex/sessions'), h('.codex/archived_sessions'), h('.codex/thread_history_1.sqlite')],
    effect: 'Past Codex conversations become unrecoverable; `codex resume` stops working for them. Quit Codex first.', clean: trash },
  { id: 'claude-transcripts', label: 'Claude Code transcripts', group: 'review', tag: 'session', paths: [h('.claude/projects')],
    effect: 'Loses `claude --resume` history and project memory files. Prefer lowering `cleanupPeriodDays` in settings.',
    clean: (p) => ['# Claude Code has no prune command; consider "cleanupPeriodDays" in ~/.claude/settings.json instead', ...trash(p)] },
  { id: 'claude-desktop', label: 'Claude desktop app data', group: 'review', tag: 'session', paths: [h('Library/Application Support/Claude')],
    effect: 'Signs you out and drops local app state/VM bundles; re-downloaded on next launch. Quit Claude first.', clean: trash },
  { id: 'agentsview-db', label: 'agentsview sessions DB', group: 'review', tag: 'session', paths: [h('.agentsview/sessions.db'), h('.agentsview/sessions.db-wal')],
    effect: 'agentsview loses its indexed session archive and re-indexes from source logs that still exist.', clean: trash },
  { id: 'opencode-data', label: 'OpenCode + cursor-agent data', group: 'review', tag: 'session', paths: [h('.local/share/opencode'), h('.local/share/cursor-agent')],
    effect: 'Session history and installed binaries for these CLIs; they reinstall/re-auth on next use.', clean: trash },
  { id: 't3-userdata', label: 'T3 Code user data', group: 'review', tag: 'session', paths: [h('.t3/userdata')],
    effect: 'T3 Code threads and settings are lost.', clean: trash },
  { id: 'hf-models', label: 'Hugging Face models', group: 'review', tag: 'model', paths: [h('.cache/huggingface')],
    effect: 'Models re-download (GBs) on next use. Interactive picker lets you keep some.', clean: () => ['hf cache delete || huggingface-cli delete-cache'] },
  { id: 'kokoro-models', label: 'Kokoro TTS models', group: 'review', tag: 'model', paths: [h('.cache/kokoro')],
    effect: 'TTS voices re-download on next use.', clean: trash },
  { id: 'colima', label: 'Colima VMs', group: 'review', tag: 'docker', paths: [h('.colima/_lima')],
    effect: 'Each profile holds its own images, containers and volumes. Delete only profiles you no longer use.',
    clean: () => ['colima list', 'echo "Colima: run colima delete <profile> for each unused profile above"'] },
  { id: 'vs-artifacts', label: 'vs session artifacts (~/.vs)', group: 'review', tag: 'session', paths: [h('.vs')],
    effect: 'Reports, videos and evidence from vs skills. Trashes only entries idle 30+ days in render kinds; specs, RFCs, issues and context stay.',
    clean: () => [`DAYS=30 bash ${q(VS_ARTIFACTS)} | awk -F'\\t' '$1=="STALE"{print $4}' | bash ${q(VS_ARTIFACTS)} --remove`] },
  { id: 'rancher-desktop', label: 'Rancher Desktop', group: 'review', tag: 'docker', paths: [h('Library/Application Support/rancher-desktop'), h('.rd')],
    effect: 'Factory reset wipes its VM, images and volumes. Uninstall the app after if unused.', clean: () => ['rdctl factory-reset'] },
  { id: 'core-simulator', label: 'iOS Simulators data', group: 'review', tag: 'build', paths: [h('Library/Developer/CoreSimulator/Devices')],
    effect: 'Erase wipes installed apps and data on every simulator; devices stay listed.', clean: () => ['xcrun simctl delete unavailable', 'xcrun simctl shutdown all', 'xcrun simctl erase all'] },
  { id: 'android-avd', label: 'Android emulator images', group: 'review', tag: 'build', paths: [h('.android/avd')],
    effect: 'Deletes the emulator and its data; recreate in Android Studio.',
    clean: () => lsDirs(h('.android/avd')).filter((n) => n.endsWith('.avd')).map((n) => `"$HOME/Library/Android/sdk/cmdline-tools/latest/bin/avdmanager" delete avd -n "${n.replace(/\.avd$/, '')}"`) },
  { id: 'android-sdk', label: 'Android SDK', group: 'review', tag: 'build', paths: [h('Library/Android/sdk')],
    effect: 'Android builds stop working until the SDK is reinstalled. Remove only unused platforms/system images.',
    clean: () => ['echo "Android SDK: open Android Studio > SDK Manager and uninstall unused platforms/system-images (or sdkmanager --uninstall <pkg>)"'] },
  { id: 'nvm-node', label: 'nvm Node versions', group: 'review', tag: 'runtime', paths: [h('.nvm/versions/node')],
    effect: 'Removes all nvm-installed Node versions. Anything still pinned to nvm breaks.',
    clean: () => ['export NVM_DIR="$HOME/.nvm"; . "$NVM_DIR/nvm.sh"', 'nvm deactivate >/dev/null 2>&1 || true', ...lsDirs(h('.nvm/versions/node')).map((v) => `nvm uninstall ${v}`)] },
  { id: 'rustup-old', label: 'Old Rust toolchains', group: 'review', tag: 'runtime',
    paths: lsDirs(h('.rustup/toolchains')).filter((n) => !n.startsWith('stable')).map((n) => h(`.rustup/toolchains/${n}`)),
    effect: 'Projects pinned to these exact versions re-download them.',
    clean: (p) => [`rustup toolchain uninstall ${p.map((x) => x.split('/').pop()).join(' ')}`] },
  { id: 'verdaccio', label: 'Verdaccio local registry', group: 'review', tag: 'data', paths: [h('.local/share/verdaccio')],
    effect: 'Packages published only to your local registry are lost.', clean: trash },
  { id: 'codex-runtimes', label: 'Codex runtimes cache', group: 'review', tag: 'cache', paths: [h('.cache/codex-runtimes')],
    effect: 'Likely re-downloaded by Codex; unverified, so review.', clean: trash },
];

// ---- git worktrees: found by a `.git` *file* (name check only, contents never read)
function findWorktrees(root: string, depth: number): string[] {
  if (!existsSync(root)) return [];
  const r = spawnSync('find', [root, '-xdev', '-maxdepth', String(depth), '-name', '.git', '-type', 'f'], { encoding: 'utf8' });
  return r.stdout.split('\n').filter(Boolean).map(dirname);
}
const wtClean = (paths: string[]) => paths.flatMap((p) => [
  `wt=${q(p)}; main="$(git -C "$wt" rev-parse --path-format=absolute --git-common-dir)/.."`,
  `git -C "$main" worktree remove "$wt" || echo "  kept (uncommitted changes?): $wt"`,
]);
const wtEffect = 'Removes the checkout. git refuses if it has uncommitted changes (no --force). Committed branches stay in the main repo.';
const wtGroups = new Map<string, string[]>();
const addWt = (key: string, p: string) => wtGroups.set(key, [...(wtGroups.get(key) ?? []), p]);
for (const p of findWorktrees(h('.codex/worktrees'), 3)) addWt('Codex worktrees', p);
for (const p of findWorktrees(h('.t3/worktrees'), 3)) addWt('T3 Code worktrees', p);
for (const proj of lsDirs(h('Projects'))) {
  for (const p of findWorktrees(h(`Projects/${proj}/.claude/worktrees`), 2)) addWt(`Claude worktrees: ${proj}`, p);
}
for (const [label, paths] of wtGroups) {
  items.push({ id: 'wt:' + label, label: `${label} (${paths.length})`, group: 'review', tag: 'worktree', paths, effect: wtEffect, clean: wtClean });
}

// ---- project build artifacts, grouped per project (worktrees excluded: counted above)
const ARTIFACT_NAMES = ['node_modules', '.next', '.turbo', '.angular', '.parcel-cache', '.nx', 'target', '.venv', 'venv', 'Pods', '.expo'];
const nameExpr = ARTIFACT_NAMES.flatMap((n, i) => (i ? ['-o', '-name', n] : ['-name', n]));
// Common code roots; realpath dedupes case-insensitive twins (~/Projects vs ~/projects on APFS).
const artRoots = [...new Set(['Projects', 'projects', 'dev', 'src', 'code', 'repos', 'work', 'conductor']
  .map(h).filter(existsSync).map((p) => realpathSync(p)))];
const found = spawnSync('find', [...artRoots, '-xdev', '-type', 'd', '(', '-name', 'worktrees', '-o', '-name', '.git', ')', '-prune', '-o',
  '-type', 'd', '(', ...nameExpr, ')', '-prune', '-print'], { encoding: 'utf8', maxBuffer: 1 << 26 }).stdout.split('\n').filter(Boolean);
const artGroups = new Map<string, string[]>();
for (const p of found) {
  const rel = relative(HOME, p).split('/');
  const key = rel.slice(0, 2).join('/');
  artGroups.set(key, [...(artGroups.get(key) ?? []), p]);
}
for (const [proj, paths] of artGroups) {
  items.push({ id: 'art:' + proj, label: `${proj.split('/').pop()} build artifacts`, group: 'safe', tag: 'build', paths,
    effect: `node_modules / build caches (${paths.length} dir${paths.length > 1 ? 's' : ''}). Reinstall/rebuild restores them; no source touched. Deleted only where git-ignored; committed ones are skipped.`,
    clean: trash });
}

// ---- measure (du -skx; hardlinks counted once per item)
function du(paths: string[]): number {
  const ok = paths.filter(exists);
  if (!ok.length) return 0;
  const r = spawnSync('du', ['-skxc', ...ok], { encoding: 'utf8', maxBuffer: 1 << 26 });
  const total = r.stdout.trim().split('\n').pop() ?? '0';
  return parseInt(total, 10) || 0;
}

// ---- previous scan: read before writing (latest scanned_at per id)
const prev = new Map<string, number>();
let prevAt = '';
if (existsSync(CSV)) {
  const rows = readFileSync(CSV, 'utf8').trim().split('\n').slice(1).map((l) => l.split(','));
  prevAt = rows.reduce((m, r) => (r[0] > m ? r[0] : m), '');
  for (const r of rows) if (r[0] === prevAt) prev.set(decodeURIComponent(r[1]), Number(r[4]));
}

// "Last used" = newest mtime of each path and its direct children (metadata only, no contents).
// Directory mtime changes when entries are added/removed, so installs and builds bump it.
function lastTouched(paths: string[]): number {
  let max = 0;
  for (const p of paths) {
    try {
      max = Math.max(max, statSync(p).mtimeMs);
      if (statSync(p).isDirectory()) for (const n of readdirSync(p)) {
        try { max = Math.max(max, statSync(join(p, n)).mtimeMs); } catch { /* vanished or unreadable: ignore */ }
      }
    } catch { /* missing path: no signal */ }
  }
  return max;
}

const scannedAt = new Date().toISOString();
const ACTIVE_DAYS = 14; // safe items touched more recently are in use and would just rebuild
const MIN_KB = 200 * 1024; // hide items under 200 MB
const GROW_KB = 100 * 1024; // flag growth >= 100 MB and >= 5%
const results = items.map((it) => {
  const kb = du(it.paths);
  const before = prev.get(it.id);
  const delta = before === undefined ? null : kb - before;
  const grew = delta !== null && delta >= GROW_KB && delta >= before! * 0.05;
  const touched = lastTouched(it.paths.filter(exists));
  const active = touched > Date.now() - ACTIVE_DAYS * 86400e3;
  // Only "safe" items get excluded for activity; "review" items are a human call either way.
  const excluded = it.rebuilds ? 'rebuilds' : it.group === 'safe' && active ? 'active' : null;
  return { id: it.id, label: it.label, group: excluded ? 'excluded' : it.group, excluded, active,
    lastUsed: touched ? new Date(touched).toISOString() : null, tag: it.tag, kb, before: before ?? null, delta, grew, isNew: prevAt !== '' && before === undefined,
    paths: it.paths.filter(exists).map(tilde), effect: it.effect,
    // Safe items are regenerable: delete for real (git-ignore guarded). Review items go to Trash.
    commands: it.clean(it.paths.filter(exists)).map((c) => (it.group === 'safe' ? c.replace(/^rm_safe /, 'rm_regen ') : c)) };
}).filter((r) => r.kb >= MIN_KB).sort((a, b) => b.kb - a.kb);

// ---- append to CSV (all items, including small ones, so growth is tracked from the start)
if (!existsSync(CSV)) writeFileSync(CSV, 'scanned_at,id,label,group,kb,path\n');
const csvSafe = (s: string) => encodeURIComponent(s);
appendFileSync(CSV, results.map((r) => [scannedAt, csvSafe(r.id), csvSafe(r.label), r.group, r.kb, csvSafe(r.paths[0] ?? '')].join(',')).join('\n') + '\n');

const df = spawnSync('df', ['-k', '/System/Volumes/Data'], { encoding: 'utf8' }).stdout.trim().split('\n').pop()!.split(/\s+/);
const disk = { totalKb: Number(df[1]), usedKb: Number(df[2]), freeKb: Number(df[3]) };

const report = { scannedAt, prevAt, disk, scanPath: join(import.meta.dirname, 'scan.mts'), items: results };
writeFileSync(LATEST, JSON.stringify(report, null, 1)); // read by cleanup.mts
const tpl = readFileSync(join(import.meta.dirname, 'template.html'), 'utf8');
const builder = readFileSync(join(import.meta.dirname, 'cleanup-script.mjs'), 'utf8').replace(/^export /m, '');
const data = JSON.stringify(report).replace(/</g, '\\u003c');
writeFileSync(HTML, tpl.replace('__SCAN_CMD__', () => SCAN_CMD).replace('/*__DATA__*/null', () => data).replace('/*__BUILD__*/', () => builder));
const gb = (kb: number) => (kb / 1048576).toFixed(1) + ' GB';
console.log(`Scanned ${results.length} items at ${scannedAt}${prevAt ? ` (previous: ${prevAt})` : ' (first run)'}`);
for (const g of ['safe', 'review', 'excluded'] as const) console.log(`  ${g}: ${gb(results.filter((r) => r.group === g).reduce((s, r) => s + r.kb, 0))}`);
const grown = results.filter((r) => r.grew);
if (grown.length) console.log('  grew: ' + grown.map((r) => `${r.label} +${gb(r.delta!)}`).join(', '));
console.log(`Open: ${HTML}`);
