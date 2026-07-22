# agent-browser Fallback Reference for QA

Use this reference only when `agent-browser` is the selected control surface
after applying the priority in `../SKILL.md`. Harness-native browser or extension
control and Playwright take precedence. Translate these operations to the selected
control surface when a higher-priority tool is available.

When an example captures bulky output, first resolve
`$EVIDENCE_TOOL` to the sibling `vs-internal-shared/scripts/evidence-manifest.mjs`.

## Detect the installed variant first

Two incompatible `agent-browser` builds exist. Run `agent-browser --help`
before writing any script:

- **Subcommand CLI** (common in current installs): drive it with subcommands —
  `agent-browser open <url>`, `agent-browser eval '<js>'`,
  `agent-browser find text "<t>" click`, `agent-browser errors`,
  `agent-browser screenshot <path>`. The heredoc examples below do not work on
  this variant; translate each operation to its subcommand equivalent.
- **QuickJS heredoc runtime**: the examples below apply as written. Scripts run
  sandboxed — no `require`, no `fetch`, no `process`; use the `browser` global.

On either variant, start QA in a fresh named session per run. Reusing a
session shared with another agent or app bleeds console errors and state into
QA results, and `--clear`-style flags are not reliable across builds — a fresh
session is.

The QuickJS examples use the harness global `saveScreenshot`. Replace
`<absolute-run-directory>` with the current QA run directory.

## Page Names

Use stable page names so scripts resume after failures:
- `"qa-main"` — primary test browser
- `"qa-mobile"` — mobile viewport (separate `--browser` instance)
- `"qa-probe"` — port detection, disposable

## Connect to user's real browser (preferred when logged in)

```bash
agent-browser --connect <<'EOF'
const page = await browser.getPage("qa-main");
console.log(JSON.stringify({ url: page.url(), title: await page.title() }));
EOF
```

Use `--connect` when the user is already authenticated in their browser. Skips login steps, uses real sessions.

## Navigate + Snapshot

```bash
EVIDENCE_TOOL="<resolved-vs-internal-shared-skill-directory>/scripts/evidence-manifest.mjs"
SNAPSHOT_PATH="<run-directory>/evidence/page-name.a11y.txt"
agent-browser <<'EOF' \
  | node "$EVIDENCE_TOOL" capture "$SNAPSHOT_PATH" --json-tail
const page = await browser.getPage("qa-main");
await page.goto("https://example.com");
const snap = await page.snapshotForAI();
const buf = await page.screenshot();
const path = await saveScreenshot(buf, "<absolute-run-directory>/screenshots/page-name.png");
console.log(snap.full);
console.log(JSON.stringify({ url: page.url(), title: await page.title(), screenshot: path }));
EOF
```

The pipe stores the full accessibility snapshot and emits only its manifest plus
the final JSON metadata line. Use the shared evidence tool's bounded `slice`
command only when a targeted part of the snapshot is needed.

## Inject Error Capture (run once after first goto)

```bash
agent-browser <<'EOF'
const page = await browser.getPage("qa-main");
await page.evaluate(() => {
  if (window.__qaErrors) return;
  window.__qaErrors = [];
  window.onerror = (msg, src, line) => window.__qaErrors.push({ msg, src, line });
  window.addEventListener('unhandledrejection', e =>
    window.__qaErrors.push({ msg: String(e.reason) }));
});
EOF
```

## Check Console Errors

```bash
agent-browser <<'EOF'
const page = await browser.getPage("qa-main");
const allErrors = await page.evaluate(() => window.__qaErrors || []);
const errors = [...new Map(allErrors.map(error => [JSON.stringify(error), error])).values()];
console.log(JSON.stringify({ errors: errors.slice(-20), count: errors.length }));
EOF
```

## Get All Links

```bash
agent-browser <<'EOF'
const page = await browser.getPage("qa-main");
const links = await page.$$eval('a[href]', els =>
  els.map(e => ({ text: e.textContent.trim().slice(0, 60), href: e.href }))
     .filter(l => l.href && !l.href.startsWith('javascript:') && !l.href.startsWith('mailto:'))
     .slice(0, 20));
console.log(JSON.stringify(links));
EOF
```

## Fill and Submit Form

```bash
agent-browser <<'EOF'
const page = await browser.getPage("qa-main");
await page.fill('input[type="email"]', 'test@example.com');
await page.fill('input[type="password"]', '[REDACTED]');
await page.click('button[type="submit"]');
await page.waitForURL('**/dashboard', { timeout: 5000 });
console.log(JSON.stringify({ url: page.url(), title: await page.title() }));
EOF
```

## Find Elements by Role (from snapshot)

```bash
agent-browser <<'EOF'
const page = await browser.getPage("qa-main");
const snap = await page.snapshotForAI();
// Query the needed role/name from the bounded inventory or a targeted snapshot slice, then:
await page.getByRole('button', { name: 'Sign in' }).click();
console.log(JSON.stringify({ url: page.url() }));
EOF
```

## Track DOM Changes (diff mode)

```bash
SNAPSHOT_PATH="<run-directory>/evidence/step-1.a11y.txt"
agent-browser <<'EOF' \
  | node "$EVIDENCE_TOOL" capture "$SNAPSHOT_PATH" --json-tail
const page = await browser.getPage("qa-main");
// First call with track ID establishes baseline
const before = await page.snapshotForAI({ track: "step-1" });
await page.click('button#submit');
// Second call returns incremental diff
const after = await page.snapshotForAI({ track: "step-1" });
console.log(`BEFORE:\n${before.full}\nAFTER:\n${after.incremental || after.full}`);
console.log(JSON.stringify({ url: page.url(), changed: true }));
EOF
```

## Mobile Viewport

Use a separate browser instance with `--browser mobile`:

```bash
agent-browser --browser mobile <<'EOF'
const page = await browser.getPage("qa-mobile");
await page.goto("https://example.com");
// Browser starts headless at mobile dimensions
const buf = await page.screenshot();
console.log(await saveScreenshot(buf, "<absolute-run-directory>/screenshots/page-mobile.png"));
EOF
```

## Detect Port

```bash
agent-browser <<'EOF'
const page = await browser.getPage("qa-probe");
for (const port of [3000, 4000, 5173, 8080, 5000]) {
  try {
    await page.goto(`http://localhost:${port}`, { timeout: 2000 });
    console.log(JSON.stringify({ found: true, url: page.url(), port }));
    break;
  } catch {}
}
EOF
```

## Run JavaScript in Page Context

```bash
agent-browser <<'EOF'
const page = await browser.getPage("qa-main");
const result = await page.evaluate(() => {
  return {
    localStorage: Object.keys(localStorage),
    cookies: document.cookie,
    viewport: { w: window.innerWidth, h: window.innerHeight },
  };
});
console.log(JSON.stringify(result));
EOF
```

## API / Fetch Testing

```bash
agent-browser <<'EOF'
const page = await browser.getPage("qa-main");
const result = await page.evaluate(async () => {
  const r = await fetch('/api/health');
  return { status: r.status, body: await r.json() };
});
console.log(JSON.stringify(result));
EOF
```

## Tips

- Persist `snapshotForAI()` output through the disk-backed evidence pipe. Use
  bounded DOM inventories first and retrieve a targeted snapshot slice only when
  needed. Use screenshots when layout/styling matters.
- Keep page names stable across scripts — you can resume after failures.
- `--connect` attaches to the user's running Chrome with all their sessions intact.
- Use short timeouts (`{ timeout: 3000 }`) so scripts fail fast instead of hanging.
