# Merge independent opinions into pushback

Date: 2026-07-18

Supersedes the `vs-second-opinion` classification in
`classify-skills-by-kind.md`; the rest of that ADR remains in force.

## Context

`vs-pushback` and `vs-second-opinion` exposed two user-facing skills for the
same intent: challenge a formed decision before acting. Users had to choose the
review mechanism before the review could determine whether another model would
add value. Meanwhile, RFC and code-review workflows still needed a small,
non-interactive independent-advisor mechanism without running the full
pushback grill.

Multiple advisors also add correlated cost when they share a model family, and
waiting for them before the first question makes routine pushback slower.

## Decision

`vs-pushback` is the only public skill for adversarial decision review. Remove
`vs-second-opinion` from the plugin and documentation.

Keep advisor fanout as the internal shared contract
`vs-internal-shared/references/independent-advisors.md`. Pushback and other
review workflows may consume it through a deterministic risk gate:

- routine decisions use no advisor
- substantial decisions use one different-model advisor
- high-risk or disputed decisions may use two advisors in parallel

Advisor work starts during pre-scan, never delays Round 1, and shares one
45-second deadline. Late or unavailable advisors are skipped and disclosed.
The parent verifies objections against evidence and does not majority-vote.

## Consequences

- Users have one obvious challenge command.
- RFC and roast workflows retain a reusable non-interactive review seam.
- Model-backed advisors continue to count against the shared child budget.
- High-risk review can consume deep child budget, but routine pushback becomes
  no slower.
- Callers must provide minimal redacted context and tolerate partial or skipped
  advisor results.

## Alternatives considered

- **Keep both public skills.** Rejected because the trigger and outcome overlap,
  leaving users to choose an internal mechanism.
- **Put all advisor logic directly in pushback.** Rejected because RFC and code
  review would duplicate it or invoke an unrelated interactive grill.
- **Create a general orchestration runtime.** Rejected because one bounded
  review contract does not justify a new runtime abstraction.
