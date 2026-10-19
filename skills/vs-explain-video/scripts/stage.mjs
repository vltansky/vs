// Opens the work dir's index.html in headless Chrome for check.mjs: checks the
// inputs, resolves Playwright like render.mjs, and hands out fresh pages that
// are booted and READY. Exits 2 (blocked) the same way render.mjs does.
import { existsSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

import { ensurePlaywright, fail, which } from './media.mjs';

export const openStage = async (work, script) => {
  for (const file of ['index.html', 'timeline.js', 'scenes.js', 'motion.js', 'captions.js']) {
    if (!existsSync(path.join(work, file))) {
      fail(`${path.join(work, file)} is missing. ${file === 'timeline.js' ? 'Run narrate.mjs first.' : 'Run init.mjs first.'}`);
    }
  }
  if (!which('ffmpeg')) fail(`ffmpeg missing. Run: brew install ffmpeg. Then rerun ${script}.`);
  const { entry, error } = ensurePlaywright([work]);
  if (!entry) fail(`Playwright is not available: ${error}. Fix that and rerun ${script}, or set PLAYWRIGHT_MODULE=/abs/path/node_modules/playwright-core.`);
  const playwright = await import(pathToFileURL(entry).href);
  const chromium = playwright.chromium ?? playwright.default?.chromium;
  const flags = { args: ['--force-color-profile=srgb', '--disable-gpu-vsync'] };
  let browser;
  try {
    browser = await chromium.launch(flags);
  } catch (bundled) {
    try {
      browser = await chromium.launch({ ...flags, channel: 'chrome' });
    } catch {
      fail(`Chromium did not launch: ${bundled.message.split('\n')[0]}. Run: npx playwright install chromium. Then rerun ${script}.`);
    }
  }
  const errors = [];
  const newPage = async () => {
    const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
    page.on('pageerror', (e) => errors.push(e.message));
    page.on('console', (m) => {
      if (m.type() === 'error' && !/favicon/.test(m.text())) errors.push(m.text());
    });
    await page.goto(pathToFileURL(path.join(work, 'index.html')).href);
    try {
      await page.waitForFunction('window.READY === true', null, { timeout: 15000 });
    } catch {
      await browser.close();
      fail(`The stage never became ready. Page errors: ${errors.join(' | ') || 'none'}. Fix scenes.js and rerun.`);
    }
    return page;
  };
  return { browser, newPage, errors };
};
