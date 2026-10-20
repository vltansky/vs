import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { check, evaluate, judge } from '@wix/pathgrade';
import { describe, expect, it } from 'vitest';
import { createAgent } from '../../vs-internal-shared/test/pathgrade-agent';

type LogoBoxes = { wix: number | null; multitan: number | null; icon: number | null; textPx: number | null };

// Renders the edited page on the host (the agent's sandbox may not run Chrome)
// and measures the two marks. The fixture starts at wix 28 / multitan 40 /
// icon 40 / Hebrew text 18px.
async function measureLogos(workspace: string): Promise<LogoBoxes> {
  const puppeteer = await import('puppeteer-core');
  const browser = await puppeteer.launch({
    executablePath: process.env.CHROME_PATH ?? '/usr/bin/google-chrome',
    args: ['--no-sandbox'],
    headless: true,
  });
  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1200, height: 640 });
    await page.goto(`file://${path.join(workspace, 'index.html')}`);
    return await page.evaluate(() => {
      const wix = document.querySelector('[alt="Wix"], [aria-label="Wix"]');
      const mt = document.querySelector('[aria-label="Multitan"], [alt="Multitan"]');
      const icon = mt?.querySelector('img, svg') ?? null;
      const text = [...(mt?.querySelectorAll('*') ?? [])].find(
        (e) => /מולטיטן/.test(e.textContent ?? '') && e.children.length === 0,
      );
      const h = (e: Element | null) => (e ? Math.round(e.getBoundingClientRect().height) : null);
      return {
        wix: h(wix),
        multitan: h(mt),
        icon: h(icon),
        textPx: text ? parseFloat(getComputedStyle(text).fontSize) : null,
      };
    });
  } finally {
    await browser.close();
  }
}

// Fail shape from the real run: one height copied onto both marks and nothing
// else touched. Unchanged boxes also fail (the ask was not acted on). A dense
// wordmark at the lockup's box height already reads heavier (rendered check:
// Wix 40px outweighs the 40px icon + 18px text), so a Wix box at or above the
// lockup box with the text left at 18px or smaller also fails.
function isSingleNumberEqualize(m: LogoBoxes): boolean {
  const near = (a: number | null, b: number | null) => a !== null && b !== null && Math.abs(a - b) <= 1;
  const unchanged = m.wix === 28 && m.multitan === 40 && m.textPx === 18;
  const equalized = near(m.wix, m.multitan) && near(m.wix, m.icon) && (m.textPx ?? 18) <= 18;
  const wordmarkOutweighs =
    m.wix !== null && m.multitan !== null && m.wix >= m.multitan - 1 && (m.textPx ?? 18) <= 18;
  return unchanged || equalized || wordmarkOutweighs;
}

// Replays a real turn (Wix LP chat, 2026-08-18, backlog #44). Vlad asked
// "Can we do logos same height?" on a co-branded header: the Wix wordmark next
// to the Multitan icon + Hebrew text. The bot set one pixel height on both,
// replied "Logos are the same height now.", and took two more rounds to learn
// he meant visual balance of the whole mark. The plain-model baseline did the
// same: equalized the outer boxes at 32px and reported done.
//
// Pass: the change balances the whole marks optically, the agent looks at the
// rendered result against the previous shot before reporting, and the report
// names what it compared. Fail: one number equalized and "done".

const SKILL_DIR = path.resolve(__dirname, '..');
const SKILLS_DIR = path.resolve(SKILL_DIR, '..');
const FIXTURE_DIR = path.join(__dirname, 'fixtures', 'cobrand-logos');
const EVAL_AGENT = (process.env.PATHGRADE_AGENT ?? 'codex') as 'claude' | 'codex';
const REPO_ROOT = path.resolve(SKILLS_DIR, '..');

// The agent's command sandbox cannot start Chrome, so screenshots go through a
// small MCP server that runs outside it (see render-page-mcp.cjs).
function writeRenderMcpConfig(dir: string) {
  const file = path.join(dir, 'render-mcp.json');
  fs.writeFileSync(
    file,
    JSON.stringify({
      mcpServers: {
        'render-page': {
          command: process.execPath,
          args: [
            path.join(__dirname, 'render-page-mcp.cjs'),
            path.join(REPO_ROOT, 'node_modules', 'puppeteer-core'),
          ],
          env: { CHROME_PATH: process.env.CHROME_PATH ?? '/usr/bin/google-chrome' },
          startup_timeout_sec: 20,
          tool_timeout_sec: 60,
        },
      },
    }),
  );
  return file;
}

function stageWorkspace() {
  const workspace = fs.mkdtempSync(path.join(os.tmpdir(), 'vs-ui-look-'));
  fs.cpSync(FIXTURE_DIR, workspace, { recursive: true });
  for (const convention of ['.agents', '.claude']) {
    fs.cpSync(
      path.join(SKILLS_DIR, 'vs-internal-shared'),
      path.join(workspace, convention, 'skills', 'vs-internal-shared'),
      { recursive: true, filter: (src) => !src.split(path.sep).includes('test') },
    );
  }
  return workspace;
}

const PROMPT = `Use $vs-ui.

[You are the agent building a co-branded landing page (Multitan × Wix) for Vlad in this workspace: index.html and styles.css. The header shows two logos side by side: the Wix wordmark and the Multitan logo (icon + Hebrew text). You can render the page and take screenshots with the render_page tool (it saves the PNG and shows it to you). NOTES.md has the thread so far. Oldest first.]

Aug 18, you sent two shots: "Now (master)." and "Proposed. Same typeface." (shots/master.png, shots/proposed.png)
Aug 18, 17:08, Vlad: "good I like it Can we do logos same height?  Also repalce em dashes with regular dashes"

Task: make the change and report back with a shot (save it as shots/result.png). Your reply is what Vlad reads.`;

describe('vs-ui pre-send visual look (#44 replay)', () => {
  it('balances the whole logo marks and names what it compared before reporting', async () => {
    const workspace = stageWorkspace();
    const mcpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'vs-ui-look-mcp-'));
    const agent = await createAgent({
      mcpConfigFile: writeRenderMcpConfig(mcpDir),
      agent: EVAL_AGENT,
      timeout: 600,
      skillDir: SKILL_DIR,
      workspace,
      debug: true,
    });

    try {
      const reply = await agent.prompt(PROMPT);

      const result = await evaluate(
        agent,
        [
          check('em-dashes-replaced', ({ workspace: ws }) => {
            const html = fs.readFileSync(path.join(ws, 'index.html'), 'utf8');
            return !html.includes('—') && /Wix/.test(html) && /מולטיטן/.test(html);
          }),
          check('no-copied-reference-shot', ({ workspace: ws }) => {
            const result = path.join(ws, 'shots', 'result.png');
            if (!fs.existsSync(result)) return true;
            const bytes = fs.readFileSync(result);
            return ['master.png', 'proposed.png'].every(
              (ref) => !bytes.equals(fs.readFileSync(path.join(FIXTURE_DIR, 'shots', ref))),
            );
          }),
          check('not-one-equalized-number', async ({ workspace: ws }) => {
            const m = await measureLogos(ws);
            console.log('[visual-look] measured', JSON.stringify(m));
            return !isSingleNumberEqualize(m);
          }, { weight: 2 }),
          judge('optical-balance-not-one-number', {
            input: { 'final reply to Vlad': reply },
            rubric: `Vlad asked "Can we do logos same height?" about a header with the Wix wordmark next to the Multitan logo (a square icon plus Hebrew text). In an earlier real run, the agent set both to one pixel height and replied "Logos are the same height now." Vlad answered: "no but now visually its not same use visual capability to understand when its good balance" and "you took only the text size - i meant whole logo visually".

Grade only the OUTCOME the reply reports as done (what was changed and why). Ignore narration of intentions or progress such as "I'm checking the proportions" or "I'll compare"; those do not count unless the final report shows the result.
Score 1.0: The reported outcome treats "same height" as visual/optical balance of the whole marks (icon + text vs the wordmark, their visual weight), and says the marks were sized so they READ equal, for example the boxes differ by N px on purpose, or the wordmark was sized to the Multitan icon+text block as seen in the render.
Score 0.5: The reply mentions optical balance only as an open option or caveat ("if you want them to look equal I can...") while reporting a single equalized number as done.
Score 0.0: The reply reports one equalized number (for example "both logos now share a 40px height", both 32px, same box height, same text size) as done, with no claim that the result reads balanced.`,
            weight: 3,
          }),
          judge('names-what-was-compared', {
            input: { 'final reply to Vlad': reply },
            rubric: `Before reporting a visual change as done, the agent should look at the rendered result against a reference (the previous shot, master, or the live page) and say what it compared.

Grade the final report, not narration of intentions ("I'll compare against the prior reference").
Score 1.0: The reply names the reference it compared against (previous/proposed shot, master shot, or live page) AND what it compared (e.g. whole logo marks including icon and text, visual weight, cap height vs icon height, the dashes in the hero), or it honestly says it could not render and what is unverified.
Score 0.5: The reply says it took or attached a screenshot but does not say what it compared or against what.
Score 0.0: The reply claims done with no sign the render was looked at.`,
            weight: 2,
          }),
        ],
        { failFast: false, onScorerError: 'zero' },
      );

      console.log('[visual-look]', JSON.stringify({ score: result.score, scorers: result.scorers.map((s) => ({ name: s.name, score: s.score, details: s.details })), reply }));
      const optical = result.scorers.find((s) => s.name === 'optical-balance-not-one-number');
      const measured = result.scorers.find((s) => s.name === 'not-one-equalized-number');
      expect(measured?.score ?? 0).toBe(1);
      expect(result.scorers.find((s) => s.name === 'no-copied-reference-shot')?.score ?? 0).toBe(1);
      expect(optical?.score ?? 0).toBeGreaterThanOrEqual(0.75);
      expect(result.score).toBeGreaterThanOrEqual(0.75);
    } finally {
      await agent.dispose();
      fs.rmSync(workspace, { recursive: true, force: true });
      fs.rmSync(mcpDir, { recursive: true, force: true });
    }
  }, 720_000);
});
