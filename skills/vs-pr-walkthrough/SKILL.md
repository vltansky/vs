---
name: vs-pr-walkthrough
description: "Use when a large or unfamiliar GitHub PR is hard to read in GitHub's alphabetical file order, or the user asks for a logical walkthrough of a PR. Produces one interactive HTML walkthrough ordered as a step-by-step product or execution story with a pseudocode section spine, pair-file cards, and click-expand real hunks."
---

# PR Walkthrough

Turn a large GitHub PR into a review surface that reads from cause to effect.
The HTML orders the change as a product or execution story with a short
pseudocode spine per section, then one pair-file card per path (pair-file
pseudocode + click-expand real hunks, collapsed by default). Real code also
opens on GitHub via blob-at-headSha links (plus the PR URL and exact head SHA
commit link).

Based on the original `pr-walkthrough` skill by **Oren Roth**.

The renderer is mechanical. The useful work is deciding what the reader must
understand first, writing the narrative between steps, and naming the
non-obvious decisions worth checking.

## Boundary

Use this for a GitHub PR whose story is obscured by its file list, normally ten
or more changed files.

| Reader needs | Use |
|---|---|
| Read a large PR in logical order | this skill |
| Functional behavior before and after a diff | `/vs-before-after` |
| Find defects or judge code quality | `/vs-roast-code` |
| Current status and next decision | `/vs-recap` |

Do not turn the walkthrough into a review verdict. A `watch` item may identify
an assumption or decision the reader should inspect, but it must not invent a
finding that has not been verified.

For a small PR, say GitHub's native diff is the clearer surface and return
`SKIPPED_SMALL_PR`.

## 1. Resolve and capture the exact PR

Resolve the repository from the PR URL, not from the checkout remote. Capture
the title, exact head SHA, file count, and unified diff.

```bash
PR_JSON=$(gh pr view <pr> --repo <owner/repo> \
  --json url,title,body,comments,headRefOid,changedFiles,additions,deletions)
PR_URL=$(echo "$PR_JSON" | jq -r .url)
HEAD_SHA=$(echo "$PR_JSON" | jq -r .headRefOid)
```

Resolve `$PROJECT_ID` through
[`../vs-internal-shared/SKILL.md`](../vs-internal-shared/SKILL.md). Create a
new run directory without overwriting an earlier walkthrough:

```text
~/.vs/$PROJECT_ID/explanations/YYYY-MM-DD-<pr-slug>/
  config.json
  pr.diff
  walkthrough.html
```

Set `RUN_DIR` to that new directory, then write the full diff there; do not
print a large diff into chat. Use the shared evidence manifest to inspect
bounded hunk ranges:

```bash
gh pr diff <pr> --repo <owner/repo> > "$RUN_DIR/pr.diff"
node <resolved-vs-internal-shared-skill-directory>/scripts/evidence-manifest.mjs \
  manifest "$RUN_DIR/pr.diff"
rg -n '^(diff --git|@@)' "$RUN_DIR/pr.diff"
```

Follow the
[`disk-backed evidence contract`](../vs-internal-shared/references/disk-backed-evidence.md)
for any additional slices.

## 2. Find the reading order

Read enough surrounding code to make the order true:

1. Start with changed entry points and the rules that shape later behavior.
2. Read changed files whose role is unclear from their name.
3. Read the callers, callees, and tests needed to verify the sequence.
4. Use the PR body and discussion for stated intent; label unsupported intent as
   inference.

Name one spine for the walkthrough:

- **User journey:** entry → loading → state → action → result.
- **Request path:** contract → caller → processing → persistence → response.
- **Policy path:** rule → enforcement → surfaced behavior → verification.

If no honest spine emerges, keep reading. Alphabetical files with narrative
labels are still an alphabetical dump.

## 3. Author the smallest honest section map

Read [references/config-schema.md](references/config-schema.md) before writing
`config.json`.

Aim for four to eight sections. Use fewer when the change genuinely has fewer
behavioral stages; never split one stage merely to hit a number.

Each section must:

- say what happens, not name a directory;
- list `files` in first-needed reading order — each entry is a pair-file object
  `{ path, pseudocode }` (legacy bare string paths are accepted only as a
  migration shape; with a diff present, pair-file `pseudocode` is required for
  every rendered card and fail-closed otherwise);
- carry a short fenced language-agnostic `pseudocode` **section spine**
  (required) that the reader can use to predict the next step;
- keep `lede` optional and secondary — at most one line of context, not the
  primary spine;
- use `watch` for a verified decision, assumption, workaround, or uncertainty
  the story cannot explain by itself.

### Section spine + pair-file cards + click-expand real hunks

The HTML contract is three layers:

1. **Section spine** — short fenced language-agnostic `pseudocode` per section
   (~12 non-empty lines max), same litmus as before.
2. **Pair-file cards** — under each section, one card per path in `files`
   reading order. Each card shows:
   - the file path;
   - short **pair-file pseudocode** (language-agnostic, what THAT file’s change
     does — not a real TS/Python dump; ~12 lines max; reject oversize);
   - a **Show real diff** control that expands/collapses the green/red unified
     hunks **in place** for that file only (collapsed by default);
   - a small GitHub blob link at headSha:
     `https://github.com/<owner>/<repo>/blob/<headSha>/<path>`
     (deleted files may 404 at tip — known Low residual, do not block).
3. **Real hunks** come back into the HTML, but ONLY behind the click-expand
   control — not always-visible panels like the pre-pseudocode-only layout.

Constraints:

- Language-agnostic: not a real TypeScript/Python dump, not a line-by-line
  prose tour of the algorithm.
- About **~12 lines** max for both section and pair-file pseudocode (the
  renderer rejects more than 12 non-empty lines).
- Litmus inspired by `/vs-show-me`: use full conditional pseudocode when the
  reader must **predict the next step under a condition**; keep
  **who/what connects** sections lighter (still a short `pseudocode` block,
  just fewer branches). Do not turn every section into three surfaces.
- This does **not** change `/vs-ship-it` Summary pick-one — that firewall stays
  untouched. Do not change pathgrade.

Place each file exactly once across `files` arrays — that order is both the
strict placement map and the HTML reading-order card list. Cross-reference a
file in prose instead of duplicating it. Put generated files, registrations,
snapshots, and lockfiles in a final `Aside · Plumbing` section. `pr.diff` is
fetched for authoring order, strict placement, and the click-expand hunk
panels.

Narrative fields (`intro`, `subtitle`, `pr_label`, `lede`, `watch`,
`notes[].text`) accept only `<b>`, `<i>`, `<em>`, `<strong>`, `<code>`, and
`<br>` with no attributes. Everything else is escaped. Section and pair-file
`pseudocode` are plain text rendered as escaped fenced blocks, not rich HTML.
Use `notes` sparingly for authoring context tied to an exact file path.

## 4. Render strictly

Run the bundled renderer from this skill's resolved directory:

```bash
node <this-skill-dir>/scripts/render-walkthrough.mjs config.json \
  --diff pr.diff \
  --out walkthrough.html
```

The original positional CLI, optional renderer-side diff fetching, `subtitle`,
`pr_label`, configurable `fold`, rich narrative allowlist, and per-file `notes`
(for authoring/order validation) are all supported. If `--diff` is omitted, the
renderer confirms the live PR still equals `headSha` before fetching the diff.
The captured-diff form above is preferred in VS because it also serves as
durable authoring evidence.

Rendering fails when:

- a changed file is missing from the section map;
- a file is listed twice;
- a listed path is absent from the exact diff;
- a pair-file card lacks required `pseudocode` when a diff is present;
- section or pair-file pseudocode exceeds ~12 non-empty lines;
- the PR URL, head SHA, section ID, or config shape is invalid.

Do not weaken or bypass these checks. An incomplete map makes the ordering
untrustworthy, and a stale map can explain code that is no longer in the PR.

The saved page must provide:

- a single-column walkthrough UI ordered as the authored story;
- per-section short fenced language-agnostic pseudocode (the section spine);
- per-file cards with pair-file pseudocode, Show real diff click-expand
  (collapsed by default), and blob-at-headSha links;
- real unified hunks only behind that expand control (not always-visible);
- PR URL and exact head SHA commit link(s);
- per-section viewed controls;
- progress persisted by PR URL plus exact head SHA;
- optional ticket/team subtitle, custom PR label, and watch items.

## 5. Verify the artifact

Verify both mechanics and the rendered page:

1. Re-fetch the PR head SHA and confirm it still equals `config.json.headSha`.
2. Run the renderer again; strict placement must pass with no ignored files.
3. Open the HTML and verify the title, first section, section spine, pair-file
   cards, collapsed Show real diff controls, progress, and the PR URL plus head
   SHA links.
4. Mark one section read, reload, and confirm exact-head progress persists.
5. Capture a first-screen screenshot.

The page needs custom stateful behavior, so it is bespoke HTML rather than
HTMDX. Inherit the URL and first-screen shot handoff from
`/vs-show-me` ([`../vs-show-me/SKILL.md`](../vs-show-me/SKILL.md)), but do not route rendering
through HTMDX.

## Re-running after the PR changes

Start from the previous config, capture the new exact head and diff, then
re-read every changed or newly added file before updating the narrative. Never
carry a `watch`, note, `lede`, section `pseudocode`, or pair-file `pseudocode`
forward merely because its file path still exists. Viewed state intentionally
starts fresh for the new head SHA.

## VS adaptations

The original feature set and interaction model stay intact. VS changes only
these correctness and integration boundaries:

- `headSha` is required and scopes viewed state, so progress from an older PR
  revision cannot masquerade as current review progress.
- Missing, duplicated, or stale file placements fail before HTML is written;
  an `Unsorted` fallback would make an incomplete story look trustworthy.
- Per-file notes match exact repo paths rather than basenames, avoiding a note
  landing on the wrong same-named file in a monorepo.
- The renderer is implemented with Node built-ins so it shares the VS runtime
  and deterministic Vitest feedback loop; it adds no runtime dependency.
- VS normally supplies the disk-backed diff for reproducible evidence. The
  original fetch-with-`gh` path remains available and adds an exact-head check.

## Handoff

Return only:

- `Explains:` PR URL and exact head SHA
- `Story:` the walkthrough spine in one sentence
- `Saved:` clickable absolute path to `walkthrough.html`
- `Verified:` strict placement, current head, browser render, and persistence
- `Judgement calls:` ordering or intent that remains inference
- `Status: READY_FOR_REVIEW`

Do not paste the walkthrough or diff into chat.

## Flow Contract

- **Kind:** Building block
- **Inputs:** a GitHub PR URL or number, its exact head SHA, complete unified
  diff, and enough surrounding code to establish reading order
- **Outputs:** one interactive HTML walkthrough (section spine, pair-file
  cards with click-expand real hunks) plus its JSON source map and optional
  captured diff for authoring
- **Status:** `READY_FOR_REVIEW | BLOCKED_STALE_HEAD | BLOCKED_INCOMPLETE_MAP | SKIPPED_SMALL_PR`
- **Consumers:** direct human invocation, onboarding a reviewer to an
  unfamiliar PR, and `vs-ship-it` for automatic large-PR review handoff
- **Skip conditions:** small PR, non-GitHub diff, or a request for a quality
  verdict rather than a reading aid

## Output style

Apply the [shared output style](../vs-internal-shared/references/output-style.md)
to every user-facing message.

## Workflow

Direct: emit **Next** only. Composed: return to caller.

**Prev:** a large GitHub PR the reader needs to understand
**Next:** done
**Relevant:** `/vs-before-after` | `/vs-roast-code`
