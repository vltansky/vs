# Open regular PRs instead of drafts

Date: 2026-09-08

## Context

`vs-ship-it` opened every PR as a draft and handed it to `vs-baby-sit`, which
kept it draft until the exact head passed CI and automated review, then ran
`gh pr ready`. A PR whose first head was already green still sat as a draft
until the babysitter promoted it, so reviewers saw a draft badge on work that
was ready, and a user who declined babysitting had to promote it by hand.

The babysitter already handles a non-draft PR: before a confirmed repair it
runs `gh pr ready --undo`, keeps the PR draft through the repair pushes, and
promotes it again only when the new head is green.

## Decision

Ship-it opens a regular PR. `gh pr create` runs without `--draft` and the
verification step requires `isDraft == false` on the exact head. Draft state
is reserved for the babysitter's repair window, where it still protects an
unverified head from being merged.

GitHub auto-merge is not part of this workflow. It was considered and dropped:
on a repository without a branch rule blocking the PR, `gh pr merge --auto`
merges on the spot before CI runs, so arming it at creation would need a
guard whose failure mode is a silent early merge. Merging stays a user turn
after the human review gate.

## Consequences

- The first head is reviewable and mergeable as soon as the PR exists; the
  draft-until-green contract now covers repairs only.
- The ship-it handoff reports `State: open, ready for review` and explains
  that a repair converts the PR to draft and back.
- The babysitter's ready-for-review gate is reached only after a repair, not
  on every PR.
