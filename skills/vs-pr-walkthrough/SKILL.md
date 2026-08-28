---
name: vs-pr-walkthrough
description: "Use when a large or unfamiliar GitHub PR is hard to read in GitHub's alphabetical file order, or the user asks for a logical walkthrough of a PR. Produces one interactive HTML diff ordered as a step-by-step product or execution story."
---

# PR Walkthrough

Turn a large GitHub PR into a review surface that reads from cause to effect.
The artifact contains the complete diff, but orders files by the product journey
or execution path instead of by directory.

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
- contain files in first-needed reading order;
- explain what the step establishes for the next section;
- use `watch` for a verified decision, assumption, workaround, or uncertainty
  the diff cannot explain by itself.

Place each file exactly once. Cross-reference a file in prose instead of
duplicating its diff. Put generated files, registrations, snapshots, and
lockfiles in a final `Aside · Plumbing` section.

Narrative fields accept only `<b>`, `<i>`, `<em>`, `<strong>`, `<code>`, and
`<br>` with no attributes. Everything else is escaped, including private source
code. Use `notes` sparingly for context immediately above one exact file path,
and `path_prefix` when a monorepo prefix adds visual noise.

## 4. Render strictly

Run the bundled renderer from this skill's resolved directory:

```bash
node <this-skill-dir>/scripts/render-walkthrough.mjs config.json \
  --diff pr.diff \
  --out walkthrough.html
```

The original positional CLI, optional renderer-side diff fetching, `subtitle`,
`pr_label`, `path_prefix`, configurable `fold`, rich narrative allowlist,
per-file `notes`, and self-contained syntax highlighting are all supported. If
`--diff` is omitted, the renderer confirms the live PR still equals `headSha`
before fetching the diff. The captured-diff form above is preferred in VS
because it also serves as durable review evidence.

Rendering fails when:

- a changed file is missing from the section map;
- a file is listed twice;
- a listed path is absent from the exact diff;
- the PR URL, head SHA, section ID, or config shape is invalid.

Do not weaken or bypass these checks. An incomplete map makes the ordering
untrustworthy, and a stale map can explain code that is no longer in the PR.

The saved page must provide:

- the original GitHub-native, single-column walkthrough UI;
- the full unified diff grouped by the authored story;
- per-file and per-section viewed controls;
- progress persisted by PR URL plus exact head SHA;
- direct GitHub links for files and changed lines;
- collapse controls, with tests and plumbing folded by default;
- self-contained syntax highlighting for TypeScript/JavaScript, JVM languages,
  Python, JSON, CSS, shell, and YAML;
- optional ticket/team subtitle, custom PR label, shortened display paths, and
  exact-path notes.

## 5. Verify the artifact

Verify both mechanics and the rendered page:

1. Re-fetch the PR head SHA and confirm it still equals `config.json.headSha`.
2. Run the renderer again; strict placement must pass with no ignored files.
3. Open the HTML and verify the title, first section, diff rows, progress, and
   one GitHub line link.
4. Mark one file viewed, reload, and confirm exact-head progress persists.
5. Capture a first-screen screenshot.

The page needs custom stateful behavior, so it is bespoke HTML rather than
HTMDX. Inherit the URL and first-screen shot handoff from
[`../vs-htmdx/SKILL.md`](../vs-htmdx/SKILL.md), but do not route rendering
through HTMDX.

## Re-running after the PR changes

Start from the previous config, capture the new exact head and diff, then
re-read every changed or newly added file before updating the narrative. Never
carry a `watch`, note, or lede forward merely because its file path still
exists. Viewed state intentionally starts fresh for the new head SHA.

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
- **Outputs:** one interactive HTML walkthrough plus its JSON source map and
  captured diff
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
