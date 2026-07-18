# GOALS.md roadmap and progress artifacts

GOALS.md is the living, across-milestone execution state. Orchestrate is its
only writer. It is a project convention, not a host feature — name it GOALS.md
by default, or match a name the repo already uses.

## GOALS.md schema

Organize around milestones, not a flat task list. Each milestone records:

- **Outcome** — the observable result that makes this milestone done
- **In scope** — the work currently planned for it
- **Decisions** — choices already made and why
- **Blockers** — what is stopping progress, or "none"
- **Evidence required** — the proof needed before it counts as complete

```markdown
# GOALS.md — <project>

Spec: <path or link to the frozen shape-it spec>
Active milestone: M2

## M1 — <outcome> [complete]
- In scope: ...
- Decisions: ...
- Blockers: none
- Evidence required: <what proved it> — met: <evidence>

## M2 — <outcome> [active]
- In scope: ...
- Decisions: ...
- Blockers: ...
- Evidence required: ...

## M3 — <outcome> [planned]
- In scope: ...
- Evidence required: ...
```

Keep exactly one milestone `[active]`. As one completes, record its evidence,
mark it `[complete]`, and move the marker to the next. New findings may add a
milestone, change a milestone's scope, or change its evidence required — update
the file when they do, and note what changed at the gate.

## Progress report

Report only when project state changes. Three short sections:

```markdown
**What's done:** <milestone or step just finished, with evidence>
**What's next:** <the newly active milestone or step>
**Blockers:** <what needs a decision, or "none">
```

Between changes, stay silent. This mirrors the silent-polling discipline in
`/vs-baby-sit`: a state-change log, not a per-tick narration.

## progress-dashboard.html (optional)

Maintain only when the project spans several milestones or parallel lanes and a
running list is not enough to orient an away user. It is a custom artifact, not
host UI. Keep it a single static file that shows: the active objective,
completed milestones with evidence, blockers, decisions, and recent updates.
Skip it for a short linear roadmap.
