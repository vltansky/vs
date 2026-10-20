# mt-reports

Monorepo for Multitan inspection reports.

- `packages/functions` — Firebase Cloud Functions (europe-west1)
- `packages/models` — shared types and prompts
- `packages/reportan-web` — Angular web app (Firebase Hosting)
- `packages/reportan-mobile` — Expo / React Native app

CI lives in `.github/workflows/`. The last 30 days of GitHub Actions job and
step results are exported to `ci/runs-30d.csv` (one row per job, plus one row
per step for `backend-test`). Billed minutes are Linux 2-core, rounded up per job.
