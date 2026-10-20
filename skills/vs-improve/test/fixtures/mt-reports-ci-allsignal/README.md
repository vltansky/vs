# mt-reports

Monorepo for Multitan inspection reports.

- `packages/functions` — Firebase Cloud Functions (europe-west1)
- `packages/models` — shared types and prompts
- `packages/reportan-web` — Angular web app (Firebase Hosting)
- `packages/reportan-mobile` — Expo / React Native app

CI lives in `.github/workflows/`. The last 30 days of GitHub Actions job and
step results are exported to `ci/runs-30d.csv` (one row per job, plus one row
per step for `backend-test`). Billed minutes are Linux 2-core, rounded up per job.

`changes` (path detection) and the `Install` step are setup, not checks.
Preview does not block merge: it posts the preview channel URL as a PR
comment. `ci/output-usage-30d.csv` has one row per PR for
that comment: whether anyone looked at the output and what it led to.
