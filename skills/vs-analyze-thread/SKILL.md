---
name: vs-analyze-thread
description: "Analyze Codex, Claude Code, or Cursor threads, transcripts, and transcriptions. Use for thread analysis, transcript review, conversation audits, agent-performance diagnosis, comparing sessions, finding loops or corrections, and extracting decisions, outcomes, evidence, and actionable improvements."
---

# Analyze Thread

Turn one or more coding-agent conversations into an evidence-backed diagnosis.
Support the active conversation, attached or exported transcripts, and local Codex
or Claude Code JSONL history. Treat Cursor's Markdown export as its portable
transcript contract.

## Guardrails

- Keep project files and transcript sources read-only unless the user explicitly
  asks to apply findings. A cross-session report under `~/.vs/` is output, not a
  source mutation.
- Do not surface secrets, credentials, private keys, hidden reasoning, or raw
  chain-of-thought. Paraphrase sensitive evidence and omit reasoning events.
- Separate agent behavior, tool or environment failures, user corrections, and
  task complexity. Similar symptoms can have different owners.
- Label claims as **verified**, **inferred**, or **unknown**. A polished summary
  must not conceal missing transcript sections or unavailable tool results.
- Quote only the smallest useful evidence fragment and identify its source and
  turn. Prefer paraphrase when a quote may contain private data.

## 1. Resolve scope

Use explicit transcript paths, thread IDs, pasted text, or the current
conversation first. If the user says only "analyze this thread," analyze the
active thread. If they ask for recent history without a count, use the three most
recent project-matching sessions.

Ask only when choosing the wrong project, session set, or comparison baseline
would materially change the result.

## 2. Acquire transcripts

Prefer host APIs or thread-reading tools when available. Otherwise use the
narrowest local source that matches the request:

| Host | Preferred source | Local or export fallback |
|---|---|---|
| Codex | Active thread or thread-read tool | `~/.codex/sessions/**/rollout-*.jsonl`; match a supplied ID or `session_meta.payload.cwd` |
| Claude Code | Active conversation | `~/.claude/projects/<project-slug>/*.jsonl` |
| Cursor | Active chat or `@Past Chats` | Export the chat as Markdown from History |

Do not scrape Cursor's SQLite history by default. Its internal schema is not a
portable contract; request a Markdown export if the active chat is insufficient.
Background or remote-agent chats may require the host's own history surface.

For local JSONL or exported Markdown, normalize only the files in scope:

```bash
node "<skill-dir>/scripts/normalize-transcript.mjs" <transcript-file> [more-files]
```

The normalizer emits user and assistant turns with stable source and turn labels.
It excludes system, developer, tool, and reasoning records. Read raw records only
when diagnosing a specific tool failure, and summarize them rather than dumping
them.

If a transcript cannot be accessed, say exactly which source is unavailable and
continue with the evidence that is available.

## 3. Build an evidence ledger

For every material claim, record:

- source and turn or timestamp;
- observed event;
- classification: verified, inferred, or unknown;
- owner: agent, user decision, tool/environment, or external dependency;
- impact on the outcome.

Deduplicate repeated status messages and compacted copies of the same turn. Treat
summaries as secondary evidence when original turns are present.

## 4. Analyze

Evaluate the conversation along these axes:

1. **Intent and outcome** — what the user wanted, what was delivered, and what
   remains incomplete.
2. **Trajectory** — the few turning points that changed the plan or result.
3. **Decisions and corrections** — accepted choices, rejected assumptions, and
   durable preferences.
4. **Execution quality** — useful actions, avoidable loops, premature claims,
   missed verification, and unnecessary interruptions.
5. **Failure ownership** — agent mistake versus tool, auth, sandbox, network,
   repository, or external-state failure.
6. **Improvements** — the smallest instruction, workflow, tooling, or product
   changes that would prevent recurrence.

Use metrics only when the transcript supports them. Useful measures include
user corrections, repeated commands, failed tool calls, approval waits, and
turns between request and verified outcome. Do not invent token counts, costs,
durations, or success rates.

For comparisons, apply the same rubric to every transcript and explain material
differences in task scope or environment before ranking agents or sessions.

## 5. Report

Lead with the diagnosis. A single-thread analysis stays compact in Markdown in
chat. Omit empty sections; for a short thread, collapse the report to Bottom
line, Findings, and Recommended changes.

```markdown
# Thread analysis

## Bottom line
<outcome, main cause, and current state>

## What happened
- <turning point> — <source:turn> — verified|inferred

## Decisions and corrections
- <decision or durable preference> — <evidence>

## Friction
- <symptom> -> <cause or unknown> -> <impact>

## What worked
- <effective behavior and why it mattered>

## Recommended changes
1. <smallest high-value change> — owner: <agent|workflow|tool|product>

## Evidence gaps
- <missing or inaccessible evidence, or "None material">
```

For a cross-session comparison, use HTMDX because the repeated rubric, metrics,
turning points, and evidence are easier to compare visually. Resolve the project
ID and create the artifact directory. Choose a comparison slug from the session
labels or comparison focus, using lowercase letters, numbers, and hyphens only:

```bash
PROJECT_ID=$(git config --get remote.origin.url 2>/dev/null \
  | sed -E 's#\.git$##; s#.*[:/]([^/]+/[^/]+)$#\1#; s#/#-#g')
[ -z "$PROJECT_ID" ] && PROJECT_ID=$(basename "$PWD")
REPORT_DIR="$HOME/.vs/$PROJECT_ID/thread-analysis"
REPORT_DATE=$(date +%F)
COMPARISON_SLUG="sessions"
REPORT_EXTENSION="html"
REPORT_BASE="$REPORT_DIR/thread-comparison-$REPORT_DATE-$COMPARISON_SLUG"
REPORT_PATH="$REPORT_BASE.$REPORT_EXTENSION"
SUFFIX=2
mkdir -p "$REPORT_DIR"
while ! (set -C; : > "$REPORT_PATH") 2>/dev/null; do
  REPORT_PATH="$REPORT_BASE-$SUFFIX.$REPORT_EXTENSION"
  SUFFIX=$((SUFFIX + 1))
done
```

Replace the generic `sessions` slug before resolving the path. The loop appends
a numeric suffix before the extension (`-2`, `-3`, and so on) when the output
already exists and atomically reserves the first free path, so concurrent runs
cannot overwrite an earlier comparison. For HTMDX, copy
`references/thread-comparison-template.html` into the reserved `$REPORT_PATH`.
If population fails, report the reserved empty path instead of reusing it.

Edit only the HTMDX source block. Produce one canonical artifact with no
Markdown twin, then return the bottom line and report path in chat. Follow the
[shared rich-artifact contract](../vs-internal-shared/references/rich-artifacts.md).

Apply the security boundary to the actual report content. Paraphrase and redact
credentials, secrets, PII, and sensitive evidence. A sanitized comparison still
uses HTMDX. If the user explicitly requests Markdown, or sensitive data must
remain and no trusted local runtime is available, set `REPORT_EXTENSION="md"`,
run the same collision-safe path resolution, and write the comparison as
`$REPORT_DIR/thread-comparison-$REPORT_DATE-$COMPARISON_SLUG.md` without copying
the HTML template.

Do not write findings into rules, memories, issues, or skill files without a
separate explicit request.

## Workflow

Direct: emit **Next** only. Composed: return to caller.

**Prev:** thread selection | transcript export
**Next:** done | `/vs-retro` for reviewed learnings
**Relevant:** `/vs-recap` | `/vs-retro` | `/vs-try-skill`
