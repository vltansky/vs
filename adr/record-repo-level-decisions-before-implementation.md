# Record repo-level decisions before implementation

Date: 2026-07-27

Builds on `adopt-adrs-for-repo-level-decisions.md`, which established `adr/` as
the durable home for repo-level decisions. That ADR said where decisions live;
this one says when they are written.

## Context

Both workflow skills treated the ADR as an afterthought.

`vs-shape-it` — the skill that actually makes architecture decisions — only
recommended one, in a single line inside its Design step: "For an
expensive-to-reverse repo-level decision, recommend an ADR." A recommendation
competes with everything else in a closing interaction, so the decision that was
just reasoned through with full evidence got handed off as a suggestion the user
might act on later, if they remembered.

`vs-build-it` wrote ADRs in Phase 3 Step 3b, after execution. By then the code
exists, the approach is settled, and the record is written backwards from the
diff rather than forwards from the reasoning. An ADR written after the fact
documents what happened; it does not gate what happens. It also cannot bind the
implementation it is supposed to constrain, because the implementation is
already done.

The net effect was that the decision record trailed the code in both skills, and
the shaped rationale — alternatives evaluated, prior art rejected, tradeoffs
accepted — evaporated between the two.

The counterweight is real: ADRs are a durable record, not a working scratchpad.
`vs-setup-adr` exists to install ADR support "without turning the repo into a
planning graveyard." Most shaped work is ordinary feature work that settles no
repo-level decision, and an ADR per session would bury the ones that matter.

## Decision

The decision record precedes the implementation it governs, and the two skills
split the roles.

**Shape-it drafts the ADR and owns the decision.** The ADR question is resolved
once, explicitly, in the independent beat — the same decide-once treatment
`shape-it-always-stress-tests-and-researches.md` gave research:

- When the design settles an expensive-to-reverse repo-level decision, write
  `adr/<slug>.md` during independent shaping, before the closing interaction.
  The draft is uncommitted; per `adopt-adrs-for-repo-level-decisions.md`,
  approval happens at PR merge, so no `Status` field is added.
- When no such decision was settled, say so in one clause with the reason.
  Silence is not an allowed outcome.
- When the decision qualifies but the repo has no ADR surface, recommend
  `/vs-setup-adr` in the closing interaction instead of unilaterally creating an
  ADR convention the repo never adopted.

Drafting an ADR does not breach shape-it's hard gate. An ADR is a decision
record, not implementation.

The Goal Contract gains an `ADR` line naming the paths build-it must honor, or
`None — <reason>`. That makes the record part of the artifact the user approves
rather than a follow-up task, and gives build-it a binding input it can read.

**Build-it enforces the ADR and fills the gap it created itself.** Its
after-the-fact Step 3b shrinks to the case it is actually good for:

- Phase 0 reads every ADR the plan names. Its constraints outrank build-it's own
  decision principles; a decision principle cannot overturn a recorded decision.
- When build-it generated the plan itself (Step 1a) and that plan settles a
  durable repo-level decision, the ADR is written and committed at the end of
  Phase 2 — after pushback has stressed the plan, before any implementation
  commit.
- Phase 3 keeps only the case that genuinely cannot run earlier: execution
  invalidated a recorded decision. That is handled by superseding with a new
  ADR, never by editing the merged one.

## Consequences

- The rationale reaches the repo while it is still intact. The alternatives and
  the rejected prior art are in working memory during shaping; after
  implementation they have to be reconstructed.
- ADRs become a real gate. An implementation that contradicts an approved ADR is
  now a visible conflict rather than an undocumented drift, because build-it
  reads the record before it writes code.
- Shape-it sessions that settle a repo-level decision get longer by one drafted
  document. Sessions that do not settle one pay a single sentence.
- The decide-once rule is self-assessed, like the research rule it mirrors. A
  session can still misjudge whether a decision is repo-level; requiring a stated
  outcome makes the misjudgment visible in the transcript instead of silent.
- Build-it writing an ADR before implementing commits the repo to a decision that
  execution may then invalidate. The supersede path is the release valve, and it
  costs a second ADR.
- Shape-it now writes into the repository working tree, not only into
  `~/.vs/$PROJECT_ID/`. That is a narrow, deliberate exception to its
  planning-only posture, bounded to the repo's ADR directory.

## Alternatives considered

- **Write an ADR for every shaped design.** Rejected. Most shaping sessions
  settle no repo-level decision, and an ADR per session turns `adr/` into the
  planning graveyard `vs-setup-adr` was written to prevent. The signal that
  matters is which decisions were expensive to reverse.
- **Keep it a recommendation and let the user ask.** Rejected. That is the
  current behavior, and it is why the decision record trails the code. A
  recommendation surfaced at the end of a long closing interaction is the first
  thing dropped.
- **Put ADR authorship only in build-it.** Rejected. Build-it did not make the
  decision; it received it. Writing the record where the reasoning did not happen
  is how ADRs end up as diff summaries.
- **Put ADR authorship only in shape-it.** Rejected. Build-it runs without a
  spec — Step 1a generates its own plan — and that path settles durable
  decisions with no shaping session to record them.
- **Have shape-it write the ADR to `~/.vs/$PROJECT_ID/` and let build-it move
  it.** Rejected. It adds a handoff step whose only failure mode is losing the
  document, and the repo's ADR convention already treats an unmerged file as an
  unapproved decision.
