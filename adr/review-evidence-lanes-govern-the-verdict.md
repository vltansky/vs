# Review evidence lanes govern the verdict

- Date: 2026-07-30

## Context

Transcript analysis of every real session where `vs-roast-code` actually ran
(six sessions on disk, four of them full reviews) produced a consistent picture
of where the review's cost went and where its findings came from.

Where the findings came from: the cross-model advisor lane. In both runs where
Codex completed, it surfaced findings the parent pass had already cleared. In
one run the parent closed the review with `Remaining: 0` on a diff an
independent reviewer then broke down into two capital-level and three
felony-level problems. The advisor lane also failed in roughly three of five
attempts — timeout, a blocked environment, a declined approval — and on every
failure the verdict read exactly as it would have read had the lane succeeded.
A missing lane silently upgraded confidence instead of lowering it.

Where the cost went, none of it into findings:

- `Pass 0` ran a `slop-scan` ladder in seven observed runs and produced zero
  actionable findings. Once it printed a clean result on a diff that had real
  bugs, which is worse than producing nothing — it read as reassurance.
- Flag discovery for the advisor lane. `--uncommitted` returns nothing on an
  already-committed branch, so runs probed: `codex review --help`, then one
  flag, then the other, then a backgrounded run polled with `sleep`. One
  session spent four tool calls and several minutes establishing which of two
  cases git could have answered in one.
- Unconditional re-review after fixes, including after a misdemeanor-tier fix,
  paying a second full advisor pass to confirm wording.
- Report bulk that the findings did not support: zingers past the finding
  count, tier headers opened to hold nothing, and a fix-tier menu offered on
  changes where the answer was always "fix the serious ones".
- Disk-backed evidence capture — patch file, hunk index, manifest — on diffs
  small enough that printing the diff was cheaper than describing where it was
  written.

Separately, two real misses shared a shape worth naming. Both were changes that
were stylistically clean, type-checked, and green, and did not work: a guard
armed on one screen and checked on another that is never mounted at the same
time. And one fix was applied to one of several copies of the same rule, with
the unfixed copies invisible in the diff.

## Decision

The review's verdict is a function of which evidence lanes actually ran, and
budget goes to the lanes that produce findings.

- **Lane accounting is mandatory.** Every closeout names the lanes it ran:
  `Lanes: codex ✓`, or `Lanes: codex ✗ (timeout)` with the reason. When the
  advisor lane did not run, a `HIGH-RISK` verdict reads "reviewed, not
  independently verified — human review required", never `Remaining: 0` on its
  own, and confidence caps at 70%.
- **The advisor lane fires on `HIGH-RISK` and on a clean parent pass.** A clean
  self-review is the least trustworthy verdict the skill produces and the
  cheapest moment to buy an independent one — there is nothing else left to do
  on that diff. Size alone does not gate the lane.
- **The scope flag is derived from the selected review scope, once.** Phase 0
  retains whether it selected explicit uncommitted paths, explicit branch
  paths, a current-file review, staged changes, or a branch diff. Unrelated
  working-tree changes do not replace that selection, and explicitly selected
  untracked files stay in the uncommitted scope. `--help`, retry-the-other-flag,
  and poll-a-background-run are all forbidden.
- **`timeout 120` is the whole retry policy.** No backgrounding, no polling.
  Past the window the lane is logged as skipped and the missing-lane rule
  applies.
- **Re-review must earn a re-run**: only after fixing a CAPITAL OFFENSE or
  FELONY. Below that, focused tests plus a re-read of the changed hunks are
  the proof.
- **No deterministic scanner phase.** `Pass 0` and the `slop-scan` ladder are
  removed. AI-slop patterns stay in the lens list, where a reader with the diff
  in front of them assigns severity by impact.
- **Disk-backed evidence capture is `HIGH-RISK` only.** Under 300 changed
  lines, reading the diff directly costs less than the artifacts describing it.
- **Output is bounded by findings.** One to three zingers, one per real
  finding; empty tiers are dropped rather than filled; serious findings are
  fixed automatically instead of offered as a menu.
- **A provable no-op escalates a `SMALL` change** alongside security,
  data-loss, and crash findings — a fix that cannot fire on the path it
  targets, a guard checked where it is never armed, a test asserting something
  other than the behavior in question. Green tests and a confident summary are
  actively laundering that class of defect.
- **Fixes sweep for their other copies.** Before calling a fix done, grep for
  further copies of the changed selector, constant, threshold, or rule; fix
  every copy in scope or name the unfixed ones as a finding.

## Consequences

- Positive: the budget freed by the scanner, the flag probing, and the
  unconditional re-review pays for an advisor lane on exactly the reviews that
  most need it.
- Positive: a failed lane can no longer be laundered into a confident clean
  verdict — the same failure mode
  [completion-claims-inherit-verify-status.md](completion-claims-inherit-verify-status.md)
  fixed for build-it and ship-it summaries.
- Negative: `STANDARD` reviews that find nothing now cost an advisor run they
  previously skipped. Accepted: that is the case where the parent's verdict is
  least reliable, and it is bounded by `timeout 120`.
- Negative: dropping the scanner loses a lane that could in principle catch
  something the lenses miss. Accepted on evidence — zero findings in seven
  runs.
- Follow-up: the missing-lane rule and the lane field are asserted statically;
  behavior evals cannot exercise the advisor lane, so lane-failure wording
  stays static-only coverage.

## Alternatives considered

- **Keep `Pass 0` but scope it to the diff.** Rejected. Scoping fixes the cost,
  not the yield; the lane produced nothing in seven runs at any scope.
- **Retry the advisor lane on timeout.** Rejected. Observed timeouts were the
  review not finishing, not a transient failure; a retry doubles the wall clock
  for the same outcome. Weakening the verdict is the honest response.
- **Make a failed advisor lane block the review.** Rejected, for the reason
  `completion-claims-inherit-verify-status.md` rejected blocking on `WARN`: the
  lane is legitimately unavailable in some environments, and the fix is
  calibrated wording.
- **Ask the user whether to spend the advisor lane on a clean pass.** Rejected.
  The user cannot answer better than the skill can, and a question at the end
  of an otherwise-finished review is the most expensive place to stop.
