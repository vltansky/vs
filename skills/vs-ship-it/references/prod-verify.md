# Merge, deploy, and production check

Read this only for the Production check offer or a yes to it. The offer never
blocks; the watch starts only on a yes.

## Pick the offer (once, before the final message)

1. **No offer, and no lookup,** when the PR has no runtime change: only docs,
   skill text, comments, or tests changed, or CI config that touches none of
   the repo's deploy workflows. A deploy signal never overrides this.
2. **Else find the deploy signal** with the watcher's own definition, so the
   offer and the watch agree:

   ```bash
   python3 <vs-baby-sit>/scripts/watch_pr.py --repo <owner/name> --discover-deploy
   ```

   It prints `signal`, the production `environments`, and the deploy
   `workflows` (name and path). Preview, staging, docs, and draft workflows
   do not count. A change to a listed deploy workflow gets the offer.
3. `signal: true` → the full offer: `Want me to tell you when it's merged and deployed, and check it on production? Reply yes.`
   `signal: false` → the short offer: `Want me to tell you when it's merged? Reply yes.`
   Never guess a deploy path that the command did not find.

## On a yes (now or later in the thread)

Start one fresh-context background agent, the same way as Step 4b. Give it
only: repo, PR number, the signal you found, the PR's Before/After proof, and
this file. No transcript. Do not wait for it. If the host has no subagents,
run the watcher yourself as one background process: a background task in
Claude Code, a background terminal with notify on exit in Cursor, and the
fresh-context watcher in `vs-baby-sit` for Codex. The yes reply names the
deploy signal (environment or workflow name), shows the exact watcher command
below, and says the watch lives only as long as the session.

1. **Wait for merge and deploy** with the `vs-baby-sit` watcher, never a
   `sleep` loop:

   ```bash
   python3 <vs-baby-sit>/scripts/watch_pr.py --repo <owner/name> --pr <N> --until deployed [--deploy-workflow '<regex>']
   # short offer: --until merged --passive
   ```

   The watch is passive: it reports, and it never stops for CI, review, or
   approval, and never merges. It polls every 60 s (5 min while merge-ready)
   and exits once with `terminal`: `merged`, `closed`, `deployed`,
   `deploy-failed`, `deploy-stalled` (a deploy still pending after
   `--deploy-wait`, default 1 h), or `no-deploy-signal` (no deploy for the
   merge commit within that wait). Cancelled and superseded runs do not count
   as failures. The snapshot carries the merge sha
   and the deployment or workflow runs with time and URL.
2. **Check production** only after `deployed`. Derive one read-only smoke
   check from the PR's After proof, against the production URL (deployment
   `environment_url`, else the repo's docs or `homepage`; none found → say so):
   - UI: `record-flow.mjs` with the After flow and the production `url`,
     `--no-video`; only steps that do not write data.
   - Endpoint: the PR's request only when it is GET or HEAD; compare the
     response with After. Any other method: not checked.
   - CLI or package: install the published version and run only a read-only
     command (`--version`, `--help`, or an After command that reads and writes
     nothing). Anything else: not checked.
   Never send a write, payment, or message on production for the check. When
   no read-only check fits, report `not checked` with the reason.
3. **Report** once, in plain words:

   ```markdown
   - Merged: <short sha> at <time, user's zone>
   - Deployed: <signal> <short sha> at <time> (<run or environment URL>)
   - Production: verified — <screenshot path or response line> | failed — <exact difference> | not checked — <reason>
   ```

   `deploy-failed` names the failed run and its URL. `no-deploy-signal` says
   no deploy was seen; it does not claim the change is live.
