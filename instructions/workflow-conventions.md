---
description: vs workflow rules for decision ownership, artifacts, ADRs, and long-running waits
inline: true
---

# vs Workflow Conventions

vs separates strategic work from execution work. The human owns product intent, design tradeoffs, and final verification. The agent owns tactical execution, evidence gathering, implementation, review, testing, and clear handoff.

## Decision Ownership

- Ask the user for strategic decisions: product intent, expensive-to-reverse tradeoffs, destructive actions, or ambiguous definitions of "good".
- Resolve tactical decisions yourself: file naming, local helper shape, test command discovery, implementation sequence, and reversible defaults.

## Artifacts

Session artifacts belong outside the target repo by default:

```bash
PROJECT_ID=$(git config --get remote.origin.url 2>/dev/null \
  | sed -E 's#\.git$##; s#.*[:/]([^/]+/[^/]+)$#\1#; s#/#-#g')
[ -z "$PROJECT_ID" ] && PROJECT_ID=$(basename "$PWD")
ARTIFACTS_DIR="$HOME/.vs/$PROJECT_ID"
```

Use `~/.vs/$PROJECT_ID/<kind>/...` for pushback reports, specs, RFC drafts, research notes, QA reports, briefs, issue drafts, steals, and competitor maps.

Do not write session artifacts into `docs/`, `.context/`, `.octocode/`, or other project folders unless the user explicitly asks for a committed artifact.

## ADRs

Use ADRs for durable repo-level decisions that are architecture-impacting, cross-cutting, or hard to reverse.

- Prefer `adr/` at the repo root when the repo has no existing ADR convention.
- Use lowercase dash-separated filenames, for example `adopt-adrs-for-repo-level-decisions.md`.
- Do not use ADRs for temporary exploration notes, session reports, or small local implementation details.
- Use `/setup-adr` when the repo needs ADR support bootstrapped.

## Runtime Waits

Long-running watches and waits should use the host's background primitive rather than foreground polling.

- Claude Code: run watches in background and poll output.
- Codex: use a background terminal or awaiter-style subagent for long CI/reviewer waits.
- Avoid repeated busy-polling when the host can wake the agent on completion.
