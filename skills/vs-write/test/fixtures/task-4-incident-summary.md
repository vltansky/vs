# Task 4: Incident summary

Write the summary section of the postmortem. Audience is mixed: engineers who will fix it, and a support lead and a product manager who need to know impact.

Raw timeline and findings:
- 14:02 deploy of v2.31 goes out
- 14:09 first customer report: checkout page spinning forever
- 14:11 error rate on /api/checkout hits 38%
- 14:22 on-call pages a second engineer
- 14:31 root cause identified: v2.31 added a database index concurrently, and the migration held a lock on the orders table longer than expected under production write volume. staging has ~1/400th the write volume so this never showed up.
- 14:38 migration cancelled, lock released
- 14:41 error rate back to baseline
- impact: 39 minutes of degraded checkout. 1,140 checkout attempts failed. 812 of those customers retried successfully within the hour. we do not know what happened to the other 328 — they may have retried later, or left. we have not confirmed either way.
- no data loss. no payments were double-charged; we verified this against the payment provider's ledger.
- contributing factor: we have no way to run migrations against production-like write volume before shipping.
- action items are being tracked separately
