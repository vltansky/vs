# Scale code review depth to the change

Date: 2026-07-30

## Context

`vs-roast-code` ran one program for every review. Regardless of what was under
review, the skill scanned the whole repository with `slop-scan scan .`, wrote the
diff to `~/.vs/$PROJECT_ID/reviews/evidence/`, emitted a manifest and a hunk
index, swept three Pass 1 lenses, swept four more Pass 2 lenses, grouped the
result under five severity tiers, deep-dived a "worst offender", walked a
seven-item approval bar, and — past a size or risk gate — spent a Codex run.

That program is right for a migration touching auth. On a two-line copy fix it is
the reviewer generating more artifacts than the change has lines. Worse, the
ceremony creates pressure to fill it: a five-tier inventory with a worst-offender
spotlight implicitly asks for a worst offender, and a seven-item approval bar
asks for a blocker, on a diff that has neither. Ceremony that must be filled is
how a review starts inventing findings.

The rest of the plugin already scales. `vs-ship-it` has a mechanical PR fast path
for a single doc file under 50 changed lines. `vs-build-it` Phase 4 keeps a diff
of at most 5 files and 300 lines in the parent and only loads `vs-roast-code`
above that. `vs-verify` climbs a ladder and stops at the cheapest sufficient
proof. The review skill was the one place where the cheapest path did not exist.

## Decision

`vs-roast-code` classifies the change before reviewing it, announces the class,
and runs the program for that class.

- **Phase 1 classifies on two signals**: size (changed files, changed lines,
  whether the change is docs/comments/formatting only) and risk surface (auth,
  secrets, crypto, query construction, shell or dynamic execution, untrusted
  input parsing, persistence and migrations, concurrency, payments, public API,
  CI/release/permissions config). One `git diff --stat` plus a scan of the
  changed lines produces both.
- **Three classes**: `SMALL` (one integrated pass, flat findings list, no
  disk-backed capture, no advisor lane, no tiers), `STANDARD` (Pass 1 lenses,
  parent roast, tiered inventory, advisor lane on a clean parent pass),
  `HIGH-RISK` (the full program plus the cross-model second opinion).
- **Risk surface outranks size.** A five-line diff that hardcodes a credential or
  loosens an auth check is `HIGH-RISK`. Size can only ever downgrade a change
  that touches no risk surface.
- **Escalation needs evidence, not suspicion**: a confirmed capital- or
  felony-level finding, a diff larger than the stat implied, or an explicit user
  request for depth. Announce the upgrade in one line and continue.
- **Ceremony is opt-in per class, and unfilled ceremony is not a finding.** The
  tiered taxonomy, worst-offender spotlight, fix-tier menu, and approval bar
  belong to `STANDARD` and `HIGH-RISK`. A `SMALL` review answers in a few lines.
  Inventing a structural finding, a tier, or a blocker to justify the program
  that ran is a review defect.

The fixed five-tier taxonomy is unchanged where it applies, and an explicit user
request for a deep review, an exhaustive roast, or a second opinion still wins
over the size signal.

Depth scales down, but the cross-model advisor lane is not part of what gets
cut on a `STANDARD` change — see
[review-evidence-lanes-govern-the-verdict.md](review-evidence-lanes-govern-the-verdict.md),
which gates that lane on a clean parent pass rather than on size alone.

## Consequences

- Small reviews cost roughly one file read and a short answer instead of an
  evidence file and five tier headers.
- The severity taxonomy still governs every review that has real findings to
  group, so `roast-code.eval.ts` taxonomy and redaction expectations hold: both
  fixtures touch secrets and therefore classify `HIGH-RISK`.
- Reviews become slightly less uniform to read. Accepted: the one-line class
  announcement tells the user which program ran and why.
- Risk: a misclassified change gets a thin review. Mitigated by risk surface
  outranking size, by mid-review escalation on evidence, and by the rule that an
  explicit depth request cannot be downgraded.
- Risk: `SMALL` becomes a hiding place for a lazy review. Mitigated by keeping
  the positive-assertion requirement in every class — a clean verdict must still
  name what is specifically right, with `file:line`.

## Alternatives considered

- **Leave the program fixed and trim the prose.** Rejected. The cost is the
  passes and artifacts, not the wording; a shorter description of the same
  program still runs a repo-wide scan on a typo fix.
- **Classify by size alone.** Rejected. The redaction fixture is five lines of
  hardcoded secrets, which is exactly the change that must not get the cheap
  path. Transcript review found the same failure in the other direction: the
  session where the advisor lane produced the run's only real findings was a
  three-file diff that a size-only gate would have routed away from it.
- **Ask the user which depth they want.** Rejected. The signals are in the diff,
  and `vs-decide-for-me` semantics put a question the reviewer can answer itself
  on the reviewer.
- **Move classification into a shared reference for every review-ish skill.**
  Deferred. `vs-ship-it` and `vs-build-it` already carry their own thresholds
  that predate this ADR; unifying them is a separate change with its own eval
  surface.
