import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { check, evaluate, judge } from '@wix/pathgrade';
import { describe, expect, it } from 'vitest';
import { createAgent } from '../../vs-internal-shared/test/pathgrade-agent';
import { badgeGeometry, cobrandGeometry, type Geometry, renderCheck, resolveChrome } from './visual-look.helpers';

// Two "make these the same height" cases for the vs-ui pre-send look (#44).
//
// cobrand-logos replays a real turn (Wix LP chat, 2026-08-18). Vlad asked
// "Can we do logos same height?" on a co-branded header: the Wix wordmark next
// to the Multitan icon + Hebrew text. The bot set one pixel height on both,
// replied "Logos are the same height now.", and took two more rounds to learn
// he meant visual balance of the whole mark.
//
// store-badges is held out: the skill text was never tuned on it. Two store
// badges share one CSS height, but the Google Play file carries its own clear
// space, so its visible badge is about two thirds the height of the App Store
// one. Equal numbers are already there; only a look at the render shows the gap.
//
// Pass, per case: the agent renders the edited page with render_page (the
// result shot must be that render of the final code), the visible result is
// balanced by a host-side measurement, and the reply reports optical balance
// and names what it compared. Each scorer has its own gate.

const SKILL_DIR = path.resolve(__dirname, '..');
const SKILLS_DIR = path.resolve(SKILL_DIR, '..');
const REPO_ROOT = path.resolve(SKILLS_DIR, '..');
const FIXTURES = path.join(__dirname, 'fixtures');
const EVAL_AGENT = (process.env.PATHGRADE_AGENT ?? 'codex') as 'claude' | 'codex';

type Case = {
  id: string;
  fixture: string;
  prompt: string;
  references: string[];
  textCheck?: (html: string) => boolean;
  geometry: (workspace: string) => Promise<Geometry>;
  window: string;
  balanceRubric: string;
};

const TOOL_LINE =
  'You can render the page and take screenshots with the render_page tool (it saves the PNG and shows it to you).';

const CASES: Case[] = [
  {
    // Known failing on master: the plain skill sets one shared height (40/40/18).
    id: 'cobrand-logos-known-failing-on-master',
    fixture: 'cobrand-logos',
    references: ['master.png', 'proposed.png'],
    prompt: `Use $vs-ui.

[You are the agent building a co-branded landing page (Multitan × Wix) for Vlad in this workspace: index.html and styles.css. The header shows two logos side by side: the Wix wordmark and the Multitan logo (icon + Hebrew text). ${TOOL_LINE} NOTES.md has the thread so far. Oldest first.]

Aug 18, you sent two shots: "Now (master)." and "Proposed. Same typeface." (shots/master.png, shots/proposed.png)
Aug 18, 17:08, Vlad: "good I like it Can we do logos same height?  Also repalce em dashes with regular dashes"

Task: make the change and report back with a shot (save it as shots/result.png). Your reply is what Vlad reads.`,
    textCheck: (html) => !html.includes('—') && /Wix/.test(html) && /מולטיטן/.test(html),
    geometry: cobrandGeometry,
    window: 'Wix box 22-40px and at least 4px shorter than the Multitan box (34-60px); Multitan text 20-30px. 40/40/18 is unbalanced, 30/44/24 is balanced.',
    balanceRubric: `Vlad asked "Can we do logos same height?" about a header with the Wix wordmark next to the Multitan logo (a square icon plus Hebrew text). In an earlier real run, the agent set both to one pixel height and replied "Logos are the same height now." Vlad answered: "no but now visually its not same use visual capability to understand when its good balance" and "you took only the text size - i meant whole logo visually".`,
  },
  {
    id: 'store-badges-heldout',
    fixture: 'store-badges',
    references: ['current.png'],
    prompt: `Use $vs-ui.

[You are the agent building the Reportan download page for Vlad in this workspace: index.html and styles.css. It shows two app store badges side by side. ${TOOL_LINE} NOTES.md has the thread so far. Oldest first.]

Oct 02, you sent: "Store buttons are in." (shots/current.png)
Oct 02, 11:40, Vlad: "make the app store and google play buttons the same height"

Task: make the change and report back with a shot (save it as shots/result.png). Your reply is what Vlad reads.`,
    geometry: badgeGeometry,
    window: 'Visible (ink) heights of the two badges within 2px of each other.',
    balanceRubric: `Vlad asked to make the App Store and Google Play badges "the same height". Both <img> elements already share one CSS height, but the visible badges do not look the same height. A number-only answer ("they are both 48px", or setting one shared height) does not fix what Vlad sees.`,
  },
];

function stageWorkspace(fixture: string) {
  const workspace = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'vs-ui-look-')));
  fs.cpSync(path.join(FIXTURES, fixture), workspace, { recursive: true });
  for (const convention of ['.agents', '.claude']) {
    fs.cpSync(
      path.join(SKILLS_DIR, 'vs-internal-shared'),
      path.join(workspace, convention, 'skills', 'vs-internal-shared'),
      { recursive: true, filter: (src) => !src.split(path.sep).includes('test') },
    );
  }
  return workspace;
}

// The agent's command sandbox cannot start Chrome, so screenshots go through a
// small MCP server that runs outside it (see render-page-mcp.cjs). The tool
// writes a PNG inside the workspace, so it is not read-only; this config
// approves exactly that one tool on that one server, nothing else.
function writeRenderMcpConfig(dir: string, log: string) {
  const file = path.join(dir, 'render-mcp.json');
  fs.writeFileSync(
    file,
    JSON.stringify({
      mcpServers: {
        'render-page': {
          command: process.execPath,
          args: [path.join(__dirname, 'render-page-mcp.cjs'), path.join(REPO_ROOT, 'node_modules', 'puppeteer-core')],
          env: {
            // "." = the agent's workspace: Codex starts the server there, and
            // PathGrade copies the staged workspace, so its path is not known
            // here. The server refuses / and $HOME.
            RENDER_ROOT: '.',
            RENDER_LOG: log,
            CHROME_PATH: resolveChrome(),
            ...(process.env.RENDER_NO_SANDBOX ? { RENDER_NO_SANDBOX: process.env.RENDER_NO_SANDBOX } : {}),
          },
          startup_timeout_sec: 20,
          tool_timeout_sec: 60,
          tools: { render_page: { approval_mode: 'approve' } },
        },
      },
    }),
  );
  return file;
}

const COMPARED_RUBRIC = `Before reporting a visual change as done, the agent should look at the rendered result against a reference (the previous shot, master, or the live page) and say what it compared.

Grade the final report, not narration of intentions ("I'll compare against the prior reference").
Score 1.0: The reply names the reference it compared against (a previous shot, master shot, or live page) AND what it compared (for example the whole marks, visible height, visual weight, the text it changed).
Score 0.5: The reply says it took or attached a screenshot but does not say what it compared or against what.
Score 0.0: The reply claims done with no sign the render was looked at.`;

function balanceRubric(context: string) {
  return `${context}

You also get MEASURED GROUND TRUTH from a host-side render of the final page: the measured sizes and whether they are balanced for this page. It overrides any claim in the reply. A claim that the result "reads equal", "looks balanced" or was "checked by eye / side by side" is FALSE when the ground truth says unbalanced.

Grade only the OUTCOME the reply reports as done. Ignore narration of intentions or progress such as "I'm checking the proportions" or "I'll compare".
Score 1.0: The ground truth says balanced, AND the reply treats "same height" as how the elements look in the render (visible size, visual weight of the whole element), not as one equal CSS number, and describes what it saw.
Score 0.5: The ground truth says balanced, but the reply reports it only as numbers, or never says how the result looks.
Score 0.0: The ground truth says unbalanced (whatever the reply claims), or the reply reports one equal number as done.`;
}

// A by-eye claim the measurement contradicts scores 0, without an LLM.
const BY_EYE_CLAIM =
  /\b(?:read|reads|look|looks)\s+(?:\w+\s+){0,3}(?:the\s+)?(?:same|equal|balanced|matched)\b|\bbalanced\b|\bside\s+by\s+side\b|\bby\s+eye\b|\boptical(?:ly)?\s+(?:equal|matched|balanced)\b/i;

describe('vs-ui pre-send visual look (#44)', () => {
  for (const c of CASES) {
    it(`renders, compares, and balances by eye: ${c.id}`, async () => {
      const workspace = stageWorkspace(c.fixture);
      const mcpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'vs-ui-look-mcp-'));
      const log = path.join(mcpDir, 'renders.jsonl');
      const agent = await createAgent({
        mcpConfigFile: writeRenderMcpConfig(mcpDir, log),
        agent: EVAL_AGENT,
        timeout: 600,
        skillDir: SKILL_DIR,
        workspace,
        debug: true,
      });

      try {
        const reply = await agent.prompt(c.prompt);
        let geometry: Geometry | undefined;
        let render: ReturnType<typeof renderCheck> | undefined;
        const scorers = [
          check('result-shot-rendered', ({ workspace: ws }) => {
            render = renderCheck(ws, log, c.references);
            return render.ok;
          }),
          check('visible-balance', async ({ workspace: ws }) => {
            geometry = await c.geometry(ws);
            return geometry.ok;
          }, { weight: 2 }),
          check('no-false-by-eye-claim', async ({ workspace: ws }) => {
            const g = geometry ?? (await c.geometry(ws));
            return g.ok || !BY_EYE_CLAIM.test(reply);
          }),
          judge('optical-balance-not-one-number', {
            input: async ({ workspace: ws }) => {
              const g = geometry ?? (await c.geometry(ws));
              return {
                'final reply to Vlad': reply,
                'MEASURED GROUND TRUTH': { balanced: g.ok, measured: g.measured, window: c.window },
              };
            },
            rubric: balanceRubric(c.balanceRubric),
            weight: 3,
          }),
          judge('names-what-was-compared', {
            input: { 'final reply to Vlad': reply },
            rubric: COMPARED_RUBRIC,
            weight: 2,
          }),
        ];
        if (c.textCheck) {
          const textCheck = c.textCheck;
          scorers.unshift(
            check('text-edit-done', ({ workspace: ws }) => textCheck(fs.readFileSync(path.join(ws, 'index.html'), 'utf8'))),
          );
        }
        const result = await evaluate(agent, scorers, { failFast: false, onScorerError: 'zero' });

        console.log(
          `[visual-look:${c.id}]`,
          JSON.stringify({
            score: result.score,
            render,
            measured: geometry?.measured,
            scorers: result.scorers.map((s) => ({ name: s.name, score: s.score, details: s.details })),
            reply,
          }),
        );
        // Per-scorer gates: a skipped render, a failed measurement, or a
        // missing comparison each fail the case on their own.
        for (const s of result.scorers) {
          const bar = s.name.startsWith('optical') || s.name.startsWith('names') ? 0.75 : 1;
          expect(s.score, `${s.name}: ${s.details}`).toBeGreaterThanOrEqual(bar);
        }
      } finally {
        await agent.dispose();
        fs.rmSync(workspace, { recursive: true, force: true });
        fs.rmSync(mcpDir, { recursive: true, force: true });
      }
    }, 720_000);
  }
});
