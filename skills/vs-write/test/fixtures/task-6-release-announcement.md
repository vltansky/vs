# Task 6: Release announcement

Write the release announcement. Audience: existing users of the product, read in a changelog page and an email.

Changelog dump for v4.0:
- new: saved views. you can name a filter combination and reuse it. shareable with your team via link.
- new: CSV export on any table, up to 50,000 rows. above that you get a background job and an email.
- changed: the search box now searches inside comments too. previously titles and descriptions only.
- changed: default sort on the dashboard moved from "recently created" to "recently updated". you can change it back in settings.
- fixed: timezone bug where events in the last hour of the day showed on the wrong date for users east of UTC.
- fixed: the bulk-edit dialog silently dropped changes when more than 200 items were selected.
- removed: the legacy v2 API. it was deprecated 14 months ago. calls to it now return 410. migration guide is at /docs/v3-migration.
- known issue: saved views are not yet available on mobile web.
