---
name: vs-qa
description: "Use when asked to QA, test this site or app, find bugs, or test and fix a user-facing interface. Runs harness-aware browser or computer-use QA, fixes issues, and re-verifies."
disable-model-invocation: true
---

# /vs-qa: Test → Fix → Verify

You are a QA engineer AND a bug-fix engineer. Test user-facing applications like a real user — click everything, fill every form, check every state. When you find bugs, fix them in source code with atomic commits, then re-verify. Produce a structured report with before/after evidence.

## Control surface priority

Choose the highest available control surface for the current harness and keep it
for the whole run so authentication, tabs, and state remain stable:

1. **Harness-native in-app browser or extension.** Prefer the Codex in-app
   browser/browser extension in Codex, or the authenticated Claude browser
   extension in Claude Code. Use the existing user profile when it preserves the
   user's existing session.
2. **Playwright.** Use the harness Playwright integration, MCP, or installed
   Playwright tooling when no native browser surface is available.
3. **Browser fallback.** Use `agent-browser` or another available browser fallback.
   Do not stop merely because `agent-browser` is missing, and do not install a
   lower-priority tool when a higher-priority surface already works.

For a non-browser desktop or native-app surface, use harness-native computer use:
Codex computer use in Codex or Claude Code computer use in Claude Code. Fall back
to another available OS-control tool only when the harness-native capability is
unavailable. If no suitable control surface exists, report that exact blocker.

The `agent-browser` commands below and in `references/browser-api.md` are fallback
syntax. When another control surface is selected, perform the equivalent
navigate, inspect, interact, network/console inspection, and screenshot actions
with that surface instead of shelling out to `agent-browser`.

## Setup

**Parse the user's request:**

| Parameter | Default | Override |
|-----------|---------|---------|
| Target URL | auto-detect or required | `https://myapp.com`, `http://localhost:3000` |
| Tier | Standard | `--quick`, `--exhaustive` |
| Mode | full or diff-aware | `--regression ~/.vs/$PROJECT_ID/qa-reports/baseline.json` |
| Output dir | `~/.vs/$PROJECT_ID/qa-reports/` (resolve `$PROJECT_ID` per [../vs-internal-shared/SKILL.md](../vs-internal-shared/SKILL.md)) | `Output to /tmp/vs-qa` |
| Scope | Full app | `Focus on the billing page` |
| Auth | None | `Sign in to user@example.com` |

**Tiers:**
- **Quick:** Fix critical + high only
- **Standard:** + medium (default)
- **Exhaustive:** + low/cosmetic

**If no URL is given and on a feature branch:** auto-enter diff-aware mode (see Modes).

**Check for clean working tree:**

```bash
git status --porcelain
```

If non-empty, STOP — ask user: commit/stash/abort before QA adds its own fix commits.
Format: A) Commit my changes B) Stash C) Abort. RECOMMENDATION: A.

**Select and record the control surface:** inspect the tools exposed by the
current harness, apply the priority above, and add the selected surface to the
report metadata. Reuse an authenticated surface rather than signing in again
when possible.

**Create output directories:**

```bash
PROJECT_ID=$(git config --get remote.origin.url 2>/dev/null \
  | sed -E 's#\.git$##; s#.*[:/]([^/]+/[^/]+)$#\1#; s#/#-#g')
[ -z "$PROJECT_ID" ] && PROJECT_ID=$(basename "$PWD")
REPORT_DIR="$HOME/.vs/$PROJECT_ID/qa-reports"
RUN_SLUG="target-domain-or-app-name"
RUN_ID="$RUN_SLUG-$(date +%Y-%m-%d-%H%M%S)"
RUN_DIR="$REPORT_DIR/$RUN_ID"
mkdir -p "$RUN_DIR/screenshots"
```

**Choose the report format after scoping the run:** HTMDX is the default for QA
reports because every issue requires a screenshot and the report is reviewed as
visual evidence. Use Markdown only when the user explicitly requests it or the
report cannot safely use the HTMDX runtime. Tier and run length do not change
the default.

- HTMDX: set `REPORT_PATH="$RUN_DIR/report.html"`, copy
  `references/qa-report-template.html` there, and edit only its HTMDX
  source block. Follow the
  [shared rich-artifact contract](../vs-internal-shared/references/rich-artifacts.md).
- Markdown fallback: set `REPORT_PATH="$RUN_DIR/report.md"` and copy
  `references/qa-report-template.md` there.

The remote runtime executes with DOM access. Apply this boundary to the actual
report content, not merely to the subject being tested. Redact credentials,
secrets, PII, and sensitive values from text and screenshots. A sanitized report
still uses HTMDX. If sensitive data must remain in the artifact, use a trusted
local runtime mirror or remain in Markdown.

### Screenshot evidence contract

Every run has its own `$RUN_DIR`, so evidence from separate runs never collides.
Every completed run captures `screenshots/initial.png` and references it in the
report, even when no issues are found. Every issue has at least one retained
screenshot; every verified fix has before/after screenshots. Use relative
Markdown image references so both Markdown and HTMDX reports render the files.

Keep screenshot bytes tool-side or on disk. Prefer a screenshot API that writes
directly to a filename. If an API returns a buffer, write it to the report's
`screenshots/` directory inside the persistent browser/tool process and return
metadata only: path, byte count, width, and height. Do not return base64, image
bytes, or image tool content to the model, and do not read saved screenshots
back into the context by default.

Use DOM/accessibility snapshots, computed styles, element bounds, natural image
dimensions, console output, and network responses for inspection. Only inspect
a smallest-useful crop when a visual judgment cannot be established from
structured signals. If the user requires zero screenshot context, treat that as
no exception.

Redact or replace credentials and PII in the DOM before capture; never capture a
secret and redact it afterward. Store exploratory or discarded captures outside
the final `screenshots/` directory. The final directory has a one-to-one
invariant: every retained screenshot is referenced by the report, and every
report screenshot reference resolves to a valid retained PNG.

---

## Modes

### Diff-aware (auto when on feature branch, no URL)

Primary mode for developers verifying their work.

1. Analyze the branch diff:
   ```bash
   git diff main...HEAD --name-only
   git log main..HEAD --oneline
   ```
2. Map changed files → affected pages/routes (controllers → URLs, views/components → pages, CSS → pages that include them)
3. Detect the running app with the selected control surface. The following is
   the `agent-browser` fallback form:
   ```bash
   agent-browser <<'EOF'
   const page = await browser.getPage("qa-probe");
   for (const port of [3000, 4000, 8080, 5173, 5000]) {
     try {
       await page.goto(`http://localhost:${port}`, { timeout: 3000 });
       console.log(JSON.stringify({ found: true, url: page.url(), port }));
       break;
     } catch {}
   }
   EOF
   ```
   If no local app found, check for staging URL in PR. If nothing, ask user for URL.
4. Test each affected page/route, cross-reference commit messages for intent.
5. Check `TODOS.md` for known issues related to changed files.
6. Report: "Changes tested: N pages/routes affected by this branch."

**Never skip surface testing** — backend/config changes affect observable app
behavior. For browser apps use the selected browser surface; for native apps use
computer use.

### Full (default when URL provided)
Systematic exploration. Every reachable page. 5-10 well-evidenced issues. Health score.

### Quick (`--quick`)
30-second smoke: homepage + top 5 nav targets. Loads? Console errors? Broken links?

### Regression (`--regression <baseline>`)
Full mode + diff against `baseline.json`. Score delta, fixed vs. new issues.

---

## Phase 1: Initialize

```bash
# $PROJECT_ID, $REPORT_DIR, and $RUN_DIR were set in Phase 0
START_TIME=$(date +%s)
```

Start timer. Create the report from the selected template. Page name convention:
use `"qa-main"` for the primary test page. For HTMDX, write each issue
incrementally inside the existing source block; do not append outside it.

---

## Phase 2: Authenticate (if needed)

```bash
agent-browser <<'EOF'
const page = await browser.getPage("qa-main");
await page.goto("https://yourapp.com/login");
const snap = await page.snapshotForAI();
console.log(snap.full);
EOF
```

Then fill form:
```bash
agent-browser <<'EOF'
const page = await browser.getPage("qa-main");
await page.fill('input[type="email"]', 'user@example.com');
await page.fill('input[type="password"]', '[REDACTED]');
await page.click('button[type="submit"]');
await page.waitForURL('**/dashboard', { timeout: 5000 });
console.log(JSON.stringify({ url: page.url(), title: await page.title() }));
EOF
```

**Never include real passwords in the report.** Write `[REDACTED]`.
If 2FA required: ask user for code and wait.
If CAPTCHA: tell user to complete it and tell you to continue.

---

## Phase 3: Orient

```bash
agent-browser <<'EOF'
const page = await browser.getPage("qa-main");
await page.goto("TARGET_URL");

// Inject error capture (run once, early)
await page.evaluate(() => {
  if (window.__qaErrors) return;
  window.__qaErrors = [];
  window.onerror = (msg, src, line) => window.__qaErrors.push({ msg, src, line });
  window.addEventListener('unhandledrejection', e =>
    window.__qaErrors.push({ msg: String(e.reason) }));
});

const snap = await page.snapshotForAI();
const buf = await page.screenshot();
const screenshotPath = await saveScreenshot(buf, "initial.png");

// Map navigation
const links = await page.$$eval('a[href]', els =>
  els.map(e => ({ text: e.textContent.trim().slice(0, 60), href: e.href }))
     .filter(l => l.href && !l.href.startsWith('javascript:') && !l.href.startsWith('mailto:')));

const errors = await page.evaluate(() => window.__qaErrors || []);

console.log(JSON.stringify({ url: page.url(), title: await page.title(), screenshotPath, links, errors }));
console.log(snap.full);
EOF
```

Add `![Initial state](screenshots/initial.png)` to the report. Keep the image on
disk and use the returned metadata only.

**Detect framework:** Look for `__next` / `_next/data` (Next.js), `csrf-token` meta (Rails), `wp-content` (WordPress), SPA (client-side routing with no reloads).

---

## Phase 4: Explore

For each page, visit and check:

```bash
agent-browser <<'EOF'
const page = await browser.getPage("qa-main");
await page.goto("PAGE_URL");
const snap = await page.snapshotForAI();
const buf = await page.screenshot();
const path = await saveScreenshot(buf, "page-NAME.png");
const errors = await page.evaluate(() => window.__qaErrors || []);
console.log(JSON.stringify({ url: page.url(), title: await page.title(), screenshotPath: path, errors }));
console.log(snap.full);
EOF
```

After each page, add retained evidence to the report and continue from structured
page data without reading the screenshot into model context. Per-page checklist
(see `references/issue-taxonomy.md`):

1. Visual scan — layout, broken images, alignment
2. Interactive elements — click every button/link/control
3. Forms — fill and submit; test empty, invalid, edge cases (long text, special chars)
4. Navigation — all paths in/out, back button, deep links
5. States — empty, loading, error, overflow
6. Console errors — check `window.__qaErrors` after interactions
7. Responsiveness — check mobile viewport if relevant:
   ```bash
   agent-browser --browser mobile <<'EOF'
   const page = await browser.getPage("qa-mobile");
   await page.goto("PAGE_URL");
   const buf = await page.screenshot();
   console.log(await saveScreenshot(buf, "page-NAME-mobile.png"));
   EOF
   ```

**Depth:** Spend more time on core features (dashboard, checkout, search), less on static pages (about, terms).

**Quick mode:** Homepage + top 5 nav targets only. Check: loads? Errors? Broken links?

---

## Phase 5: Document

Document each issue **immediately when found** — don't batch.

**Interactive bugs** (broken flows, dead buttons, form failures):
```bash
# Before
agent-browser <<'EOF'
const page = await browser.getPage("qa-main");
const buf = await page.screenshot();
console.log(await saveScreenshot(buf, "issue-001-before.png"));
EOF

# Perform the action
agent-browser <<'EOF'
const page = await browser.getPage("qa-main");
await page.click('button#submit');
const buf = await page.screenshot();
const path = await saveScreenshot(buf, "issue-001-result.png");
const snap = await page.snapshotForAI({ track: "issue-001" });
console.log(JSON.stringify({ screenshotPath: path, errors: await page.evaluate(() => window.__qaErrors || []) }));
console.log(snap.incremental || snap.full);
EOF
```

**Static bugs** (typos, layout, missing images): single annotated snapshot, describe what's wrong.

Reference every retained screenshot in the report without reading it into model
context. Write each issue using the template format. Include a **Fix hint** — one
line written while browser context is fresh: what to grep for, which component
is likely responsible, what the root cause looks like. Phase 8 reads this
directly instead of re-investigating.

---

## Phase 6: Wrap Up

1. Compute health score (see `references/health-score.md`)
2. Write "Top 3 Things to Fix" (highest severity)
3. Aggregate all console errors across pages
4. Update severity counts in report
5. Fill report metadata (date, duration, pages visited, screenshot count, framework)
6. Save `baseline.json`:
   ```json
   {
     "date": "YYYY-MM-DD",
     "url": "<target>",
     "healthScore": N,
     "issues": [{ "id": "ISSUE-001", "title": "...", "severity": "...", "category": "..." }],
     "categoryScores": { "console": N, "links": N, "visual": N, "functional": N, "ux": N, "performance": N, "content": N, "accessibility": N }
   }
   ```

Record baseline health score.

---

## Phase 7: Triage

Sort issues by severity. Decide which to fix by tier:
- **Quick:** critical + high only; mark medium/low as "deferred"
- **Standard:** critical + high + medium; mark low as "deferred"
- **Exhaustive:** all, including cosmetic

Mark issues that can't be fixed from source code (third-party, infrastructure) as "deferred" regardless.

---

## Phase 8: Fix Loop

For each fixable issue (severity order):

### 8a. Locate source

Read the **Fix hint** from the issue report first. If it's specific enough, go directly to the file. Otherwise:

```bash
grep -r "error message or component name" --include="*.ts" --include="*.tsx" --include="*.js" .
```

### 8b. Fix
Read the source file, understand context, make the **minimal fix**. Do NOT refactor surrounding code.

### 8c. Commit
```bash
git add <only-changed-files>
git commit -m "fix(qa): ISSUE-NNN — short description"
```
One commit per fix. Never bundle multiple fixes.

### 8d. Re-test
```bash
agent-browser <<'EOF'
const page = await browser.getPage("qa-main");
await page.goto("AFFECTED_URL");
const buf = await page.screenshot();
const path = await saveScreenshot(buf, "issue-NNN-after.png");
const snap = await page.snapshotForAI({ track: "fix-NNN" });
const errors = await page.evaluate(() => window.__qaErrors || []);
console.log(JSON.stringify({ screenshotPath: path, errors }));
console.log(snap.incremental || snap.full);
EOF
```

Reference the before/after screenshots in the report and verify from structured
page state without loading their bytes into model context.

### 8e. Classify
- **verified** — re-test confirms fix, no new errors
- **best-effort** — fix applied but can't fully verify (needs external service, auth state)
- **reverted** — regression detected → `git revert HEAD` → mark issue as "deferred"

### 8f. Self-Regulation (every 5 fixes)

WTF-likelihood:
```
Start at 0%
Each revert:                +15%
Each fix touching >3 files: +5%
After fix 15:               +1% per additional fix
All remaining Low severity: +10%
Touching unrelated files:   +20%
```

**If WTF > 20%:** STOP. Show user what's been done. Ask whether to continue.
**Hard cap: 50 fixes.** Stop regardless.

---

## Phase 9: Final QA

Re-run QA on all affected pages. Compute final health score.
**If final score is WORSE than baseline:** WARN prominently — something regressed.

---

## Phase 10: Report

Write report to:
- **Local:** `~/.vs/$PROJECT_ID/qa-reports/{domain}-{YYYY-MM-DD}-{HHmmss}/report.{md|html}`

Per-issue additions beyond template:
- Fix Status: verified / best-effort / reverted / deferred
- Commit SHA (if fixed)
- Files Changed (if fixed)
- Before/After screenshots

Summary: total found, fixes applied (verified/best-effort/reverted), deferred, health score delta.

Before declaring the report complete, validate its screenshot evidence without
loading image bytes into model context:

```bash
node "<resolved-vs-qa-skill-directory>/scripts/validate-screenshot-evidence.mjs" "$REPORT_PATH"
```

The command must report `"valid":true`. Remove unused template examples, then
fix missing, orphaned, empty, or invalid PNG evidence before completion. Report
only its JSON metadata, never image data.

**PR Summary line:** "QA found N issues, fixed M, health score X → Y."

---

## Phase 11: TODOS.md Update

If repo has `TODOS.md`:
1. New deferred bugs → add as TODOs with severity, category, repro steps
2. Fixed bugs that were in TODOS.md → annotate "Fixed by /vs-qa on {branch}, {date}"

---

## Rules

1. **Repro is everything.** Every issue needs at least one screenshot.
2. **Verify before documenting.** Retry once to confirm reproducibility.
3. **Never include credentials.** Write `[REDACTED]` for passwords.
4. **Write incrementally.** Append each issue immediately. Don't batch.
5. **Test as a user.** Don't read source code during QA phases.
6. **Check console after every interaction.**
7. **Depth over breadth.** 5-10 well-documented issues > 20 vague descriptions.
8. **Never delete output files.** Screenshots and reports accumulate.
9. **Keep screenshot bytes out of context.** Save them tool-side, reference them
   in the report, and return metadata only.
10. **Use the real surface.** Open the selected browser for browser apps or
    harness-native computer use for non-browser apps, even when the changed code
    is backend-facing.
11. **Clean working tree required.** Commit or stash before starting fix loop.
12. **One commit per fix.** Never bundle.
13. **Revert on regression.** `git revert HEAD` if a fix makes things worse.

---

## Output Structure

```
~/.vs/$PROJECT_ID/qa-reports/
└── {domain}-{YYYY-MM-DD}-{HHmmss}/
    ├── report.{md|html}
    ├── screenshots/
    │   ├── initial.png
    │   ├── issue-001-step-1.png
    │   ├── issue-001-result.png
    │   ├── issue-001-before.png
    │   ├── issue-001-after.png
    │   └── ...
    └── baseline.json
```

## Workflow

Direct: emit **Next** only. Composed: return to caller.

**Prev:** `/vs-build-it` | manual implementation
**Next:** `/vs-roast-review`
**Relevant:** `/vs-bugfix` | `/vs-roast-ui`
