// Render an HTMDX artifact headlessly and report whether it compiled.
//
//   node render-check.mjs <file.html> [more.html ...]
//
// HTMDX renders its own diagnostic page on failure, so the check is: did the
// document render, or did the runtime replace it with "Failed step: compile" /
// "Failed step: render".
//
// Exit codes: 0 all rendered · 1 an artifact failed · 2 could not check.
// Treat 2 as "not verified" — never as a pass.
const files = process.argv.slice(2);
if (!files.length) {
  console.error('usage: node render-check.mjs <file.html> [...]');
  process.exit(2);
}

// This script runs from the installed plugin, but playwright lives in the
// project being worked on — resolve from cwd before falling back to our own
// module path.
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

const fromCwd = createRequire(pathToFileURL(process.cwd() + '/'));

let chromium;
for (const specifier of ['playwright', 'playwright-core']) {
  for (const load of [
    () => import(pathToFileURL(fromCwd.resolve(specifier)).href),
    () => import(specifier),
  ]) {
    try {
      const ns = await load();
      // playwright is CJS, so the browser types may only hang off `default`.
      chromium = ns.chromium ?? ns.default?.chromium;
    } catch {
      continue;
    }
    if (chromium) break;
  }
  if (chromium) break;
}

if (!chromium) {
  console.error(
    'Cannot render: playwright is not installed here.\n' +
      'Install it (npm i -D playwright && npx playwright install chromium),\n' +
      'use the host browser tooling, or open the file:// path manually.\n' +
      'Do not report rendered proof without one of these.',
  );
  process.exit(2);
}

const browser = await chromium.launch();
let failed = 0;

for (const file of files) {
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));

  // A bare relative path becomes file://name and navigates to a host, so
  // resolve before building the URL.
  try {
    await page.goto(pathToFileURL(resolve(file)).href, { waitUntil: 'networkidle' });
  } catch (error) {
    console.error(`Cannot render ${file}: ${error.message.split('\n')[0]}`);
    console.error('Treat this as not verified, not as a pass.');
    await browser.close();
    process.exit(2);
  }
  await page.waitForTimeout(2000);

  const details = page.locator('text=Error details').first();
  if (await details.count()) await details.click().catch(() => {});
  const body = (await page.locator('body').innerText()).trim();

  // A missing local screenshot is a stale path, not a compile failure.
  const runtimeErrors = errors.filter((e) => !/ERR_FILE_NOT_FOUND/.test(e));
  const diagnostic = body.match(/Failed step: \w+[\s\S]{0,300}/);

  // A runtime older than the artifact's markup escapes raw tags to visible text
  // instead of failing, so the only symptom is a tag the reader can read.
  const escaped = body.match(/<\/?(?:video|audio|source|iframe|details|summary|div|figure)\b/i);

  // An unreachable runtime — unpublished pin, offline, blocked CDN — leaves the
  // page blank with no error of its own. Empty is never a rendered artifact.
  const blank = body.length < 40;

  if (diagnostic || runtimeErrors.length || escaped || blank) {
    failed++;
    console.log(`FAIL  ${file}`);
    if (diagnostic) console.log('  ' + diagnostic[0].split('\n').filter(Boolean).slice(0, 3).join('\n  '));
    if (escaped) {
      console.log(`  Raw HTML rendered as literal text: ${escaped[0]}`);
      console.log('  The pinned runtime predates the raw-HTML allowlist. Bump the pin.');
    }
    if (blank) {
      console.log(`  Rendered ${body.length} chars — the runtime never loaded.`);
      console.log('  Check the pinned version exists and the CDN is reachable.');
    }
    for (const e of runtimeErrors.slice(0, 3)) console.log('  ' + e);
  } else {
    console.log(`PASS  ${file} — rendered ${body.length} chars`);
  }
  await page.close();
}

await browser.close();
process.exit(failed ? 1 : 0);
