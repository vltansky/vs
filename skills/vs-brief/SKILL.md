---
name: vs-brief
description: "Use when asked what changed, orient me, show the diff, compare before and after, or summarize a branch. Produces a compact review brief from git diff and captured output evidence."
---

# Brief

Two-level orientation brief from a git diff: 1-line summary + semantic file table. Answers what changed, where to look, and (when session context is available) what decisions to verify.

## Flow Contract

- **Level:** L2 phase tool
- **Inputs:** Current branch diff, base ref, optional session context such as a
  build-it decision log or flagged review items, and optional before-and-after
  evidence captured by the caller
- **Outputs:** Rendered `## Change Brief` markdown suitable for chat, PR body details, or handoff summaries
- **Status:** `BRIEF_READY` when generated, `SKIPPED_TRIVIAL` for trivial diffs, `BLOCKED_NO_DIFF` when no meaningful diff exists
- **Consumers:** `vs:build-it` Phase 7 handoff, `vs:ship-it` PR body and CI-watch context, standalone branch orientation
- **Skip conditions:** Skip for trivial typo/version/config changes only when no
  meaningful comparison evidence exists, or when there is no branch diff to
  summarize. Comparison evidence overrides the trivial-diff skip.

Calling flows should capture the rendered markdown once and reuse the same brief
for PR bodies, chat summaries, and CI-watch context instead of regenerating
slightly different summaries.

Before-and-after evidence is presentation-specific:

- **UI comparison:** render two images captured from the same route, state,
  viewport, and fixture. Use reachable image paths or URLs and keep captions
  factual. Never replace missing UI images with an inferred text description.
- **Text comparison:** render the exact before and after output from the same
  command and representative input. Preserve whitespace and meaningful stderr.
- Omit the comparison when the caller reports no meaningful observable output.
  If a relevant capture was blocked, state the blocker without fabricating the
  missing side.

## Step 1: Resolve diff range

```bash
BASE=$(git merge-base HEAD \
  "$(git symbolic-ref refs/remotes/origin/HEAD 2>/dev/null | sed 's|refs/remotes/origin/||')" \
  2>/dev/null)

if [ -z "$BASE" ]; then
  echo "Warning: could not resolve upstream base. Falling back to repository root commit."
  BASE=$(git rev-list --max-parents=0 HEAD | tail -1)
fi
```

## Step 2: Gather input (within ~20k token budget)

```bash
# File list with stats
git diff "$BASE"..HEAD --stat --no-color

# Per file: first 100 lines of diff (up to 10 source files; skip generated)
git diff "$BASE"..HEAD --name-only -z \
  | awk 'BEGIN { RS="\0"; ORS="\0" }
      !/(\.lock$|package-lock\.json|yarn\.lock|\.generated\.|^dist\/|^build\/)/ && ++n <= 10 { print }' \
  | while IFS= read -r -d '' f; do
      echo "=== $f ==="
      git diff "$BASE"..HEAD -- "$f" | head -100
    done
```

Collect lock/generated files separately — they become one "Dependencies updated" line regardless of change size.

## Step 3: Generate the brief

Use session context if available (a prior build-it session in this conversation provides decision rationale). In standalone mode (no session context), omit "Decisions to verify" and populate "Review focus" from diff alone.

Call the LLM with a constrained JSON schema:

```json
{
  "summary": "<1 sentence: problem solved + approach>",
  "scope": { "files": N, "added": X, "removed": Y },
  "groups": [
    {
      "label": "New features | Bug fixes | Tests | Config / tooling | Other / mixed",
      "files": [{ "path": "...", "description": "<1 sentence>" }]
    }
  ],
  "decisions": [
    { "point": "...", "choice": "...", "rationale": "..." }
  ],
  "review_focus": [
    { "location": "path/to/file.ts:line", "trigger": "<concrete condition that would make this a problem>" }
  ],
  "diagram": {
    "kind": "flowchart | sequence | state",
    "code": "<Mermaid source without the code fence>"
  },
  "comparison": {
    "kind": "ui | text",
    "subject": "<route, command, or output being compared>",
    "before": { "value": "<image path/URL or exact text>", "caption": "<factual label>" },
    "after": { "value": "<image path/URL or exact text>", "caption": "<factual label>" }
  }
}
```

## Step 4: Render

````markdown
## Change Brief

**Summary:** {summary}
**Scope:** {scope.files} files · +{scope.added} / -{scope.removed} lines

---

### What changed

{for each group with files:}
**{label}** ({N} files)
- `{path}` — {description}

{if total files > 10:}
<details>
<summary>+ {overflow} more files</summary>

{remaining file list}
</details>

{if lock/generated files changed:}
**Dependencies** — lock files / generated files updated

---

{if diagram present:}
### How it fits together

```mermaid
{diagram.code}
```

---

{if comparison.kind == "ui":}
### Before & after

| Before | After |
|---|---|
| ![Before — {before.caption}]({before.value}) | ![After — {after.caption}]({after.value}) |

{if comparison.kind == "text":}
### Before & after

**Before — {before.caption}**
```text
{before.value}
```

**After — {after.caption}**
```text
{after.value}
```

---

{if decisions present:}
<details>
<summary>Decisions to verify ({N} items)</summary>

- **{point}:** Agent chose {choice} — {rationale}
</details>

{if review_focus present:}
<details>
<summary>Review focus ({N} items)</summary>

- `{location}` — {trigger}
</details>
````

## Diagram rules

Include `diagram` when the change is best understood as three or more
interacting components, a multi-step runtime sequence, or meaningful state
transitions. Derive every node and edge from the diff or supplied evidence.
Keep it to roughly eight nodes and explain the takeaway in the summary or the
sentence before the diagram. Prefer behavior-oriented labels over a second file
list. Omit it for a simple file list, a single fact, or a linear two-step change.
Follow the shared Mermaid guidance in
[`../vs-internal-shared/references/rich-artifacts.md`](../vs-internal-shared/references/rich-artifacts.md).

## Review focus rules

- Maximum 3 items
- Each item must state a concrete trigger scenario: not "this might break" but "this breaks if [specific condition]"
- Empty list is acceptable — do not force findings
- Only flag changes where the specific affected code path is identifiable from the diff (and session context when available)
- Do not flag intentional design choices unless they introduce a clear defect

## Workflow

Direct: emit **Next** only. Composed: return to caller.

**Prev:** `/vs-build-it` | standalone branch
**Next:** `/vs-ship-it`
**Relevant:** `/vs-write` | `/vs-recap`
