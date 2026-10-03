import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { applyEdits, applyMoves, type Variant } from './variants';

const AB_DIR = __dirname;
const SKILLS_ROOT = path.resolve(AB_DIR, '../../..');
export const FIXTURE_DIR = path.join(AB_DIR, 'fixtures', 'shop');
export const MOCK_GH = path.join(AB_DIR, 'mock-gh.mjs');
const CODEX_TAP = path.join(AB_DIR, 'codex-tap.mjs');
const REAL_CODEX = (() => {
  try { return execFileSync('which', ['codex'], { encoding: 'utf8' }).trim(); } catch { return ''; }
})();
// /tmp, not os.tmpdir(): Codex's workspace-write sandbox allows writes to /tmp
// but not to the PathGrade sandbox HOME or to any `.git` directory, so the git
// dir, bare origin, and mock gh state all live here.
export const RUNS_ROOT = '/tmp/shipit-ab/runs';

const git = (args: string[], cwd?: string) =>
  execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();

/** Fixture plus every skill (minus test dirs), with the variant's SKILL.md edits applied. */
export function buildWorkspace(variant: Variant, runDir: string): string {
  const ws = path.join(runDir, 'workspace-src');
  fs.cpSync(FIXTURE_DIR, ws, { recursive: true });
  writeInheritedContextDocs(path.join(ws, 'docs'), process.env.SHIPIT_AB_LIGHT ? 2 : 50);
  for (const name of fs.readdirSync(SKILLS_ROOT)) {
    const src = path.join(SKILLS_ROOT, name);
    if (!fs.existsSync(path.join(src, 'SKILL.md'))) continue;
    for (const root of ['.claude/skills', '.agents/skills']) {
      const dest = path.join(ws, root, name);
      fs.cpSync(src, dest, {
        recursive: true,
        filter: (p) => !/\/(test|tests|node_modules)(\/|$)/.test(path.relative(SKILLS_ROOT, p).replace(/^[^/]+/, '')),
      });
      const md = path.join(dest, 'SKILL.md');
      const { md: moved, refs } = applyMoves(name, fs.readFileSync(md, 'utf8'), variant.moves ?? []);
      fs.writeFileSync(md, applyEdits(name, moved, variant.edits));
      for (const [ref, body] of refs) {
        fs.mkdirSync(path.dirname(path.join(dest, ref)), { recursive: true });
        // Relative links inside moved prose were written for the skill root.
        fs.writeFileSync(path.join(dest, ref), body.replaceAll('](../', '](../../'));
      }
    }
  }
  for (const [dest, src] of Object.entries(variant.files ?? {})) {
    for (const root of ['.claude/skills', '.agents/skills']) {
      fs.cpSync(path.join(AB_DIR, src), path.join(ws, root, dest));
    }
  }
  for (const [dest, src] of Object.entries(variant.workspaceFiles ?? {})) {
    fs.mkdirSync(path.dirname(path.join(ws, dest)), { recursive: true });
    fs.cpSync(path.join(AB_DIR, src), path.join(ws, dest));
  }
  if (variant.claudeSettings) fs.writeFileSync(path.join(ws, '.claude', 'settings.json'), JSON.stringify(variant.claudeSettings, null, 2));
  return ws;
}

const DOC_WORDS = ['checkout', 'coupon', 'pricing', 'refund', 'ledger', 'invoice', 'webhook', 'region', 'currency',
  'promotion', 'reservation', 'inventory', 'settlement', 'session', 'eligibility', 'audit', 'retry', 'idempotency', 'tax', 'cart'];

/**
 * ~48KB per doc of seeded filler that AGENTS.md tells the agent to read in full:
 * it reproduces the large inherited context real ship-it threads carry. Seeded so
 * every variant pays for identical bytes; changing the size or seed invalidates
 * comparisons with earlier results.
 */
function writeInheritedContextDocs(dir: string, sectionCount: number): void {
  let seed = 20260930;
  const rand = () => ((seed = (seed * 1103515245 + 12345) % 2 ** 31) / 2 ** 31);
  const word = () => DOC_WORDS[Math.floor(rand() * DOC_WORDS.length)];
  const words = (n: number) => Array.from({ length: n }, word).join(' ');
  fs.mkdirSync(dir, { recursive: true });
  for (const title of ['Architecture', 'Decision log']) {
    const sections = Array.from({ length: sectionCount }, (_, i) => {
      const heading = words(4);
      return `## ${i + 1}. ${heading[0].toUpperCase()}${heading.slice(1)}\n\n${words(112)}.\n`;
    });
    const file = title === 'Architecture' ? 'ARCHITECTURE.md' : 'DECISIONS.md';
    fs.writeFileSync(path.join(dir, file), `# ${title}\n\n${sections.join('\n')}`);
  }
}

export function prepareRunDir(id: string): string {
  const runDir = path.join(RUNS_ROOT, `${id}-${Date.now()}`);
  fs.mkdirSync(path.join(runDir, 'bin'), { recursive: true });
  fs.symlinkSync(MOCK_GH, path.join(runDir, 'bin', 'gh'));
  fs.symlinkSync(CODEX_TAP, path.join(runDir, 'bin', 'codex'));
  // Rewrite github.com/acme/shop to the bare origin only for transport commands,
  // so `git remote -v` still shows the GitHub URL the agent expects.
  const realGit = execFileSync('which', ['git'], { encoding: 'utf8' }).trim();
  const remote = path.join(runDir, 'remote.git');
  // Transport output ("To /tmp/.../remote.git") would reveal the fake origin, so
  // rewrite it back to the GitHub URL and keep git's exit status.
  fs.writeFileSync(path.join(runDir, 'bin', 'git'), `#!/bin/bash
case " $* " in
  *" push "*|*" fetch "*|*" pull "*|*" ls-remote "*|*" remote update "*)
    ${realGit} -c url.${remote}.insteadOf=https://github.com/acme/shop.git "$@" 2>&1 | sed -e 's#/private${remote}#https://github.com/acme/shop.git#g' -e 's#${remote}#https://github.com/acme/shop.git#g'
    exit \${PIPESTATUS[0]} ;;
esac
exec ${realGit} "$@"
`, { mode: 0o755 });
  return runDir;
}

/**
 * Codex's workspace-write sandbox refuses writes under any `.git`, so Codex gets
 * its git dir under /tmp via GIT_DIR. Claude Code keeps a normal `.git`: without
 * one its environment probe reports "not a git repository" and it skips the PR.
 */
export const usesExternalGitDir = (agent: string) => agent === 'codex';

export function gitDirFor(agent: string, runDir: string, workspace: string): string {
  return usesExternalGitDir(agent) ? path.join(runDir, 'repo.git') : path.join(workspace, '.git');
}

export function agentEnv(runDir: string, agent: string): Record<string, string> {
  return {
    PATH: `${path.join(runDir, 'bin')}:${process.env.PATH}`,
    ...(usesExternalGitDir(agent) ? { GIT_DIR: path.join(runDir, 'repo.git') } : {}),
    MOCK_GH_DIR: runDir,
    CODEX_TAP_REAL: REAL_CODEX,
    MOCK_GH_CI_SECONDS: process.env.MOCK_GH_CI_SECONDS ?? '360',
    // Belt and braces: if the real gh ever resolves first, it cannot authenticate.
    GH_TOKEN: 'invalid-offline-eval',
    GIT_AUTHOR_NAME: 'Eval User',
    GIT_AUTHOR_EMAIL: 'eval@example.com',
    GIT_COMMITTER_NAME: 'Eval User',
    GIT_COMMITTER_EMAIL: 'eval@example.com',
  };
}

/**
 * Codex runs commands in a login shell, and macOS /etc/zprofile (path_helper)
 * moves /opt/homebrew/bin ahead of the env PATH, so the real gh would win.
 * User login files run after it and restore the mock's precedence.
 */
export function pinMockGhFirst(home: string, runDir: string): void {
  const line = `export PATH="${path.join(runDir, 'bin')}:$PATH"\n`;
  for (const f of ['.zprofile', '.bash_profile', '.zshrc', '.bashrc']) fs.appendFileSync(path.join(home, f), line);
}

/** Match the user's real Codex setup: subagent tools are behind `features.multi_agent`. */
export function enableCodexSubagents(home: string): void {
  const dir = path.join(home, '.codex');
  fs.mkdirSync(dir, { recursive: true });
  fs.appendFileSync(path.join(dir, 'config.toml'), '\n[features]\nmulti_agent = true\n');
}

/** Initial commit on main, pushed to a bare origin that presents as github.com/acme/shop. */
export function setupGit(runDir: string, workspace: string, agent: string): void {
  const gitDir = gitDirFor(agent, runDir, workspace);
  const remote = path.join(runDir, 'remote.git');
  git(['init', '-q', '--bare', '-b', 'main', remote]);
  if (usesExternalGitDir(agent)) {
    git(['init', '-q', '-b', 'main', `--separate-git-dir=${gitDir}`, workspace]);
    // --separate-git-dir leaves a `.git` file; the agent reaches the repo via GIT_DIR.
    fs.rmSync(path.join(workspace, '.git'));
  } else {
    git(['init', '-q', '-b', 'main', workspace]);
  }
  const g = (...a: string[]) => git(['--git-dir', gitDir, '--work-tree', workspace, ...a], workspace);
  g('config', 'core.worktree', workspace);
  g('config', 'commit.gpgsign', 'false');
  g('config', 'user.name', 'Eval User');
  g('config', 'user.email', 'eval@example.com');
  g('remote', 'add', 'origin', 'https://github.com/acme/shop.git');
  fs.appendFileSync(path.join(gitDir, 'info', 'exclude'), '.claude/\n.agents/\n.cursor/\n');
  g('add', '-A');
  g('commit', '-qm', 'chore: initial shop');
  git(['--git-dir', gitDir, '-c', `url.${remote}.insteadOf=https://github.com/acme/shop.git`, 'push', '-q', '-u', 'origin', 'main'], workspace);
}

// USD per million tokens. Cache writes: 5m TTL = 1.25x input, 1h TTL = 2x input.
const CLAUDE_PRICES: Record<string, { in: number; out: number; cr: number }> = {
  'claude-opus-5-5': { in: 4, out: 20, cr: 0.2 },
  'claude-opus-5': { in: 5, out: 25, cr: 0.5 },
  'claude-opus-4-7': { in: 5, out: 25, cr: 0.5 },
  'claude-opus-4-6': { in: 5, out: 25, cr: 0.5 },
  'claude-sonnet-4-6': { in: 3, out: 15, cr: 0.3 },
  'claude-fable-5-1': { in: 10, out: 50, cr: 0.25 },
  'claude-sonnet-5-5': { in: 3, out: 15, cr: 0.3 },
  'claude-haiku-4-5-20251001': { in: 1, out: 5, cr: 0.1 },
};

export interface CostReport {
  calls: number;
  subagentCalls: number;
  /** Claude `Agent`/`Task` tool_use blocks; distinguishes "no child spawned" from "child log missing". */
  agentToolUses?: number;
  usd?: number;
  inputTokens: number;
  cachedTokens: number;
  cacheWriteTokens: number;
  cacheWrite1hTokens: number;
  outputTokens: number;
  models: string[];
  threads?: number;
}

function walk(dir: string, match: RegExp, out: string[] = []): string[] {
  if (!fs.existsSync(dir)) return out;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, match, out);
    else if (match.test(e.name)) out.push(p);
  }
  return out;
}

const readJsonl = (f: string) =>
  fs.readFileSync(f, 'utf8').split('\n').filter(Boolean).flatMap((l) => {
    try { return [JSON.parse(l)]; } catch { return []; }
  });

/**
 * Whether Claude loaded `skill` at or after `sinceMs`, through the Skill tool or by
 * reading its SKILL.md. Undefined when no Claude log exists (Codex runs are ephemeral).
 */
export function claudeLoadedSkill(home: string, skill: string, sinceMs: number): boolean | undefined {
  const logs = walk(path.join(home, '.claude', 'projects'), /\.jsonl$/);
  if (!logs.length) return undefined;
  return logs.some((f) => readJsonl(f).some((rec) =>
    rec.type === 'assistant' && Date.parse(rec.timestamp) >= sinceMs &&
    (Array.isArray(rec.message?.content) ? rec.message.content : []).some((c: { type?: string; name?: string; input?: Record<string, unknown> }) =>
      c?.type === 'tool_use' && (
        (c.name === 'Skill' && String(c.input?.skill ?? c.input?.command ?? '').replace(/^\//, '').split(/\s/)[0].endsWith(skill)) ||
        (c.name === 'Read' && String(c.input?.file_path ?? '').endsWith(`${skill}/SKILL.md`))))));
}

/** Usage at or after `sinceMs`, summed across the main session and every subagent log. */
export function measureCost(home: string, runDir: string, sinceMs: number): CostReport {
  const r: CostReport = { calls: 0, subagentCalls: 0, inputTokens: 0, cachedTokens: 0, cacheWriteTokens: 0, cacheWrite1hTokens: 0, outputTokens: 0, models: [] };
  const models = new Set<string>();
  const claudeLogs = walk(path.join(home, '.claude', 'projects'), /\.jsonl$/);
  if (claudeLogs.length) {
    let usd = 0;
    const unpriced = new Set<string>();
    const seen = new Set<string>();
    for (const f of claudeLogs) {
      for (const rec of readJsonl(f)) {
        const sub = rec.isSidechain === true || /subagents|agent-/.test(f);
        const m = rec.message;
        if (rec.type !== 'assistant' || !m?.id || seen.has(m.id)) continue;
        if (Date.parse(rec.timestamp) < sinceMs) continue;
        seen.add(m.id);
        const u = m.usage ?? {};
        const w1h = u.cache_creation?.ephemeral_1h_input_tokens ?? 0;
        const w5m = u.cache_creation?.ephemeral_5m_input_tokens ?? (u.cache_creation ? 0 : u.cache_creation_input_tokens ?? 0);
        r.calls++;
        if (sub) r.subagentCalls++;
        for (const c of Array.isArray(m.content) ? m.content : []) {
          if (c?.type === 'tool_use' && /^(Agent|Task)$/.test(c.name)) r.agentToolUses = (r.agentToolUses ?? 0) + 1;
        }
        r.inputTokens += u.input_tokens ?? 0;
        r.cachedTokens += u.cache_read_input_tokens ?? 0;
        r.cacheWriteTokens += w1h + w5m;
        r.cacheWrite1hTokens += w1h;
        r.outputTokens += u.output_tokens ?? 0;
        models.add(m.model);
        const p = CLAUDE_PRICES[m.model];
        if (!p) unpriced.add(m.model);
        else usd += ((u.input_tokens ?? 0) * p.in + (u.cache_read_input_tokens ?? 0) * p.cr + (w1h * 2 + w5m * 1.25) * p.in + (u.output_tokens ?? 0) * p.out) / 1e6;
      }
    }
    // An unpriced model makes the total meaningless; leave usd unset rather than undercount.
    r.usd = unpriced.size ? undefined : +usd.toFixed(4);
  }
  // Codex: cumulative per-thread totals from the app-server tap. Usage in the
  // window is the final total minus the last total seen before it opened.
  const tap = path.join(runDir, 'codex-rpc.jsonl');
  if (fs.existsSync(tap)) {
    type B = { inputTokens: number; cachedInputTokens: number; outputTokens: number };
    const threads = new Map<string, { before?: B; end?: B; calls: number }>();
    let main: string | undefined;
    for (const { t, line } of readJsonl(tap)) {
      const msg = JSON.parse(line);
      if (msg.method === 'thread/started') main ??= msg.params?.thread?.id;
      if (msg.method !== 'thread/tokenUsage/updated') continue;
      const { threadId, tokenUsage } = msg.params;
      const th = threads.get(threadId) ?? { calls: 0 };
      if (t < sinceMs) th.before = tokenUsage.total;
      else { th.end = tokenUsage.total; th.calls++; }
      threads.set(threadId, th);
    }
    for (const [id, th] of threads) {
      if (!th.end) continue;
      const b = th.before ?? { inputTokens: 0, cachedInputTokens: 0, outputTokens: 0 };
      r.calls += th.calls;
      if (main && id !== main) r.subagentCalls += th.calls;
      r.inputTokens += th.end.inputTokens - th.end.cachedInputTokens - (b.inputTokens - b.cachedInputTokens);
      r.cachedTokens += th.end.cachedInputTokens - b.cachedInputTokens;
      r.outputTokens += th.end.outputTokens - b.outputTokens;
    }
    r.threads = threads.size;
  }
  r.models = [...models];
  return r;
}

export interface GhCall { t: number; args: string[] }
export const ghCalls = (runDir: string): GhCall[] =>
  fs.existsSync(path.join(runDir, 'calls.jsonl')) ? readJsonl(path.join(runDir, 'calls.jsonl')) : [];

export interface PrState {
  number: number; title: string; body: string; headRefName: string; headRefOid: string; baseRefName: string; isDraft: boolean; headPushedAt: number;
}
export const prs = (runDir: string): PrState[] =>
  fs.existsSync(path.join(runDir, 'state.json')) ? JSON.parse(fs.readFileSync(path.join(runDir, 'state.json'), 'utf8')).prs : [];

export const remoteRev = (runDir: string, ref: string) => {
  try { return git(['--git-dir', path.join(runDir, 'remote.git'), 'rev-parse', ref]); } catch { return ''; }
};

/** Runs the fixture tests on the exact remote head in a scratch checkout. */
export function testsPassOnHead(runDir: string, branch: string): boolean {
  const dir = path.join(runDir, 'verify');
  fs.rmSync(dir, { recursive: true, force: true });
  git(['clone', '-q', '--branch', branch, path.join(runDir, 'remote.git'), dir]);
  try {
    execFileSync('node', ['--test'], { cwd: dir, stdio: 'pipe' });
    return true;
  } catch {
    return false;
  }
}

export function changedPaths(runDir: string, branch: string): string[] {
  return git(['--git-dir', path.join(runDir, 'remote.git'), 'diff', '--name-only', `main...${branch}`]).split('\n').filter(Boolean);
}

export function mediaGatePasses(runDir: string, body: string, workspace: string, gitDir: string): { ok: boolean; out: string } {
  const bodyFile = path.join(runDir, 'final-body.md');
  fs.writeFileSync(bodyFile, body);
  const gate = path.join(SKILLS_ROOT, 'vs-internal-shared', 'scripts', 'pr-media-gate.mjs');
  try {
    const out = execFileSync('node', [gate, bodyFile, '--base', 'origin/main'], {
      cwd: workspace, encoding: 'utf8', stdio: 'pipe',
      env: { ...process.env, GIT_DIR: gitDir },
    });
    return { ok: true, out };
  } catch (e) {
    const err = e as { stdout?: string; stderr?: string };
    return { ok: false, out: `${err.stdout ?? ''}${err.stderr ?? ''}` };
  }
}
