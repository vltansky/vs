# Phase Boundaries

At the end of a meaningful phase, decide both **what work comes next** and **how
the context should continue**. These are separate decisions:

- The **semantic route** names the next workflow or outcome, such as
  `/vs-build-it`, `/vs-ship-it`, or done.
- The **session action** chooses how to carry the work across the boundary:
  continue, subagent, handoff, compact, clear, or stop.

The agent owns this decision. Do not make the user remember the routing model or
choose among several context-management commands without a recommendation.

## Choose one session action

Evaluate the routes in this order and choose exactly one:

1. **Stop** — no authorized, meaningful next work remains, or progress requires
   a strategic decision, access, or approval. A completed objective stops when
   the user did not request continuation; it can cross into a related next phase
   when that continuation is already part of the request. Report the semantic
   route without starting new scope.
2. **Subagent** — an independent, bounded lane can run while the parent
   continues useful work and remains responsible for integration. A subagent is
   not a context-cleanup mechanism or an overflow bin for the current session.
   Follow `subagents.md`; coupled and sequential work stays with the parent.
3. **Continue** — the next work serves the same objective, the current reasoning
   is materially useful, and the next coherent segment fits without degraded
   recall or repeated rediscovery. This is the default inside a phase.
4. **Handoff** — the next work needs a fresh owner, workspace, or session, but
   relevant state is not fully captured in durable artifacts. Also choose this
   when the current phase is incomplete and context pressure makes continuing
   unreliable. Preserve the state explicitly before moving.
5. **Compact** — the same conversation and objective should continue, a clean
   phase boundary has been reached, and a summary can safely replace verbatim
   history. Do not compact mid-phase merely to make room; use a handoff when
   losing exact reasoning would put unfinished work at risk.
6. **Clear** — the next work can start entirely from a durable spec, issue,
   roadmap, commit, or other source of truth, and the old conversation is now
   disposable. Use the host's fresh-task equivalent when `/clear` is unavailable.

Do not infer context pressure from token folklore alone. Prefer observable
signals: repeated rediscovery, forgotten constraints, a large irrelevant
history, an upcoming owner or workspace change, or a complete durable artifact
that already replaces the conversation.

## Durable handoffs

When handoff is selected and no existing artifact fully carries the state,
write `~/.vs/$PROJECT_ID/sessions/YYYY-MM-DD-<topic>-handoff.md`. Include:

- objective and current phase/status
- durable sources of truth by path or URL
- decisions and constraints not already recorded elsewhere
- remaining work and the first concrete next action
- verification evidence, blockers, and required approvals

Reference specs, issues, commits, diffs, and reports instead of duplicating
them. Redact credentials, secrets, and personal information. If the current
request authorizes only advice, recommend the handoff without writing it.

## Reporting

The decision is usually internal. Keep the workflow's existing `Next` route as
the semantic destination. Report the session action only when the user must act
(`/compact`, `/clear`, or a fresh task), a handoff artifact was created, or a
non-default transition materially changes execution.

When reporting it, use this compact shape:

```text
Session: <continue | subagent | handoff | compact | clear | stop> — <one reason>
Next: <semantic workflow, artifact, command, or concrete action>
```
