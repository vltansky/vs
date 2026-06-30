---
name: brief
description: "Use when asked what changed, orient me, show the diff, or summarize a branch. Produces a compact review brief from git diff."
---

# Brief

Two-level orientation brief from a git diff: 1-line summary + semantic file table. Answers what changed, where to look, and (when session context is available) what decisions to verify.

## Flow Contract

- **Level:** L2 phase tool
- **Inputs:** Current branch diff, base ref, and optional session context such as a build-it decision log or flagged review items
- **Outputs:** Rendered `## Change Brief` markdown suitable for chat, PR body details, or handoff summaries
- **Status:** `BRIEF_READY` when generated, `SKIPPED_TRIVIAL` for trivial diffs, `BLOCKED_NO_DIFF` when no meaningful diff exists
- **Consumers:** `vs:build-it` Phase 7 handoff, `vs:ship-it` PR body and CI-watch context, standalone branch orientation
- **Skip conditions:** Skip only for trivial typo/version/config changes or when there is no branch diff to summarize

Calling flows should capture the rendered markdown once and reuse the same brief
for PR bodies, chat summaries, and CI-watch context instead of regenerating
slightly different summaries.

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
  ]
}
```

## Step 4: Render

```markdown
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
```

## Review focus rules

- Maximum 3 items
- Each item must state a concrete trigger scenario: not "this might break" but "this breaks if [specific condition]"
- Empty list is acceptable — do not force findings
- Only flag changes where the specific affected code path is identifiable from the diff (and session context when available)
- Do not flag intentional design choices unless they introduce a clear defect

## Workflow

**Prev:** `/build-it` (loads this skill for Phase 7) | standalone on any branch
**Next:** `/ship-it` | done
