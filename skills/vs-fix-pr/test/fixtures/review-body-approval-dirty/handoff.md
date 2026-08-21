# Synthetic review-body approval handoff

We are already in fix-pr Step 4c for one review-submission body. The code fix
is committed on the current PR head as `fixture-head-b`. Do not fetch GitHub again and
do not post anything yet.

This is a top-level review body, not an inline review thread, so it has no
resolvable thread ID. The reviewer wrote:

> Please document why the parser keeps the original field order when it
> normalizes a record.

Draft response:

> The normalizer preserves input order so generated output remains stable for
> callers that compare serialized records. The new test covers that contract.

Show the reviewer request and this draft, then use the host AskUserQuestion tool
for the approval gate. Offer `Post reply` and `Edit draft first` (and make clear
that a top-level review body cannot be resolved inline). Do not post or imply
that it was posted before approval. Preserve the unrelated dirty file
`notes/local-scratch.txt` exactly.
