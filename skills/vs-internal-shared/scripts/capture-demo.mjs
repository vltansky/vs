import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { cursorOverlayScript } from './cursor-overlay.mjs';

// The caller supplies its existing Playwright browser and approved context options.
// This helper owns only the context it creates; closing it flushes the recording.
export async function captureDemo({ browser, directory, revision, scenario, viewport, contextOptions = {}, run }) {
  if (!revision || !scenario || !viewport || typeof run !== 'function') {
    throw new Error('Supply revision, scenario, viewport, and a run callback before recording.');
  }
  const output = path.resolve(directory);
  // A fresh directory prevents failed reruns from leaving an older success manifest.
  await mkdir(output, { recursive: false });
  const context = await browser.newContext({
    ...contextOptions,
    viewport,
    recordVideo: { dir: output, size: viewport },
  });
  const checkpoints = [];
  let video;
  try {
    const page = await context.newPage();
    await page.addInitScript(cursorOverlayScript);
    video = page.video();
    if (!video) throw new Error('Video recording is unavailable; use the existing browser recording route.');
    await run({
      page,
      click: async (locator) => {
        await locator.scrollIntoViewIfNeeded();
        const box = await locator.boundingBox();
        if (!box || !(await locator.isEnabled())) throw new Error('Demo target is hidden or disabled; inspect the page before retrying.');
        await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 22 });
        await page.waitForTimeout(450);
        await page.mouse.down();
        try {
          await page.waitForTimeout(120);
        } finally {
          await page.mouse.up();
        }
      },
      checkpoint: async (caption, verify) => {
        if (!caption || typeof verify !== 'function') throw new Error('Each checkpoint needs a caption and an assertion callback.');
        await verify();
        await page.waitForTimeout(600);
        const still = path.join(output, `${checkpoints.length + 1}.png`);
        await page.screenshot({ path: still });
        checkpoints.push({ caption, still });
      },
    });
    if (!checkpoints.length) throw new Error('No verified checkpoints captured; add a checkpoint to the scenario.');
  } finally {
    await context.close();
  }
  const manifest = { revision, scenario, viewport, video: await video.path(), checkpoints, visualInspection: 'pending' };
  await writeFile(path.join(output, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
  return manifest;
}
