import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { createAgent } from '../../vs-internal-shared/test/pathgrade-agent';
import { CATCH_ALL_ASK_USER, CONVERSE_ASK_USER_DEFAULTS } from '../../vs-internal-shared/test/pathgrade-v1';
import {
  agentEnv, buildWorkspace, enableCodexSubagents, gitDirFor, changedPaths, ghCalls, measureCost, mediaGatePasses,
  pinMockGhFirst, prepareRunDir, prs, remoteRev, RUNS_ROOT, setupGit, testsPassOnHead,
} from './ab/harness';
import { VARIANTS } from './ab/variants';

// Opt-in cost A/B for the full publish path: a live agent fixes a bug in a repo
// with a large inherited context, then runs "create pr" against an offline gh
// whose CI turns green after MOCK_GH_CI_SECONDS. Each trial spends real tokens
// and ~10-20 minutes, so it never runs in the default suite.
//   SHIPIT_AB=1 PATHGRADE_AGENT=claude SHIPIT_AB_VARIANTS=v0-baseline npm run eval -- ship-it-cost.ab
// For Codex, set PATHGRADE_CODEX_MODEL to a model with collaboration tools
// (gpt-5.6-luna has none, so fresh-context child variants cannot run on it).
const EVAL_AGENT = (process.env.PATHGRADE_AGENT ?? 'codex') as 'claude' | 'codex';
const SELECTED = (process.env.SHIPIT_AB_VARIANTS ?? VARIANTS.map((v) => v.id).join(',')).split(',');

const FIX_PROMPT = `Checkout still applies coupons after they expire (coupons carry an ISO \`expiresAt\`).
Before changing anything, read AGENTS.md and every document it points to in full.
Then fix the bug in src/coupon.js, add a regression test, and run npm test. Do not commit.`;
// Plain wording on purpose: "/vs-ship-it create pr" made Claude read "create pr"
// as an explicit scope and skip babysitting, which is not what users get.
const SHIP_PROMPT = 'create pr';

describe.skipIf(!process.env.SHIPIT_AB)(`ship-it cost A/B (${EVAL_AGENT})`, () => {
  for (const variant of VARIANTS.filter((v) => SELECTED.includes(v.id))) {
    it(variant.id, async () => {
      const runDir = prepareRunDir(`${EVAL_AGENT}-${variant.id}`);
      const agent = await createAgent({
        agent: EVAL_AGENT,
        timeout: 2400,
        workspace: buildWorkspace(variant, runDir),
        env: agentEnv(runDir, EVAL_AGENT),
      });
      const started = Date.now();
      const ciSeconds = Number(agentEnv(runDir, EVAL_AGENT).MOCK_GH_CI_SECONDS);
      let shipStarted = 0;
      try {
        const home = path.join(path.dirname(agent.workspace), 'home');
        setupGit(runDir, agent.workspace, EVAL_AGENT);
        pinMockGhFirst(home, runDir);
        if (EVAL_AGENT === 'codex') enableCodexSubagents(home);
        const conversation = await agent.runConversation({
          firstMessage: FIX_PROMPT,
          maxTurns: 2,
          reactions: [{ when: /[\s\S]/, reply: SHIP_PROMPT, once: true }, CATCH_ALL_ASK_USER],
          ...CONVERSE_ASK_USER_DEFAULTS,
        });
        const shipMsg = agent.messages.findIndex((m) => m.role === 'user' && m.content === SHIP_PROMPT);
        // The ship turn starts after the fix turn's last logged event; fall back to run start.
        shipStarted = firstShipTimestamp(home) ?? turnBoundary(agent.log) ?? started;
        const ship = measureCost(home, runDir, shipStarted);
        const total = measureCost(home, runDir, 0);
        const calls = ghCalls(runDir);
        const pr = prs(runDir).at(-1);
        const finalMessage = agent.messages.filter((m) => m.role === 'agent').at(-1)?.content ?? '';
        const shipCalls = calls.filter((c) => c.t >= shipStarted);
        const quality: Record<string, boolean> = {
          prCreated: !!pr,
          notDraft: !!pr && !pr.isDraft,
          featureBranch: !!pr && pr.headRefName !== 'main',
          headMatchesRemote: !!pr && remoteRev(runDir, `refs/heads/${pr.headRefName}`) === pr.headRefOid,
          scopedFiles: !!pr && changedPaths(runDir, pr.headRefName).every((f) => /^(src|test)\//.test(f)),
          testsPassOnHead: !!pr && testsPassOnHead(runDir, pr.headRefName),
          bodyExplainsExpiry: !!pr && /expir/i.test(pr.body) && /before/i.test(pr.body) && /after/i.test(pr.body),
          mediaGate: !!pr && mediaGatePasses(runDir, pr.body, agent.workspace, gitDirFor(EVAL_AGENT, runDir, agent.workspace)).ok,
          // Observed CI after it actually turned green, and said so in the handoff.
          babysatToCiGreen: !!pr && calls.some((c) => c.t >= pr.headPushedAt + ciSeconds * 1000) &&
            /review needed|@alice|checks? (?:pass|green)|ci (?:is )?(?:pass|green)|all checks/i.test(finalMessage),
          handoffHasUrl: /github\.com\/acme\/shop\/pull\/\d+/.test(finalMessage),
          noMergeClaim: !/\bmerged\b(?! by)/i.test(finalMessage.replace(/not (?:been )?merged|until merged|merge-ready/gi, '')),
        };
        const efficiency = {
          ghCallsDuringShip: shipCalls.length,
          checksWatch: shipCalls.filter((c) => c.args[0] === 'pr' && c.args[1] === 'checks' && c.args.includes('--watch')).length,
          oneShotPolls: shipCalls.filter((c) => (c.args[0] === 'pr' && /^(checks|view)$/.test(c.args[1])) || c.args[0] === 'api').length,
          wallSeconds: Math.round((Date.now() - shipStarted) / 1000),
        };
        const record = {
          agent: EVAL_AGENT, variant: variant.id, runDir, completion: conversation.completionReason,
          shipMsgIndex: shipMsg, quality, qualityScore: Object.values(quality).filter(Boolean).length / Object.keys(quality).length,
          efficiency, ship, total, finalMessage: finalMessage.slice(-1500),
        };
        fs.appendFileSync(path.join(RUNS_ROOT, 'results.jsonl'), `${JSON.stringify(record)}\n`);
        fs.writeFileSync(path.join(runDir, 'transcript.txt'), agent.transcript());
        console.log(JSON.stringify({ ...record, finalMessage: undefined }, null, 2));
        expect(quality.prCreated).toBe(true);
      } finally {
        await agent.dispose();
      }
    }, 2_700_000);
  }
});

/** Codex app-server sessions are ephemeral (no rollout), so use PathGrade's own turn log. */
function turnBoundary(log: ReadonlyArray<{ type: string; timestamp?: string; turn_number?: number }>): number | undefined {
  const entry = log.find((e) => e.type === 'user_reply' && e.timestamp);
  return entry?.timestamp ? Date.parse(entry.timestamp) : undefined;
}

/** Timestamp of the "create pr" user record in the agent's own session log. */
function firstShipTimestamp(home: string): number | undefined {
  const stack = [path.join(home, '.claude', 'projects'), path.join(home, '.codex', 'sessions')];
  let best: number | undefined;
  while (stack.length) {
    const dir = stack.pop()!;
    if (!fs.existsSync(dir)) continue;
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) { stack.push(p); continue; }
      if (!p.endsWith('.jsonl') || /subagents/.test(p)) continue;
      for (const line of fs.readFileSync(p, 'utf8').split('\n')) {
        if (!line.includes(SHIP_PROMPT)) continue;
        try {
          const rec = JSON.parse(line);
          const isClaudeUser = rec.type === 'user' && JSON.stringify(rec.message?.content ?? '').includes(SHIP_PROMPT);
          const isCodexUser = rec.type === 'event_msg' && rec.payload?.type === 'user_message' && rec.payload.message?.includes(SHIP_PROMPT);
          if (isClaudeUser || isCodexUser) {
            const t = Date.parse(rec.timestamp);
            if (best === undefined || t < best) best = t;
          }
        } catch { /* partial line */ }
      }
    }
  }
  return best;
}
