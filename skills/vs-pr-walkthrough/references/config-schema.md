# Walkthrough config

JSON passed to `scripts/render-walkthrough.mjs`. `pr`, `headSha`, and `sections`
are required. Narrative fields support a small formatting allowlist and are
otherwise escaped.

## Top level

| Field | Type | Meaning |
|---|---|---|
| `pr` | string, required | Full GitHub PR URL used for links, optional diff fetching, and viewed state |
| `headSha` | 40-character PR head SHA, required | Exact PR head used to reject stale fetches and scope viewed state |
| `sections` | array, required | One to eight section objects rendered in order |
| `title` | string | Page heading; defaults to `PR review` |
| `subtitle` | string | Small text beside the PR link, such as a ticket or team |
| `pr_label` | string | PR link text; defaults to `<repo> PR #<n>` |
| `intro` | string | Boxed paragraph explaining how to read the page |
| `path_prefix` | string | Prefix removed from displayed filenames; links retain full paths |
| `out` | string | Output path when `--out` is omitted |
| `fold` | regex-source string | Files matching this start folded |

The default `fold` value covers specs, drivers, top-level docs, lockfiles,
version files, and snapshots.

## Section

| Field | Type | Meaning |
|---|---|---|
| `id` | string, required | Unique anchor beginning with a letter; letters, digits, `_`, and `-` only |
| `title` | string, required | Behavioral step, such as `Step 2 · The request becomes a persisted job` |
| `files` | string array, required | Exact repo-relative diff paths in first-needed reading order |
| `lede` | string | What this step establishes and why it comes here |
| `watch` | string array | Decisions, assumptions, workarounds, or uncertainties to inspect |
| `notes` | `{file, text}` array | A short paragraph above one exact file path in this section |
| `fold` | boolean | Start every file in this section folded |

Every changed path must appear exactly once across all `files` arrays. The
renderer rejects missing, duplicated, and unknown paths. A note path must
exactly match a file in its own section; basename matching is not allowed.

## Formatting in narrative fields

`intro`, `subtitle`, `pr_label`, `lede`, `watch`, and `notes[].text` accept only:

```text
<b> <i> <em> <strong> <code> <br>
```

The tags accept no attributes. Everything else is escaped and displayed as
literal text, including an allowed tag with an attribute. `title`, section
titles, file paths, and source code are always fully escaped.

## Example

```json
{
  "pr": "https://github.com/owner/repo/pull/123",
  "headSha": "0123456789abcdef0123456789abcdef01234567",
  "title": "Persist retries before exposing job status",
  "subtitle": "RETRY-123",
  "pr_label": "Jobs PR #123",
  "path_prefix": "apps/jobs/",
  "intro": "Read this as <strong>rule → storage → API → UI → verification</strong>.",
  "fold": "\\.spec\\.|Test\\.java|lock",
  "sections": [
    {
      "id": "retry-policy",
      "title": "Step 1 · The retry rule",
      "lede": "The <code>attempts</code> policy constrains every later transition.",
      "watch": [
        "The third attempt becomes terminal; verify that this matches the public contract."
      ],
      "notes": [
        {
          "file": "apps/jobs/src/retry-policy.ts",
          "text": "Read the exported limit <em>before</em> its callers."
        }
      ],
      "files": [
        "apps/jobs/src/retry-policy.ts",
        "apps/jobs/src/retry-policy.spec.ts"
      ]
    },
    {
      "id": "plumbing",
      "title": "Aside · Plumbing",
      "lede": "Registration and dependency changes.",
      "fold": true,
      "files": ["package-lock.json"]
    }
  ]
}
```

## Invocation

```bash
# Fetches the diff with gh after confirming the current PR head equals headSha.
node render-walkthrough.mjs config.json

# Uses an already captured diff and explicit output path.
node render-walkthrough.mjs config.json --diff pr.diff --out walkthrough.html

# The flag form remains supported for VS callers.
node render-walkthrough.mjs --config config.json --diff pr.diff --out walkthrough.html
```
