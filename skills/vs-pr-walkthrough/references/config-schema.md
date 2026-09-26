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
| `path_prefix` | string | Optional monorepo prefix hint for authoring; HTML no longer renders file panels |
| `out` | string | Output path when `--out` is omitted |
| `fold` | regex-source string | Files matching this start folded |

The default `fold` value covers specs, drivers, top-level docs, lockfiles,
version files, and snapshots.

## Section

| Field | Type | Meaning |
|---|---|---|
| `id` | string, required | Unique anchor beginning with a letter; letters, digits, `_`, and `-` only |
| `title` | string, required | Behavioral step, such as `Step 2 · The request becomes a persisted job` |
| `files` | string array | Exact repo-relative diff paths in first-needed reading order. Source for **ordered GitHub blob links** in the HTML (`/blob/<headSha>/<path>`) and for authoring/order validation; not rendered as hunk panels. When a diff is supplied, every changed path must appear exactly once |
| `lede` | string | Optional one-line context; not the primary spine |
| `pseudocode` | string, required | Short language-agnostic spine (~12 lines max) rendered as a fenced code block (the HTML spine; no unified diffs) |
| `watch` | string array | Decisions, assumptions, workarounds, or uncertainties to inspect |
| `notes` | `{file, text}` array | Authoring note tied to one exact file path in this section (not rendered as a hunk panel) |
| `fold` | boolean | Start this section folded |

`files` arrays are the reading-order source: the renderer emits an ordered list
of GitHub blob links (`https://github.com/<owner>/<repo>/blob/<headSha>/<path>`)
and still uses them for authoring/order validation without rendering hunks.
When a diff is supplied, the renderer rejects missing, duplicated, and unknown paths. A note path must exactly match a file in its own section; basename
matching is not allowed. `files` may be omitted only when no diff is being
validated; with a captured or fetched diff, keep complete placement.

Each section must include `pseudocode`: the short fenced spine. The HTML must
not render unified-diff hunk panels — the reader opens real code on GitHub via
ordered per-file blob links plus the PR URL and head SHA commit link. `lede`
may stay as one-line context; it is not the primary spine.

## Formatting in narrative fields

`intro`, `subtitle`, `pr_label`, `lede`, `watch`, and `notes[].text` accept only:

```text
<b> <i> <em> <strong> <code> <br>
```

The tags accept no attributes. Everything else is escaped and displayed as
literal text, including an allowed tag with an attribute. `title`, section
titles, file paths, and source code are always fully escaped.

`pseudocode` is not rich HTML. It is plain language-agnostic text rendered as a
short fenced code block (escaped `<pre class="pseudocode"><code>…</code></pre>`).
Do not put real TypeScript/Python dumps or a line-by-line prose tour in it.
The renderer rejects more than 12 non-empty lines.

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
      "lede": "The attempts policy constrains every later transition.",
      "pseudocode": "IF attempts >= limit THEN\n  mark job terminal\nELSE\n  enqueue retry with attempts+1",
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
      "pseudocode": "REGISTER package\nLOCK dependencies",
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
