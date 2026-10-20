import * as crypto from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { createRequire } from 'node:module';

const guard = createRequire(__filename)('./render-guard.cjs') as {
  pageHash: (root: string) => string;
  allowRequest: (root: string, url: string) => boolean;
};

// Host-side helpers for visual-look.eval.ts: Chrome lookup, the geometry
// checks for each case, and the check that shots/result.png is a render_page
// output of the final code.

export function resolveChrome(): string {
  if (process.env.CHROME_PATH) return process.env.CHROME_PATH;
  const found = [
    '/usr/bin/google-chrome',
    '/usr/bin/google-chrome-stable',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  ].find((c) => fs.existsSync(c));
  if (!found) throw new Error('No Chrome found. Set CHROME_PATH.');
  return found;
}

export async function withPage<T>(workspace: string, fn: (page: import('puppeteer-core').Page) => Promise<T>): Promise<T> {
  const puppeteer = await import('puppeteer-core');
  const browser = await puppeteer.launch({
    executablePath: resolveChrome(),
    // Chrome's own sandbox stays on; RENDER_NO_SANDBOX=1 is only for hosts
    // (root CI containers) where it cannot start.
    args: process.env.RENDER_NO_SANDBOX === '1' ? ['--no-sandbox'] : [],
    headless: true,
  });
  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1200, height: 640 });
    await page.goto(`file://${path.join(workspace, 'index.html')}`, { waitUntil: 'load' });
    return await fn(page);
  } finally {
    await browser.close();
  }
}

// Visible (ink) height of an element: screenshot its box, count the rows that
// hold any pixel clearly darker or more saturated than the page background.
export async function inkHeight(page: import('puppeteer-core').Page, selector: string): Promise<number | null> {
  const el = await page.$(selector);
  if (!el) return null;
  const box = await el.boundingBox();
  if (!box) return null;
  const pad = 4;
  const data = await page.screenshot({
    encoding: 'base64',
    clip: { x: Math.max(0, box.x - pad), y: Math.max(0, box.y - pad), width: box.width + pad * 2, height: box.height + pad * 2 },
  });
  return page.evaluate(async (b64: string) => {
    const img = new Image();
    img.src = `data:image/png;base64,${b64}`;
    await img.decode();
    const c = document.createElement('canvas');
    c.width = img.width;
    c.height = img.height;
    const ctx = c.getContext('2d')!;
    ctx.drawImage(img, 0, 0);
    const px = ctx.getImageData(0, 0, c.width, c.height).data;
    const [br, bg, bb] = [px[0], px[1], px[2]];
    let top = -1;
    let bottom = -1;
    for (let y = 0; y < c.height; y++) {
      for (let x = 0; x < c.width; x++) {
        const i = (y * c.width + x) * 4;
        if (Math.abs(px[i] - br) + Math.abs(px[i + 1] - bg) + Math.abs(px[i + 2] - bb) > 90) {
          if (top < 0) top = y;
          bottom = y;
          break;
        }
      }
    }
    return top < 0 ? 0 : bottom - top + 1;
  }, data as string);
}

export type Geometry = { ok: boolean; measured: Record<string, number | null> };

export type LogoBoxes = { wix: number | null; multitan: number | null; icon: number | null; textPx: number | null };

// Balanced window for cobrand-logos. This is fixture ground truth from renders,
// not a general rule: at 40/40/18 (Wix box / Multitan box / Hebrew text px) the
// dense Wix wordmark reads bigger than the icon + small-text lockup; at
// 30/44/24 the two read as equal partners (agreed in review 5584741988).
// Window: the Wix box clearly shorter than the lockup box (at least 4px) but not
// tiny (22-40px), the lockup box 34-60px, and the lockup text in a sane band
// (20-30px) and not taller than the lockup box allows. The fixture starts at
// 28/40/18, which fails on the text band.
export function cobrandBalanced(m: LogoBoxes): boolean {
  const { wix, multitan, textPx } = m;
  if (wix === null || multitan === null || textPx === null) return false;
  return (
    wix >= 22 &&
    wix <= 40 &&
    wix <= multitan - 4 &&
    multitan >= 34 &&
    multitan <= 60 &&
    textPx >= 20 &&
    textPx <= 30 &&
    textPx <= multitan * 0.7
  );
}

export async function cobrandGeometry(workspace: string): Promise<Geometry> {
  const m = await withPage(workspace, (page) =>
    page.evaluate(() => {
      const wix = document.querySelector('[alt="Wix"], [aria-label="Wix"]');
      const mt = document.querySelector('[aria-label="Multitan"], [alt="Multitan"]');
      const icon = mt?.querySelector('img, svg') ?? null;
      const text = [...(mt?.querySelectorAll('*') ?? [])].find(
        (e) => /מולטיטן/.test(e.textContent ?? '') && e.children.length === 0,
      );
      const h = (e: Element | null) => (e ? Math.round(e.getBoundingClientRect().height) : null);
      return { wix: h(wix), multitan: h(mt), icon: h(icon), textPx: text ? parseFloat(getComputedStyle(text).fontSize) : null };
    }),
  );
  return { ok: cobrandBalanced(m), measured: m };
}

// store-badges starts at 48px CSS height on both; visible: App Store 48px,
// Google Play about 31px. Pass: visible heights within 2px of each other.
export async function badgeGeometry(workspace: string): Promise<Geometry> {
  const m = await withPage(workspace, async (page) => ({
    apple: await inkHeight(page, '[alt*="App Store"], [aria-label*="App Store"]'),
    google: await inkHeight(page, '[alt*="Google Play"], [aria-label*="Google Play"]'),
  }));
  const ok = m.apple !== null && m.google !== null && m.apple >= 24 && m.google >= 24 && Math.abs(m.apple - m.google) <= 2;
  return { ok, measured: m };
}

// Same hash as render-page-mcp.cjs (render-guard.cjs): every workspace file
// the page can load, including SVGs and other assets.
export function sourceHash(dir: string): string {
  return guard.pageHash(fs.realpathSync(dir));
}

export type RenderEntry = { out: string; pngSha: string; sourceHash: string };

export function renderCheck(workspace: string, log: string, refs: string[]) {
  const entries: RenderEntry[] = fs.existsSync(log)
    ? fs.readFileSync(log, 'utf8').trim().split('\n').filter(Boolean).map((l) => JSON.parse(l))
    : [];
  const result = path.join(workspace, 'shots', 'result.png');
  if (!fs.existsSync(result)) return { ok: false, why: 'no shots/result.png', calls: entries.length };
  const bytes = fs.readFileSync(result);
  if (refs.some((ref) => bytes.equals(fs.readFileSync(path.join(workspace, 'shots', ref))))) {
    return { ok: false, why: 'result.png is a copy of a reference shot', calls: entries.length };
  }
  const sha = crypto.createHash('sha256').update(bytes).digest('hex');
  const match = entries.find((e) => e.pngSha === sha);
  if (!match) return { ok: false, why: 'result.png did not come from render_page', calls: entries.length };
  if (match.sourceHash !== sourceHash(workspace)) {
    return { ok: false, why: 'result.png shows an older state of the page', calls: entries.length };
  }
  return { ok: true, why: 'rendered from the final code', calls: entries.length };
}

