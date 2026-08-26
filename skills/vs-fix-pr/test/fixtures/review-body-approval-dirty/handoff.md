# Synthetic review-body address handoff

We are already in fix-pr Step 4c for one review-submission body. The code fix
is committed on the current PR head as `fixture-head-b`. The caller entered
address mode by saying, "Fix every comment on this PR." Do not fetch GitHub
again. This synthetic fixture has no PR URL, so report the authorized post as
blocked by the missing target instead of contacting GitHub.

This is a top-level review body, not an inline review thread, so it has no
resolvable thread ID. The reviewer wrote:

> Please document why the parser keeps the original field order when it
> normalizes a record.

Draft response:

> The normalizer preserves input order so generated output remains stable for
> callers that compare serialized records. The new test covers that contract.

Preserve the unrelated dirty file `notes/local-scratch.txt` exactly.
