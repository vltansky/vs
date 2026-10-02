#!/usr/bin/env node
// Transparent `codex` wrapper for the cost A/B eval. PathGrade starts Codex's
// app-server with `ephemeral: true`, so no rollout file records token usage; this
// tap copies every app-server stdout line, timestamped, to MOCK_GH_DIR so the
// harness can sum `thread/tokenUsage/updated` notifications per thread.
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const real = process.env.CODEX_TAP_REAL;
if (!real) { process.stderr.write('codex-tap: CODEX_TAP_REAL is not set\n'); process.exit(4); }
const tapping = process.argv.includes('app-server') && process.env.MOCK_GH_DIR;
// The user's real Codex enables subagent tools via `features.multi_agent`; the
// sandbox HOME has no config, so inject it to compare like with like.
const extra = tapping ? ['-c', 'features.multi_agent=true'] : [];
const child = spawn(real, [...extra, ...process.argv.slice(2)], { stdio: ['inherit', tapping ? 'pipe' : 'inherit', 'inherit'] });
if (tapping) {
  const log = fs.createWriteStream(path.join(process.env.MOCK_GH_DIR, 'codex-rpc.jsonl'), { flags: 'a' });
  let buf = '';
  child.stdout.on('data', (chunk) => {
    process.stdout.write(chunk);
    buf += chunk;
    let nl;
    while ((nl = buf.indexOf('\n')) >= 0) {
      const line = buf.slice(0, nl);
      buf = buf.slice(nl + 1);
      if (line.includes('tokenUsage') || line.includes('thread/started')) log.write(`${JSON.stringify({ t: Date.now(), line })}\n`);
    }
  });
}
for (const sig of ['SIGTERM', 'SIGINT', 'SIGHUP']) process.on(sig, () => child.kill(sig));
child.on('exit', (code, signal) => (signal ? process.kill(process.pid, signal) : process.exit(code ?? 1)));
