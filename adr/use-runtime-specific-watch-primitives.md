# Use runtime-specific watch primitives

- Date: 2026-04-15

## Context

Several vs skills wait on long-running subprocesses such as CI checks, reviewer-bot watches, `gh pr checks --watch`, and `gh run watch`. Depending on the host runtime, the wrong primitive silently truncates the wait.

- Claude Code foreground `Bash` calls hit a timeout ceiling, while background commands with `run_in_background: true` wake the agent when the process exits.
- Codex CLI unified-exec background terminals keep the process running, but long waits are better handled by the `awaiter` builtin sub-agent or by raising `background_terminal_max_timeout`.

Earlier versions of `vs-fix-pr` and `vs-ship-it` incorrectly claimed Codex had no background-with-notify primitive and recommended busy-polling. That guidance was stale.

## Decision

Use runtime-specific background primitives for any subprocess that may run longer than a foreground timeout ceiling allows.

- Claude Code: use `Bash` with `run_in_background: true`. Do not foreground a `--watch` or other multi-minute subprocess.
- Codex CLI: use the `awaiter` builtin sub-agent, or a unified-exec background terminal with `background_terminal_max_timeout` raised in `~/.codex/config.toml`. Do not busy-poll with repeated `--json state` calls.

## Consequences

- Positive: long-running watches work correctly on both Claude Code and Codex CLI without host-specific skill forks
- Positive: one durable place for the runtime split; skills can link out instead of restating the full rationale
- Negative: skill authors must remember the split when adding long-running waits
- Follow-up: mirror this guidance in peer repos that ship `skills` or `ck-*` skills for Codex users

## Alternatives considered

- Busy-poll with `--json state` on Codex: rejected because it pollutes tool output, costs tokens, and depends on manual polling discipline
- Bump foreground timeouts and hope they are enough: rejected because the ceiling is still hard and the turn blocks
- Ask the user to wait and rerun the skill after CI completes: rejected because it breaks the autonomous handoff chain
