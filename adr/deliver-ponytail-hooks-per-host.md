# Deliver Ponytail hooks per host

Date: 2026-08-24

Supersedes the hook-delivery portion of
[make-ponytail-a-composed-building-block](make-ponytail-a-composed-building-block.md);
the Ponytail contract, invocation surface, and disable boundary are unchanged.

## Context

The prior ADR assumed one hook manifest and one script serve Claude Code,
Codex, and Cursor. Live verification against current hosts showed three
incompatible delivery contracts:

- Claude Code auto-loads the plugin's `hooks/hooks.json` (PascalCase events)
  and accepts raw stdout as session context. A manifest `hooks` field pointing
  at the same file now triggers a duplicate-hooks warning.
- Codex removed plugin-manifest hooks entirely (feature `plugin_hooks` is
  stage `removed`; a probe hook in an installed plugin never executed, and
  force-enabling the flag changed nothing). Only user-level
  `~/.codex/hooks.json` hooks run, they are gated by interactive trust
  approval, and a SessionStart response must be
  `{"hookSpecificOutput": {"hookEventName", "additionalContext"}}` JSON —
  raw stdout is ignored.
- Cursor discovers plugin hooks but with camelCase event names
  (`sessionStart`, `subagentStart`), so it cannot match PascalCase entries,
  and it requires `{"additional_context"}` JSON on stdout.

## Decision

One script, host-detected at runtime; delivery wired per host:

- `hooks/ponytail.mjs` detects the host from the hook stdin payload (Cursor
  sends `cursor_version`/camelCase events; Codex is the only host sending
  `permission_mode` with PascalCase events) and emits that host's response
  shape. Claude Code accepts both raw stdout and the Codex JSON shape, so
  misdetection between the two stays harmless.
- Claude Code: `hooks/hooks.json` auto-loads; the manifest carries no `hooks`
  field.
- Codex: `install.sh`/`install.ps1` run the plugin-shipped
  `hooks/install-codex-hook.mjs`, which idempotently merges SessionStart and
  SubagentStart entries into `~/.codex/hooks.json` pointing at the installed
  plugin. The user approves the hook once in Codex's trust prompt; untrusted
  hooks are silently skipped.
- Cursor: `.cursor-plugin/plugin.json` points `hooks` at
  `hooks/cursor-hooks.json` (camelCase events), overriding auto-discovery of
  the PascalCase file.

`tests/hooks.eval.ts` pins each host's event names, env, stdin payload, and
response shape by executing the literal hook commands; `tests/install.eval.ts`
pins the Codex registration flow.

## Consequences

- Ponytail reaches Cursor sessions for the first time and regains a working
  Codex path.
- Codex delivery depends on installer-managed user config plus a one-time
  trust approval, and the registered absolute path goes stale if Codex
  relocates its plugin cache; the command's existence guard keeps such
  sessions silent rather than broken, and rerunning the installer repairs the
  path.
- Host detection rests on payload fields Codex and Cursor do not guarantee as
  stable API; the evals encode those assumptions so a host change fails
  loudly.

## Alternatives considered

- **One shared hooks file for all hosts.** Rejected: Cursor cannot parse
  PascalCase events, and Codex ignores plugin hook manifests entirely.
- **Always emit hookSpecificOutput JSON.** Rejected: Cursor requires a
  different JSON shape, so host detection is needed anyway; raw stdout for
  Claude preserves the proven current behavior.
- **Copy hook script and contract into `~/.codex/hooks/`.** Rejected: the
  copies would drift from the installed plugin; referencing the plugin path
  keeps one source and lets plugin upgrades update the hook body without
  re-registration.
