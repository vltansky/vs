# Disk-backed evidence

Use this contract for screenshots, DOM snapshots, transcripts, diffs, logs,
recordings, and other evidence whose raw form is too large for routine model
context.

## Principle

Keep the authoritative artifact on disk. Return a bounded description that lets
the agent prove which artifact it used, then retrieve only the smallest portion
needed for the current decision. A manifest proves identity and availability;
it does not prove that the artifact's contents are correct.

Use this shape:

```json
{
  "path": "/absolute/path/to/evidence",
  "mediaType": "text/plain",
  "bytes": 12345,
  "sha256": "...",
  "summary": "bounded workflow-specific description",
  "locator": "lines 80-110 | hunk 3 | turn 12 | crop x,y,w,h"
}
```

`summary` and `locator` are optional. Keep emitted summaries under roughly 2 KB.
Never put base64, image bytes, full transcripts, full DOM snapshots, complete
logs, or whole large diffs in the manifest.

## Retrieval

Start with structure and counts. Retrieve raw content only on demand:

- text or logs: one bounded line range around a matching error;
- code review: one diff hunk plus the owning source function and tests;
- transcripts: one indexed transcript turn or a short adjacent turn range;
- images: structured dimensions and annotations first, then the smallest useful
  image crop when pixels are required for judgment;
- recordings: timestamps and event metadata first, then a short clip or frame.

Do not bypass context for evidence the model must genuinely interpret. Narrow it
instead. Secrets and PII must be redacted before capture or before any selected
slice enters context.

## Tool

Resolve `scripts/evidence-manifest.mjs` from this skill directory.

```bash
# Describe existing files without emitting their contents.
node "$EVIDENCE_TOOL" manifest "$EVIDENCE_PATH"

# Keep command stdout on disk. With --json-tail, the last parseable JSON line is
# returned as structured metadata and all other output is stored.
producer-command \
  | node "$EVIDENCE_TOOL" capture "$EVIDENCE_PATH" --json-tail

# Deliberate bounded retrieval after the manifest/index identifies useful lines.
node "$EVIDENCE_TOOL" slice "$EVIDENCE_PATH" --start 80 --end 110
```

`slice` rejects ranges over 200 lines and truncates output over 32 KiB. Prefer an
even smaller range when it is enough to make the decision.
