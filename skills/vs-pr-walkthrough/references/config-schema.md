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
| `path_prefix` | string | Optional monorepo prefix stripped from displayed card paths |
| `out` | string | Output path when `--out` is omitted |
| `fold` | regex-source string | Files matching this start their section folded |

The default `fold` value covers specs, drivers, top-level docs, lockfiles,
version files, and snapshots.

## Section

| Field | Type | Meaning |
|---|---|---|
| `id` | string, required | Unique anchor beginning with a letter; letters, digits, `_`, and `-` only |
| `title` | string, required | Behavioral step, such as `Step 2 · The request becomes a persisted job` |
| `files` | array of `{ path, pseudocode }` | Exact repo-relative diff paths in first-needed reading order. Each object is one pair-file card: `path` plus short language-agnostic pair-file `pseudocode`. Legacy bare string paths are accepted as a migration shape only; when a diff is present, every rendered card requires pair-file `pseudocode` (fail closed). Placement still rejects missing, duplicated, and unknown paths |
| `lede` | string | Optional one-line context; not the primary spine |
| `pseudocode` | string, required | Short language-agnostic **section spine** (~12 lines max) rendered as a fenced code block |
| `watch` | string array | Decisions, assumptions, workarounds, or uncertainties to inspect |
| `notes` | `{file, text}` array | Authoring note tied to one exact file path in this section |
| `fold` | boolean | Start this section folded |

### Pair-file card contract

For each entry in `files`, the HTML emits one card showing:

1. the file `path`;
2. pair-file `pseudocode` (what that file’s change does);
3. a **Show real diff** click-expand control (`<details>`, collapsed by default)
   that reveals green/red unified hunks in place for that file only;
4. a GitHub blob link at headSha:
   `https://github.com/<owner>/<repo>/blob/<headSha>/<path>`.

Real hunks are present in the HTML only behind that expand control — not as
always-visible panels.

`files` arrays are both the reading-order source and the strict placement map.
When a diff is supplied, the renderer rejects missing, duplicated, and unknown
paths. A note path must exactly match a file in its own section; basename
matching is not allowed. `files` may be omitted only when no diff is being
validated; with a captured or fetched diff, keep complete placement and require
pair-file `pseudocode` on every card.

Each section must include section-spine `pseudocode`. `lede` may stay as
one-line context; it is not the primary spine.

## Formatting in narrative fields

`intro`, `subtitle`, `pr_label`, `lede`, `watch`, and `notes[].text` accept only:

```text
<b> <i> <em> <strong> <code> <br>
```

The tags accept no attributes. Everything else is escaped and displayed as
literal text, including an allowed tag with an attribute. `title`, section
titles, file paths, and source code are always fully escaped.

Section and pair-file `pseudocode` are not rich HTML. They are plain
language-agnostic text rendered as short fenced code blocks
(`<pre class="pseudocode">…</pre>` for the section spine;
`<pre class="pseudocode pair-pseudocode">…</pre>` on each card). Do not put
real TypeScript/Python dumps or a line-by-line prose tour in them. The renderer
rejects more than 12 non-empty lines on either field.

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
        {
          "path": "apps/jobs/src/retry-policy.ts",
          "pseudocode": "IF attempts >= limit THEN\n  return terminal\nELSE\n  bump attempts"
        },
        {
          "path": "apps/jobs/src/retry-policy.spec.ts",
          "pseudocode": "ASSERT third attempt is terminal\nASSERT fourth is rejected"
        }
      ]
    },
    {
      "id": "plumbing",
      "title": "Aside · Plumbing",
      "lede": "Registration and dependency changes.",
      "pseudocode": "REGISTER package\nLOCK dependencies",
      "fold": true,
      "files": [
        {
          "path": "package-lock.json",
          "pseudocode": "LOCK dependency versions"
        }
      ]
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
